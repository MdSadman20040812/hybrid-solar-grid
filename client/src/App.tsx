import { useEffect, useMemo, useState } from 'react';
import type { ActiveSource, ZoneKey } from '../../shared/protocol.js';
import { useMiniGridSocket } from './hooks/useMiniGridSocket';
import { formatAge, formatCurrency, formatNumber, formatTime } from './utils/format';
import { activeSourceBreakdown, batteryStateOfCharge, sessionEconomics } from './utils/derived';
import { TrendChart } from './components/TrendChart';
import { ZoneControl } from './components/ZoneControl';
import { MiniatureCity } from './components/MiniatureCity';
import { Esp32BridgeGuide } from './components/Esp32BridgeGuide';
import { Sparkline } from './components/Sparkline';
import { Gauge } from './components/Gauge';
import { EnergyMixDonut } from './components/EnergyMixDonut';
import { KpiTicker } from './components/KpiTicker';
import { EconomicsPanel } from './components/EconomicsPanel';
import { CommandPalette } from './components/CommandPalette';
import { EngineeringHUD } from './components/EngineeringHUD';
import { SavingsTrajectory } from './components/SavingsTrajectory';
import { KpiTile } from './components/KpiTile';
import {
  ActivityIcon,
  AlertIcon,
  BatteryIcon,
  GridIcon,
  InfoIcon,
  LeafIcon,
  LockIcon,
  SearchIcon,
  ShieldIcon,
  SignalIcon,
  SparkIcon,
  SunIcon,
  TrendIcon
} from './components/Icons';

type TabId = 'overview' | 'simulator' | 'ai' | 'developer';

const ZONE_DETAILS: Record<ZoneKey, { label: string; description: string }> = {
  zone1: { label: 'Priority load', description: 'Critical lighting or essential circuit' },
  zone2: { label: 'Community zone', description: 'Shared area or service circuit' },
  zone3: { label: 'Utility load', description: 'Pump, fan, or productive appliance' },
  zone4: { label: 'Street line', description: 'Outdoor or perimeter lighting' },
  zone5: { label: 'Reserve output', description: 'Flexible expansion circuit' }
};

function sourceIcon(source: ActiveSource) {
  if (source === 'SOLAR') return <SunIcon />;
  if (source === 'BATTERY') return <BatteryIcon />;
  return <GridIcon />;
}

function sourceMessage(source: ActiveSource): string {
  if (source === 'SOLAR') return 'Direct solar energy is carrying the active load.';
  if (source === 'BATTERY') return 'Stored energy is maintaining continuity without grid input.';
  if (source === 'GRID') return 'Grid backup is maintaining the load while renewable supply is limited.';
  return 'A reliable active source has not been confirmed yet.';
}

function connectionLabel(state: ReturnType<typeof useMiniGridSocket>['connectionState'], hardwareConnected: boolean, stale: boolean): string {
  if (state === 'AUTH_REQUIRED') return 'Access required';
  if (state === 'RECONNECTING') return 'Reconnecting';
  if (state !== 'CONNECTED') return 'Server offline';
  if (!hardwareConnected) return 'Hardware waiting';
  if (stale) return 'Telemetry stale';
  return 'System live';
}

function AuthDialog({ onSubmit }: { onSubmit: (token: string) => void }) {
  const [token, setToken] = useState('');
  return (
    <div className="auth-overlay" role="presentation">
      <form className="auth-dialog" onSubmit={(event) => { event.preventDefault(); if (token.trim()) onSubmit(token); }}>
        <div className="auth-icon"><LockIcon /></div>
        <span className="eyebrow">Protected local console</span>
        <h1>Enter dashboard access key</h1>
        <p>This server requires a local access token. The key remains in this browser session and is never added to the application bundle.</p>
        <label htmlFor="access-token">Access key</label>
        <input id="access-token" type="password" autoComplete="current-password" value={token} onChange={(event) => setToken(event.target.value)} autoFocus />
        <button className="primary-button" type="submit" disabled={!token.trim()}>Unlock dashboard</button>
      </form>
    </div>
  );
}

function formatTapeCounter(totalSeconds: number) {
  const hrs = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const mins = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const secs = (totalSeconds % 60).toString().padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

export function App() {
  const {
    snapshot,
    publicConfig,
    connectionState,
    commandFeedback,
    sendZoneCommand,
    authenticate,
    clearFeedback,
    events,
    packetsPerMinute,
    lastSeenAt,
    protocolVersion
  } = useMiniGridSocket();
  const [clock, setClock] = useState(0);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sessionStartedAt] = useState<number>(() => Date.now());
  const [tutorialStep, setTutorialStep] = useState<number>(() => {
    const visited = localStorage.getItem('miniGridTutorialVisited');
    return visited ? 0 : 1;
  });
  const [localZones, setLocalZones] = useState<Record<ZoneKey, boolean>>({
    zone1: false,
    zone2: false,
    zone3: false,
    zone4: false,
    zone5: false,
  });

  const telemetry = snapshot?.telemetry;

  useEffect(() => {
    if (telemetry?.zones) {
      setLocalZones({
        zone1: telemetry.zones.zone1,
        zone2: telemetry.zones.zone2,
        zone3: telemetry.zones.zone3,
        zone4: telemetry.zones.zone4,
        zone5: telemetry.zones.zone5,
      });
    }
  }, [telemetry?.zones]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!commandFeedback) return;
    const timer = window.setTimeout(clearFeedback, 4200);
    return () => window.clearTimeout(timer);
  }, [clearFeedback, commandFeedback]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const isModifier = event.metaKey || event.ctrlKey;
      if (isModifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((value) => !value);
        return;
      }
      if (event.key === 'Escape') setPaletteOpen(false);
      if (!isModifier) {
        if (event.key === 'g') setActiveTab('overview');
        if (event.key === 's') setActiveTab('simulator');
        if (event.key === 'a') setActiveTab('ai');
        if (event.key === 'd') setActiveTab('developer');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const batterySoc = batteryStateOfCharge(telemetry?.voltages.battery);
  const batteryTone: 'normal' | 'warn' | 'trip' = telemetry?.status.overChargeTrip || telemetry?.status.overDischargeTrip
    ? 'trip'
    : (telemetry?.voltages.battery ?? 0) >= 14 || (telemetry?.voltages.battery ?? 0) <= 10.8
      ? 'warn'
      : 'normal';

  const derived = snapshot?.derived;
  const hardware = snapshot?.hardware;

  const sessionCurrency = derived?.currencyCode ?? publicConfig?.currencyCode ?? 'BDT';
  const economics = useMemo(
    () => sessionEconomics(snapshot?.history ?? [], derived, sessionCurrency),
    [snapshot?.history, derived, sessionCurrency]
  );
  const mixShares = useMemo(
    () => activeSourceBreakdown(snapshot?.history ?? []),
    [snapshot?.history]
  );
  const loadHistory = useMemo(() => (snapshot?.history ?? []).map((point) => point.loadPowerW), [snapshot?.history]);
  const solarHistory = useMemo(() => (snapshot?.history ?? []).map((point) => point.solarPowerW), [snapshot?.history]);
  const activeSource = telemetry?.status.activeSource ?? 'UNKNOWN';
  const connected = connectionState === 'CONNECTED' && Boolean(hardware?.connected);
  const stale = hardware?.telemetryStale ?? true;
  const protectionActive = snapshot?.protectionLockout ?? false;
  
  // The simulation is runnable even when offline. Only disable controls if physical lockout protection is active.
  const controlsDisabled = protectionActive;
  const disabledReason = 'Locked by physical battery protection';
  
  const handleZoneToggle = (zone: ZoneKey, desiredState: boolean) => {
    setLocalZones((prev) => ({ ...prev, [zone]: desiredState }));
    sendZoneCommand(zone, desiredState);
  };

  const pendingByZone = useMemo(() => new Set(snapshot?.pendingCommands.map((item) => item.zone) ?? []), [snapshot?.pendingCommands]);
  const sourceEfficiency = activeSource === 'SOLAR'
    ? 'Renewable-first operation'
    : activeSource === 'BATTERY'
      ? 'Resilient backup operation'
      : activeSource === 'GRID'
        ? 'Grid support active'
        : 'Source verification pending';

  if (connectionState === 'AUTH_REQUIRED') return <AuthDialog onSubmit={authenticate} />;

  return (
    <main className="app-shell">
      <div className="vhs-scanlines" />
      <div className="vhs-noise" />
      
      <div className="vhs-vcr-hud">
        <div className="vhs-vcr-left">
          <span className="vhs-hud-badge vhs-kinetic-hover">PLAY ▶</span>
          <span className="vhs-hud-badge">SP</span>
        </div>
        <div className="vhs-vcr-center">
          <span className="vhs-clock">T-120</span>
        </div>
        <div className="vhs-vcr-right">
          <button 
            type="button" 
            className="vhs-hud-badge vhs-kinetic-hover" 
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', outline: 'none', marginRight: '8px' }}
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette"
          >
            <SearchIcon style={{ width: 14, height: 14, marginRight: 6, verticalAlign: '-2px' }} />
            ⌘K
          </button>
          <button
            type="button"
            className="vhs-hud-badge vhs-kinetic-hover"
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', outline: 'none', marginRight: '8px' }}
            onClick={() => setTutorialStep(1)}
          >
            📖 HELP GUIDE
          </button>
          <span className="vhs-hud-badge">TRACKING OK</span>
          <span className="vhs-tape-counter">TAPE {formatTapeCounter(clock)}</span>
        </div>
      </div>

      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />

      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><span /><span /><span /></div>
          <div>
            <p className="vhs-kinetic-hover">Project Electronics</p>
            <h1 className="vhs-text-glitch">Hybrid Mini-Grid</h1>
          </div>
        </div>
        <div className="topbar-status">
          {hardware?.simulated && <span className="sim-badge vhs-kinetic-hover">Simulator</span>}
          <div className={`connection-pill connection-pill--${connectionState.toLowerCase()}`}>
            <span className="pulse-dot" />
            <div>
              <strong>{connectionLabel(connectionState, Boolean(hardware?.connected), stale)}</strong>
              <small>{formatAge(hardware?.lastSeenAt ?? null)}</small>
            </div>
          </div>
        </div>
      </header>

      {!connected && (
        <section className="notice-bar" aria-live="polite">
          <SignalIcon />
          <div>
            <strong>{connectionState === 'CONNECTED' ? 'Waiting for the mini-grid' : 'Local service connection is interrupted'}</strong>
            <span>{connectionState === 'CONNECTED' ? 'Start the hardware simulator or connect the authenticated ESP32 client.' : 'The interface will reconnect automatically without losing the last known view.'}</span>
          </div>
        </section>
      )}

      {protectionActive && telemetry && (
        <section className="protection-banner" role="alert">
          <div className="protection-icon"><AlertIcon /></div>
          <div>
            <span className="eyebrow">Physical protection activated</span>
            <h2>{telemetry.status.overChargeTrip ? 'Over-charge trip detected' : 'Over-discharge trip detected'}</h2>
            <p>Load controls are locked. Inspect the battery and protection path before restoring normal operation.</p>
          </div>
          <span className="lockout-badge"><LockIcon />Control lockout</span>
        </section>
      )}

      <nav className="toolbar" aria-label="Dashboard Navigation">
        <button type="button" className={`toolbar-btn ${activeTab === 'overview' ? 'is-active' : ''}`} onClick={() => setActiveTab('overview')}>
          <span className="btn-icon">📊</span> Overview
        </button>
        <button type="button" className={`toolbar-btn ${activeTab === 'simulator' ? 'is-active' : ''}`} onClick={() => setActiveTab('simulator')}>
          <span className="btn-icon">🏙️</span> 3D City Simulator
          <span style={{ 
            display: 'inline-block', 
            width: '6px', 
            height: '6px', 
            borderRadius: '50%', 
            marginLeft: '6px',
            background: connected ? '#ffffff' : '#ff453a', 
            boxShadow: connected ? '0 0 6px rgba(255,255,255,0.4)' : '0 0 8px rgba(255,69,58,0.8)' 
          }} />
        </button>
        <button type="button" className={`toolbar-btn ${activeTab === 'ai' ? 'is-active' : ''}`} onClick={() => setActiveTab('ai')}>
          <span className="btn-icon">🧠</span> AI Copilot & Analytics
        </button>
        <button type="button" className={`toolbar-btn ${activeTab === 'developer' ? 'is-active' : ''}`} onClick={() => setActiveTab('developer')}>
          <span className="btn-icon">🔌</span> ESP32 Developer Bridge
        </button>
      </nav>

      <div className="tab-viewport">
        <div className="tab-pane" style={{ display: activeTab === 'overview' ? 'block' : 'none' }}>
          <section className="ticker-strip">
            <KpiTicker
              label="Live load"
              value={derived?.loadPowerW ?? 0}
              digits={1}
              unit="W"
              tone={activeSource === 'GRID' ? 'warn' : 'normal'}
              trend={loadHistory.length > 4 && loadHistory[loadHistory.length - 1]! > loadHistory[loadHistory.length - 5]! ? 'up' : loadHistory.length > 4 ? 'down' : 'flat'}
            />
            <KpiTicker
              label="Solar capture"
              value={derived?.solarPowerW ?? 0}
              digits={1}
              unit="W"
              tone="positive"
              trend={solarHistory.length > 4 && solarHistory[solarHistory.length - 1]! > solarHistory[solarHistory.length - 5]! ? 'up' : solarHistory.length > 4 ? 'down' : 'flat'}
            />
            <KpiTicker
              label="Battery SoC"
              value={batterySoc}
              digits={0}
              unit="%"
              tone={batteryTone === 'trip' ? 'danger' : batteryTone === 'warn' ? 'warn' : 'normal'}
              trend="flat"
            />
            <KpiTicker
              label="Avoided grid"
              value={derived?.estimatedGridEnergyAvoidedKWh ?? 0}
              digits={3}
              unit="kWh"
              tone="positive"
              trend="up"
            />
            <KpiTicker
              label="Avoided cost"
              value={derived?.estimatedGridCostAvoided ?? 0}
              digits={2}
              prefix={derived?.currencyCode ?? publicConfig?.currencyCode ?? 'BDT'}
              tone="positive"
              trend="up"
            />
          </section>

          <EngineeringHUD
            events={events}
            packetsPerMinute={packetsPerMinute}
            connectionState={connectionState}
            lastSeenAt={lastSeenAt ?? hardware?.lastSeenAt ?? null}
            protocolVersion={protocolVersion}
            sessionStartedAt={sessionStartedAt}
          />

          <section className="hero-grid">
            <article className={`source-hero source-hero--${activeSource.toLowerCase()}`}>
              <div className="source-topline">
                <div>
                  <span className="eyebrow">Active energy source</span>
                  <div className="source-title"><span className="source-icon">{sourceIcon(activeSource)}</span><h2>{activeSource}</h2></div>
                </div>
                <span className="quality-badge">{derived?.dataQuality ?? 'UNAVAILABLE'} data</span>
              </div>
              <p className="source-message">{sourceMessage(activeSource)}</p>
              <div className="energy-flow" aria-label={`Energy flow from ${activeSource} to load`}>
                {(['SOLAR', 'BATTERY', 'GRID'] as ActiveSource[]).map((source) => (
                  <div key={source} className={`energy-node ${activeSource === source ? 'energy-node--active' : ''}`}>
                    {sourceIcon(source)}<span>{source}</span>
                  </div>
                ))}
                <div className="flow-rail"><span className={connected && activeSource !== 'UNKNOWN' ? 'flow-particle' : ''} /></div>
                <div className="energy-node energy-node--load"><ActivityIcon /><span>LOAD</span></div>
              </div>
              <div className="source-footer">
                <span>{sourceEfficiency}</span>
                <span>{formatNumber(derived?.loadPowerW ?? 0, 1)} W live demand</span>
              </div>
            </article>

            <article className="commercial-card">
              <div className="card-head">
                <div className="icon-box"><SparkIcon /></div>
                <div><span className="eyebrow">Commercial impact</span><h2>Estimated savings</h2></div>
              </div>
              <div className="savings-value">{formatCurrency(derived?.estimatedGridCostAvoided ?? 0, derived?.currencyCode ?? publicConfig?.currencyCode ?? 'BDT')}</div>
              <p className="muted">Direct solar energy converted into estimated avoided grid cost.</p>
              <div className="commercial-stats">
                <div><span>Avoided energy</span><strong>{formatNumber(derived?.estimatedGridEnergyAvoidedKWh ?? 0, 4)} kWh</strong></div>
                <div><span>Solar runtime</span><strong>{formatNumber(derived?.solarUtilizationPercent ?? 0, 1)}%</strong></div>
                <div><span>Monthly run-rate</span><strong>{(derived?.projectedMonthlySavings ?? 0) > 0 ? formatCurrency(derived?.projectedMonthlySavings ?? 0, derived?.currencyCode ?? 'BDT') : 'Calibrating'}</strong></div>
              </div>
              <div className="estimate-note"><InfoIcon />Estimate uses {formatNumber(derived?.tariffPerKWh ?? 0, 2)} {derived?.currencyCode ?? 'BDT'}/kWh and is not a utility-grade bill.</div>
            </article>
          </section>

          <section className="metric-grid" aria-label="Live electrical measurements">
            <article className="metric-card">
              <span>Load power</span><strong>{formatNumber(derived?.loadPowerW ?? 0, 1)} <small>W</small></strong>
              <p>{formatNumber(telemetry?.voltages.load ?? 0, 2)} V · {formatNumber(telemetry?.currents.load ?? 0, 2)} A</p>
            </article>
            <article className="metric-card">
              <span>Solar generation</span><strong>{formatNumber(derived?.solarPowerW ?? 0, 1)} <small>W</small></strong>
              <p>{formatNumber(telemetry?.voltages.solar ?? 0, 2)} V · {formatNumber(telemetry?.currents.solar ?? 0, 2)} A</p>
            </article>
            <article className="metric-card">
              <span>Battery voltage</span><strong>{formatNumber(telemetry?.voltages.battery ?? 0, 2)} <small>V</small></strong>
              <p>{telemetry?.status.overChargeTrip || telemetry?.status.overDischargeTrip ? 'Protection intervention active' : 'Protection path normal'}</p>
            </article>
            <article className="metric-card">
              <span>Grid reference</span><strong>{formatNumber(telemetry?.voltages.grid ?? 0, 2)} <small>V</small></strong>
              <p>{activeSource === 'GRID' ? 'Currently supporting load' : 'Available as backup reference'}</p>
            </article>
          </section>

          <section className="elevation-grid">
            <article className="elevation-card">
              <div className="card-head">
                <div className="icon-box"><ActivityIcon /></div>
                <div><span className="eyebrow">Source allocation</span><h2>Live energy mix</h2></div>
              </div>
              <div className="elevation-flex">
                <EnergyMixDonut shares={mixShares} liveSource={activeSource} />
                <Gauge
                  value={batterySoc}
                  max={100}
                  label="Battery state-of-charge"
                  unit="%"
                  tone={batteryTone}
                />
              </div>
              <p className="muted" style={{ marginTop: '12px' }}>
                SoC is a software projection between {`10.5V`} and {`14.4V`} — not a meter reading.
              </p>
            </article>

            <article className="elevation-card elevation-card--wide">
              <div className="card-head">
                <div className="icon-box"><TrendIcon /></div>
                <div><span className="eyebrow">Live sparkline telemetry</span><h2>Continuous power streams</h2></div>
              </div>
              <div className="kpi-tile-grid">
                <KpiTile
                  label="Load demand"
                  value={formatNumber(derived?.loadPowerW ?? 0, 1)}
                  unit="W"
                  caption={`${formatNumber(telemetry?.voltages.load ?? 0, 2)} V load bus`}
                  history={loadHistory}
                  tone={activeSource === 'GRID' ? 'warn' : 'normal'}
                />
                <KpiTile
                  label="Solar harvest"
                  value={formatNumber(derived?.solarPowerW ?? 0, 1)}
                  unit="W"
                  caption={`${formatNumber(telemetry?.voltages.solar ?? 0, 2)} V solar bus`}
                  history={solarHistory}
                  tone="positive"
                  glyph={<LeafIcon />}
                />
                <KpiTile
                  label="Battery SoC"
                  value={`${batterySoc.toFixed(0)}`}
                  unit="%"
                  caption={`${formatNumber(telemetry?.voltages.battery ?? 0, 2)} V bus`}
                  history={(snapshot?.history ?? []).map((point) => point.batteryVoltage)}
                  tone={batteryTone === 'trip' ? 'danger' : batteryTone === 'warn' ? 'warn' : 'normal'}
                />
                <KpiTile
                  label="Solar utilization"
                  value={`${formatNumber(derived?.solarUtilizationPercent ?? 0, 1)}`}
                  unit="%"
                  caption="live session"
                  history={solarHistory.map((value, index) => value && loadHistory[index] ? (value / Math.max(value, loadHistory[index]!)) * 100 : 0)}
                  tone="positive"
                />
              </div>
            </article>
          </section>

          <SavingsTrajectory
            history={snapshot?.history ?? []}
            derived={derived}
            currencyCode={sessionCurrency}
          />

          <EconomicsPanel
            history={snapshot?.history ?? []}
            derived={derived}
            currencyCode={sessionCurrency}
          />
        </div>

        <div className="tab-pane" style={{ display: activeTab === 'simulator' ? 'block' : 'none' }}>
          <section className="control-section control-city-split">
            <div className="control-left">
              <div className="section-heading">
                <div><span className="eyebrow">Five-zone switching</span><h2>Load control</h2></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    display: 'inline-block',
                    width: '9px',
                    height: '9px',
                    borderRadius: '50%',
                    background: connected ? '#ffffff' : '#ff453a',
                    boxShadow: connected ? '0 0 6px rgba(255,255,255,0.4)' : '0 0 8px rgba(255,69,58,0.8)'
                  }} />
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: connected ? '#aeaeae' : '#ff453a' }}>
                    Hardware {connected ? 'Connected' : 'Offline'}
                  </span>
                </div>
              </div>
              <div className="zone-vertical-list">
                {(Object.keys(ZONE_DETAILS) as ZoneKey[]).map((zone) => (
                  <ZoneControl
                    key={zone}
                    zone={zone}
                    label={ZONE_DETAILS[zone].label}
                    description={ZONE_DETAILS[zone].description}
                    active={localZones[zone]}
                    pending={pendingByZone.has(zone)}
                    disabled={controlsDisabled}
                    disabledReason={disabledReason}
                    onToggle={handleZoneToggle}
                  />
                ))}
              </div>
            </div>
            <div className="control-right">
              <div className="section-heading">
                <div><span className="eyebrow">Scale Model Simulation</span><h2>Miniature City Prototype</h2></div>
              </div>
              <MiniatureCity zones={localZones} />
            </div>
          </section>
        </div>

        <div className="tab-pane" style={{ display: activeTab === 'ai' ? 'block' : 'none' }}>
          <section className="lower-grid">
            <TrendChart points={snapshot?.history ?? []} />

            <article className={`insight-card insight-card--${(snapshot?.aiInsight?.severity ?? 'INFO').toLowerCase()}`}>
              <div className="card-head">
                <div className="icon-box"><SparkIcon /></div>
                <div><span className="eyebrow">Advisory intelligence</span><h2>{snapshot?.aiInsight?.title ?? 'Preparing system insight'}</h2></div>
              </div>
              <p className="insight-message">{snapshot?.aiInsight?.message ?? 'A verified insight will appear after fresh telemetry is available.'}</p>
              <div className="recommendation">
                <span>Recommended response</span>
                <strong>{snapshot?.aiInsight?.recommendedAction ?? 'Connect hardware or run the simulator.'}</strong>
              </div>
              <div className="insight-meta">
                <span>{snapshot?.aiInsight?.source === 'CEREBRAS' ? 'Cerebras advisory' : 'Deterministic local advisory'}</span>
                <span>{snapshot?.aiInsight?.confidence ?? 'HIGH'} confidence</span>
              </div>
            </article>
          </section>
        </div>

        <div className="tab-pane" style={{ display: activeTab === 'developer' ? 'block' : 'none' }}>
          <section className="trust-grid">
            <article className="trust-card">
              <div className="trust-icon"><LockIcon /></div>
              <div><span className="eyebrow">Security posture</span><h3>Local-first by design</h3><p>Secrets remain server-side, messages are schema-validated, origins are restricted, and commands target only five allowlisted zones.</p></div>
            </article>
            <article className="trust-card">
              <div className="trust-icon"><ShieldIcon /></div>
              <div><span className="eyebrow">Protection integrity</span><h3>Hardware remains authoritative</h3><p>Software never bypasses physical protection. Trips create an immediate control lockout independent of AI.</p></div>
            </article>
            <article className="trust-card">
              <div className="trust-icon"><ActivityIcon /></div>
              <div><span className="eyebrow">Lean architecture</span><h3>No unnecessary bloat</h3><p>In-memory telemetry, native SVG charts, and a focused WebSocket broker keep deployment fast and maintainable.</p></div>
            </article>
          </section>

          <Esp32BridgeGuide />
        </div>
      </div>

      <footer className="footer">
        <div><strong>Hybrid Mini-Grid Control Interface</strong><span>Protocol 1.0 · App {publicConfig?.version ?? '1.0.0'}</span></div>
        <div><span>Last packet {formatTime(hardware?.lastSeenAt ?? null)}</span><span>AI {publicConfig?.aiEnabled ? 'enabled' : 'local fallback'}</span></div>
      </footer>

      {commandFeedback && (
        <div className={`toast ${commandFeedback.success ? 'toast--success' : 'toast--error'}`} role="status" aria-live="polite">
          {commandFeedback.success ? <ShieldIcon /> : <AlertIcon />}
          <div><strong>{commandFeedback.success ? 'Zone command confirmed' : 'Zone command failed'}</strong><span>{commandFeedback.success ? `${ZONE_DETAILS[commandFeedback.zone].label} updated by hardware.` : (commandFeedback.reason ?? 'The hardware did not confirm the command.')}</span></div>
          <button type="button" onClick={clearFeedback} aria-label="Dismiss notification">×</button>
        </div>
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        zones={localZones}
        pendingZones={pendingByZone}
        onToggleZone={handleZoneToggle}
        protectionActive={protectionActive}
        restartTutorial={() => setTutorialStep(1)}
      />

      {tutorialStep > 0 && (() => {
        const steps = [
          {
            title: "1. Smart Mini-Grid Overview",
            desc: "This dashboard displays real-time telemetry from a physical micro-grid (solar panels, battery banks, and the utility grid) to help balance generation and consumption.",
            tip: "Check the energy flow diagram on the main page to see where power is currently routing."
          },
          {
            title: "2. The Connection Status",
            desc: "The connection pill on the right shows if your browser is communicating with the local server, and if the physical ESP32 hardware is connected.",
            tip: "A white status dot indicates the link is live; a red status dot indicates hardware is offline."
          },
          {
            title: "3. 3D Miniature City Simulation",
            desc: "The 3D City Simulator tab contains a 3D isometric scale model of your micro-grid's loads. It allows you to toggle 5 distinct power zones: Priority load (Z1), Community zone (Z2), Utility load (Z3), Street line (Z4), and Reserve output (Z5).",
            tip: "Each zone illuminates the 3D model in a unique color (Cyan, Amber, Violet, Lime, Crimson) and is runnable even when the hardware is offline!"
          },
          {
            title: "4. AI Copilot & Safety Lockout",
            desc: "The AI Copilot tab uses Cerebras AI inference to monitor telemetry and generate action advisories. For security and physical safety, a hardware lockout system overrides commands if battery limits are breached.",
            tip: "You cannot toggle loads while the safety lockout is active. The lockout badge will turn red during trips."
          },
          {
            title: "5. ESP32 Developer Bridge",
            desc: "Under the Developer Bridge tab, you will find instructions and a pre-configured C++ code block. Copy and flash this to your ESP32 board to link the local dashboard server directly to your physical relay prototype.",
            tip: "The bridge works like an API to route dashboard commands to physical outputs."
          }
        ];

        const current = steps[tutorialStep - 1] as { title: string; desc: string; tip: string };

        return (
          <div className="auth-overlay" style={{ zIndex: 100000 }} role="dialog" aria-modal="true">
            <div className="auth-dialog" style={{ width: 'min(480px, 95vw)', padding: '28px', position: 'relative' }}>
              <div className="auth-icon" style={{ fontSize: '24px' }}>💡</div>
              <span className="eyebrow">Interactive Console Guide</span>
              <h2 style={{ margin: '8px 0 12px', fontSize: '20px', color: '#ffffff' }}>{current.title}</h2>
              <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#aeaeae', margin: '0 0 16px' }}>{current.desc}</p>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '12px', marginBottom: '24px' }}>
                <span style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: '#8e8e93', marginBottom: '4px' }}>Pro Tip</span>
                <span style={{ fontSize: '12px', color: '#d1d1d6' }}>{current.tip}</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '12px', color: '#8e8e93', fontWeight: 'bold' }}>
                  Step {tutorialStep} of {steps.length}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                  {tutorialStep > 1 && (
                    <button 
                      type="button" 
                      className="primary-button" 
                      style={{ background: 'transparent', color: '#ffffff', border: '1.5px solid rgba(255,255,255,0.18)', width: 'auto', marginTop: 0, padding: '8px 16px' }}
                      onClick={() => setTutorialStep(prev => prev - 1)}
                    >
                      Back
                    </button>
                  )}
                  <button 
                    type="button" 
                    className="primary-button" 
                    style={{ width: 'auto', marginTop: 0, padding: '8px 16px' }}
                    onClick={() => {
                      if (tutorialStep < steps.length) {
                        setTutorialStep(prev => prev + 1);
                      } else {
                        localStorage.setItem('miniGridTutorialVisited', 'true');
                        setTutorialStep(0);
                      }
                    }}
                  >
                    {tutorialStep === steps.length ? "Finish Tour" : "Next"}
                  </button>
                </div>
              </div>
              
              <button 
                type="button" 
                style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 0, color: '#8e8e93', fontSize: '18px', cursor: 'pointer' }}
                onClick={() => {
                  localStorage.setItem('miniGridTutorialVisited', 'true');
                  setTutorialStep(0);
                }}
                aria-label="Skip Tutorial"
              >
                ×
              </button>
            </div>
          </div>
        );
      })()}
    </main>
  );
}

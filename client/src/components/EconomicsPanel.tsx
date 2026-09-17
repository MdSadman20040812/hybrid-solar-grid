import type { DerivedMetrics, TelemetryPoint } from '../../../shared/protocol.js';
import { GRID_KG_CO2_PER_KWH, sessionEconomics } from '../utils/derived';
import { formatNumber, formatCurrency } from '../utils/format';
import { Sparkline } from './Sparkline';
import { LeafIcon, TrendIcon } from './Icons';

interface EconomicsPanelProps {
  history: TelemetryPoint[];
  derived: DerivedMetrics | null | undefined;
  currencyCode: string;
}

export function EconomicsPanel({ history, derived, currencyCode }: EconomicsPanelProps) {
  const econ = sessionEconomics(history, derived, currencyCode);
  const pace = history.length > 1
    ? history.slice(-20).reduce((acc, point) => acc + (point.solarPowerW - point.loadPowerW), 0) / Math.max(1, history.slice(-20).length)
    : 0;
  const lifetimeProjection = (derived?.projectedMonthlySavings ?? 0) * 12 * 5; // 5 year forward outlook
  const paybackMonths = (() => {
    if (!derived || derived.projectedMonthlySavings <= 0) return null;
    const systemCost = 65000; // Software-only illustrative BDT figure for the engineering readout.
    return Math.ceil(systemCost / derived.projectedMonthlySavings);
  })();
  const sparkData = history.slice(-40).map((p) => p.solarPowerW);

  return (
    <article className="economics-panel">
      <header className="card-head">
        <div className="icon-box icon-box--green"><LeafIcon /></div>
        <div>
          <span className="eyebrow">Engineering economics</span>
          <h2>Sustainability &amp; ROI</h2>
        </div>
      </header>
      <div className="economics-grid">
        <div className="economics-stat">
          <span>CO₂ avoided</span>
          <strong>{formatNumber(econ.co2AvoidedKg, 3)} <small>kg</small></strong>
          <small className="economics-sub">at {GRID_KG_CO2_PER_KWH} kg/kWh grid mix</small>
        </div>
        <div className="economics-stat">
          <span>Solar kWh this session</span>
          <strong>{formatNumber(econ.directSolarEnergyKWh, 4)} <small>kWh</small></strong>
          <small className="economics-sub">Direct solar only — battery attribution is conservative.</small>
        </div>
        <div className="economics-stat">
          <span>Payback window</span>
          <strong>{paybackMonths ? `${paybackMonths} mo` : '—'}</strong>
          <small className="economics-sub">Indicative; uses indicative BDT 65k hardware baseline.</small>
        </div>
        <div className="economics-stat">
          <span>5-year projection</span>
          <strong>{formatCurrency(lifetimeProjection, currencyCode)}</strong>
          <small className="economics-sub">Forward look at current run-rate.</small>
        </div>
      </div>
      <div className="economics-spark">
        <div className="economics-spark-head">
          <span><TrendIcon /> Solar generation trend</span>
          <em>{pace >= 0 ? 'Net positive' : 'Net drawing'} · {formatNumber(Math.abs(pace), 1)} W</em>
        </div>
        <Sparkline
          values={sparkData}
          width={420}
          height={56}
          stroke="#5ac8fa"
          fill="rgba(90, 200, 250, 0.18)"
        />
      </div>
    </article>
  );
}
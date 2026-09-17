import { formatAge, formatTime } from '../utils/format';
import { ActivityIcon, ClockIcon, SignalIcon } from './Icons';
import type { ConnectionState } from '../hooks/useMiniGridSocket';

export interface ProtocolEvent {
  id: string;
  type: string;
  detail: string;
  at: number;
}

interface EngineeringHUDProps {
  events: ProtocolEvent[];
  packetsPerMinute: number;
  connectionState: ConnectionState;
  lastSeenAt: number | null;
  protocolVersion: string;
  sessionStartedAt: number;
}

function severityLabel(type: string) {
  if (type.includes('ACK') || type.includes('SUCCESS')) return 'OK';
  if (type.includes('PENDING') || type.includes('SNAPSHOT')) return 'INFO';
  if (type.includes('ERROR') || type.includes('REJECT')) return 'WARN';
  return 'EVT';
}

export function EngineeringHUD({
  events,
  packetsPerMinute,
  connectionState,
  lastSeenAt,
  protocolVersion,
  sessionStartedAt
}: EngineeringHUDProps) {
  const sessionSeconds = Math.floor((Date.now() - sessionStartedAt) / 1000);
  const sessionLabel = (() => {
    const h = Math.floor(sessionSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((sessionSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(sessionSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  })();

  return (
    <article className="engineering-hud">
      <header className="card-head">
        <div className="icon-box icon-box--violet"><ActivityIcon /></div>
        <div>
          <span className="eyebrow">Engineering HUD</span>
          <h2>Protocol telemetry</h2>
        </div>
      </header>
      <div className="hud-grid">
        <div className="hud-cell">
          <SignalIcon />
          <div>
            <span>Connection</span>
            <strong>{connectionState.replace('_', ' ').toLowerCase()}</strong>
          </div>
        </div>
        <div className="hud-cell">
          <ClockIcon />
          <div>
            <span>Last packet</span>
            <strong>{formatAge(lastSeenAt)}</strong>
          </div>
        </div>
        <div className="hud-cell">
          <span className="hud-cell-icon">📡</span>
          <div>
            <span>Packets / min</span>
            <strong>{packetsPerMinute.toFixed(1)}</strong>
          </div>
        </div>
        <div className="hud-cell">
          <span className="hud-cell-icon">🛰️</span>
          <div>
            <span>Protocol</span>
            <strong>v{protocolVersion}</strong>
          </div>
        </div>
        <div className="hud-cell hud-cell--wide">
          <span className="hud-cell-icon">⏱️</span>
          <div>
            <span>Session uptime</span>
            <strong>{sessionLabel}</strong>
          </div>
        </div>
      </div>
      <div className="hud-log">
        <div className="hud-log-head">
          <span>Live protocol event stream</span>
          <em>Last {events.length} messages</em>
        </div>
        <ul className="hud-log-list">
          {events.length === 0 && <li className="hud-log-empty">Awaiting first protocol message…</li>}
          {events.slice(0, 8).map((event) => (
            <li key={event.id}>
              <span className={`hud-log-tag hud-log-tag--${severityLabel(event.type).toLowerCase()}`}>{severityLabel(event.type)}</span>
              <strong>{event.type}</strong>
              <span className="hud-log-detail">{event.detail}</span>
              <em>{formatTime(event.at)}</em>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
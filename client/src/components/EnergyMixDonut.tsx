import type { ActiveSource } from '../../../shared/protocol.js';
import type { ActiveSourceShare } from '../utils/derived';

interface EnergyMixDonutProps {
  shares: ActiveSourceShare[];
  liveSource: ActiveSource;
}

const TONE: Record<ActiveSource, string> = {
  SOLAR: '#5ac8fa',
  BATTERY: '#bf5af2',
  GRID: '#ffd60a',
  UNKNOWN: '#6e6e73'
};

export function EnergyMixDonut({ shares, liveSource }: EnergyMixDonutProps) {
  const size = 184;
  const radius = 70;
  const stroke = 16;
  const circumference = 2 * Math.PI * radius;
  const total = shares.reduce((sum, item) => sum + item.share, 0);
  let offset = 0;

  return (
    <div className="mix-donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Session energy mix">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
        {shares.map((share) => {
          if (share.share <= 0) return null;
          const dash = (share.share / Math.max(0.0001, total)) * circumference;
          const node = (
            <circle
              key={share.source}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={TONE[share.source]}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              strokeLinecap="butt"
              style={{ transition: 'stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease' }}
            />
          );
          offset += dash;
          return node;
        })}
        <circle cx={size / 2} cy={size / 2} r={radius - stroke} fill="#06060a" />
        <text x={size / 2} y={size / 2 - 8} textAnchor="middle" className="mix-donut-eyebrow">LIVE</text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" className="mix-donut-value">{liveSource}</text>
      </svg>
      <ul className="mix-legend">
        {shares.map((share) => (
          <li key={share.source}>
            <i className="mix-dot" style={{ background: TONE[share.source] }} />
            <div>
              <strong>{share.label}</strong>
              <span>{(share.share * 100).toFixed(1)}% of session energy</span>
            </div>
          </li>
        ))}
        {shares.length === 0 && <li className="mix-empty">Awaiting telemetry to compute mix.</li>}
      </ul>
    </div>
  );
}
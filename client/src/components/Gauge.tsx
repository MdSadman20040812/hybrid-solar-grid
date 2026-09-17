import { useId } from 'react';

interface GaugeProps {
  value: number; // 0..max
  max?: number;
  label: string;
  unit?: string;
  displayValue?: string;
  tone?: 'normal' | 'warn' | 'trip';
}

export function Gauge({ value, max = 100, label, unit, displayValue, tone = 'normal' }: GaugeProps) {
  const id = useId().replace(/:/g, '');
  const clamped = Math.max(0, Math.min(max, value));
  const ratio = clamped / max;
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * ratio;
  const toneColor =
    tone === 'trip' ? '#ff453a' : tone === 'warn' ? '#ffd60a' : '#5ac8fa';

  return (
    <div className={`gauge gauge--${tone}`}>
      <svg width="148" height="148" viewBox="0 0 148 148" role="img" aria-label={`${label} gauge`}>
        <defs>
          <linearGradient id={`gauge-grad-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={toneColor} stopOpacity="0.95" />
            <stop offset="100%" stopColor={toneColor} stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <circle cx="74" cy="74" r={radius} stroke="rgba(255,255,255,0.07)" strokeWidth="10" fill="none" />
        <circle
          cx="74"
          cy="74"
          r={radius}
          stroke={`url(#gauge-grad-${id})`}
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform="rotate(-90 74 74)"
          style={{ transition: 'stroke-dasharray 0.45s ease' }}
        />
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const angle = -Math.PI / 2 + tick * Math.PI * 2;
          const x1 = 74 + Math.cos(angle) * (radius - 14);
          const y1 = 74 + Math.sin(angle) * (radius - 14);
          const x2 = 74 + Math.cos(angle) * (radius - 8);
          const y2 = 74 + Math.sin(angle) * (radius - 8);
          return <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />;
        })}
      </svg>
      <div className="gauge-readout">
        <strong>{displayValue ?? `${clamped.toFixed(0)}${unit ?? ''}`}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
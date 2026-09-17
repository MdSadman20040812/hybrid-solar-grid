import { useEffect, useRef, useState } from 'react';

interface KpiTickerProps {
  label: string;
  value: number;
  digits?: number;
  unit?: string;
  prefix?: string;
  trend?: 'up' | 'down' | 'flat';
  tone?: 'normal' | 'positive' | 'warn' | 'danger';
}

// Smoothly animates a number between renders so the dashboard feels "alive"
function useAnimatedNumber(target: number, durationMs = 600) {
  const [display, setDisplay] = useState(target);
  const startRef = useRef<number>(target);
  const targetRef = useRef<number>(target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === targetRef.current) return;
    startRef.current = display;
    targetRef.current = target;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = startRef.current + (target - startRef.current) * eased;
      setDisplay(next);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return display;
}

export function KpiTicker({ label, value, digits = 2, unit = '', prefix = '', trend = 'flat', tone = 'normal' }: KpiTickerProps) {
  const animated = useAnimatedNumber(value);
  const formatted = `${prefix}${animated.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}${unit}`;
  return (
    <div className={`kpi-ticker kpi-ticker--${tone}`}>
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{formatted}</strong>
      <span className={`kpi-trend kpi-trend--${trend}`} aria-hidden>
        {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '◆'}
      </span>
    </div>
  );
}
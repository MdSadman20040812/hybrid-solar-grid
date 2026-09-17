import type { ReactNode } from 'react';
import { Sparkline } from './Sparkline';

interface KpiTileProps {
  label: string;
  value: string;
  caption?: string;
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
  tone?: 'normal' | 'positive' | 'warn' | 'danger';
  history?: number[];
  glyph?: ReactNode;
}

export function KpiTile({ label, value, caption, unit, trend = 'flat', tone = 'normal', history, glyph }: KpiTileProps) {
  return (
    <article className={`kpi-tile kpi-tile--${tone}`}>
      <div className="kpi-tile-head">
        <span className="kpi-tile-label">{label}</span>
        {glyph && <span className="kpi-tile-glyph" aria-hidden>{glyph}</span>}
      </div>
      <div className="kpi-tile-value-row">
        <strong>{value}<small>{unit}</small></strong>
        <span className={`kpi-tile-trend kpi-tile-trend--${trend}`}>{trend === 'up' ? '▲' : trend === 'down' ? '▼' : '◆'}</span>
      </div>
      {caption && <p className="kpi-tile-caption">{caption}</p>}
      {history && history.length > 1 && (
        <Sparkline values={history} width={220} height={42} stroke="#5ac8fa" fill="rgba(90, 200, 250, 0.18)" />
      )}
    </article>
  );
}
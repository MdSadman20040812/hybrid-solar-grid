import { useId } from 'react';
import type { TelemetryPoint } from '../../../shared/protocol.js';

interface TrendChartProps {
  points: TelemetryPoint[];
}

function linePath(values: number[], width: number, height: number, min: number, max: number): string {
  if (values.length < 2) return '';
  const range = Math.max(0.001, max - min);
  return values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

export function TrendChart({ points }: TrendChartProps) {
  const gradientId = useId().replace(/:/g, '');
  const recent = points.slice(-80);
  const loadValues = recent.map((point) => point.loadPowerW);
  const solarValues = recent.map((point) => point.solarPowerW);
  const all = [...loadValues, ...solarValues];
  const max = Math.max(10, ...all);
  const min = Math.min(0, ...all);
  const width = 700;
  const height = 190;

  return (
    <div className="chart-shell" aria-label="Recent load and solar power trend">
      <div className="chart-head">
        <div>
          <span className="eyebrow">Live performance</span>
          <h2>Power trend</h2>
        </div>
        <div className="chart-legend" aria-label="Chart legend">
          <span><i className="legend-dot legend-dot--load" />Load</span>
          <span><i className="legend-dot legend-dot--solar" />Solar</span>
        </div>
      </div>
      {recent.length < 2 ? (
        <div className="chart-empty">Waiting for enough telemetry to draw a reliable trend.</div>
      ) : (
        <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img">
          <title>Recent load and solar power in watts</title>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(91, 211, 153, 0.22)" />
              <stop offset="100%" stopColor="rgba(91, 211, 153, 0)" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line key={ratio} x1="0" y1={height * ratio} x2={width} y2={height * ratio} className="chart-grid" />
          ))}
          <path d={linePath(solarValues, width, height, min, max)} className="chart-line chart-line--solar" />
          <path d={linePath(loadValues, width, height, min, max)} className="chart-line chart-line--load" />
          <path d={`${linePath(loadValues, width, height, min, max)} L${width},${height} L0,${height} Z`} fill={`url(#${gradientId})`} opacity=".55" />
        </svg>
      )}
      <div className="chart-axis"><span>Recent</span><span>{max.toFixed(0)} W peak</span><span>Now</span></div>
    </div>
  );
}

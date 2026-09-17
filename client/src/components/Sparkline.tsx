interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
  min?: number;
  max?: number;
  strokeWidth?: number;
}

export function Sparkline({
  values,
  width = 120,
  height = 36,
  stroke = '#ffffff',
  fill = 'rgba(255,255,255,0.12)',
  min,
  max,
  strokeWidth = 1.6
}: SparklineProps) {
  if (values.length < 2) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline sparkline--empty" aria-hidden>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(255,255,255,0.08)" strokeDasharray="2 4" />
      </svg>
    );
  }

  const observedMin = min ?? Math.min(...values);
  const observedMax = max ?? Math.max(...values);
  const range = Math.max(0.0001, observedMax - observedMin);
  const step = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - observedMin) / range) * height;
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width.toFixed(1)},${height.toFixed(1)} L0,${height.toFixed(1)} Z`;
  const last = points[points.length - 1]!;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="sparkline" aria-hidden>
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r={2.4} fill={stroke} />
    </svg>
  );
}
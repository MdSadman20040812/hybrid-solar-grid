import type { DerivedMetrics, TelemetryPoint } from '../../../shared/protocol.js';
import { formatCurrency } from '../utils/format';
import { compactNumber } from '../utils/derived';

interface SavingsTrajectoryProps {
  history: TelemetryPoint[];
  derived: DerivedMetrics | null | undefined;
  currencyCode: string;
}

interface Bin {
  start: number;
  end: number;
  savings: number;
  energyWh: number;
}

function bucket(history: TelemetryPoint[], tariffPerKWh: number, bucketMs = 30_000): Bin[] {
  if (history.length < 2) return [];
  const first = history[0]!;
  const last = history[history.length - 1]!;
  const totalMs = Math.max(bucketMs, last.receivedAt - first.receivedAt);
  const buckets = Math.max(1, Math.ceil(totalMs / bucketMs));
  const bins: Bin[] = Array.from({ length: buckets }, (_, index) => ({
    start: first.receivedAt + index * bucketMs,
    end: first.receivedAt + (index + 1) * bucketMs,
    savings: 0,
    energyWh: 0
  }));
  for (let i = 1; i < history.length; i += 1) {
    const prev = history[i - 1]!;
    const curr = history[i]!;
    const dtHours = Math.max(0, (curr.receivedAt - prev.receivedAt) / 1000 / 3600);
    const binIndex = Math.min(bins.length - 1, Math.floor((curr.receivedAt - first.receivedAt) / bucketMs));
    const bin = bins[binIndex]!;
    if (curr.activeSource === 'SOLAR') {
      bin.energyWh += curr.loadPowerW * dtHours;
    }
  }
  // Approximate cumulative savings using the configured tariff.
  let cumulative = 0;
  for (const bin of bins) {
    cumulative += bin.energyWh * tariffPerKWh / 1000;
    bin.savings = cumulative;
  }
  return bins;
}

export function SavingsTrajectory({ history, derived, currencyCode }: SavingsTrajectoryProps) {
  const bins = bucket(history, derived?.tariffPerKWh ?? 0, 30_000);
  const width = 560;
  const height = 160;
  const maxSavings = Math.max(...bins.map((b) => b.savings), derived?.estimatedGridCostAvoided ?? 0, 0.0001);
  const points = bins.map((bin, index) => {
    const x = (index / Math.max(1, bins.length - 1)) * width;
    const y = height - (bin.savings / maxSavings) * height;
    return [x, y] as const;
  });
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = bins.length > 0 ? `${linePath} L${width},${height} L0,${height} Z` : '';

  const totalEnergy = bins.reduce((acc, bin) => acc + bin.energyWh, 0) / 1000;

  return (
    <article className="savings-trajectory">
      <header className="card-head">
        <div className="icon-box icon-box--amber">📈</div>
        <div>
          <span className="eyebrow">Savings trajectory</span>
          <h2>Cumulative avoided grid cost</h2>
        </div>
      </header>
      {bins.length === 0 ? (
        <div className="savings-trajectory-empty">
          Collecting telemetry to draw your session-long savings curve…
        </div>
      ) : (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} className="trajectory-svg" role="img" aria-label="Cumulative savings trajectory">
            <defs>
              <linearGradient id="savingsArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(90, 200, 250, 0.45)" />
                <stop offset="100%" stopColor="rgba(90, 200, 250, 0)" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((ratio) => (
              <line key={ratio} x1="0" y1={height * ratio} x2={width} y2={height * ratio} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            ))}
            <path d={areaPath} fill="url(#savingsArea)" />
            <path d={linePath} fill="none" stroke="#5ac8fa" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="trajectory-meta">
            <div>
              <span>Current total</span>
              <strong>{formatCurrency(derived?.estimatedGridCostAvoided ?? 0, currencyCode)}</strong>
            </div>
            <div>
              <span>Solar energy</span>
              <strong>{compactNumber(totalEnergy, 3)} kWh</strong>
            </div>
            <div>
              <span>Run-rate (30s)</span>
              <strong>{compactNumber(maxSavings, 2)} {currencyCode}</strong>
            </div>
          </div>
        </>
      )}
    </article>
  );
}
import type { AppConfig } from '../config.js';
import type {
  AiInsight,
  DataQuality,
  DerivedMetrics,
  TelemetryData,
  TelemetryPoint
} from '../../../shared/protocol.js';

const EMPTY_DERIVED = (config: AppConfig): DerivedMetrics => ({
  loadPowerW: 0,
  solarPowerW: 0,
  estimatedGridEnergyAvoidedKWh: 0,
  estimatedGridCostAvoided: 0,
  projectedMonthlySavings: 0,
  estimateWindowMinutes: 0,
  solarUtilizationPercent: 0,
  dataQuality: 'UNAVAILABLE',
  currencyCode: config.currencyCode,
  tariffPerKWh: config.gridTariffPerKwh
});

export class TelemetryStore {
  private telemetry: TelemetryData | null = null;
  private history: TelemetryPoint[] = [];
  private lastReceivedAt: number | null = null;
  private firstReceivedAt: number | null = null;
  private avoidedEnergyKWh = 0;
  private eligibleDurationMs = 0;
  private observedDurationMs = 0;
  private insight: AiInsight | null = null;

  constructor(private readonly config: AppConfig) {}

  ingest(data: TelemetryData, hardwareTimestamp: number, receivedAt = Date.now()): void {
    const loadPowerW = Math.max(0, data.voltages.load * data.currents.load);
    const solarPowerW = Math.max(0, data.voltages.solar * data.currents.solar);

    if (this.lastReceivedAt !== null) {
      const elapsedMs = receivedAt - this.lastReceivedAt;
      const safeElapsedMs = elapsedMs > 0 && elapsedMs <= this.config.telemetryStaleMs ? elapsedMs : 0;
      this.observedDurationMs += safeElapsedMs;
      if (data.status.activeSource === 'SOLAR' && safeElapsedMs > 0) {
        this.eligibleDurationMs += safeElapsedMs;
        this.avoidedEnergyKWh += (loadPowerW * (safeElapsedMs / 3_600_000)) / 1000;
      }
    }

    this.telemetry = structuredClone(data);
    this.lastReceivedAt = receivedAt;
    this.firstReceivedAt ??= receivedAt;
    this.history.push({
      timestamp: hardwareTimestamp,
      receivedAt,
      loadPowerW,
      solarPowerW,
      loadVoltage: data.voltages.load,
      batteryVoltage: data.voltages.battery,
      solarVoltage: data.voltages.solar,
      loadCurrent: data.currents.load,
      activeSource: data.status.activeSource
    });

    if (this.history.length > this.config.telemetryHistoryPoints) {
      this.history.splice(0, this.history.length - this.config.telemetryHistoryPoints);
    }
  }

  getTelemetry(): TelemetryData | null {
    return this.telemetry ? structuredClone(this.telemetry) : null;
  }

  getHistory(): TelemetryPoint[] {
    return this.history.map((point) => ({ ...point }));
  }

  getLastReceivedAt(): number | null {
    return this.lastReceivedAt;
  }

  isStale(now = Date.now()): boolean {
    return this.lastReceivedAt === null || now - this.lastReceivedAt > this.config.telemetryStaleMs;
  }

  getDataQuality(now = Date.now()): DataQuality {
    if (!this.telemetry || this.lastReceivedAt === null) return 'UNAVAILABLE';
    if (this.isStale(now)) return 'STALE';

    const values = [
      ...Object.values(this.telemetry.voltages),
      ...Object.values(this.telemetry.currents)
    ];
    const suspect = values.some((value) => value < 0 || value > 30);
    return suspect ? 'SUSPECT' : 'GOOD';
  }

  getDerived(now = Date.now()): DerivedMetrics {
    if (!this.telemetry) return EMPTY_DERIVED(this.config);

    const loadPowerW = Math.max(0, this.telemetry.voltages.load * this.telemetry.currents.load);
    const solarPowerW = Math.max(0, this.telemetry.voltages.solar * this.telemetry.currents.solar);
    const estimatedGridCostAvoided = this.avoidedEnergyKWh * this.config.gridTariffPerKwh;
    const elapsedMs = this.firstReceivedAt ? Math.max(0, now - this.firstReceivedAt) : 0;
    const projectedMonthlySavings = elapsedMs >= 60_000
      ? (estimatedGridCostAvoided / elapsedMs) * 30 * 24 * 60 * 60 * 1000
      : 0;

    return {
      loadPowerW,
      solarPowerW,
      estimatedGridEnergyAvoidedKWh: this.avoidedEnergyKWh,
      estimatedGridCostAvoided,
      projectedMonthlySavings: Number.isFinite(projectedMonthlySavings) ? projectedMonthlySavings : 0,
      estimateWindowMinutes: Math.round((elapsedMs / 60_000) * 10) / 10,
      solarUtilizationPercent: this.observedDurationMs > 0
        ? Math.round((this.eligibleDurationMs / this.observedDurationMs) * 1000) / 10
        : 0,
      dataQuality: this.getDataQuality(now),
      currencyCode: this.config.currencyCode,
      tariffPerKWh: this.config.gridTariffPerKwh
    };
  }

  setInsight(insight: AiInsight): void {
    this.insight = { ...insight };
  }

  getInsight(): AiInsight | null {
    return this.insight ? { ...this.insight } : null;
  }

  reset(): void {
    this.telemetry = null;
    this.history = [];
    this.lastReceivedAt = null;
    this.firstReceivedAt = null;
    this.avoidedEnergyKWh = 0;
    this.eligibleDurationMs = 0;
    this.observedDurationMs = 0;
    this.insight = null;
  }
}

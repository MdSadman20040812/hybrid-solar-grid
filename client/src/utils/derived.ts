import type {
  ActiveSource,
  DerivedMetrics,
  TelemetryData,
  TelemetryPoint
} from '../../../shared/protocol.js';

// Soft "typical" lead-acid / Li-ion envelope used purely for software estimates.
export const BATTERY_NOMINAL_VOLTAGE = 12;
export const BATTERY_EMPTY_VOLTAGE = 10.5;
export const BATTERY_FULL_VOLTAGE = 14.4;
export const GRID_KG_CO2_PER_KWH = 0.45; // average grid carbon intensity (kg/kWh)

export function batteryStateOfCharge(batteryVoltage: number | null | undefined): number {
  if (batteryVoltage === null || batteryVoltage === undefined || !Number.isFinite(batteryVoltage)) return 0;
  if (batteryVoltage <= 0) return 0;
  const ratio = (batteryVoltage - BATTERY_EMPTY_VOLTAGE) / (BATTERY_FULL_VOLTAGE - BATTERY_EMPTY_VOLTAGE);
  return Math.max(0, Math.min(100, ratio * 100));
}

export function batteryProtectionUrgency(telemetry: TelemetryData | null | undefined): 'NOMINAL' | 'WARN' | 'TRIP' {
  if (!telemetry) return 'NOMINAL';
  if (telemetry.status.overChargeTrip || telemetry.status.overDischargeTrip) return 'TRIP';
  const v = telemetry.voltages.battery;
  if (v >= BATTERY_FULL_VOLTAGE - 0.4 || v <= BATTERY_EMPTY_VOLTAGE + 0.4) return 'WARN';
  return 'NOMINAL';
}

export interface EnergyMix {
  solar: number;
  battery: number;
  grid: number;
}

export function energyMixFromHistory(history: TelemetryPoint[]): EnergyMix {
  let solar = 0;
  let battery = 0;
  let grid = 0;
  for (const point of history) {
    const load = Math.max(0, point.loadPowerW);
    if (point.activeSource === 'SOLAR') solar += load;
    else if (point.activeSource === 'BATTERY') battery += load;
    else if (point.activeSource === 'GRID') grid += load;
  }
  return { solar, battery, grid };
}

export interface SessionEconomics {
  directSolarEnergyKWh: number;
  co2AvoidedKg: number;
  gridTariffSaved: number;
  currencyCode: string;
}

export function sessionEconomics(history: TelemetryPoint[], derived: DerivedMetrics | null | undefined, currencyCode: string): SessionEconomics {
  // Sum energy directly attributed to solar across the local session.
  let energyWh = 0;
  if (history.length > 1) {
    for (let i = 1; i < history.length; i += 1) {
      const prev = history[i - 1]!;
      const curr = history[i]!;
      const dtHours = Math.max(0, (curr.receivedAt - prev.receivedAt) / 1000 / 3600);
      if (curr.activeSource === 'SOLAR') {
        energyWh += curr.loadPowerW * dtHours;
      }
    }
  }
  const directSolarKWh = energyWh / 1000;
  const co2 = directSolarKWh * GRID_KG_CO2_PER_KWH;
  const gridSaved = derived?.estimatedGridCostAvoided ?? 0;
  return {
    directSolarEnergyKWh: directSolarKWh,
    co2AvoidedKg: co2,
    gridTariffSaved: gridSaved,
    currencyCode
  };
}

export function formatCountdown(targetSeconds: number): string {
  if (!Number.isFinite(targetSeconds) || targetSeconds < 0) return '—';
  const h = Math.floor(targetSeconds / 3600);
  const m = Math.floor((targetSeconds % 3600) / 60);
  const s = Math.floor(targetSeconds % 60);
  return [h, m, s].map((v) => v.toString().padStart(2, '0')).join(':');
}

export interface ActiveSourceShare {
  source: ActiveSource;
  label: string;
  share: number; // 0..1
  energyWh: number;
}

export function activeSourceBreakdown(history: TelemetryPoint[]): ActiveSourceShare[] {
  const totals: Record<ActiveSource, number> = { SOLAR: 0, BATTERY: 0, GRID: 0, UNKNOWN: 0 };
  if (history.length < 2) return [];
  for (let i = 1; i < history.length; i += 1) {
    const prev = history[i - 1]!;
    const curr = history[i]!;
    const dtHours = Math.max(0, (curr.receivedAt - prev.receivedAt) / 1000 / 3600);
    const power = Math.max(0, curr.loadPowerW);
    totals[curr.activeSource] += power * dtHours;
  }
  const sum = totals.SOLAR + totals.BATTERY + totals.GRID;
  if (sum <= 0) return [];
  const labelMap: Record<ActiveSource, string> = {
    SOLAR: 'Solar',
    BATTERY: 'Battery',
    GRID: 'Grid',
    UNKNOWN: 'Pending'
  };
  return (['SOLAR', 'BATTERY', 'GRID'] as ActiveSource[]).map((source) => ({
    source,
    label: labelMap[source],
    share: totals[source] / sum,
    energyWh: totals[source]
  }));
}

export function compactNumber(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(digits)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(digits)}k`;
  return value.toFixed(digits);
}
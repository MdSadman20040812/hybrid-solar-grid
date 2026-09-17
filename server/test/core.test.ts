import { describe, expect, it } from 'vitest';
import { config } from '../src/config.js';
import { aiInsightResponseSchema, telemetrySchema } from '../src/schemas.js';
import { parseAiInsight } from '../src/services/cerebrasService.js';
import { TelemetryStore } from '../src/services/telemetryStore.js';
import { PROTOCOL_VERSION, createEmptyZones, type TelemetryData } from '../../shared/protocol.js';

const validData: TelemetryData = {
  voltages: { solar: 13.8, battery: 12.5, grid: 12, load: 12.2 },
  currents: { solar: 1.2, load: 0.8 },
  status: { overChargeTrip: false, overDischargeTrip: false, activeSource: 'SOLAR' },
  zones: createEmptyZones()
};

describe('protocol validation', () => {
  it('accepts a valid telemetry payload', () => {
    const result = telemetrySchema.safeParse({
      type: 'TELEMETRY_UPDATE',
      protocolVersion: PROTOCOL_VERSION,
      timestamp: Date.now(),
      sequence: 1,
      data: validData
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid numeric and source values safely', () => {
    const result = telemetrySchema.safeParse({
      type: 'TELEMETRY_UPDATE',
      protocolVersion: PROTOCOL_VERSION,
      timestamp: Date.now(),
      data: {
        ...validData,
        voltages: { ...validData.voltages, solar: '13.8' },
        status: { ...validData.status, activeSource: 'NUCLEAR' }
      }
    });
    expect(result.success).toBe(false);
  });
});

describe('telemetry and savings engine', () => {
  it('integrates savings only while direct solar carries the load', () => {
    const testConfig = { ...config, gridTariffPerKwh: 10, telemetryHistoryPoints: 3, telemetryStaleMs: 5000 };
    const store = new TelemetryStore(testConfig);
    store.ingest(validData, 1000, 1000);
    store.ingest(validData, 2000, 2000);
    const solarSavings = store.getDerived(2000).estimatedGridCostAvoided;

    const gridData: TelemetryData = {
      ...validData,
      status: { ...validData.status, activeSource: 'GRID' }
    };
    store.ingest(gridData, 3000, 3000);
    expect(store.getDerived(3000).estimatedGridCostAvoided).toBeCloseTo(solarSavings, 8);
    expect(solarSavings).toBeGreaterThan(0);
  });

  it('keeps the trend ring buffer bounded and identifies stale data', () => {
    const testConfig = { ...config, telemetryHistoryPoints: 3, telemetryStaleMs: 1000 };
    const store = new TelemetryStore(testConfig);
    for (let index = 0; index < 8; index += 1) store.ingest(validData, index, 1000 + index * 100);
    expect(store.getHistory()).toHaveLength(3);
    expect(store.getDataQuality(4000)).toBe('STALE');
  });
});

describe('AI advisory parsing', () => {
  it('accepts verified structured output', () => {
    const raw = JSON.stringify({
      severity: 'INFO',
      title: 'Solar stable',
      message: 'Readings are within the recent operating range.',
      recommendedAction: 'Continue monitoring.',
      confidence: 'MEDIUM'
    });
    expect(aiInsightResponseSchema.safeParse(JSON.parse(raw)).success).toBe(true);
    expect(parseAiInsight(raw, 123).source).toBe('CEREBRAS');
  });

  it('falls back when provider output is malformed', () => {
    const insight = parseAiInsight('not-json', 123);
    expect(insight.source).toBe('LOCAL');
    expect(insight.severity).toBe('NOTICE');
  });
});

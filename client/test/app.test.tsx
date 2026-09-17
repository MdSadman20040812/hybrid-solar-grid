// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { useMiniGridSocket } from '../src/hooks/useMiniGridSocket';
import { PROTOCOL_VERSION, createEmptyZones, type SystemSnapshot } from '../../shared/protocol.js';

vi.mock('../src/hooks/useMiniGridSocket', () => ({ useMiniGridSocket: vi.fn() }));

const mockedHook = vi.mocked(useMiniGridSocket);

function snapshot(overChargeTrip = false): SystemSnapshot {
  return {
    type: 'SYSTEM_SNAPSHOT',
    protocolVersion: PROTOCOL_VERSION,
    serverTime: Date.now(),
    hardware: { connected: true, clientId: 'sim', simulated: true, lastSeenAt: Date.now(), telemetryStale: false },
    telemetry: {
      voltages: { solar: 13.8, battery: 12.5, grid: 12, load: 12.2 },
      currents: { solar: 1.2, load: 0.8 },
      status: { overChargeTrip, overDischargeTrip: false, activeSource: 'SOLAR' },
      zones: createEmptyZones()
    },
    derived: {
      loadPowerW: 9.76, solarPowerW: 16.56, estimatedGridEnergyAvoidedKWh: .01,
      estimatedGridCostAvoided: .1, projectedMonthlySavings: 100, estimateWindowMinutes: 15,
      solarUtilizationPercent: 80, dataQuality: 'GOOD', currencyCode: 'BDT', tariffPerKWh: 10
    },
    history: [],
    pendingCommands: [],
    aiInsight: {
      severity: 'INFO', title: 'Solar stable', message: 'Normal readings.', recommendedAction: 'Continue monitoring.',
      confidence: 'MEDIUM', generatedAt: Date.now(), source: 'LOCAL'
    },
    protectionLockout: overChargeTrip
  };
}

beforeEach(() => {
  mockedHook.mockReturnValue({
    snapshot: snapshot(),
    publicConfig: { version: '1.0.0', wsPath: '/ws', currencyCode: 'BDT', tariffPerKWh: 10, dashboardAuthenticationRequired: false, aiEnabled: false },
    connectionState: 'CONNECTED',
    commandFeedback: null,
    sendZoneCommand: vi.fn(),
    authenticate: vi.fn(),
    clearFeedback: vi.fn(),
    events: [],
    packetsPerMinute: 0,
    lastSeenAt: Date.now(),
    protocolVersion: PROTOCOL_VERSION
  });
});

describe('dashboard critical states', () => {
  it('renders active source, savings, and five controls', () => {
    render(<App />);
    expect(screen.getAllByText('SOLAR').length).toBeGreaterThan(0);
    expect(screen.getByText('Estimated savings')).toBeInTheDocument();
    expect(screen.getAllByRole('switch', { hidden: true })).toHaveLength(5);
  });

  it('renders protection lockout and disables zone controls', () => {
    mockedHook.mockReturnValue({ ...mockedHook(), snapshot: snapshot(true) });
    render(<App />);
    expect(screen.getByText('Over-charge trip detected')).toBeInTheDocument();
    expect(screen.getAllByRole('switch', { hidden: true }).every((button) => button.hasAttribute('disabled'))).toBe(true);
  });
});

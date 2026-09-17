import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { WebSocket } from 'ws';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { MiniGridBroker } from '../src/websocket/broker.js';
import { PROTOCOL_VERSION, createEmptyZones, type ServerMessage } from '../../shared/protocol.js';

const resources: Array<() => void> = [];
afterEach(() => {
  while (resources.length) resources.pop()?.();
});

function waitForMessage(socket: WebSocket, type: string, timeoutMs = 2500): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), timeoutMs);
    const listener = (raw: Buffer) => {
      const parsed = JSON.parse(raw.toString()) as ServerMessage;
      if (parsed.type !== type) return;
      clearTimeout(timeout);
      socket.off('message', listener);
      resolve(parsed);
    };
    socket.on('message', listener);
  });
}

async function startStack(overrides: Partial<typeof config> = {}) {
  const testConfig = {
    ...config,
    host: '127.0.0.1',
    port: 0,
    nodeEnv: 'test' as const,
    allowedOrigins: ['http://localhost'],
    aiInsightsEnabled: false,
    aiEnabled: false,
    telemetryStaleMs: 900,
    commandTimeoutMs: 500,
    heartbeatIntervalMs: 5000,
    ...overrides
  };
  let broker: MiniGridBroker | null = null;
  const app = createApp(testConfig, () => broker);
  const server = http.createServer(app);
  broker = new MiniGridBroker(server, testConfig);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  resources.push(() => broker?.close());
  resources.push(() => server.close());
  return { app, port };
}

async function connect(url: string, hello: object): Promise<WebSocket> {
  const socket = new WebSocket(url, { origin: 'http://localhost' });
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  socket.send(JSON.stringify(hello));
  resources.push(() => socket.close());
  return socket;
}

describe('HTTP and WebSocket integration', () => {
  it('returns a sanitized health response', async () => {
    const { app } = await startStack();
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body.ok).toBe(true);
    expect(response.body).not.toHaveProperty('cerebrasApiKey');
  });

  it('routes telemetry, command, and acknowledgement end to end', async () => {
    const { port } = await startStack();
    const url = `ws://127.0.0.1:${port}/ws`;
    const hardware = await connect(url, {
      type: 'HELLO', protocolVersion: PROTOCOL_VERSION, role: 'HARDWARE', clientId: 'test-hardware', simulated: true
    });
    const dashboard = await connect(url, {
      type: 'HELLO', protocolVersion: PROTOCOL_VERSION, role: 'DASHBOARD', clientId: 'test-dashboard'
    });
    await waitForMessage(dashboard, 'SYSTEM_SNAPSHOT');

    const telemetryPromise = waitForMessage(dashboard, 'SYSTEM_SNAPSHOT');
    hardware.send(JSON.stringify({
      type: 'TELEMETRY_UPDATE',
      protocolVersion: PROTOCOL_VERSION,
      timestamp: Date.now(),
      sequence: 1,
      data: {
        voltages: { solar: 13.8, battery: 12.5, grid: 12, load: 12.2 },
        currents: { solar: 1.2, load: 0.8 },
        status: { overChargeTrip: false, overDischargeTrip: false, activeSource: 'SOLAR' },
        zones: createEmptyZones()
      }
    }));
    const snapshot = await telemetryPromise;
    expect(snapshot.telemetry.status.activeSource).toBe('SOLAR');

    const commandId = crypto.randomUUID();
    const hardwareCommandPromise = waitForMessage(hardware, 'ZONE_COMMAND');
    const pendingPromise = waitForMessage(dashboard, 'COMMAND_PENDING');
    dashboard.send(JSON.stringify({
      type: 'ZONE_COMMAND', protocolVersion: PROTOCOL_VERSION, commandId, timestamp: Date.now(), zone: 'zone2', desiredState: true
    }));
    const command = await hardwareCommandPromise;
    expect(command.commandId).toBe(commandId);
    await pendingPromise;

    const resultPromise = waitForMessage(dashboard, 'COMMAND_RESULT');
    hardware.send(JSON.stringify({
      type: 'COMMAND_ACK', protocolVersion: PROTOCOL_VERSION, commandId, timestamp: Date.now(), accepted: true, zone: 'zone2', actualState: true, reason: null
    }));
    const result = await resultPromise;
    expect(result.success).toBe(true);
  });



  it('requires configured hardware authentication', async () => {
    const { port } = await startStack({ hardwareSharedSecret: 'correct-secret' });
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'http://localhost' });
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });
    const closePromise = new Promise<number>((resolve) => socket.once('close', (code) => resolve(code)));
    socket.send(JSON.stringify({
      type: 'HELLO', protocolVersion: PROTOCOL_VERSION, role: 'HARDWARE', clientId: 'unauthorized-hardware', token: 'wrong-secret'
    }));
    expect(await closePromise).toBe(4401);
  });

  it('blocks zone commands during a physical protection trip', async () => {
    const { port } = await startStack();
    const url = `ws://127.0.0.1:${port}/ws`;
    const hardware = await connect(url, {
      type: 'HELLO', protocolVersion: PROTOCOL_VERSION, role: 'HARDWARE', clientId: 'protected-hardware'
    });
    const dashboard = await connect(url, {
      type: 'HELLO', protocolVersion: PROTOCOL_VERSION, role: 'DASHBOARD', clientId: 'protected-dashboard'
    });
    await waitForMessage(dashboard, 'SYSTEM_SNAPSHOT');
    const snapshotPromise = waitForMessage(dashboard, 'SYSTEM_SNAPSHOT');
    hardware.send(JSON.stringify({
      type: 'TELEMETRY_UPDATE', protocolVersion: PROTOCOL_VERSION, timestamp: Date.now(),
      data: {
        voltages: { solar: 13.8, battery: 15.1, grid: 12, load: 12.2 },
        currents: { solar: 1.2, load: 0.8 },
        status: { overChargeTrip: true, overDischargeTrip: false, activeSource: 'SOLAR' },
        zones: createEmptyZones()
      }
    }));
    await snapshotPromise;
    const resultPromise = waitForMessage(dashboard, 'COMMAND_RESULT');
    dashboard.send(JSON.stringify({
      type: 'ZONE_COMMAND', protocolVersion: PROTOCOL_VERSION, commandId: crypto.randomUUID(), timestamp: Date.now(), zone: 'zone1', desiredState: true
    }));
    const result = await resultPromise;
    expect(result.success).toBe(false);
    expect(result.reason).toBe('PROTECTION_LOCKOUT');
  });

  it('contains malformed JSON without crashing the broker', async () => {
    const { port } = await startStack();
    const hardware = await connect(`ws://127.0.0.1:${port}/ws`, {
      type: 'HELLO', protocolVersion: PROTOCOL_VERSION, role: 'HARDWARE', clientId: 'malformed-test'
    });
    const errorPromise = waitForMessage(hardware, 'PROTOCOL_ERROR');
    hardware.send('{broken');
    const error = await errorPromise;
    expect(error.code).toBe('INVALID_JSON');
    expect(hardware.readyState).toBe(WebSocket.OPEN);
  });
});

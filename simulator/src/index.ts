import process from 'node:process';
import { WebSocket } from 'ws';
import {
  ACTIVE_SOURCES,
  PROTOCOL_VERSION,
  createEmptyZones,
  type ActiveSource,
  type TelemetryData,
  type ZoneCommandMessage
} from '../../shared/protocol.js';

interface Options {
  url: string;
  intervalMs: number;
  scenario: 'normal' | 'overcharge' | 'overdischarge' | 'malformed' | 'delayed-ack' | 'rejected' | 'disconnect';
  source: ActiveSource | 'AUTO';
  seed: number;
  secret: string;
}

function readArgs(): Options {
  const args = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 1) {
    const key = process.argv[index];
    const value = process.argv[index + 1];
    if (key?.startsWith('--') && value && !value.startsWith('--')) {
      args.set(key.slice(2), value);
      index += 1;
    }
  }
  const scenario = (args.get('scenario') ?? process.env.SIM_SCENARIO ?? 'normal') as Options['scenario'];
  if (!['normal', 'overcharge', 'overdischarge', 'malformed', 'delayed-ack', 'rejected', 'disconnect'].includes(scenario)) {
    throw new Error(`Unsupported scenario: ${scenario}`);
  }
  const sourceInput = (args.get('source') ?? process.env.SIM_SOURCE ?? 'AUTO').toUpperCase();
  const source = (sourceInput === 'AUTO' ? 'AUTO' : sourceInput) as Options['source'];
  if (source !== 'AUTO' && !ACTIVE_SOURCES.includes(source)) throw new Error(`Unsupported source: ${source}`);

  return {
    url: args.get('url') ?? process.env.SIM_WS_URL ?? 'ws://127.0.0.1:3000/ws',
    intervalMs: Math.max(250, Math.min(2000, Number(args.get('interval') ?? process.env.SIM_INTERVAL_MS ?? 400))),
    scenario,
    source,
    seed: Number(args.get('seed') ?? process.env.SIM_SEED ?? 42),
    secret: args.get('secret') ?? process.env.HARDWARE_SHARED_SECRET ?? ''
  };
}

function mulberry32(seed: number): () => number {
  return () => {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296;
  };
}

const options = readArgs();
const random = mulberry32(options.seed);
const zones = createEmptyZones();
let sequence = 0;
let timer: NodeJS.Timeout | null = null;
let malformedSent = false;

function noise(amplitude: number): number {
  return (random() - 0.5) * amplitude;
}

function activeSourceFor(sequenceNumber: number): ActiveSource {
  if (options.source !== 'AUTO') return options.source;
  const phase = Math.floor(sequenceNumber / 60) % 3;
  return phase === 0 ? 'SOLAR' : phase === 1 ? 'BATTERY' : 'GRID';
}

function createTelemetry(): TelemetryData {
  const source = activeSourceFor(sequence);
  const wave = Math.sin(sequence / 12);
  const solarVoltage = source === 'SOLAR' ? 13.7 + wave * 0.35 + noise(0.08) : 8.2 + wave * 0.4 + noise(0.1);
  const batteryVoltage = options.scenario === 'overcharge'
    ? 15.1 + noise(0.05)
    : options.scenario === 'overdischarge'
      ? 10.2 + noise(0.05)
      : 12.45 + wave * 0.08 + noise(0.04);
  const gridVoltage = source === 'GRID' ? 12.15 + noise(0.05) : 12.0 + noise(0.04);
  const enabledZones = Object.values(zones).filter(Boolean).length;
  const baseLoadCurrent = 0.22 + enabledZones * 0.16;
  const loadCurrent = baseLoadCurrent + Math.abs(wave) * 0.08 + noise(0.025);
  const loadVoltage = source === 'SOLAR'
    ? 12.35 + noise(0.05)
    : source === 'BATTERY'
      ? Math.max(10.8, batteryVoltage - 0.18) + noise(0.04)
      : gridVoltage - 0.08 + noise(0.03);
  const solarCurrent = source === 'SOLAR' ? Math.max(0.2, loadCurrent + 0.35 + noise(0.06)) : 0.05 + noise(0.02);

  return {
    voltages: {
      solar: Number(solarVoltage.toFixed(2)),
      battery: Number(batteryVoltage.toFixed(2)),
      grid: Number(gridVoltage.toFixed(2)),
      load: Number(loadVoltage.toFixed(2))
    },
    currents: {
      solar: Number(Math.max(0, solarCurrent).toFixed(2)),
      load: Number(Math.max(0, loadCurrent).toFixed(2))
    },
    status: {
      overChargeTrip: options.scenario === 'overcharge',
      overDischargeTrip: options.scenario === 'overdischarge',
      activeSource: source
    },
    zones: { ...zones }
  };
}

const socket = new WebSocket(options.url, { maxPayload: 65_536 });

socket.on('open', () => {
  console.log(`[simulator] connected to ${options.url} (${options.scenario})`);
  socket.send(JSON.stringify({
    type: 'HELLO',
    protocolVersion: PROTOCOL_VERSION,
    role: 'HARDWARE',
    clientId: 'mini-grid-simulator-01',
    token: options.secret || undefined,
    simulated: true
  }));

  timer = setInterval(() => {
    sequence += 1;
    if (options.scenario === 'malformed' && sequence === 8 && !malformedSent) {
      malformedSent = true;
      socket.send('{"type":"TELEMETRY_UPDATE","broken":');
      return;
    }
    socket.send(JSON.stringify({
      type: 'TELEMETRY_UPDATE',
      protocolVersion: PROTOCOL_VERSION,
      timestamp: Date.now(),
      sequence,
      data: createTelemetry()
    }));

    if (options.scenario === 'disconnect' && sequence === 20) {
      console.log('[simulator] disconnect scenario triggered');
      socket.close(1000, 'Simulated link loss');
    }
  }, options.intervalMs);
});

socket.on('message', (raw) => {
  let message: unknown;
  try {
    message = JSON.parse(raw.toString());
  } catch {
    return;
  }
  if (!message || typeof message !== 'object' || (message as { type?: string }).type !== 'ZONE_COMMAND') return;
  const command = message as ZoneCommandMessage;
  const accepted = options.scenario !== 'rejected';
  const sendAck = () => {
    if (accepted) zones[command.zone] = command.desiredState;
    socket.send(JSON.stringify({
      type: 'COMMAND_ACK',
      protocolVersion: PROTOCOL_VERSION,
      commandId: command.commandId,
      timestamp: Date.now(),
      accepted,
      zone: command.zone,
      actualState: zones[command.zone],
      reason: accepted ? null : 'HARDWARE_BUSY'
    }));
    console.log(`[simulator] ${command.zone} -> ${command.desiredState ? 'ON' : 'OFF'} (${accepted ? 'accepted' : 'rejected'})`);
  };
  if (options.scenario === 'delayed-ack') setTimeout(sendAck, 4500);
  else sendAck();
});

socket.on('close', (code, reason) => {
  if (timer) clearInterval(timer);
  console.log(`[simulator] disconnected (${code}) ${reason.toString()}`);
  process.exit(0);
});

socket.on('error', (error) => {
  console.error(`[simulator] ${error.message}`);
});

function shutdown(): void {
  if (timer) clearInterval(timer);
  socket.close(1000, 'Simulator shutdown');
  setTimeout(() => process.exit(0), 500).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

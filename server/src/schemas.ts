import { z } from 'zod';
import { ACTIVE_SOURCES, CLIENT_ROLES, PROTOCOL_VERSION, ZONE_KEYS } from '../../shared/protocol.js';

const finiteNumber = z.number().finite();
const voltage = finiteNumber.min(-1).max(100);
const current = finiteNumber.min(-0.5).max(100);
const zoneRecord = z.object({
  zone1: z.boolean(),
  zone2: z.boolean(),
  zone3: z.boolean(),
  zone4: z.boolean(),
  zone5: z.boolean()
}).strict();

export const helloSchema = z.object({
  type: z.literal('HELLO'),
  protocolVersion: z.literal(PROTOCOL_VERSION),
  role: z.enum(CLIENT_ROLES),
  clientId: z.string().trim().min(3).max(100).regex(/^[a-zA-Z0-9._:-]+$/),
  token: z.string().max(256).optional(),
  simulated: z.boolean().optional()
}).strict();

export const telemetrySchema = z.object({
  type: z.literal('TELEMETRY_UPDATE'),
  protocolVersion: z.literal(PROTOCOL_VERSION),
  timestamp: z.number().int().positive(),
  sequence: z.number().int().nonnegative().optional(),
  data: z.object({
    voltages: z.object({ solar: voltage, battery: voltage, grid: voltage, load: voltage }).strict(),
    currents: z.object({ solar: current, load: current }).strict(),
    status: z.object({
      overChargeTrip: z.boolean(),
      overDischargeTrip: z.boolean(),
      activeSource: z.enum(ACTIVE_SOURCES)
    }).strict(),
    zones: zoneRecord
  }).strict()
}).strict();

export const zoneCommandSchema = z.object({
  type: z.literal('ZONE_COMMAND'),
  protocolVersion: z.literal(PROTOCOL_VERSION),
  commandId: z.string().uuid(),
  timestamp: z.number().int().positive(),
  zone: z.enum(ZONE_KEYS),
  desiredState: z.boolean()
}).strict();

export const commandAckSchema = z.object({
  type: z.literal('COMMAND_ACK'),
  protocolVersion: z.literal(PROTOCOL_VERSION),
  commandId: z.string().uuid(),
  timestamp: z.number().int().positive(),
  accepted: z.boolean(),
  zone: z.enum(ZONE_KEYS),
  actualState: z.boolean(),
  reason: z.string().trim().max(120).nullable()
}).strict();

export const aiInsightResponseSchema = z.object({
  severity: z.enum(['INFO', 'NOTICE', 'WARNING', 'CRITICAL']),
  title: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(280),
  recommendedAction: z.string().trim().min(1).max(180),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH'])
}).strict();

export function parseJsonPayload(raw: Buffer | ArrayBuffer | Buffer[]): unknown {
  const text = Array.isArray(raw)
    ? Buffer.concat(raw).toString('utf8')
    : Buffer.isBuffer(raw)
      ? raw.toString('utf8')
      : Buffer.from(raw).toString('utf8');
  return JSON.parse(text);
}

export function formatValidationError(error: z.ZodError): string {
  return error.issues.slice(0, 3).map((issue) => `${issue.path.join('.') || 'message'}: ${issue.message}`).join('; ');
}

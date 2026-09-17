import 'dotenv/config';
import { z } from 'zod';

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}, z.boolean());

const numberFromEnv = (fallback: number, min = 0) =>
  z.preprocess((value) => {
    if (value === undefined || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }, z.number().min(min));

const envSchema = z.object({
  PORT: numberFromEnv(3000, 1).pipe(z.number().int().max(65535)),
  HOST: z.string().default('127.0.0.1'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_VERSION: z.string().default('1.0.0'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000'),
  HARDWARE_SHARED_SECRET: z.string().default(''),
  DASHBOARD_ACCESS_TOKEN: z.string().default(''),
  CEREBRAS_API_KEY: z.string().default(''),
  CEREBRAS_MODEL: z.string().default('gpt-oss-120b'),
  CEREBRAS_API_URL: z.string().url().default('https://api.cerebras.ai/v1/chat/completions'),
  AI_INSIGHTS_ENABLED: booleanFromEnv.default(false),
  AI_INSIGHT_INTERVAL_MS: numberFromEnv(20_000, 5_000).pipe(z.number().int()),
  AI_TIMEOUT_MS: numberFromEnv(8_000, 1_000).pipe(z.number().int()),
  TELEMETRY_STALE_MS: numberFromEnv(4_000, 1_000).pipe(z.number().int()),
  COMMAND_TIMEOUT_MS: numberFromEnv(3_000, 500).pipe(z.number().int()),
  HEARTBEAT_INTERVAL_MS: numberFromEnv(15_000, 5_000).pipe(z.number().int()),
  MAX_WS_PAYLOAD_BYTES: numberFromEnv(65_536, 1_024).pipe(z.number().int().max(1_048_576)),
  TELEMETRY_HISTORY_POINTS: numberFromEnv(180, 30).pipe(z.number().int().max(1_000)),
  GRID_TARIFF_PER_KWH: numberFromEnv(10, 0),
  CURRENCY_CODE: z.string().min(3).max(3).default('BDT'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error('Invalid environment configuration:', result.error.flatten().fieldErrors);
  process.exit(1);
}

const env = result.data;

export const config = {
  port: env.PORT,
  host: env.HOST,
  nodeEnv: env.NODE_ENV,
  version: env.APP_VERSION,
  allowedOrigins: env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  hardwareSharedSecret: env.HARDWARE_SHARED_SECRET,
  dashboardAccessToken: env.DASHBOARD_ACCESS_TOKEN,
  cerebrasApiKey: env.CEREBRAS_API_KEY,
  cerebrasModel: env.CEREBRAS_MODEL,
  cerebrasApiUrl: env.CEREBRAS_API_URL,
  aiInsightsEnabled: env.AI_INSIGHTS_ENABLED,
  aiInsightIntervalMs: env.AI_INSIGHT_INTERVAL_MS,
  aiTimeoutMs: env.AI_TIMEOUT_MS,
  telemetryStaleMs: env.TELEMETRY_STALE_MS,
  commandTimeoutMs: env.COMMAND_TIMEOUT_MS,
  heartbeatIntervalMs: env.HEARTBEAT_INTERVAL_MS,
  maxWsPayloadBytes: env.MAX_WS_PAYLOAD_BYTES,
  telemetryHistoryPoints: env.TELEMETRY_HISTORY_POINTS,
  gridTariffPerKwh: env.GRID_TARIFF_PER_KWH,
  currencyCode: env.CURRENCY_CODE,
  logLevel: env.LOG_LEVEL,
  aiEnabled: env.AI_INSIGHTS_ENABLED && Boolean(env.CEREBRAS_API_KEY && env.CEREBRAS_MODEL)
} as const;

export type AppConfig = typeof config;

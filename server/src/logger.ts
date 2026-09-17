import { config } from './config.js';

const weights = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof weights;

function sanitize(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitize);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (/key|secret|token|authorization/i.test(key)) return [key, '[REDACTED]'];
      return [key, sanitize(item)];
    })
  );
}

function write(level: Level, event: string, context: Record<string, unknown> = {}): void {
  if (weights[level] < weights[config.logLevel]) return;
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitize(context) as Record<string, unknown>
  };
  const line = JSON.stringify(record);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, context?: Record<string, unknown>) => write('debug', event, context),
  info: (event: string, context?: Record<string, unknown>) => write('info', event, context),
  warn: (event: string, context?: Record<string, unknown>) => write('warn', event, context),
  error: (event: string, context?: Record<string, unknown>) => write('error', event, context)
};

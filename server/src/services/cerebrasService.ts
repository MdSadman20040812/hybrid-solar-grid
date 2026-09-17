import type { AppConfig } from '../config.js';
import { aiInsightResponseSchema } from '../schemas.js';
import type { AiInsight, TelemetryData, TelemetryPoint } from '../../../shared/protocol.js';

function stripCodeFence(value: string): string {
  return value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
}

export function parseAiInsight(raw: string, now = Date.now()): AiInsight {
  try {
    const parsed = aiInsightResponseSchema.parse(JSON.parse(stripCodeFence(raw)));
    return { ...parsed, generatedAt: now, source: 'CEREBRAS' };
  } catch {
    return {
      severity: 'NOTICE',
      title: 'AI advisory unavailable',
      message: 'The diagnostic response could not be verified, so it was not displayed.',
      recommendedAction: 'Continue using the live electrical readings and protection indicators.',
      confidence: 'LOW',
      generatedAt: now,
      source: 'LOCAL'
    };
  }
}

export function createLocalInsight(telemetry: TelemetryData | null, stale: boolean, now = Date.now()): AiInsight {
  if (!telemetry || stale) {
    return {
      severity: 'WARNING',
      title: 'Live telemetry is unavailable',
      message: 'The dashboard is showing the last known state and cannot confirm current hardware conditions.',
      recommendedAction: 'Check the local server, hardware power, and WebSocket connection.',
      confidence: 'HIGH',
      generatedAt: now,
      source: 'LOCAL'
    };
  }
  if (telemetry.status.overChargeTrip) {
    return {
      severity: 'CRITICAL',
      title: 'Over-charge protection is active',
      message: 'The physical protection circuit reports an over-charge trip. Software controls are locked.',
      recommendedAction: 'Inspect the charge path and battery voltage before restoring operation.',
      confidence: 'HIGH',
      generatedAt: now,
      source: 'LOCAL'
    };
  }
  if (telemetry.status.overDischargeTrip) {
    return {
      severity: 'CRITICAL',
      title: 'Over-discharge protection is active',
      message: 'The battery protection circuit reports an over-discharge trip. Software controls are locked.',
      recommendedAction: 'Reduce load and verify safe battery recovery before restoring operation.',
      confidence: 'HIGH',
      generatedAt: now,
      source: 'LOCAL'
    };
  }
  return {
    severity: 'INFO',
    title: `${telemetry.status.activeSource.toLowerCase()} source is stable`,
    message: 'No protection trip is active and the latest telemetry is internally consistent.',
    recommendedAction: 'No immediate action is required; continue monitoring.',
    confidence: 'MEDIUM',
    generatedAt: now,
    source: 'LOCAL'
  };
}

export class CerebrasService {
  private inFlight = false;
  private lastRunAt = 0;
  private backoffUntil = 0;
  private failureCount = 0;

  constructor(private readonly config: AppConfig) {}

  canRun(now = Date.now()): boolean {
    return this.config.aiEnabled
      && !this.inFlight
      && now >= this.backoffUntil
      && now - this.lastRunAt >= this.config.aiInsightIntervalMs;
  }

  async generate(telemetry: TelemetryData, history: TelemetryPoint[]): Promise<AiInsight> {
    const now = Date.now();
    if (!this.canRun(now)) return createLocalInsight(telemetry, false, now);

    this.inFlight = true;
    this.lastRunAt = now;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.aiTimeoutMs);

    try {
      const compactHistory = history.slice(-12).map((point) => ({
        t: point.receivedAt,
        loadW: Number(point.loadPowerW.toFixed(2)),
        solarW: Number(point.solarPowerW.toFixed(2)),
        batteryV: Number(point.batteryVoltage.toFixed(2)),
        source: point.activeSource
      }));
      const response = await fetch(this.config.cerebrasApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.cerebrasApiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.config.cerebrasModel,
          temperature: 0.1,
          max_completion_tokens: 220,
          messages: [
            {
              role: 'system',
              content: 'You are an advisory diagnostic assistant for a small hybrid solar, battery, and grid demonstration system. Return only compact JSON with severity, title, message, recommendedAction, and confidence. Never claim to control hardware, bypass protection, or provide unsafe electrical instructions.'
            },
            {
              role: 'user',
              content: JSON.stringify({ telemetry, recentTrend: compactHistory })
            }
          ]
        })
      });

      if (!response.ok) throw new Error(`CEREBRAS_HTTP_${response.status}`);
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error('CEREBRAS_EMPTY_RESPONSE');
      this.failureCount = 0;
      this.backoffUntil = 0;
      return parseAiInsight(content, Date.now());
    } catch {
      this.failureCount += 1;
      const backoff = Math.min(5 * 60_000, 5_000 * 2 ** Math.min(this.failureCount, 6));
      this.backoffUntil = Date.now() + backoff;
      return createLocalInsight(telemetry, false, Date.now());
    } finally {
      clearTimeout(timeout);
      this.inFlight = false;
    }
  }
}

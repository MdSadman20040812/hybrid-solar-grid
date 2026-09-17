import path from 'node:path';
import fs from 'node:fs';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import type { AppConfig } from './config.js';
import type { MiniGridBroker } from './websocket/broker.js';

export function createApp(config: AppConfig, brokerProvider: () => MiniGridBroker | null) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));
  app.use(express.json({ limit: '16kb' }));

  app.use((request: Request, response: Response, next: NextFunction) => {
    const origin = request.headers.origin;
    if (origin && config.allowedOrigins.includes(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    }
    if (request.method === 'OPTIONS') return response.sendStatus(204);
    next();
  });

  app.get('/api/health', (_request, response) => {
    const broker = brokerProvider();
    const status = broker?.getStatus();
    response.json({
      ok: true,
      version: config.version,
      uptimeSeconds: Math.round(process.uptime()),
      hardwareConnected: status?.hardware.connected ?? false,
      lastTelemetryAgeMs: status?.lastTelemetryAgeMs ?? null,
      aiEnabled: config.aiEnabled,
      environment: config.nodeEnv
    });
  });

  app.get('/api/status', (_request, response) => {
    const broker = brokerProvider();
    response.json({
      version: config.version,
      serverTime: Date.now(),
      ...broker?.getStatus(),
      ai: {
        configured: config.aiEnabled,
        provider: config.aiEnabled ? 'Cerebras' : 'Local advisory fallback'
      },
      security: {
        hardwareAuthenticationRequired: Boolean(config.hardwareSharedSecret),
        dashboardAuthenticationRequired: Boolean(config.dashboardAccessToken),
        allowedOriginCount: config.allowedOrigins.length
      }
    });
  });

  app.get('/api/config/public', (_request, response) => {
    response.json({
      version: config.version,
      wsPath: '/ws',
      currencyCode: config.currencyCode,
      tariffPerKWh: config.gridTariffPerKwh,
      dashboardAuthenticationRequired: Boolean(config.dashboardAccessToken),
      aiEnabled: config.aiEnabled
    });
  });

  const clientDist = path.resolve(process.cwd(), 'dist/client');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist, { maxAge: config.nodeEnv === 'production' ? '1h' : 0, etag: true }));
    app.use((request, response, next) => {
      if (request.path.startsWith('/api/') || request.path === '/ws') return next();
      response.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    response.status(500).json({ error: config.nodeEnv === 'production' ? 'Internal server error' : message });
  });

  return app;
}

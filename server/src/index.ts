import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { MiniGridBroker } from './websocket/broker.js';

let broker: MiniGridBroker | null = null;
const app = createApp(config, () => broker);
const server = http.createServer(app);
broker = new MiniGridBroker(server, config);

server.listen(config.port, config.host, () => {
  logger.info('server_started', {
    host: config.host,
    port: config.port,
    version: config.version,
    aiEnabled: config.aiEnabled,
    dashboardAuthRequired: Boolean(config.dashboardAccessToken),
    hardwareAuthRequired: Boolean(config.hardwareSharedSecret)
  });
});

function shutdown(signal: string): void {
  logger.info('server_shutdown', { signal });
  broker?.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => logger.error('uncaught_exception', { message: error.message, stack: error.stack }));
process.on('unhandledRejection', (reason) => logger.error('unhandled_rejection', { reason: String(reason) }));

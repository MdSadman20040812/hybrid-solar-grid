import crypto from 'node:crypto';
import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import type { AppConfig } from '../config.js';
import { logger } from '../logger.js';
import {
  commandAckSchema,
  formatValidationError,
  helloSchema,
  parseJsonPayload,
  telemetrySchema,
  zoneCommandSchema
} from '../schemas.js';
import { CommandService } from '../services/commandService.js';
import { CerebrasService, createLocalInsight } from '../services/cerebrasService.js';
import { TelemetryStore } from '../services/telemetryStore.js';
import {
  PROTOCOL_VERSION,
  type ClientRole,
  type CommandAckMessage,
  type CommandResultEvent,
  type HardwareStatus,
  type HelloMessage,
  type ProtocolErrorEvent,
  type ServerMessage,
  type SystemSnapshot,
  type TelemetryUpdateMessage,
  type ZoneCommandMessage
} from '../../../shared/protocol.js';

interface ClientMeta {
  role: ClientRole | 'UNREGISTERED';
  clientId: string;
  simulated: boolean;
  isAlive: boolean;
  registeredAt: number | null;
  lastSeenAt: number;
  remoteAddress: string;
}

export interface BrokerStatus {
  hardware: HardwareStatus;
  dashboardClients: number;
  pendingCommands: number;
  lastTelemetryAgeMs: number | null;
  dataQuality: string;
}

function safeEqual(expected: string, supplied: string | undefined): boolean {
  if (!expected) return true;
  if (!supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export class MiniGridBroker {
  private readonly wss: WebSocketServer;
  private readonly clients = new Map<WebSocket, ClientMeta>();
  private readonly dashboards = new Set<WebSocket>();
  private hardware: WebSocket | null = null;
  private readonly store: TelemetryStore;
  private readonly commands: CommandService;
  private readonly cerebras: CerebrasService;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private staleTimer: NodeJS.Timeout | null = null;
  private aiTimer: NodeJS.Timeout | null = null;
  private lastStaleState = true;

  constructor(private readonly server: HttpServer, private readonly config: AppConfig) {
    this.store = new TelemetryStore(config);
    this.commands = new CommandService(config.commandTimeoutMs);
    this.cerebras = new CerebrasService(config);
    this.wss = new WebSocketServer({ noServer: true, maxPayload: config.maxWsPayloadBytes });
    this.attach();
  }

  private attach(): void {
    this.server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      if (url.pathname !== '/ws') {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }
      const origin = request.headers.origin;
      if (origin && !this.config.allowedOrigins.includes(origin)) {
        logger.warn('ws_origin_rejected', { origin, remoteAddress: request.socket.remoteAddress });
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(request, socket, head, (ws) => this.wss.emit('connection', ws, request));
    });

    this.wss.on('connection', (ws, request) => this.handleConnection(ws, request));

    this.heartbeatTimer = setInterval(() => this.runHeartbeat(), this.config.heartbeatIntervalMs);
    this.staleTimer = setInterval(() => this.checkStaleState(), Math.min(1000, this.config.telemetryStaleMs / 2));
    this.aiTimer = setInterval(() => void this.refreshInsight(), 2000);
    this.heartbeatTimer.unref?.();
    this.staleTimer.unref?.();
    this.aiTimer.unref?.();
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const meta: ClientMeta = {
      role: 'UNREGISTERED',
      clientId: 'unregistered',
      simulated: false,
      isAlive: true,
      registeredAt: null,
      lastSeenAt: Date.now(),
      remoteAddress: request.socket.remoteAddress ?? 'unknown'
    };
    this.clients.set(ws, meta);

    const registrationTimer = setTimeout(() => {
      if (meta.role === 'UNREGISTERED') ws.close(4408, 'HELLO required');
    }, 5000);
    registrationTimer.unref?.();

    ws.on('pong', () => {
      meta.isAlive = true;
      meta.lastSeenAt = Date.now();
    });
    ws.on('message', (raw) => this.handleMessage(ws, raw));
    ws.on('close', (code, reason) => {
      clearTimeout(registrationTimer);
      this.handleDisconnect(ws, code, reason.toString());
    });
    ws.on('error', (error) => {
      logger.warn('ws_client_error', { role: meta.role, clientId: meta.clientId, message: error.message });
    });
  }

  private handleMessage(ws: WebSocket, raw: RawData): void {
    const meta = this.clients.get(ws);
    if (!meta) return;
    meta.lastSeenAt = Date.now();
    meta.isAlive = true;

    let payload: unknown;
    try {
      payload = parseJsonPayload(raw as Buffer | ArrayBuffer | Buffer[]);
    } catch {
      this.sendProtocolError(ws, 'INVALID_JSON', 'Message must contain valid JSON.');
      return;
    }

    if (meta.role === 'UNREGISTERED') {
      const parsed = helloSchema.safeParse(payload);
      if (!parsed.success) {
        this.sendProtocolError(ws, 'HELLO_REQUIRED', formatValidationError(parsed.error));
        ws.close(4400, 'Invalid HELLO');
        return;
      }
      this.registerClient(ws, parsed.data as HelloMessage);
      return;
    }

    const messageType = typeof payload === 'object' && payload !== null && 'type' in payload
      ? String((payload as { type: unknown }).type)
      : 'UNKNOWN';

    if (meta.role === 'HARDWARE') {
      if (messageType === 'TELEMETRY_UPDATE') {
        const parsed = telemetrySchema.safeParse(payload);
        if (!parsed.success) return this.sendProtocolError(ws, 'INVALID_TELEMETRY', formatValidationError(parsed.error), messageType);
        this.handleTelemetry(parsed.data as TelemetryUpdateMessage);
        return;
      }
      if (messageType === 'COMMAND_ACK') {
        const parsed = commandAckSchema.safeParse(payload);
        if (!parsed.success) return this.sendProtocolError(ws, 'INVALID_ACK', formatValidationError(parsed.error), messageType);
        this.handleCommandAck(parsed.data);
        return;
      }
      this.sendProtocolError(ws, 'ROLE_MESSAGE_FORBIDDEN', 'Hardware client sent an unsupported message type.', messageType);
      return;
    }

    if (meta.role === 'DASHBOARD' && messageType === 'ZONE_COMMAND') {
      const parsed = zoneCommandSchema.safeParse(payload);
      if (!parsed.success) return this.sendProtocolError(ws, 'INVALID_COMMAND', formatValidationError(parsed.error), messageType);
      this.handleZoneCommand(ws, parsed.data);
      return;
    }

    this.sendProtocolError(ws, 'ROLE_MESSAGE_FORBIDDEN', 'Message type is not permitted for this client role.', messageType);
  }

  private registerClient(ws: WebSocket, hello: HelloMessage): void {
    const meta = this.clients.get(ws);
    if (!meta) return;

    if (hello.role === 'HARDWARE' && !safeEqual(this.config.hardwareSharedSecret, hello.token)) {
      this.sendProtocolError(ws, 'AUTH_FAILED', 'Hardware authentication failed.');
      ws.close(4401, 'Authentication failed');
      return;
    }
    if (hello.role === 'DASHBOARD' && !safeEqual(this.config.dashboardAccessToken, hello.token)) {
      this.sendProtocolError(ws, 'AUTH_REQUIRED', 'A valid dashboard access token is required.');
      ws.close(4401, 'Authentication required');
      return;
    }

    meta.role = hello.role;
    meta.clientId = hello.clientId;
    meta.simulated = hello.simulated ?? false;
    meta.registeredAt = Date.now();

    if (hello.role === 'HARDWARE') {
      if (this.hardware && this.hardware !== ws) {
        this.hardware.close(4409, 'Replaced by a new authenticated hardware client');
      }
      this.hardware = ws;
      logger.info('hardware_connected', { clientId: meta.clientId, simulated: meta.simulated, remoteAddress: meta.remoteAddress });
      this.broadcastConnectionStatus();
    } else {
      this.dashboards.add(ws);
      logger.info('dashboard_connected', { clientId: meta.clientId, remoteAddress: meta.remoteAddress });
      this.send(ws, this.getSnapshot());
    }
  }

  private handleTelemetry(message: TelemetryUpdateMessage): void {
    this.store.ingest(message.data, message.timestamp, Date.now());
    this.lastStaleState = false;
    this.broadcast(this.getSnapshot());
  }

  private handleZoneCommand(requester: WebSocket, message: ZoneCommandMessage): void {
    const telemetry = this.store.getTelemetry();
    const lockout = Boolean(telemetry?.status.overChargeTrip || telemetry?.status.overDischargeTrip);

    if (!this.hardware || this.hardware.readyState !== WebSocket.OPEN || this.store.isStale()) {
      this.sendCommandFailure(requester, message, 'HARDWARE_UNAVAILABLE');
      return;
    }
    if (lockout) {
      this.sendCommandFailure(requester, message, 'PROTECTION_LOCKOUT');
      return;
    }
    if (this.commands.hasPendingZone(message.zone)) {
      this.sendCommandFailure(requester, message, 'ZONE_COMMAND_PENDING');
      return;
    }

    const pending = this.commands.create(message, (timedOut) => {
      const result: CommandResultEvent = {
        type: 'COMMAND_RESULT',
        protocolVersion: PROTOCOL_VERSION,
        commandId: timedOut.commandId,
        zone: timedOut.zone,
        desiredState: timedOut.desiredState,
        actualState: null,
        success: false,
        reason: 'ACK_TIMEOUT',
        resolvedAt: Date.now()
      };
      this.broadcast(result);
    });

    this.broadcast({ type: 'COMMAND_PENDING', protocolVersion: PROTOCOL_VERSION, command: pending });
    this.send(this.hardware, { ...message, timestamp: Date.now() });
  }

  private handleCommandAck(message: CommandAckMessage): void {
    const pending = this.commands.resolve(message.commandId);
    if (!pending) {
      logger.warn('unexpected_command_ack', { commandId: message.commandId, zone: message.zone });
      return;
    }
    const result: CommandResultEvent = {
      type: 'COMMAND_RESULT',
      protocolVersion: PROTOCOL_VERSION,
      commandId: message.commandId,
      zone: message.zone,
      desiredState: pending.desiredState,
      actualState: message.actualState,
      success: message.accepted && message.actualState === pending.desiredState,
      reason: message.accepted ? null : message.reason ?? 'HARDWARE_REJECTED',
      resolvedAt: Date.now()
    };
    this.broadcast(result);
  }

  private sendCommandFailure(requester: WebSocket, message: ZoneCommandMessage, reason: string): void {
    this.send(requester, {
      type: 'COMMAND_RESULT',
      protocolVersion: PROTOCOL_VERSION,
      commandId: message.commandId,
      zone: message.zone,
      desiredState: message.desiredState,
      actualState: this.store.getTelemetry()?.zones[message.zone] ?? null,
      success: false,
      reason,
      resolvedAt: Date.now()
    });
  }

  private handleDisconnect(ws: WebSocket, code: number, reason: string): void {
    const meta = this.clients.get(ws);
    this.clients.delete(ws);
    this.dashboards.delete(ws);
    if (this.hardware === ws) {
      this.hardware = null;
      this.commands.clear();
      this.broadcastConnectionStatus();
      this.broadcast(this.getSnapshot());
      logger.warn('hardware_disconnected', { clientId: meta?.clientId, code, reason });
    } else if (meta?.role === 'DASHBOARD') {
      logger.info('dashboard_disconnected', { clientId: meta.clientId, code });
    }
  }

  private runHeartbeat(): void {
    for (const [ws, meta] of this.clients) {
      if (!meta.isAlive) {
        ws.terminate();
        continue;
      }
      meta.isAlive = false;
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }
  }

  private checkStaleState(): void {
    const stale = this.store.isStale();
    if (stale !== this.lastStaleState) {
      this.lastStaleState = stale;
      this.broadcastConnectionStatus();
      this.broadcast(this.getSnapshot());
    }
  }

  private async refreshInsight(): Promise<void> {
    const telemetry = this.store.getTelemetry();
    if (!telemetry || this.store.isStale()) return;
    if (!this.cerebras.canRun()) {
      if (!this.store.getInsight()) this.store.setInsight(createLocalInsight(telemetry, false));
      return;
    }
    const insight = await this.cerebras.generate(telemetry, this.store.getHistory());
    this.store.setInsight(insight);
    this.broadcast({ type: 'AI_INSIGHT', protocolVersion: PROTOCOL_VERSION, insight });
  }

  private getHardwareStatus(): HardwareStatus {
    const meta = this.hardware ? this.clients.get(this.hardware) : null;
    return {
      connected: Boolean(this.hardware && this.hardware.readyState === WebSocket.OPEN),
      clientId: meta?.clientId ?? null,
      simulated: meta?.simulated ?? false,
      lastSeenAt: this.store.getLastReceivedAt(),
      telemetryStale: this.store.isStale()
    };
  }

  getSnapshot(): SystemSnapshot {
    const telemetry = this.store.getTelemetry();
    const lockout = Boolean(telemetry?.status.overChargeTrip || telemetry?.status.overDischargeTrip);
    return {
      type: 'SYSTEM_SNAPSHOT',
      protocolVersion: PROTOCOL_VERSION,
      serverTime: Date.now(),
      hardware: this.getHardwareStatus(),
      telemetry,
      derived: this.store.getDerived(),
      history: this.store.getHistory(),
      pendingCommands: this.commands.getPending(),
      aiInsight: this.store.getInsight() ?? createLocalInsight(telemetry, this.store.isStale()),
      protectionLockout: lockout
    };
  }

  getStatus(): BrokerStatus {
    const lastSeen = this.store.getLastReceivedAt();
    return {
      hardware: this.getHardwareStatus(),
      dashboardClients: this.dashboards.size,
      pendingCommands: this.commands.getPending().length,
      lastTelemetryAgeMs: lastSeen ? Date.now() - lastSeen : null,
      dataQuality: this.store.getDataQuality()
    };
  }

  private broadcastConnectionStatus(): void {
    this.broadcast({ type: 'CONNECTION_STATUS', protocolVersion: PROTOCOL_VERSION, hardware: this.getHardwareStatus() });
  }

  private broadcast(message: ServerMessage): void {
    for (const dashboard of this.dashboards) this.send(dashboard, message);
  }

  private send(ws: WebSocket, message: ServerMessage | ZoneCommandMessage): void {
    if (ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > 1_000_000) return;
    ws.send(JSON.stringify(message));
  }

  private sendProtocolError(ws: WebSocket, code: string, message: string, requestType?: string): void {
    const event: ProtocolErrorEvent = {
      type: 'PROTOCOL_ERROR',
      protocolVersion: PROTOCOL_VERSION,
      code,
      message,
      ...(requestType ? { requestType } : {})
    };
    this.send(ws, event);
  }

  close(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.staleTimer) clearInterval(this.staleTimer);
    if (this.aiTimer) clearInterval(this.aiTimer);
    this.commands.clear();
    for (const ws of this.clients.keys()) ws.close(1001, 'Server shutting down');
    this.wss.close();
  }
}

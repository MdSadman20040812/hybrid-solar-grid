import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PROTOCOL_VERSION,
  type CommandResultEvent,
  type ServerMessage,
  type SystemSnapshot,
  type ZoneKey
} from '../../../shared/protocol.js';

export type ConnectionState = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED' | 'AUTH_REQUIRED';

interface PublicConfig {
  version: string;
  wsPath: string;
  currencyCode: string;
  tariffPerKWh: number;
  dashboardAuthenticationRequired: boolean;
  aiEnabled: boolean;
}

interface CommandFeedback {
  zone: ZoneKey;
  success: boolean;
  reason: string | null;
  at: number;
}

export interface ProtocolEvent {
  id: string;
  type: string;
  detail: string;
  at: number;
}

function buildWsUrl(path: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

function describeMessage(message: ServerMessage): { type: string; detail: string } {
  switch (message.type) {
    case 'SYSTEM_SNAPSHOT':
      return { type: 'SYSTEM_SNAPSHOT', detail: `history ${message.history.length} pts` };
    case 'COMMAND_PENDING':
      return { type: 'COMMAND_PENDING', detail: `${message.command.zone} → ${message.command.desiredState ? 'ON' : 'OFF'}` };
    case 'COMMAND_RESULT':
      return { type: 'COMMAND_RESULT', detail: `${message.zone} ${message.success ? 'ACK' : 'REJECT'}` };
    case 'CONNECTION_STATUS':
      return { type: 'CONNECTION_STATUS', detail: message.hardware.connected ? 'hardware online' : 'hardware offline' };
    case 'AI_INSIGHT':
      return { type: 'AI_INSIGHT', detail: `${message.insight.severity} · ${message.insight.source}` };
    case 'PROTOCOL_ERROR':
      return { type: 'PROTOCOL_ERROR', detail: `${message.code} · ${message.message}` };
    case 'SERVER_NOTICE':
      return { type: 'SERVER_NOTICE', detail: `${message.level}: ${message.message}` };
    default:
      return { type: 'UNKNOWN', detail: '' };
  }
}

export function useMiniGridSocket() {
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const [publicConfig, setPublicConfig] = useState<PublicConfig | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('CONNECTING');
  const [commandFeedback, setCommandFeedback] = useState<CommandFeedback | null>(null);
  const [events, setEvents] = useState<ProtocolEvent[]>([]);
  const [packetsPerMinute, setPacketsPerMinute] = useState<number>(0);
  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null);

  const accessTokenRef = useRef(sessionStorage.getItem('miniGridAccessToken') ?? '');
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const connectRef = useRef<() => void>(() => undefined);
  const eventCounterRef = useRef(0);
  const packetTimestampsRef = useRef<number[]>([]);
  const packetsPerMinuteTimerRef = useRef<number | null>(null);

  const recordEvent = useCallback((message: ServerMessage) => {
    eventCounterRef.current += 1;
    const id = `${message.type}-${eventCounterRef.current}`;
    const { type, detail } = describeMessage(message);
    const at = Date.now();
    setEvents((current) => {
      const next = [{ id, type, detail, at }, ...current];
      return next.slice(0, 20);
    });
    packetTimestampsRef.current.push(at);
    // keep only packets seen in the last minute
    packetTimestampsRef.current = packetTimestampsRef.current.filter((stamp) => at - stamp < 60_000);
    setLastSeenAt(at);
  }, []);

  const applyMessage = useCallback((message: ServerMessage) => {
    recordEvent(message);
    if (message.type === 'SYSTEM_SNAPSHOT') {
      setSnapshot(message);
      setConnectionState('CONNECTED');
      return;
    }
    if (message.type === 'CONNECTION_STATUS') {
      setSnapshot((current) => current ? { ...current, hardware: message.hardware } : current);
      return;
    }
    if (message.type === 'COMMAND_PENDING') {
      setSnapshot((current) => current ? {
        ...current,
        pendingCommands: [
          ...current.pendingCommands.filter((item) => item.commandId !== message.command.commandId),
          message.command
        ]
      } : current);
      return;
    }
    if (message.type === 'COMMAND_RESULT') {
      const result = message as CommandResultEvent;
      setSnapshot((current) => current ? {
        ...current,
        pendingCommands: current.pendingCommands.filter((item) => item.commandId !== result.commandId)
      } : current);
      setCommandFeedback({ zone: result.zone, success: result.success, reason: result.reason, at: Date.now() });
      return;
    }
    if (message.type === 'AI_INSIGHT') {
      setSnapshot((current) => current ? { ...current, aiInsight: message.insight } : current);
      return;
    }
    if (message.type === 'PROTOCOL_ERROR' && message.code === 'AUTH_REQUIRED') {
      intentionalCloseRef.current = true;
      setConnectionState('AUTH_REQUIRED');
    }
  }, [recordEvent]);

  const connect = useCallback(() => {
    if (!publicConfig) return;
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) return;
    intentionalCloseRef.current = false;
    setConnectionState(reconnectAttemptsRef.current > 0 ? 'RECONNECTING' : 'CONNECTING');
    const socket = new WebSocket(buildWsUrl(publicConfig.wsPath));
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      reconnectAttemptsRef.current = 0;
      socket.send(JSON.stringify({
        type: 'HELLO',
        protocolVersion: PROTOCOL_VERSION,
        role: 'DASHBOARD',
        clientId: `dashboard-${crypto.randomUUID()}`,
        ...(accessTokenRef.current ? { token: accessTokenRef.current } : {})
      }));
    });

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        if (!message || typeof message !== 'object' || !('type' in message)) return;
        applyMessage(message);
      } catch {
        // Ignore malformed server data without damaging the live dashboard.
      }
    });

    socket.addEventListener('close', (event) => {
      socketRef.current = null;
      if (event.code === 4401 || intentionalCloseRef.current) {
        setConnectionState('AUTH_REQUIRED');
        return;
      }
      setConnectionState('RECONNECTING');
      const attempt = Math.min(reconnectAttemptsRef.current + 1, 8);
      reconnectAttemptsRef.current = attempt;
      const delay = Math.min(10_000, 700 * 2 ** attempt) + Math.floor(Math.random() * 250);
      reconnectTimerRef.current = window.setTimeout(() => connectRef.current(), delay);
    });

    socket.addEventListener('error', () => {
      setConnectionState('DISCONNECTED');
    });
  }, [applyMessage, publicConfig]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    let active = true;
    fetch('/api/config/public')
      .then((response) => {
        if (!response.ok) throw new Error('Configuration request failed');
        return response.json() as Promise<PublicConfig>;
      })
      .then((value) => active && setPublicConfig(value))
      .catch(() => active && setConnectionState('DISCONNECTED'));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!publicConfig) return;
    connect();
    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close(1000, 'Dashboard unmounted');
    };
  }, [connect, publicConfig]);

  // Recompute packets per minute every 2 seconds so the HUD always reflects the last 60s of traffic.
  useEffect(() => {
    packetsPerMinuteTimerRef.current = window.setInterval(() => {
      setPacketsPerMinute(packetTimestampsRef.current.length);
    }, 2000);
    return () => {
      if (packetsPerMinuteTimerRef.current !== null) window.clearInterval(packetsPerMinuteTimerRef.current);
    };
  }, []);

  const sendZoneCommand = useCallback((zone: ZoneKey, desiredState: boolean) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({
      type: 'ZONE_COMMAND',
      protocolVersion: PROTOCOL_VERSION,
      commandId: crypto.randomUUID(),
      timestamp: Date.now(),
      zone,
      desiredState
    }));
    return true;
  }, []);

  const authenticate = useCallback((token: string) => {
    const normalized = token.trim();
    sessionStorage.setItem('miniGridAccessToken', normalized);
    accessTokenRef.current = normalized;
    reconnectAttemptsRef.current = 0;
    intentionalCloseRef.current = false;
    setConnectionState('CONNECTING');
    if (socketRef.current && socketRef.current.readyState < WebSocket.CLOSING) socketRef.current.close();
    window.setTimeout(() => connectRef.current(), 50);
  }, []);

  const clearFeedback = useCallback(() => setCommandFeedback(null), []);

  return {
    snapshot,
    publicConfig,
    connectionState,
    commandFeedback,
    sendZoneCommand,
    authenticate,
    clearFeedback,
    events,
    packetsPerMinute,
    lastSeenAt,
    protocolVersion: PROTOCOL_VERSION
  };
}

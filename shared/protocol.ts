export const PROTOCOL_VERSION = '1.0' as const;

export const CLIENT_ROLES = ['HARDWARE', 'DASHBOARD'] as const;
export type ClientRole = (typeof CLIENT_ROLES)[number];

export const ACTIVE_SOURCES = ['SOLAR', 'BATTERY', 'GRID', 'UNKNOWN'] as const;
export type ActiveSource = (typeof ACTIVE_SOURCES)[number];

export const DATA_QUALITIES = ['GOOD', 'STALE', 'SUSPECT', 'UNAVAILABLE'] as const;
export type DataQuality = (typeof DATA_QUALITIES)[number];

export const ZONE_KEYS = ['zone1', 'zone2', 'zone3', 'zone4', 'zone5'] as const;
export type ZoneKey = (typeof ZONE_KEYS)[number];
export type ZoneStates = Record<ZoneKey, boolean>;

export interface TelemetryData {
  voltages: {
    solar: number;
    battery: number;
    grid: number;
    load: number;
  };
  currents: {
    solar: number;
    load: number;
  };
  status: {
    overChargeTrip: boolean;
    overDischargeTrip: boolean;
    activeSource: ActiveSource;
  };
  zones: ZoneStates;
}

export interface TelemetryPoint {
  timestamp: number;
  receivedAt: number;
  loadPowerW: number;
  solarPowerW: number;
  loadVoltage: number;
  batteryVoltage: number;
  solarVoltage: number;
  loadCurrent: number;
  activeSource: ActiveSource;
}

export interface DerivedMetrics {
  loadPowerW: number;
  solarPowerW: number;
  estimatedGridEnergyAvoidedKWh: number;
  estimatedGridCostAvoided: number;
  projectedMonthlySavings: number;
  estimateWindowMinutes: number;
  solarUtilizationPercent: number;
  dataQuality: DataQuality;
  currencyCode: string;
  tariffPerKWh: number;
}

export interface PendingCommand {
  commandId: string;
  zone: ZoneKey;
  desiredState: boolean;
  requestedAt: number;
}

export type InsightSeverity = 'INFO' | 'NOTICE' | 'WARNING' | 'CRITICAL';
export type InsightConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AiInsight {
  severity: InsightSeverity;
  title: string;
  message: string;
  recommendedAction: string;
  confidence: InsightConfidence;
  generatedAt: number;
  source: 'CEREBRAS' | 'LOCAL';
}

export interface HardwareStatus {
  connected: boolean;
  clientId: string | null;
  simulated: boolean;
  lastSeenAt: number | null;
  telemetryStale: boolean;
}

export interface SystemSnapshot {
  type: 'SYSTEM_SNAPSHOT';
  protocolVersion: typeof PROTOCOL_VERSION;
  serverTime: number;
  hardware: HardwareStatus;
  telemetry: TelemetryData | null;
  derived: DerivedMetrics;
  history: TelemetryPoint[];
  pendingCommands: PendingCommand[];
  aiInsight: AiInsight | null;
  protectionLockout: boolean;
}

export interface HelloMessage {
  type: 'HELLO';
  protocolVersion: typeof PROTOCOL_VERSION;
  role: ClientRole;
  clientId: string;
  token?: string;
  simulated?: boolean;
}

export interface TelemetryUpdateMessage {
  type: 'TELEMETRY_UPDATE';
  protocolVersion: typeof PROTOCOL_VERSION;
  timestamp: number;
  sequence?: number;
  data: TelemetryData;
}

export interface ZoneCommandMessage {
  type: 'ZONE_COMMAND';
  protocolVersion: typeof PROTOCOL_VERSION;
  commandId: string;
  timestamp: number;
  zone: ZoneKey;
  desiredState: boolean;
}

export interface CommandAckMessage {
  type: 'COMMAND_ACK';
  protocolVersion: typeof PROTOCOL_VERSION;
  commandId: string;
  timestamp: number;
  accepted: boolean;
  zone: ZoneKey;
  actualState: boolean;
  reason: string | null;
}

export interface CommandPendingEvent {
  type: 'COMMAND_PENDING';
  protocolVersion: typeof PROTOCOL_VERSION;
  command: PendingCommand;
}

export interface CommandResultEvent {
  type: 'COMMAND_RESULT';
  protocolVersion: typeof PROTOCOL_VERSION;
  commandId: string;
  zone: ZoneKey;
  desiredState: boolean;
  actualState: boolean | null;
  success: boolean;
  reason: string | null;
  resolvedAt: number;
}

export interface ConnectionStatusEvent {
  type: 'CONNECTION_STATUS';
  protocolVersion: typeof PROTOCOL_VERSION;
  hardware: HardwareStatus;
}

export interface ProtocolErrorEvent {
  type: 'PROTOCOL_ERROR';
  protocolVersion: typeof PROTOCOL_VERSION;
  code: string;
  message: string;
  requestType?: string;
}

export interface ServerNoticeEvent {
  type: 'SERVER_NOTICE';
  protocolVersion: typeof PROTOCOL_VERSION;
  level: 'INFO' | 'WARNING';
  message: string;
}

export interface AiInsightEvent {
  type: 'AI_INSIGHT';
  protocolVersion: typeof PROTOCOL_VERSION;
  insight: AiInsight;
}

export type ClientMessage = HelloMessage | TelemetryUpdateMessage | ZoneCommandMessage | CommandAckMessage;
export type ServerMessage =
  | SystemSnapshot
  | CommandPendingEvent
  | CommandResultEvent
  | ConnectionStatusEvent
  | ProtocolErrorEvent
  | ServerNoticeEvent
  | AiInsightEvent;

export const createEmptyZones = (): ZoneStates => ({
  zone1: false,
  zone2: false,
  zone3: false,
  zone4: false,
  zone5: false
});

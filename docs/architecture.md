# Architecture

## Components

### Node server

The server owns all trust-sensitive behavior:

- Express HTTP application and production static hosting
- WebSocket upgrade at `/ws`
- HELLO registration and role allowlisting
- Optional hardware and dashboard shared-secret authentication
- Payload-size limits and Zod validation
- Hardware/dashboard connection registry
- Telemetry normalization and bounded in-memory history
- Derived load/solar power and conservative savings integration
- Five-zone command pending, ACK, rejection, and timeout lifecycle
- Protection lockout
- Ping/pong heartbeat and stale-data detection
- Optional Cerebras advisory calls with timeout and backoff

### React dashboard

The dashboard renders only sanitized server state. It never receives provider API keys or hardware secrets. It reconnects with bounded exponential backoff, displays last-known data as stale, and marks commands pending until the hardware acknowledges them.

### Simulator

The Node simulator behaves like an authenticated hardware client. It generates deterministic telemetry, receives commands, updates zone state, and sends matching ACK messages. It supports fault scenarios without pretending to be ESP32 firmware.

## Data flow

1. A client connects to `/ws` and sends `HELLO` within five seconds.
2. The server authenticates and registers the client as `HARDWARE` or `DASHBOARD`.
3. Hardware sends validated `TELEMETRY_UPDATE` packets.
4. The server updates bounded state, derives metrics, and broadcasts a full `SYSTEM_SNAPSHOT`.
5. A dashboard sends an allowlisted `ZONE_COMMAND` with a UUID.
6. The server checks hardware availability, freshness, protection lockout, and duplicate pending state.
7. The server forwards the normalized command to hardware and broadcasts `COMMAND_PENDING`.
8. Hardware sends `COMMAND_ACK` using the same command ID.
9. The server broadcasts `COMMAND_RESULT`; only then does the UI show confirmation.

## Failure isolation

- Invalid JSON returns `PROTOCOL_ERROR` and does not crash the broker.
- Invalid schemas are rejected with concise messages.
- AI failure never blocks telemetry or control.
- Hardware loss marks telemetry stale and disables controls.
- A protection trip creates immediate deterministic warning and lockout.
- Slow browser clients do not receive unbounded queues; sends are skipped when buffered output is excessive.

## Persistence

The initial product intentionally stores telemetry only in memory. This avoids database maintenance and privacy expansion. A future persistent-history module can be added behind the telemetry store without changing the protocol.

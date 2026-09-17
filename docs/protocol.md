# WebSocket Protocol 1.0

All messages are UTF-8 JSON. The WebSocket path is `/ws`. The default maximum message size is 65,536 bytes.

## Registration

Every client must send `HELLO` within five seconds.

### Hardware

```json
{
  "type": "HELLO",
  "protocolVersion": "1.0",
  "role": "HARDWARE",
  "clientId": "mini-grid-esp32-01",
  "token": "configured-hardware-secret",
  "simulated": false
}
```

### Dashboard

```json
{
  "type": "HELLO",
  "protocolVersion": "1.0",
  "role": "DASHBOARD",
  "clientId": "dashboard-generated-uuid",
  "token": "configured-dashboard-token"
}
```

`token` is omitted when the corresponding server secret is empty. `simulated` is optional and should be true only for the software simulator.

## Telemetry update

Hardware sends telemetry every 250–500 ms.

```json
{
  "type": "TELEMETRY_UPDATE",
  "protocolVersion": "1.0",
  "timestamp": 1690000000000,
  "sequence": 2451,
  "data": {
    "voltages": {
      "solar": 13.8,
      "battery": 12.5,
      "grid": 12.0,
      "load": 12.2
    },
    "currents": {
      "solar": 1.2,
      "load": 0.8
    },
    "status": {
      "overChargeTrip": false,
      "overDischargeTrip": false,
      "activeSource": "SOLAR"
    },
    "zones": {
      "zone1": true,
      "zone2": false,
      "zone3": true,
      "zone4": false,
      "zone5": true
    }
  }
}
```

Units are volts, amperes, and Unix milliseconds. `activeSource` is one of `SOLAR`, `BATTERY`, `GRID`, or `UNKNOWN`.

## Zone command

Dashboard to server, then normalized server to hardware:

```json
{
  "type": "ZONE_COMMAND",
  "protocolVersion": "1.0",
  "commandId": "f8d4db10-1059-4ea2-bdc6-ff794420ac7a",
  "timestamp": 1690000000500,
  "zone": "zone2",
  "desiredState": true
}
```

Only `zone1` through `zone5` are accepted. A command is blocked when hardware is unavailable, telemetry is stale, physical protection is active, or the same zone already has a pending command.

## Hardware acknowledgement

```json
{
  "type": "COMMAND_ACK",
  "protocolVersion": "1.0",
  "commandId": "f8d4db10-1059-4ea2-bdc6-ff794420ac7a",
  "timestamp": 1690000000600,
  "accepted": true,
  "zone": "zone2",
  "actualState": true,
  "reason": null
}
```

Common rejection reasons include `PROTECTION_LOCKOUT`, `INVALID_ZONE`, and `HARDWARE_BUSY`.

## Snapshot

Every newly registered dashboard receives a complete `SYSTEM_SNAPSHOT`; further valid telemetry also produces snapshots. It contains hardware state, current telemetry, derived metrics, bounded history, pending commands, advisory insight, and protection lockout.

## Server event types

- `SYSTEM_SNAPSHOT`
- `CONNECTION_STATUS`
- `COMMAND_PENDING`
- `COMMAND_RESULT`
- `AI_INSIGHT`
- `PROTOCOL_ERROR`
- `SERVER_NOTICE`

## Command lifecycle

```text
Dashboard request
    -> server validates
    -> server checks freshness/protection/pending state
    -> COMMAND_PENDING broadcast
    -> hardware receives ZONE_COMMAND
    -> hardware performs or rejects action
    -> hardware sends COMMAND_ACK
    -> COMMAND_RESULT broadcast
```

WebSocket send completion is not execution confirmation. If no ACK arrives before `COMMAND_TIMEOUT_MS`, the server emits a failed `COMMAND_RESULT` with `ACK_TIMEOUT` and does not blindly retry the physical operation.

## Heartbeat and staleness

The server sends WebSocket ping frames on `HEARTBEAT_INTERVAL_MS`. Unresponsive sockets are terminated. Telemetry is marked stale after `TELEMETRY_STALE_MS`; controls are disabled until fresh telemetry returns.

## Protocol errors

Errors are safe JSON events and never include stack traces or secrets.

```json
{
  "type": "PROTOCOL_ERROR",
  "protocolVersion": "1.0",
  "code": "INVALID_TELEMETRY",
  "message": "data.voltages.solar: Expected number",
  "requestType": "TELEMETRY_UPDATE"
}
```

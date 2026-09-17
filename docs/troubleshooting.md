# Troubleshooting

## Server does not start

1. Run `node --version`; Node 22 or newer is expected.
2. Run `npm install` from the project root.
3. Confirm `.env` values are valid numbers/URLs.
4. Check whether port 3000 is occupied.
5. Run `npm run typecheck` for import or syntax problems.

Use another port:

```dotenv
PORT=3100
```

## Dashboard opens but says server offline

- Development UI must run with `npm run dev:client` and server with `npm run dev:server`.
- Production UI must be built with `npm run build` before `npm start`.
- Confirm `/api/health` opens in the browser.
- Check that the browser origin is listed in `ALLOWED_ORIGINS`.

## Hardware waiting

Run the simulator:

```bash
npm run dev:simulator
```

When `HARDWARE_SHARED_SECRET` is configured, pass the same value in the simulator environment or with `--secret`.

## Dashboard asks for a key repeatedly

The server has `DASHBOARD_ACCESS_TOKEN` configured. Enter the exact value. The token is case-sensitive and remains only in browser session storage. Close the browser tab to clear it, or clear session storage in developer tools.

## Controls are disabled

Controls are intentionally disabled when:

- Hardware is disconnected.
- Telemetry is stale.
- Over-charge protection is active.
- Over-discharge protection is active.
- A command for the same zone is already pending.

Read the reason displayed under the zone control.

## Commands time out

- Confirm hardware receives the forwarded command.
- Confirm ACK uses the same `commandId`.
- Confirm the ACK arrives before `COMMAND_TIMEOUT_MS`.
- Use `normal` simulator mode to establish a baseline.
- Use `delayed-ack` to verify timeout behavior intentionally.

## AI insights remain local

This is expected unless all of these are configured:

```dotenv
AI_INSIGHTS_ENABLED=true
CEREBRAS_API_KEY=...
CEREBRAS_MODEL=...
```

Restart the server after editing `.env`. Telemetry and controls remain functional without AI.

## Phone cannot connect on LAN

1. Set `HOST=0.0.0.0`.
2. Add the exact phone-facing URL to `ALLOWED_ORIGINS`.
3. Use the PC's LAN IP, not `127.0.0.1`.
4. Permit the selected port through the local firewall only for trusted/private networks.
5. Ensure both devices are on the same LAN and client isolation is disabled.

Do not expose the server through router port forwarding.

## Production page returns 404

Run:

```bash
npm run build
npm start
```

The server hosts files from `dist/client` only after a successful frontend build.

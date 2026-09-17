# ⚡ Hybrid Solar-Grid Control System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

> **Real-time telemetry • 5-zone load control • Protection lockout • AI advisory**

A local-first IoT dashboard for hybrid Solar–Battery–Grid demonstration systems. Monitor solar production, battery state-of-charge, grid import/export, and five independent load zones from a responsive React dashboard.

---

## 🎯 The Problem It Solves

Hybrid solar-grid systems need transparent source selection, honest savings estimation, and responsive remote control. Most solutions either hide the physics behind proprietary clouds or overclaim savings. This system does neither.

---

## 📡 Architecture

```
┌─────────────────────────┐         WebSocket          ┌───────────────────────────────┐
│   ESP32 / Simulator     │ ◄────────────────────────►  │   Node.js + Express Broker    │
│   (telemetry + ACK)     │                              │   HTTPS → Cerebras API        │
└─────────────────────────┘                              └──────────────┬────────────────┘
                                                                       │
                                                              WebSocket snapshots
                                                              + zone commands
                                                                       ▼
                                                          ┌────────────────────────────┐
                                                          │  React / Vite Dashboard    │
                                                          │  Desktop + Mobile          │
                                                          └────────────────────────────┘
```

| Layer | Tech | Responsibility |
|-------|------|----------------|
| **Frontend** | React 18 + TypeScript + Vite | Real-time gauges, charts, zone control |
| **Backend** | Node.js + Express + ws | WebSocket broker, protocol enforcement |
| **Protocol** | Custom JSON over WS | Telemetry snapshots, command+ACK |
| **AI** | Cerebras API (optional) | Advisory insights, graceful fallback |
| **Sim** | Node.js standalone | Test without hardware |

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/MdSadman20040812/hybrid-solar-grid.git
cd hybrid-solar-grid

# Install
npm install
cp .env.example .env

# Demo with simulator (no hardware needed)
npm run dev
# → http://127.0.0.1:5173

# Production
npm run build
npm start
```

---

## 🎮 Demo Simulator

Test the full system without hardware:

```bash
# Normal operation
npm run dev:simulator -- --scenario normal

# Edge cases
npm run dev:simulator -- --scenario overcharge
npm run dev:simulator -- --scenario overdischarge
npm run dev:simulator -- --scenario malformed
npm run dev:simulator -- --scenario delayed-ack
npm run dev:simulator -- --scenario rejected
npm run dev:simulator -- --scenario disconnect

# Direct control
npm run dev:simulator -- --source SOLAR --interval 400 --seed 42
```

---

## 🖥️ Dashboard Features

- **Live Gauges** — solar power, battery SoC, grid flow, zone status
- **Energy Mix Donut** — solar vs. battery vs. grid split
- **Savings Trajectory** — honest estimated savings (explicitly labeled estimate)
- **Five-Zone Control** — acknowledged on/off with protection lockout
- **Engineering HUD** — raw telemetry for diagnostics
- **Command Palette** — keyboard-first zone control
- **Trend Charts** — short history of key metrics

---

## 📡 Protocol

Custom JSON-over-WebSocket protocol with:

- **Telemetry Snapshots** — server → client, 500ms default
- **Zone Commands** — client → server → hardware → ACK
- **Protection Lockout** — automatic lockout on over/under-voltage
- **Graceful Degradation** — all functions work without AI

See [docs/protocol.md](docs/protocol.md) for full specification.

---

## 🔒 Security

| Feature | Status |
|---------|--------|
| Shared-secret hardware auth | ✅ |
| Dashboard access token | ✅ |
| No secrets in frontend | ✅ |
| LAN-only default | ✅ |
| No cloud dependency | ✅ |

---

## 🧪 Testing

```bash
npm run check          # full quality gate: lint + typecheck + test
npm run test           # unit, UI, WebSocket integration
npm run lint           # ESLint
npm run typecheck      # TypeScript validation
```

---

## 📁 Project Structure

```
hybrid-solar-grid/
├── client/              # React + TypeScript dashboard
│   └── src/
│       ├── components/  # Gauges, charts, panels, city
│       ├── hooks/       # WebSocket connection management
│       ├── utils/       # Derived metrics, formatters
│       └── test/        # UI tests
├── server/              # Node.js broker
│   └── src/
│       ├── services/    # Telemetry, commands, Cerebras
│       └── websocket/   # Protocol broker
├── simulator/           # Standalone hardware simulator
├── shared/              # Protocol types and schemas
├── docs/                # Architecture, protocol, troubleshooting
└── electronics/         # LTSpice, schematics, wiring
```

---

## 📡 Electronics

The `electronics/` folder contains reference designs:

| File | Description |
|------|-------------|
| `Draft1.asc` | LTSpice full microgrid simulation |
| `source_select_hysteresis.cir` | Source-selection hysteresis circuit |
| `streetlight_ldr_hysteresis.cir` | LDR-based streetlight control |
| `mosfet_alternate_d6_d7.ino` | Arduino MOSFET gate driver |
| `uno-hc05-visual.html` | Interactive wiring guide |
| `dual-load-switching-schematic.svg` | Dual-load switching schematic |
| `MicrogridSchematic.tsx` | Interactive React schematic viewer |
| `wiring-interactive.html` | Full interactive wiring diagram |

> **Note:** This repo provides reference designs and simulations only. Physical implementation must follow local electrical codes and safety standards.

---

## 📊 Honest Savings Model

The system counts **only direct solar operation** as estimated avoided grid energy. Battery discharge is not claimed as solar savings because provenance is unknown. All savings figures are explicitly labeled as **estimates**, not utility-grade measurements.

Configurable via `.env`:
```dotenv
GRID_TARIFF_PER_KWH=10
CURRENCY_CODE=BDT
```

---

## 🤖 AI Advisory (Optional)

When a Cerebras API key is configured, the system provides intelligent advisory insights. When absent or unreachable, deterministic local advisories continue to work. No feature is gated behind AI.

```dotenv
CEREBRAS_API_KEY=your_key_here
CEREBRAS_MODEL=gpt-oss-120b
AI_INSIGHTS_ENABLED=true
```

---

## 👥 Contributors

| Name | Role |
|------|------|
| **Md Sadman Bin Masud** | System architecture, firmware, backend |
| **Mayesha Muntaha** | Frontend dashboard, telemetry visualization |
| **Shihab Uddin** | Electronics design, simulation, testing |
| **Rafith** | Hardware integration, protocol design |

> **Institution:** Electronics 202 — Spring 2025 — MIST Dhaka

---

## 📄 License

MIT — see [LICENSE](LICENSE)

---

<div align="center">

**⚡ Built with rigor. Deployed with evidence. ⚡**

[Demo](https://mdsadman20040812.github.io) • [Report Bug](../../issues) • [Request Feature](../../issues)

</div>

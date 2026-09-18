# ⚡ Hybrid Solar-Grid Control System

**Real-time telemetry • 5-zone load control • Protection lockout • AI advisory**

![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

A local-first IoT dashboard for hybrid Solar–Battery–Grid demonstration systems. Monitor solar production, battery state-of-charge, grid import/export, and five independent load zones from a responsive React dashboard.

---

## The Problem It Solves

Hybrid solar-grid systems need transparent source selection, honest savings estimation, and responsive remote control. Most solutions either hide the physics behind proprietary clouds or overclaim savings. This system does neither.

---

## Architecture

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

## Quick Start

```bash
git clone https://github.com/MdSadman20040812/hybrid-solar-grid.git
cd hybrid-solar-grid
npm install
cp .env.example .env

# Demo with simulator (no hardware needed)
npm run dev
# → http://127.0.0.1:5173
```

### Production

```bash
npm run build
npm start
```

### Simulate Hardware

```bash
node dist/simulator/simulator/src/index.js --scenario normal
node dist/simulator/simulator/src/index.js --scenario overcharge
node dist/simulator/simulator/src/index.js --scenario overdischarge
```

---

## Features

- **5-zone independent load control** — toggle loads from dashboard
- **Real-time telemetry** — voltage, current, source selection
- **Protection lockout** — automatic disconnect on fault conditions
- **7 simulation scenarios** — normal, overcharge, overdischarge, malformed, delayed-ack, rejected, disconnect
- **Honest economics panel** — actual vs. projected savings

---

## Structure

```
hybrid-solar-grid/
├── client/                  # React + Vite dashboard
│   └── src/components/
│       ├── EnergyMixDonut.tsx
│       ├── EngineeringHUD.tsx
│       ├── EconomicsPanel.tsx
│       └── Esp32BridgeGuide.tsx
├── server/                  # Node.js + Express broker
├── simulator/               # Hardware simulator (7 scenarios)
├── shared/                  # Protocol definitions
└── USER_MANUAL.md           # Complete setup guide
```

---

## License

MIT © Md Sadman Bin Masud, Mayesha Muntaha, Shihab Uddin, Rafith

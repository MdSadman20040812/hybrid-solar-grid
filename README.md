![Hybrid Solar-Grid](https://img.shields.io/badge/⚡-Hybrid%20Solar--Grid-f59e0b?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=node.js)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

**Real-time telemetry • 5-zone load control • Protection lockout • AI advisory**

---

## 🔌 Electronics Schematic

![Dual Load Switching Schematic](electronics/dual-load-switching-schematic.svg)
*Diode-OR automatic transfer switch — highest-voltage-wins source selection with Zener clamps and Darlington driver.*

![UNO HC-05 Visual](electronics/uno-hc05-visual.svg)
*Interactive wiring guide — ESP32/Arduino bridge visualization.*

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph Sources["⚡ Power Sources"]
        SOLAR[Solar Array]
        BATTERY[Battery Bank]
        GRID[Utility Grid]
    end
    subgraph Hardware["🔧 Hardware Layer"]
        ESP32[ESP32<br/>Telemetry + ACK]
        SIM[Node Simulator<br/>7 scenarios]
    end
    subgraph Backend["⚙️ Backend"]
        BROKER[WS Broker<br/>Express + ws]
        PROTOCOL[JSON Protocol<br/>Snapshots + Commands]
        AI[AI Advisory<br/>Cerebras API]
    end
    subgraph Frontend["📊 Frontend"]
        DASH[React + Vite Dashboard<br/>Desktop + Mobile]
        GAUGES[Real-time Gauges]
        ECON[Economics Panel]
    end
    SOLAR --> ESP32
    BATTERY --> ESP32
    GRID --> ESP32
    ESP32 <-->|WebSocket| BROKER
    SIM --> BROKER
    BROKER --> PROTOCOL
    BROKER --> AI
    BROKER <--> DASH
    DASH --> GAUGES
    DASH --> ECON
```

---

## ✨ Features

- **5-zone independent load control** — toggle from dashboard
- **Real-time telemetry** — voltage, current, source selection
- **Protection lockout** — automatic disconnect on fault conditions
- **7 simulation scenarios** — normal, overcharge, overdischarge, malformed, delayed-ack, rejected, disconnect
- **Honest economics panel** — actual vs projected savings
- **AI advisory** — Cerebras-powered insights with graceful fallback

---

## 🚀 Quick Start

```bash
git clone https://github.com/MdSadman20040812/hybrid-solar-grid.git
cd hybrid-solar-grid
npm install
cp .env.example .env
npm run dev          # Demo with simulator
# → http://127.0.0.1:5173
```

---

## 📁 Project Structure

```
hybrid-solar-grid/
├── client/                        # React + Vite dashboard
│   └── src/components/
│       ├── EnergyMixDonut.tsx     # Source distribution chart
│       ├── EngineeringHUD.tsx     # Technical metrics display
│       ├── EconomicsPanel.tsx     # Savings calculation
│       └── Esp32BridgeGuide.tsx   # Hardware wiring guide
├── server/                        # Node.js + Express broker
├── simulator/                     # Hardware simulator (7 scenarios)
├── shared/                        # Protocol definitions
├── electronics/                   # SVG schematics
├── USER_MANUAL.md                 # Complete setup guide
└── README.md
```

---

## 👥 Contributors

Md Sadman Bin Masud • Mayesha Muntaha • Shihab Uddin • Rafith

---

## 📄 License

MIT © Md Sadman Bin Masud, Mayesha Muntaha, Shihab Uddin, Rafith

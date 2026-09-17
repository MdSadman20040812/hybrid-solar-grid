import React, { useState, useRef, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Info, X, ToggleLeft, ToggleRight } from "lucide-react";

// ---------------------------------------------------------------------------
// DESIGN TOKENS
// ---------------------------------------------------------------------------
const COLORS = {
  bg: "#0a1220",
  grid: "#13233a",
  panel: "#0e1c30",
  panelBorder: "#25405e",
  stroke: "#d8c9a0",
  strokeDim: "#5c6b82",
  text: "#e9edf3",
  textDim: "#93a3ba",
  power: "#f0a860",
  ground: "#64748b",
  control: "#5fd0e0",
  sense: "#c98cf0",
  bus: "#f5c26b",
  zone: ["#ef5350", "#f59e42", "#eab308", "#4ade80", "#f5deb3"],
};

const MONO = 'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace';
const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// ---------------------------------------------------------------------------
// UNIT DATA — geometry + engineering content
// ---------------------------------------------------------------------------
const ZONE_X = [90, 340, 590, 840, 1090];
const ZONE_GPIO = ["GPIO 25", "GPIO 26", "GPIO 27", "GPIO 14", "GPIO 13"];
const ZONE_NAME = ["Zone 1 · Hospital", "Zone 2 · Water/Comms", "Zone 3 · Residential", "Zone 4 · Commercial", "Zone 5 · Streetlights"];
const ZONE_PRIO = ["Never shed", "Shed only if bus < 9.5V", "Shed on backup power + high load", "First to shed", "Auto-gated by darkness"];

const UNITS = [
  {
    id: "solar", title: "Solar Panel", sub: "12–18V / 5–10W", x: 60, y: 20, w: 190, h: 64, kind: "source",
    mechanism: "Photovoltaic panel, variable open-circuit voltage depending on irradiance.",
    connections: ["(+) → Unit 1 charge-limiter IN, and → optional Unit 5 direct-feed tap", "(−) → common ground"],
  },
  {
    id: "aux", title: "Auxiliary DC Supply", sub: "12V / 2A adapter or bench PSU", x: 1200, y: 20, w: 190, h: 64, kind: "source",
    mechanism: "Stands in for grid/backup power. Feeds Unit 4's high-side switch only.",
    connections: ["(+) → Unit 4 PMOS source (Vaux)", "(−) → common ground"],
  },
  {
    id: "u1", title: "UNIT 1 — Solar Charge Reg", sub: "LM317 constant-current", x: 60, y: 150, w: 220, h: 100, kind: "power",
    mechanism: "LM317 configured as constant-current source: a sense resistor across ADJ sets the charge-current limit off the LM317's internal 1.25V reference, preventing panel Voc swings from overcharging the pack.",
    connections: ["Solar(+) → LM317 IN", "LM317 OUT → R_sense (0.5–1Ω) → Unit 2 charge input", "ADJ → feedback divider at R_sense junction"],
  },
  {
    id: "u5", title: "UNIT 5 — Solar-Direct Droop (optional)", sub: "Tier-2 proportional sharing", x: 330, y: 150, w: 250, h: 100, kind: "power", optional: true,
    mechanism: "Taps solar pre-charge node directly onto the bus through its own droop resistor, letting solar and battery share load current in a ratio set by relative droop resistance — build only after the core system works.",
    connections: ["Solar-regulated node → R_droop_solar (0.1–0.5Ω) → 1N5822 → Bus", "Battery(+) path also gets its own R_droop_batt at the same bus junction"],
  },
  {
    id: "u2", title: "UNIT 2 — Battery Pack + BMS", sub: "3S 18650 + commercial protection module", x: 60, y: 300, w: 240, h: 110, kind: "power",
    mechanism: "Three series 18650 cells behind a bought 3S BMS protection module — the real safety layer (OVP/UVP/balance). This is intentionally not home-built: a failure here risks the physical cells.",
    connections: ["Cell taps B1+/B2/B3/B− → BMS balance-sense pins", "BMS Pack(+)/Pack(−) → Unit 1 charge in, Unit 3 sense tap, Unit 4 battery input"],
  },
  {
    id: "u3", title: "UNIT 3 — SoC Indicator", sub: "LM339 (2 ch) + TL431 + 3 LEDs", x: 340, y: 300, w: 220, h: 110, kind: "signal",
    mechanism: "Two LM339 channels compare pack voltage (divider) against two TL431-referenced trimmer thresholds. Open-collector outputs (pulled up) drive green/yellow/red status LEDs directly.",
    connections: ["Pack(+) → 100k/10k divider → LM339 non-inv inputs (both ch)", "TL431 2.5V → trimmer #1/#2 → LM339 inv inputs", "LM339 outs → 10k pull-ups → status LEDs"],
  },
  {
    id: "u4", title: "UNIT 4 — Source-Select Switch", sub: "LM339 hysteresis + NPN driver + PMOS", x: 860, y: 150, w: 300, h: 170, kind: "power",
    mechanism: "Hysteresis comparator (positive feedback Rfb) trips an NPN gate-driver, which pulls the high-side PMOS gate to GND, connecting Aux to the bus only when battery has genuinely dropped below the tuned lower threshold.",
    connections: ["Pack(+) → 100k/10k divider → 'sense' → LM339 non-inv", "TL431 → trimmer → Rref(100k) → 'ref' → LM339 inv", "LM339 out → Rfb(15k) back to 'ref' (hysteresis)", "LM339 out → pull-up → Rbase → NPN base", "NPN collector → PMOS gate; Rpu(100k) gate→Vaux", "PMOS drain + Battery(+) diode-OR (1N5822 × 2) → Bus"],
  },
  {
    id: "u6", title: "UNIT 6 — Streetlight LDR", sub: "LM339 hysteresis, dusk/dawn", x: 1090, y: 460, w: 240, h: 100, kind: "signal",
    mechanism: "LDR divider off 3.3V feeds an LM339 hysteresis comparator (same topology as Unit 4) so ambient-light flicker near the threshold doesn't chatter the streetlight.",
    connections: ["3.3V → LDR → 'sense' (10k to GND)", "TL431 → trimmer → Rref → 'ref'; Rfb(20k) feedback", "LM339 out → pull-up → gate of M5a (Zone 5's first MOSFET)"],
  },
  {
    id: "u8", title: "UNIT 8 — ESP32 Controller", sub: "Telemetry + zone commands + WebSocket", x: 560, y: 900, w: 320, h: 120, kind: "signal",
    mechanism: "Reads bus/solar/battery via ADC (GPIO 32/34/35), publishes TELEMETRY_UPDATE ~2–4Hz, receives ZONE_COMMAND, drives zone gates, replies COMMAND_ACK — speaks the dashboard's exact WebSocket protocol.",
    connections: ["GPIO 34/35/32 ← voltage dividers (solar / aux / bus)", "GPIO 25/26/27/14/13 → zone MOSFET gates (220Ω series, 100k pull-down each)", "Wi-Fi → dashboard WebSocket"],
  },
  {
    id: "dash", title: "Dashboard (Web UI)", sub: "WebSocket · HELLO / TELEMETRY / ZONE_COMMAND", x: 560, y: 1070, w: 320, h: 60, kind: "signal",
    mechanism: "Your friend's app — hardware role connects via WebSocket, sends periodic telemetry, receives and ACKs zone commands. Runs against the bundled simulator for dev before real hardware exists.",
    connections: ["Protocol: HELLO → TELEMETRY_UPDATE (250–500ms) → ZONE_COMMAND / COMMAND_ACK"],
  },
];

const BUS_Y = 460;
const BUS_X0 = 60;
const BUS_X1 = 1390;

// static wires not tied to zone loop (drawn as polylines)
function buildWires(showOptional) {
  const w = [
    { id: "solar-u1", pts: `150,84 150,150`, type: "power" },
    { id: "u1-u2", pts: `170,250 170,300`, type: "power" },
    { id: "u2-u3", pts: `300,340 340,340`, type: "power" },
    { id: "u2-u4a", pts: `300,355 700,355 700,260 860,260`, type: "power" },
    { id: "aux-u4", pts: `1295,84 1295,190 1160,190`, type: "power" },
    { id: "u4-bus", pts: `1010,320 1010,${BUS_Y}`, type: "power" },
    { id: "u2-bus-direct", pts: `300,320 320,320 320,${BUS_Y}`, type: "power" },
    { id: "u6-zone5", pts: `1180,460 1180,420 1190,420 1190,560`, type: "control" },
    { id: "esp32-wifi-dash", pts: `720,900 720,1070`, type: "control" },
  ];
  if (showOptional) {
    w.push({ id: "solar-u5", pts: `250,84 250,120 400,120 400,150`, type: "power", dashed: true });
    w.push({ id: "u5-bus", pts: `450,250 450,${BUS_Y}`, type: "power", dashed: true });
  }
  return w;
}

function WireLine({ pts, type, dashed, highlighted }) {
  const stroke =
    type === "power" ? COLORS.power : type === "ground" ? COLORS.ground : type === "sense" ? COLORS.sense : COLORS.control;
  return (
    <polyline
      points={pts}
      fill="none"
      stroke={stroke}
      strokeWidth={highlighted ? 4 : type === "power" ? 3 : 2}
      strokeDasharray={dashed || type === "sense" ? "6 5" : type === "control" ? "3 4" : undefined}
      opacity={highlighted ? 1 : 0.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function UnitBox({ u, selected, onClick }) {
  const accent =
    u.kind === "source" ? COLORS.power : u.kind === "power" ? COLORS.power : COLORS.control;
  return (
    <g
      onClick={() => onClick(u.id)}
      style={{ cursor: "pointer" }}
      opacity={u.optional && !selected ? 0.55 : 1}
    >
      <rect
        x={u.x}
        y={u.y}
        width={u.w}
        height={u.h}
        rx={8}
        fill={COLORS.panel}
        stroke={selected === u.id ? COLORS.stroke : COLORS.panelBorder}
        strokeWidth={selected === u.id ? 2.5 : 1.3}
      />
      <rect x={u.x} y={u.y} width={6} height={u.h} rx={3} fill={accent} opacity={0.85} />
      <text x={u.x + 18} y={u.y + 26} fill={COLORS.text} fontSize={13.5} fontWeight={700} fontFamily={SANS}>
        {u.title}
      </text>
      <text x={u.x + 18} y={u.y + 44} fill={COLORS.textDim} fontSize={11} fontFamily={MONO}>
        {u.sub}
      </text>
      {u.optional && (
        <text x={u.x + u.w - 14} y={u.y + 18} fill={COLORS.sense} fontSize={9.5} fontFamily={SANS} textAnchor="end">
          OPTIONAL
        </text>
      )}
    </g>
  );
}

function ZoneColumn({ idx, x, selected, onClick }) {
  const color = COLORS.zone[idx];
  const isZone5 = idx === 4;
  const mosfetY = isZone5 ? 560 : 560;
  const id = `zone${idx + 1}`;
  return (
    <g onClick={() => onClick(id)} style={{ cursor: "pointer" }}>
      {/* drop from bus */}
      <line x1={x + 90} y1={BUS_Y} x2={x + 90} y2={mosfetY} stroke={COLORS.power} strokeWidth={3} opacity={0.8} />

      {isZone5 && (
        <>
          <rect x={x} y={mosfetY} width={180} height={40} rx={6} fill={COLORS.panel} stroke={selected === id ? COLORS.stroke : color} strokeWidth={selected === id ? 2.5 : 1.4} />
          <text x={x + 90} y={mosfetY + 25} textAnchor="middle" fill={COLORS.text} fontSize={11} fontFamily={MONO}>M5a ← LDR (Unit 6)</text>
          <line x1={x + 90} y1={mosfetY + 40} x2={x + 90} y2={mosfetY + 60} stroke={COLORS.power} strokeWidth={3} />
          <rect x={x} y={mosfetY + 60} width={180} height={40} rx={6} fill={COLORS.panel} stroke={selected === id ? COLORS.stroke : color} strokeWidth={selected === id ? 2.5 : 1.4} />
          <text x={x + 90} y={mosfetY + 85} textAnchor="middle" fill={COLORS.text} fontSize={11} fontFamily={MONO}>M5b ← {ZONE_GPIO[idx]}</text>
        </>
      )}
      {!isZone5 && (
        <>
          <rect x={x} y={mosfetY} width={180} height={44} rx={6} fill={COLORS.panel} stroke={selected === id ? COLORS.stroke : color} strokeWidth={selected === id ? 2.5 : 1.4} />
          <text x={x + 90} y={mosfetY + 27} textAnchor="middle" fill={COLORS.text} fontSize={11.5} fontFamily={MONO}>N-MOSFET ← {ZONE_GPIO[idx]}</text>
        </>
      )}

      {/* LED matrix 3x3 */}
      {(() => {
        const ledsY = isZone5 ? mosfetY + 120 : mosfetY + 64;
        const cells = [];
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            cells.push(
              <circle key={`${r}-${c}`} cx={x + 40 + c * 50} cy={ledsY + 20 + r * 30} r={9} fill={color} opacity={0.85} stroke="#000" strokeWidth={0.5} />
            );
          }
        }
        return (
          <g>
            <rect x={x} y={ledsY} width={180} height={110} rx={6} fill={COLORS.panel} stroke={selected === id ? COLORS.stroke : COLORS.panelBorder} strokeWidth={selected === id ? 2.5 : 1.2} />
            {cells}
          </g>
        );
      })()}

      <text x={x + 90} y={isZone5 ? mosfetY + 250 : mosfetY + 195} textAnchor="middle" fill={color} fontSize={12.5} fontWeight={700} fontFamily={SANS}>
        {ZONE_NAME[idx]}
      </text>
      <text x={x + 90} y={isZone5 ? mosfetY + 266 : mosfetY + 211} textAnchor="middle" fill={COLORS.textDim} fontSize={10} fontFamily={MONO}>
        {ZONE_PRIO[idx]}
      </text>

      {/* control line from ESP32 up to gate (visual only, drawn from bottom) */}
      <line
        x1={x + 90}
        y1={isZone5 ? mosfetY + 100 : mosfetY + 44}
        x2={x + 90}
        y2={900}
        stroke={COLORS.control}
        strokeWidth={1.6}
        strokeDasharray="3 4"
        opacity={0.5}
      />
    </g>
  );
}

export default function MicrogridSchematic() {
  const [selected, setSelected] = useState(null);
  const [showOptional, setShowOptional] = useState(false);
  const [scale, setScale] = useState(0.62);
  const [pan, setPan] = useState({ x: 20, y: 10 });
  const dragRef = useRef(null);

  const onPointerDown = useCallback(
    (e) => {
      dragRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
    },
    [pan]
  );
  const onPointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    setPan({ x: dragRef.current.px + dx, y: dragRef.current.py + dy });
  }, []);
  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const selectedUnit = UNITS.find((u) => u.id === selected);
  const zoneDetail = selected && selected.startsWith("zone")
    ? {
        idx: Number(selected.replace("zone", "")) - 1,
      }
    : null;

  const wires = buildWires(showOptional);

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: SANS,
        color: COLORS.text,
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 18px",
          borderBottom: `1px solid ${COLORS.panelBorder}`,
          background: COLORS.panel,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.3 }}>Hybrid Smart Microgrid — Full Wiring Schematic</div>
          <div style={{ fontSize: 11.5, color: COLORS.textDim, fontFamily: MONO }}>
            Click any block for mechanism + exact connections · drag canvas to pan
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <button
            onClick={() => setShowOptional((s) => !s)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "transparent",
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 6,
              padding: "6px 10px",
              color: showOptional ? COLORS.sense : COLORS.textDim,
              fontSize: 11.5,
              cursor: "pointer",
              fontFamily: SANS,
            }}
          >
            {showOptional ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            Tier-2 optional module (Unit 5)
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            <IconBtn onClick={() => setScale((s) => Math.min(1.4, s + 0.1))} label="Zoom in"><ZoomIn size={16} /></IconBtn>
            <IconBtn onClick={() => setScale((s) => Math.max(0.3, s - 0.1))} label="Zoom out"><ZoomOut size={16} /></IconBtn>
            <IconBtn onClick={() => { setScale(0.62); setPan({ x: 20, y: 10 }); }} label="Reset view"><RotateCcw size={16} /></IconBtn>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", position: "relative", overflow: "hidden" }}>
        {/* Canvas */}
        <div
          style={{ flex: 1, overflow: "hidden", cursor: dragRef.current ? "grabbing" : "grab", position: "relative" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <svg width="100%" height="100%" style={{ display: "block" }}>
            <defs>
              <pattern id="grid" width={28} height={28} patternUnits="userSpaceOnUse">
                <path d="M 28 0 L 0 0 0 28" fill="none" stroke={COLORS.grid} strokeWidth={1} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={COLORS.bg} />
            <rect width="100%" height="100%" fill="url(#grid)" />

            <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
              {/* main bus rail with flowing current animation (signature element) */}
              <line x1={BUS_X0} y1={BUS_Y} x2={BUS_X1} y2={BUS_Y} stroke={COLORS.bus} strokeWidth={7} opacity={0.35} />
              <line x1={BUS_X0} y1={BUS_Y} x2={BUS_X1} y2={BUS_Y} stroke={COLORS.bus} strokeWidth={3} strokeDasharray="10 8">
                <animate attributeName="stroke-dashoffset" from="0" to="-36" dur="1.4s" repeatCount="indefinite" />
              </line>
              <text x={BUS_X0} y={BUS_Y - 14} fill={COLORS.bus} fontSize={13} fontWeight={700} fontFamily={MONO}>
                MAIN DC BUS — 2200µF × 2 smoothing caps along this rail
              </text>

              {wires.map((w) => (
                <WireLine key={w.id} pts={w.pts} type={w.type} dashed={w.dashed} highlighted={false} />
              ))}

              {UNITS.filter((u) => !u.optional || showOptional).map((u) => (
                <UnitBox key={u.id} u={u} selected={selected} onClick={setSelected} />
              ))}

              {ZONE_X.map((x, i) => (
                <ZoneColumn key={i} idx={i} x={x} selected={selected} onClick={setSelected} />
              ))}
            </g>
          </svg>

          {/* Legend */}
          <div
            style={{
              position: "absolute",
              left: 16,
              bottom: 16,
              background: COLORS.panel,
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 11,
              fontFamily: MONO,
              lineHeight: 1.9,
            }}
          >
            <LegendRow color={COLORS.power} label="Power path" />
            <LegendRow color={COLORS.control} label="Control / GPIO (dashed)" dashed />
            <LegendRow color={COLORS.sense} label="Sense / ADC (dashed)" dashed />
            <LegendRow color={COLORS.bus} label="Main DC bus" />
          </div>
        </div>

        {/* Detail panel */}
        <div
          style={{
            width: selectedUnit || zoneDetail ? 340 : 0,
            transition: "width 0.18s ease",
            background: COLORS.panel,
            borderLeft: selectedUnit || zoneDetail ? `1px solid ${COLORS.panelBorder}` : "none",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {(selectedUnit || zoneDetail) && (
            <div style={{ padding: 20, width: 340 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>
                  {selectedUnit ? selectedUnit.title : ZONE_NAME[zoneDetail.idx]}
                </div>
                <button
                  onClick={() => setSelected(null)}
                  style={{ background: "none", border: "none", color: COLORS.textDim, cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>

              {selectedUnit && (
                <>
                  <div style={{ fontSize: 11.5, color: COLORS.textDim, fontFamily: MONO, marginBottom: 14 }}>
                    {selectedUnit.sub}
                  </div>
                  <SectionLabel>Mechanism</SectionLabel>
                  <p style={{ fontSize: 13, lineHeight: 1.55, color: COLORS.text, marginTop: 4, marginBottom: 16 }}>
                    {selectedUnit.mechanism}
                  </p>
                  <SectionLabel>Connections</SectionLabel>
                  <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none" }}>
                    {selectedUnit.connections.map((c, i) => (
                      <li
                        key={i}
                        style={{
                          fontSize: 12,
                          fontFamily: MONO,
                          color: COLORS.text,
                          background: "rgba(255,255,255,0.03)",
                          border: `1px solid ${COLORS.panelBorder}`,
                          borderRadius: 5,
                          padding: "7px 9px",
                          marginBottom: 6,
                          lineHeight: 1.4,
                        }}
                      >
                        {c}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {zoneDetail && (
                <>
                  <div style={{ fontSize: 11.5, color: COLORS.textDim, fontFamily: MONO, marginBottom: 14 }}>
                    Control pin: {ZONE_GPIO[zoneDetail.idx]}
                  </div>
                  <SectionLabel>Shedding logic</SectionLabel>
                  <p style={{ fontSize: 13, lineHeight: 1.55, marginTop: 4, marginBottom: 16 }}>{ZONE_PRIO[zoneDetail.idx]}</p>
                  <SectionLabel>Wiring (Unit 7 template)</SectionLabel>
                  <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none" }}>
                    {[
                      "Bus(+) → 3 parallel strings of 3 series LEDs → common node",
                      "Common node → MOSFET drain; source → GND",
                      `Gate ← 220Ω ← ${ZONE_GPIO[zoneDetail.idx]}, with 100k pull-down to GND`,
                      zoneDetail.idx === 4
                        ? "Zone 5 only: TWO MOSFETs in series (M5a from Unit 6 LDR, M5b from GPIO 13) — hardware AND"
                        : "Current-limit R per string ≈ 390–470Ω for 3×3 red LEDs at 12V bus",
                    ].map((c, i) => (
                      <li
                        key={i}
                        style={{
                          fontSize: 12,
                          fontFamily: MONO,
                          background: "rgba(255,255,255,0.03)",
                          border: `1px solid ${COLORS.panelBorder}`,
                          borderRadius: 5,
                          padding: "7px 9px",
                          marginBottom: 6,
                          lineHeight: 1.4,
                        }}
                      >
                        {c}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        {!selected && (
          <div
            style={{
              position: "absolute",
              right: 16,
              top: 16,
              background: COLORS.panel,
              border: `1px solid ${COLORS.panelBorder}`,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 11.5,
              color: COLORS.textDim,
              display: "flex",
              alignItems: "center",
              gap: 8,
              maxWidth: 260,
            }}
          >
            <Info size={15} />
            Click any component — sources, Units 1–8, or any zone — for its mechanism and exact wiring.
          </div>
        )}
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, label }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        background: "transparent",
        border: `1px solid ${COLORS.panelBorder}`,
        borderRadius: 6,
        padding: "6px 8px",
        color: COLORS.text,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
      }}
    >
      {children}
    </button>
  );
}

function LegendRow({ color, label, dashed }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg width={22} height={8}>
        <line x1={0} y1={4} x2={22} y2={4} stroke={color} strokeWidth={3} strokeDasharray={dashed ? "4 3" : undefined} />
      </svg>
      <span style={{ color: COLORS.textDim }}>{label}</span>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10.5, letterSpacing: 0.6, textTransform: "uppercase", color: COLORS.sense, fontWeight: 700 }}>
      {children}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import './MiniatureCity.css';

interface MiniatureCityProps {
  zones: {
    zone1: boolean;
    zone2: boolean;
    zone3: boolean;
    zone4: boolean;
    zone5: boolean;
  };
}

type ZoneKey = 'zone1' | 'zone2' | 'zone3' | 'zone4' | 'zone5';

interface ZoneDesign {
  id: ZoneKey;
  label: string;
  color: string;
  emissive: string;
  positions: { x: number; z: number; w: number; d: number; h: number }[];
}

const ZONE_DESIGNS: ZoneDesign[] = [
  {
    id: 'zone1',
    label: 'Z1 · HOSPITAL',
    color: '#0d2236',
    emissive: 'rgba(0,240,255,0.7)',
    positions: [
      { x: -90, z: -40, w: 60, d: 40, h: 86 },
      { x: -50, z: 0, w: 40, d: 30, h: 60 }
    ]
  },
  {
    id: 'zone2',
    label: 'Z2 · HOMES',
    color: '#3a2a14',
    emissive: 'rgba(255,170,0,0.7)',
    positions: [
      { x: 60, z: -60, w: 90, d: 40, h: 50 }
    ]
  },
  {
    id: 'zone3',
    label: 'Z3 · FACTORY',
    color: '#271636',
    emissive: 'rgba(191,90,242,0.7)',
    positions: [
      { x: -110, z: 40, w: 70, d: 60, h: 70 },
      { x: -40, z: 70, w: 50, d: 30, h: 45 }
    ]
  },
  {
    id: 'zone4',
    label: 'Z4 · LIGHTS',
    color: '#2e3a12',
    emissive: 'rgba(229,255,0,0.7)',
    positions: [
      { x: -20, z: 40, w: 30, d: 25, h: 35 }
    ]
  },
  {
    id: 'zone5',
    label: 'Z5 · RESEARCH',
    color: '#3a1414',
    emissive: 'rgba(255,69,58,0.7)',
    positions: [
      { x: 60, z: 40, w: 70, d: 60, h: 110 }
    ]
  }
];

function createWindowTexture(color: string, emissive: string, cols: number, rows: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 64, 64);

  const margin = 4;
  const spacingX = (64 - margin * 2) / cols;
  const spacingY = (64 - margin * 2) / rows;
  const winW = spacingX * 0.5;
  const winH = spacingY * 0.5;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = margin + c * spacingX + (spacingX - winW) / 2;
      const y = margin + r * spacingY + (spacingY - winH) / 2;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, winW, winH);
      ctx.fillStyle = emissive;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(x, y, winW, winH);
      ctx.globalAlpha = 1;
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

function DiagramBuilding({
  x,
  z,
  w,
  d,
  h,
  color,
  emissive,
  active,
  time,
  label
}: {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
  emissive: string;
  active: boolean;
  time: number;
  label: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const texture = useMemo(
    () => createWindowTexture(emissive, emissive, 4, Math.max(2, Math.floor(h / 12))),
    [emissive, h]
  );

  useEffect(() => {
    texture.repeat.set(2, Math.max(2, Math.floor(h / 12)));
  }, [texture, h]);

  useFrame(() => {
    if (glowRef.current) {
      const s = 1 + Math.sin(time * 0.003) * 0.05;
      glowRef.current.scale.set(s, 1, s);
    }
  });

  return (
    <group position={[x, 0, z]}>
      <mesh ref={meshRef} position={[w / 2, h / 2, d / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color={color}
          roughness={0.6}
          metalness={0.2}
          emissive={active ? new THREE.Color(emissive) : new THREE.Color(0x000000)}
          map={texture}
          emissiveMap={texture}
          emissiveIntensity={active ? 0.6 : 0}
        />
      </mesh>
      {active && (
        <mesh ref={glowRef} position={[w / 2, h + 1, d / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w * 1.3, d * 1.3]} />
          <meshBasicMaterial color={emissive} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      {label && (
        <Text
          position={[w / 2, h + 4, d / 2]}
          fontSize={3}
          color="rgba(255,255,255,0.8)"
          anchorX="center"
          anchorY="middle"
          font="https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mPb54C-s0.woff"
        >
          {label}
        </Text>
      )}
    </group>
  );
}

function DiagramHub({ active, time }: { active: boolean; time: number }) {
  const beaconRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (beaconRef.current) {
      beaconRef.current.scale.setScalar(1 + Math.sin(time * 0.004) * 0.2);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[25, 14, 25]} castShadow receiveShadow>
        <boxGeometry args={[50, 28, 50]} />
        <meshStandardMaterial color="#191a23" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[25, 22, 25]}>
        <boxGeometry args={[54, 2, 54]} />
        <meshStandardMaterial color="#2c2c34" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[25, 32, 25]}>
        <cylinderGeometry args={[0.8, 0.8, 14, 8]} />
        <meshStandardMaterial color="#333333" metalness={0.8} />
      </mesh>
      <mesh ref={beaconRef} position={[25, 42, 25]}>
        <sphereGeometry args={[2, 16, 16]} />
        <meshStandardMaterial
          color={active ? 0xff3333 : 0x666666}
          emissive={active ? 0xff0000 : 0x000000}
          emissiveIntensity={active ? 1 : 0}
        />
      </mesh>
      {active && (
        <mesh position={[25, 42, 25]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[6, 14, 32]} />
          <meshBasicMaterial color="#ff3333" transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function DiagramGround() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#11141a" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[200, 8]} />
        <meshStandardMaterial color="#1f2933" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -140]}>
        <planeGeometry args={[200, 8]} />
        <meshStandardMaterial color="#1f2933" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-100, 0, 0]}>
        <planeGeometry args={[8, 280]} />
        <meshStandardMaterial color="#1f2933" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[100, 0, 0]}>
        <planeGeometry args={[8, 280]} />
        <meshStandardMaterial color="#1f2933" roughness={0.9} />
      </mesh>
    </group>
  );
}

function DiagramSolar({ time }: { time: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(time * 0.0002) * 0.08;
    }
  });

  return (
    <group ref={groupRef} position={[-70, 0, -10]}>
      {[-12, 0, 12].map((dx, i) => (
        <group key={i} position={[dx, 0, 0]}>
          <mesh position={[0, 6, 0]} rotation={[0.15, 0, 0]}>
            <boxGeometry args={[10, 0.3, 7]} />
            <meshStandardMaterial color="#1c2c4a" roughness={0.3} metalness={0.6} />
          </mesh>
          <mesh position={[-4.2, 3, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 6, 6]} />
            <meshStandardMaterial color="#333333" metalness={0.7} />
          </mesh>
          <mesh position={[4.2, 3, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 6, 6]} />
            <meshStandardMaterial color="#333333" metalness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function DiagramTrees() {
  const data = useMemo(() => [
    { x: -100, z: -100, s: 1.2 },
    { x: -60, z: -60, s: 1 },
    { x: -10, z: -110, s: 1.4 },
    { x: 40, z: -110, s: 1.1 },
    { x: -100, z: 50, s: 1.5 },
    { x: -70, z: 70, s: 1 },
    { x: 60, z: 65, s: 1.3 },
    { x: 110, z: 20, s: 1 },
    { x: 110, z: 80, s: 1.4 }
  ], []);

  return (
    <group>
      {data.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.5, 0.7, 3, 6]} />
            <meshStandardMaterial color="#5a3a1a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 4, 0]}>
            <coneGeometry args={[2.2, 4.5, 6]} />
            <meshStandardMaterial color="#1f5d2a" roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function DiagramStreetlights() {
  const positions: [number, number][] = useMemo(() => [
    [0, -30], [0, 30], [-30, 0], [30, 0], [-60, -30], [60, 30]
  ], []);

  return (
    <group>
      {positions.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 4.5, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 9, 6]} />
            <meshStandardMaterial color="#27272c" metalness={0.6} />
          </mesh>
          <mesh position={[1.2, 9, 0]}>
            <sphereGeometry args={[0.35, 8, 8]} />
            <meshStandardMaterial color="#ffeaa0" emissive="#ffeaa0" emissiveIntensity={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function DiagramCars({ time }: { time: number }) {
  const data = useMemo(() => [
    { x: -10, z: -20, color: '#5ac8fa', axis: 'x' },
    { x: -25, z: 25, color: '#ff6b6b', axis: 'z' },
    { x: 25, z: 35, color: '#ffd166', axis: 'x' },
    { x: 55, z: -25, color: '#a0e7e5', axis: 'z' }
  ], []);

  return (
    <group>
      {data.map((car, i) => (
        <mesh
          key={i}
          position={[car.x, 0.8, car.z]}
          rotation={[0, car.axis === 'x' ? 0 : Math.PI / 2, 0]}
        >
          <boxGeometry args={[4, 1.5, 2]} />
          <meshStandardMaterial color={car.color} roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function Scene({ zones, time }: { zones: MiniatureCityProps['zones']; time: number }) {
  const anyActive = zones.zone1 || zones.zone2 || zones.zone3 || zones.zone4 || zones.zone5;

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[60, 100, 40]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
      />

      <DiagramGround />
      <DiagramTrees />
      <DiagramCars time={time} />
      <DiagramStreetlights />
      <DiagramSolar time={time} />

      {ZONE_DESIGNS.map((design) =>
        design.positions.map((pos, i) => (
          <DiagramBuilding
            key={`${design.id}-${i}`}
            x={pos.x}
            z={pos.z}
            w={pos.w}
            d={pos.d}
            h={pos.h}
            color={design.color}
            emissive={design.emissive}
            active={zones[design.id]}
            time={time}
            label={design.label}
          />
        ))
      )}

      <DiagramHub active={anyActive} time={time} />
    </>
  );
}

export function MiniatureCity({ zones }: MiniatureCityProps): React.ReactElement {
  const [time, setTime] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = () => {
      const t = performance.now() - start;
      setTime(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="city-container city-container--3d">
      <Canvas
        camera={{ position: [140, 110, 140], fov: 40 }}
        shadows
        gl={{ preserveDrawingBuffer: true, antialias: true, powerPreference: 'high-performance' }}
      >
        <Scene zones={zones} time={time} />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={80}
          maxDistance={280}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 25, 0]}
        />
      </Canvas>
      <div className="city-overlay-readout">
        <div className="city-overlay-eyebrow">3D Mini-Grid Diagram</div>
        <div className="city-overlay-line">Diagram-style buildings · Orbit controls · Zone glow</div>
      </div>
    </div>
  );
}

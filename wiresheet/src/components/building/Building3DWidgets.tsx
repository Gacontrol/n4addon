import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Widget3D, Widget3DType, Duct, Pipe, DuctType, PipeType } from '../../types/building';

// ---- Colour maps ----

const WIDGET_COLORS: Record<Widget3DType, string> = {
  temperature: '#ef4444',
  setpoint:    '#f97316',
  humidity:    '#06b6d4',
  alarm:       '#ef4444',
  co2:         '#84cc16',
  presence:    '#a855f7',
  energy:      '#eab308',
  valve:       '#14b8a6',
  pump:        '#3b82f6',
  fan:         '#6366f1',
  light:       '#fde047',
  blinds:      '#8b5cf6',
  custom:      '#94a3b8',
};

const WIDGET_LABELS: Record<Widget3DType, string> = {
  temperature: 'Temperatur',
  setpoint:    'Sollwert',
  humidity:    'Feuchte',
  alarm:       'Alarm',
  co2:         'CO\u2082',
  presence:    'Anwesenheit',
  energy:      'Energie',
  valve:       'Ventil',
  pump:        'Pumpe',
  fan:         'Lüfter',
  light:       'Licht',
  blinds:      'Jalousie',
  custom:      'Widget',
};

const DUCT_COLORS: Record<DuctType, string> = {
  supply:  '#60a5fa',
  return:  '#94a3b8',
  exhaust: '#fbbf24',
  fresh:   '#34d399',
};

const PIPE_COLORS: Record<PipeType, string> = {
  supply:         '#ef4444',
  return:         '#3b82f6',
  'domestic-hot': '#f97316',
  'domestic-cold':'#06b6d4',
  sprinkler:      '#22c55e',
  gas:            '#facc15',
};

// ---- Helper: animated pulse ring ----

function PulseRing({ color, radius }: { color: string; radius: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (!mesh.current) return;
    const t = (Date.now() / 1400) % 1;
    mesh.current.scale.setScalar(1 + t * 0.4);
    (mesh.current.material as THREE.MeshBasicMaterial).opacity = 0.6 - t * 0.6;
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 0.85, radius, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ---- Spinning fan icon ----

function SpinningFan({ color }: { color: string }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 4;
  });
  return (
    <group ref={group}>
      {[0, 1, 2].map(i => (
        <mesh key={i} rotation={[0, (i / 3) * Math.PI * 2, 0]} position={[0.18, 0, 0]}>
          <boxGeometry args={[0.3, 0.04, 0.12]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

// ---- Widget3D 3D mesh ----

interface Widget3DMeshProps {
  widget: Widget3D;
  liveValue?: string | number;
  alarmActive?: boolean;
  selected: boolean;
  onSelect: () => void;
  baseY: number;
}

export function Widget3DMesh({ widget, liveValue, alarmActive, selected, onSelect, baseY }: Widget3DMeshProps) {
  const baseColor = widget.color || WIDGET_COLORS[widget.type] || '#94a3b8';
  const scale = widget.scale || 1;
  const wx = widget.x;
  const wy = baseY + widget.z;
  const wz = widget.y;

  const isAlarm = widget.type === 'alarm';
  const isFan = widget.type === 'fan';
  const isPump = widget.type === 'pump';
  const isValve = widget.type === 'valve';
  const isLight = widget.type === 'light';

  const pulseColor = alarmActive ? '#ef4444' : (isAlarm ? '#fbbf24' : baseColor);
  const displayValue = liveValue != null ? String(liveValue) : '–';
  const unit = widget.unit || '';

  return (
    <group position={[wx, wy, wz]} scale={[scale, scale, scale]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Base pole */}
      <mesh position={[0, -0.4, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.8, 8]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Base disc */}
      <mesh position={[0, -0.82, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.04, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Main body */}
      {isLight ? (
        <>
          <mesh position={[0, 0.1, 0]} castShadow>
            <sphereGeometry args={[0.22, 16, 16]} />
            <meshStandardMaterial
              color={baseColor}
              emissive={new THREE.Color(baseColor)}
              emissiveIntensity={alarmActive !== false ? 1.2 : 0.2}
              transparent opacity={0.85}
            />
          </mesh>
          <pointLight position={[0, 0.1, 0]} color={baseColor} intensity={0.6} distance={4} />
        </>
      ) : isFan ? (
        <group position={[0, 0.1, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.08, 16]} />
            <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
          </mesh>
          <SpinningFan color={baseColor} />
        </group>
      ) : isPump ? (
        <mesh position={[0, 0.1, 0]} castShadow>
          <torusGeometry args={[0.16, 0.07, 8, 16]} />
          <meshStandardMaterial color={baseColor} metalness={0.5} roughness={0.4} />
        </mesh>
      ) : isValve ? (
        <group position={[0, 0.1, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.3, 0.18, 0.18]} />
            <meshStandardMaterial color={baseColor} metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.18, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.18, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      ) : (
        <mesh position={[0, 0.1, 0]} castShadow>
          <boxGeometry args={[0.36, 0.28, 0.1]} />
          <meshStandardMaterial
            color={baseColor}
            emissive={alarmActive ? new THREE.Color('#ef4444') : new THREE.Color(baseColor)}
            emissiveIntensity={alarmActive ? 0.5 : 0.1}
            metalness={0.2}
            roughness={0.6}
          />
        </mesh>
      )}

      {/* Alarm pulse */}
      {(isAlarm || alarmActive) && (
        <PulseRing color={pulseColor} radius={0.25} />
      )}

      {/* Selection ring */}
      {selected && (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.34, 32]} />
          <meshBasicMaterial color="#60a5fa" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* HTML overlay label */}
      <Html
        position={[0, 0.62, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{
          background: 'rgba(15,23,42,0.88)',
          border: `1px solid ${alarmActive ? '#ef4444' : baseColor}60`,
          borderRadius: 6,
          padding: '3px 7px',
          minWidth: 64,
          textAlign: 'center',
          backdropFilter: 'blur(4px)',
          boxShadow: alarmActive ? `0 0 8px #ef444480` : 'none',
        }}>
          {widget.showLabel !== false && (
            <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'sans-serif', lineHeight: 1.2 }}>
              {widget.label || WIDGET_LABELS[widget.type]}
            </div>
          )}
          {widget.showValue !== false && (
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: alarmActive ? '#ef4444' : baseColor,
              fontFamily: 'monospace',
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
            }}>
              {displayValue}{unit ? <span style={{ fontSize: 9, color: '#64748b', marginLeft: 2 }}>{unit}</span> : null}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

// ---- Duct 3D rendering ----

interface DuctMeshProps {
  duct: Duct;
  offsetX: number;
  baseY: number;
  selected: boolean;
  onSelect: () => void;
}

export function DuctMesh({ duct, offsetX, baseY, selected, onSelect }: DuctMeshProps) {
  const color = duct.color || DUCT_COLORS[duct.type] || '#60a5fa';
  const elev = baseY + (duct.elevation ?? 2.4);

  const segments = useMemo(() => {
    const segs: { pos: [number, number, number]; quat: THREE.Quaternion; len: number }[] = [];
    for (let i = 0; i < duct.points.length - 1; i++) {
      const a = duct.points[i];
      const b = duct.points[i + 1];
      const dx = (b.x - a.x);
      const dz = (b.y - a.y);
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.01) continue;
      const mx = (a.x + b.x) / 2 + offsetX;
      const mz = (a.y + b.y) / 2;
      const angle = Math.atan2(dx, dz);
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0));
      segs.push({ pos: [mx, elev, mz], quat, len });
    }
    return segs;
  }, [duct.points, offsetX, elev]);

  const w = duct.width || 0.3;
  const h = duct.height || 0.2;
  const isRound = duct.shape === 'round';

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {segments.map((seg, i) => (
        <group key={i} position={seg.pos} quaternion={seg.quat}>
          {isRound ? (
            <mesh castShadow>
              <cylinderGeometry args={[w / 2, w / 2, seg.len, 12, 1, false]} rotation={[Math.PI / 2, 0, 0] as unknown as THREE.Euler} />
              <meshStandardMaterial
                color={color}
                metalness={0.4}
                roughness={0.5}
                transparent={!duct.insulated}
                opacity={duct.insulated ? 1 : 0.7}
              />
            </mesh>
          ) : (
            <mesh castShadow>
              <boxGeometry args={[w, h, seg.len]} />
              <meshStandardMaterial
                color={color}
                metalness={0.3}
                roughness={0.5}
                transparent={!duct.insulated}
                opacity={duct.insulated ? 1 : 0.75}
              />
            </mesh>
          )}
          {selected && (
            <mesh>
              <boxGeometry args={[w + 0.04, h + 0.04, seg.len + 0.04]} />
              <meshBasicMaterial color="#60a5fa" wireframe />
            </mesh>
          )}
        </group>
      ))}
      {/* connector balls at joints */}
      {duct.points.map((pt, i) => (
        i > 0 && i < duct.points.length - 1 ? (
          <mesh key={`jnt-${i}`} position={[pt.x + offsetX, elev, pt.y]} castShadow>
            <sphereGeometry args={[Math.max(w, h) / 2 + 0.02, 8, 8]} />
            <meshStandardMaterial color={color} metalness={0.4} roughness={0.5} />
          </mesh>
        ) : null
      ))}
    </group>
  );
}

// ---- Pipe 3D rendering ----

interface PipeMeshProps {
  pipe: Pipe;
  offsetX: number;
  baseY: number;
  selected: boolean;
  onSelect: () => void;
}

export function PipeMesh({ pipe, offsetX, baseY, selected, onSelect }: PipeMeshProps) {
  const color = pipe.color || PIPE_COLORS[pipe.type] || '#ef4444';
  const elev = baseY + (pipe.elevation ?? 2.2);
  const radius = (pipe.diameter || 0.05) / 2;

  const segments = useMemo(() => {
    const segs: { pos: [number, number, number]; quat: THREE.Quaternion; len: number }[] = [];
    for (let i = 0; i < pipe.points.length - 1; i++) {
      const a = pipe.points[i];
      const b = pipe.points[i + 1];
      const dx = b.x - a.x;
      const dz = b.y - a.y;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.01) continue;
      const mx = (a.x + b.x) / 2 + offsetX;
      const mz = (a.y + b.y) / 2;
      const angle = Math.atan2(dx, dz);
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0));
      segs.push({ pos: [mx, elev, mz], quat, len });
    }
    return segs;
  }, [pipe.points, offsetX, elev]);

  const insulationRadius = radius + 0.025;

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {segments.map((seg, i) => (
        <group key={i} position={seg.pos} quaternion={seg.quat}>
          <mesh castShadow>
            <cylinderGeometry args={[radius, radius, seg.len, 8]} rotation={[Math.PI / 2, 0, 0] as unknown as THREE.Euler} />
            <meshStandardMaterial color={color} metalness={0.5} roughness={0.35} />
          </mesh>
          {pipe.insulated && (
            <mesh>
              <cylinderGeometry args={[insulationRadius, insulationRadius, seg.len, 8]} rotation={[Math.PI / 2, 0, 0] as unknown as THREE.Euler} />
              <meshStandardMaterial color="#e2e8f0" transparent opacity={0.35} side={THREE.FrontSide} />
            </mesh>
          )}
          {selected && (
            <mesh>
              <cylinderGeometry args={[insulationRadius + 0.02, insulationRadius + 0.02, seg.len + 0.04, 8]} rotation={[Math.PI / 2, 0, 0] as unknown as THREE.Euler} />
              <meshBasicMaterial color="#60a5fa" wireframe />
            </mesh>
          )}
        </group>
      ))}
      {/* joints */}
      {pipe.points.map((pt, i) => (
        i > 0 && i < pipe.points.length - 1 ? (
          <mesh key={`jnt-${i}`} position={[pt.x + offsetX, elev, pt.y]} castShadow>
            <sphereGeometry args={[radius + 0.01, 8, 8]} />
            <meshStandardMaterial color={color} metalness={0.5} roughness={0.35} />
          </mesh>
        ) : null
      ))}
    </group>
  );
}

// ---- Exports for palette ----

export { WIDGET_COLORS, WIDGET_LABELS, DUCT_COLORS, PIPE_COLORS };

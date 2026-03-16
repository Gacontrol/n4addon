import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Widget3D, Widget3DType, Duct, Pipe, DuctType, PipeType } from '../../types/building';

export const WIDGET_COLORS: Record<Widget3DType, string> = {
  temperature:  '#ef4444',
  setpoint:     '#f97316',
  humidity:     '#06b6d4',
  alarm:        '#ef4444',
  co2:          '#84cc16',
  presence:     '#a855f7',
  energy:       '#eab308',
  valve:        '#14b8a6',
  pump:         '#3b82f6',
  fan:          '#6366f1',
  light:        '#fde047',
  blinds:       '#8b5cf6',
  custom:       '#94a3b8',
  roomcolor:    '#22c55e',
  duct:         '#60a5fa',
  'fire-damper':'#f43f5e',
  boolean:      '#22d3ee',
};

export const WIDGET_LABELS: Record<Widget3DType, string> = {
  temperature:  'Temperatur',
  setpoint:     'Sollwert',
  humidity:     'Feuchte',
  alarm:        'Alarm',
  co2:          'CO\u2082',
  presence:     'Anwesenheit',
  energy:       'Energie',
  valve:        'Ventil',
  pump:         'Pumpe',
  fan:          'Lüfter',
  light:        'Licht',
  blinds:       'Jalousie',
  custom:       'Widget',
  roomcolor:    'Raumeinfärbung',
  duct:         'Kanal-Sensor',
  'fire-damper':'Brandschutzklappe',
  boolean:      'Boolean',
};

export const DUCT_COLORS: Record<DuctType, string> = {
  supply:  '#60a5fa',
  return:  '#94a3b8',
  exhaust: '#fbbf24',
  fresh:   '#34d399',
};

export const PIPE_COLORS: Record<PipeType, string> = {
  supply:         '#ef4444',
  return:         '#3b82f6',
  'domestic-hot': '#f97316',
  'domestic-cold':'#06b6d4',
  sprinkler:      '#22c55e',
  gas:            '#facc15',
};

function makeDuctTexture(color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const c = new THREE.Color(color);

  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, 256, 256);

  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0,   `rgba(255,255,255,0.18)`);
  grad.addColorStop(0.3, `rgba(255,255,255,0.04)`);
  grad.addColorStop(0.6, `rgba(0,0,0,0.08)`);
  grad.addColorStop(1,   `rgba(0,0,0,0.22)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = `rgba(255,255,255,0.12)`;
  ctx.lineWidth = 1;
  for (let y = 0; y < 256; y += 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y + (Math.random() - 0.5) * 1.5);
    ctx.stroke();
  }

  ctx.strokeStyle = `rgba(0,0,0,0.25)`;
  ctx.lineWidth = 1.5;
  for (let x = 0; x < 256; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
  }

  ctx.strokeStyle = `rgba(255,255,255,0.35)`;
  ctx.lineWidth = 2;
  for (let x = 2; x < 256; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeFlangeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#7a8a99';
  ctx.fillRect(0, 0, 64, 64);
  const grad = ctx.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0.3)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 64; i += 8) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 64); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const ductTextureCache = new Map<string, THREE.CanvasTexture>();
function getCachedDuctTexture(color: string): THREE.CanvasTexture {
  if (!ductTextureCache.has(color)) ductTextureCache.set(color, makeDuctTexture(color));
  return ductTextureCache.get(color)!;
}

let _flangeTexture: THREE.CanvasTexture | null = null;
function getCachedFlangeTexture(): THREE.CanvasTexture {
  if (!_flangeTexture) _flangeTexture = makeFlangeTexture();
  return _flangeTexture;
}

function PulseRing({ color, radius }: { color: string; radius: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => {
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

interface Widget3DMeshProps {
  widget: Widget3D;
  liveValue?: string | number;
  alarmActive?: boolean;
  selected: boolean;
  onSelect: () => void;
  baseY: number;
  onDragEnd?: (x: number, y: number, z: number) => void;
}

export function Widget3DMesh({ widget, liveValue, alarmActive, selected, onSelect, baseY, onDragEnd }: Widget3DMeshProps) {
  const baseColor = widget.color || WIDGET_COLORS[widget.type] || '#94a3b8';
  const wx = widget.x;
  const wy = baseY + widget.z;
  const wz = widget.y;

  const isAlarm = widget.type === 'alarm';
  const isFan = widget.type === 'fan';
  const isPump = widget.type === 'pump';
  const isValve = widget.type === 'valve';
  const isLight = widget.type === 'light';
  const isRoomColor = widget.type === 'roomcolor';
  const isDuct = widget.type === 'duct';
  const isFireDamper = widget.type === 'fire-damper';
  const isBoolean = widget.type === 'boolean';
  const displaySize = (widget.size ?? 1.0) * (widget.scale || 1);

  if (isRoomColor) return null;

  const pulseColor = alarmActive ? '#ef4444' : (isAlarm ? '#fbbf24' : baseColor);
  const displayValue = liveValue != null ? String(liveValue) : '–';
  const unit = widget.unit || '';

  const dragRef = useRef<{
    startX: number;
    startY: number;
    startWX: number;
    startWY: number;
    startWZ: number;
    shiftKey: boolean;
    moved: boolean;
    factor: number;
  } | null>(null);
  const didDragRef = useRef(false);
  const groupRef = useRef<THREE.Group>(null);
  const { controls, camera, size } = useThree();

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const factor = dragRef.current.factor;
      const dx = (e.clientX - dragRef.current.startX) * factor;
      const dy = (e.clientY - dragRef.current.startY) * factor;
      if (Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02) dragRef.current.moved = true;
      if (!dragRef.current.moved || !groupRef.current) return;
      const isShift = dragRef.current.shiftKey || e.shiftKey;
      if (isShift) {
        groupRef.current.position.y = baseY + dragRef.current.startWZ - dy;
      } else {
        groupRef.current.position.x = dragRef.current.startWX + dx;
        groupRef.current.position.z = dragRef.current.startWY + dy;
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!dragRef.current) return;
      if (controls) (controls as any).enabled = true;
      if (dragRef.current.moved && onDragEnd) {
        didDragRef.current = true;
        const factor = dragRef.current.factor;
        const dx = (e.clientX - dragRef.current.startX) * factor;
        const dy = (e.clientY - dragRef.current.startY) * factor;
        const isShift = dragRef.current.shiftKey || e.shiftKey;
        if (isShift) {
          onDragEnd(dragRef.current.startWX, dragRef.current.startWY, dragRef.current.startWZ - dy);
        } else {
          onDragEnd(dragRef.current.startWX + dx, dragRef.current.startWY + dy, dragRef.current.startWZ);
        }
      }
      dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [controls, onDragEnd, baseY]);

  return (
    <group
      ref={groupRef}
      position={[wx, wy, wz]}
      onClick={(e) => {
        e.stopPropagation();
        if (!didDragRef.current) onSelect();
        didDragRef.current = false;
      }}
      onPointerDown={(e) => {
        if (!onDragEnd) return;
        e.stopPropagation();
        didDragRef.current = false;
        if (controls) (controls as any).enabled = false;
        const widgetWorldPos = new THREE.Vector3(wx, wy, wz);
        const camDist = camera.position.distanceTo(widgetWorldPos);
        const fovFactor = (camera as THREE.PerspectiveCamera).fov
          ? Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360)
          : 0.7;
        const factor = (camDist * fovFactor * 2) / size.height;
        dragRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          startWX: widget.x,
          startWY: widget.y,
          startWZ: widget.z,
          shiftKey: e.shiftKey,
          moved: false,
          factor,
        };
      }}
    >
      {isDuct ? (
        <group position={[0, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[1.2, 0.35, 0.55]} />
            <meshStandardMaterial color={baseColor} metalness={0.4} roughness={0.45} transparent opacity={0.92} />
          </mesh>
          <mesh castShadow>
            <boxGeometry args={[1.22, 0.37, 0.57]} />
            <meshStandardMaterial color={baseColor} wireframe opacity={0.15} transparent />
          </mesh>
          <mesh position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.4, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.52, 0]} castShadow>
            <boxGeometry args={[0.12, 0.06, 0.08]} />
            <meshStandardMaterial color="#1e293b" metalness={0.3} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.1, 0.29]} castShadow>
            <boxGeometry args={[1.22, 0.02, 0.02]} />
            <meshStandardMaterial color={baseColor} metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.1, 0.29]} castShadow>
            <boxGeometry args={[1.22, 0.02, 0.02]} />
            <meshStandardMaterial color={baseColor} metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      ) : isLight ? (
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
      ) : isFireDamper ? (
        <group position={[0, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.6 * displaySize, 0.6 * displaySize, 0.06]} />
            <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.04]} castShadow>
            <boxGeometry args={[0.52 * displaySize, 0.04, 0.02]} />
            <meshStandardMaterial color={baseColor} metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.04]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <boxGeometry args={[0.52 * displaySize, 0.04, 0.02]} />
            <meshStandardMaterial color={baseColor} metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.04]} rotation={[0, 0, Math.PI / 4]} castShadow>
            <boxGeometry args={[0.52 * displaySize * 1.41, 0.04, 0.02]} />
            <meshStandardMaterial color={alarmActive ? '#ef4444' : baseColor} emissive={new THREE.Color(alarmActive ? '#ef4444' : baseColor)} emissiveIntensity={0.3} metalness={0.4} roughness={0.3} />
          </mesh>
        </group>
      ) : isBoolean ? (
        <group position={[0, 0, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.35 * displaySize, 0.35 * displaySize, 0.06]} />
            <meshStandardMaterial color="#0f172a" metalness={0.3} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.04]} castShadow>
            <cylinderGeometry args={[0.1 * displaySize, 0.1 * displaySize, 0.04, 16]} />
            <meshStandardMaterial
              color={baseColor}
              emissive={new THREE.Color(baseColor)}
              emissiveIntensity={liveValue === true || liveValue === 'true' || liveValue === 'on' || liveValue === '1' ? 1.2 : 0.05}
              metalness={0.1}
              roughness={0.3}
              transparent
              opacity={0.9}
            />
          </mesh>
        </group>
      ) : null}

      {(isAlarm || alarmActive) && <PulseRing color={pulseColor} radius={0.22 * displaySize} />}

      {selected && !isRoomColor && (
        <mesh position={[0, 0, -0.005]}>
          <planeGeometry args={[0.52 * displaySize + 0.12, 0.52 * displaySize + 0.12]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      <Html
        position={[0, isDuct ? 0.55 + 0.15 * displaySize : 0.18, 0]}
        center
        sprite
        distanceFactor={6}
        zIndexRange={[10, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{
          background: 'rgba(10,18,36,0.88)',
          border: `2px solid ${alarmActive ? '#ef4444' : baseColor}`,
          borderRadius: Math.round(12 * displaySize) + 'px',
          padding: `${Math.round(4 * displaySize)}px ${Math.round(10 * displaySize)}px`,
          minWidth: Math.round(60 * displaySize) + 'px',
          textAlign: 'center',
          backdropFilter: 'blur(6px)',
          boxShadow: `0 0 ${Math.round(6 * displaySize)}px ${alarmActive ? '#ef444480' : baseColor + '50'}`,
          whiteSpace: 'nowrap',
        }}>
          {widget.showLabel !== false && (
            <div style={{ fontSize: Math.round(9 * displaySize), color: '#94a3b8', fontFamily: 'sans-serif', lineHeight: 1.2 }}>
              {widget.label || WIDGET_LABELS[widget.type]}
            </div>
          )}
          {widget.showValue !== false && !isBoolean && (
            <div style={{
              fontSize: Math.round(13 * displaySize), fontWeight: 700,
              color: alarmActive ? '#ef4444' : baseColor,
              fontFamily: 'monospace', lineHeight: 1.2, letterSpacing: '-0.02em',
            }}>
              {displayValue}{unit ? <span style={{ fontSize: Math.round(9 * displaySize), color: '#64748b', marginLeft: 2 }}>{unit}</span> : null}
            </div>
          )}
          {isBoolean && widget.showValue !== false && (
            <div style={{
              fontSize: Math.round(11 * displaySize), fontWeight: 700,
              color: (liveValue === true || liveValue === 'true' || liveValue === 'on' || liveValue === '1') ? baseColor : '#475569',
              fontFamily: 'monospace', lineHeight: 1.2,
            }}>
              {(liveValue === true || liveValue === 'true' || liveValue === 'on' || liveValue === '1') ? 'ON' : 'OFF'}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

interface RoomColorOverlayProps {
  widget: Widget3D;
  baseY: number;
  floorHeight: number;
  offsetX: number;
  buildings: import('../../types/building').Building[];
  liveValue?: string | number;
  alarmActive?: boolean;
  selected: boolean;
  onSelect: () => void;
}

export function RoomColorOverlay({ widget, baseY, floorHeight, offsetX, buildings, liveValue, alarmActive, selected, onSelect }: RoomColorOverlayProps) {
  const roomIds: string[] = (widget as any).roomIds ?? [];

  type RoomEntry =
    | { kind: 'box'; x: number; z: number; w: number; d: number }
    | { kind: 'poly'; extrudeGeo: THREE.BufferGeometry; cx: number; cz: number };

  const roomEntries = useMemo(() => {
    const entries: RoomEntry[] = [];
    for (const building of buildings) {
      for (const floor of building.floors) {
        if (floor.id !== widget.floorId) continue;
        for (const room of floor.rooms) {
          if (roomIds.length > 0 && !roomIds.includes(room.id)) continue;
          if (room.points && room.points.length >= 3) {
            const shape = new THREE.Shape();
            shape.moveTo(room.points[0].x + offsetX, room.points[0].y);
            for (let i = 1; i < room.points.length; i++) {
              shape.lineTo(room.points[i].x + offsetX, room.points[i].y);
            }
            shape.closePath();
            const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
              depth: floorHeight,
              bevelEnabled: false,
            });
            const xs = room.points.map(p => p.x + offsetX);
            const ys = room.points.map(p => p.y);
            entries.push({
              kind: 'poly',
              extrudeGeo,
              cx: (Math.min(...xs) + Math.max(...xs)) / 2,
              cz: (Math.min(...ys) + Math.max(...ys)) / 2,
            });
          } else {
            entries.push({
              kind: 'box',
              x: room.x + offsetX + room.width / 2,
              z: room.y + room.depth / 2,
              w: room.width,
              d: room.depth,
            });
          }
        }
      }
    }
    return entries;
  }, [buildings, widget.floorId, roomIds, offsetX, floorHeight]);

  const active = alarmActive === true || (liveValue !== undefined && liveValue !== '0' && liveValue !== 'off' && liveValue !== false);
  const overlayColor = widget.color || '#ef4444';
  const opacity = active ? 0.35 : 0.0;

  if (!active) return null;

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {roomEntries.map((entry, i) => {
        if (entry.kind === 'poly') {
          return (
            <mesh key={i} position={[0, baseY, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <primitive object={entry.extrudeGeo} />
              <meshBasicMaterial color={overlayColor} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          );
        }
        return (
          <mesh key={i} position={[entry.x, baseY + floorHeight / 2, entry.z]}>
            <boxGeometry args={[entry.w, floorHeight, entry.d]} />
            <meshBasicMaterial color={overlayColor} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        );
      })}
      {selected && roomEntries.map((entry, i) => {
        if (entry.kind === 'box') {
          return (
            <lineSegments key={`sel-${i}`} position={[entry.x, baseY + floorHeight / 2, entry.z]}>
              <edgesGeometry args={[new THREE.BoxGeometry(entry.w, floorHeight, entry.d)]} />
              <lineBasicMaterial color="#60a5fa" />
            </lineSegments>
          );
        }
        return null;
      })}
    </group>
  );
}

interface DuctSegment {
  pos: [number, number, number];
  dir: THREE.Vector3;
  len: number;
  isVertical: boolean;
}

function getElbowRadius(w: number, h: number): number {
  return Math.max(w, h) * 0.75;
}

function computeDuctSegments(
  points: { x: number; y: number; elev?: number }[],
  offsetX: number,
  defaultElev: number,
  w: number,
  h: number
): DuctSegment[] {
  const segs: DuctSegment[] = [];
  const elbowR = getElbowRadius(w, h);

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dz = b.y - a.y;
    const elevA = a.elev !== undefined ? a.elev : defaultElev;
    const elevB = b.elev !== undefined ? b.elev : defaultElev;
    const dy = elevB - elevA;
    const len = Math.sqrt(dx * dx + dz * dz + dy * dy);
    if (len < 0.01) continue;
    const dir = new THREE.Vector3(dx / len, dy / len, dz / len);

    const pullA = i > 0 ? elbowR : 0;
    const pullB = i < points.length - 2 ? elbowR : 0;
    const usedLen = Math.max(0.01, len - pullA - pullB);

    const startX = a.x + offsetX + dir.x * pullA;
    const startY = elevA + dir.y * pullA;
    const startZ = a.y + dir.z * pullA;

    const mx = startX + dir.x * usedLen / 2;
    const my = startY + dir.y * usedLen / 2;
    const mz = startZ + dir.z * usedLen / 2;

    const isVertical = Math.sqrt(dx * dx + dz * dz) < 0.01;
    segs.push({ pos: [mx, my, mz], dir, len: usedLen, isVertical });
  }
  return segs;
}

function getSegmentQuaternion(dir: THREE.Vector3): THREE.Quaternion {
  const worldUp = new THREE.Vector3(0, 1, 0);
  if (Math.abs(dir.dot(worldUp)) > 0.9999) {
    const q = new THREE.Quaternion();
    if (dir.y < 0) q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    return q;
  }
  const horizontal = new THREE.Vector3(dir.x, 0, dir.z).normalize();
  const right = new THREE.Vector3().crossVectors(horizontal, worldUp).normalize();
  const correctedUp = new THREE.Vector3().crossVectors(right, dir).normalize();
  const m = new THREE.Matrix4().makeBasis(right, dir, correctedUp);
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  return q;
}

const FLANGE_SPACING = 1.5;
const FLANGE_THICKNESS = 0.008;
const FLANGE_OVERHANG = 0.035;

function buildRectDuctGeoSimple(w: number, h: number, len: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, len, h, 1, Math.max(1, Math.round(len / 0.5)), 1);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const y = pos.getY(i);
    const u = uv.getX(i);
    uv.setXY(i, u, (y + len / 2) / len * (len / 0.5));
  }
  uv.needsUpdate = true;
  return geo;
}

function buildRectProfile(hw: number, hh: number): THREE.Vector2[] {
  return [
    new THREE.Vector2(-hw, -hh),
    new THREE.Vector2( hw, -hh),
    new THREE.Vector2( hw,  hh),
    new THREE.Vector2(-hw,  hh),
  ];
}

function buildCircleProfile(hw: number, hh: number, n = 12): THREE.Vector2[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return new THREE.Vector2(Math.cos(a) * hw, Math.sin(a) * hh);
  });
}

function getInitialProfileFrame(dirA: THREE.Vector3): { right: THREE.Vector3; up: THREE.Vector3 } {
  const worldUp = new THREE.Vector3(0, 1, 0);
  if (Math.abs(dirA.dot(worldUp)) > 0.999) {
    const right = new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3().crossVectors(right, dirA).normalize();
    return { right, up };
  }
  const right = new THREE.Vector3().crossVectors(worldUp, dirA).normalize();
  const up = new THREE.Vector3().crossVectors(dirA, right).normalize();
  return { right, up };
}

function buildElbowGeometry(
  w: number, h: number, isRound: boolean,
  cornerWorldPos: THREE.Vector3,
  dirA: THREE.Vector3,
  dirB: THREE.Vector3,
  segments = 16
): THREE.BufferGeometry {
  const elbowR = getElbowRadius(w, h);

  const dot = Math.max(-1, Math.min(1, dirA.dot(dirB)));
  const turnAngle = Math.acos(dot);
  if (turnAngle < 0.02) return new THREE.BufferGeometry();

  const axis = new THREE.Vector3().crossVectors(dirA, dirB);
  if (axis.lengthSq() < 1e-10) return new THREE.BufferGeometry();
  axis.normalize();

  const hw = w / 2, hh = h / 2;
  const profile = isRound ? buildCircleProfile(hw, hh) : buildRectProfile(hw, hh);
  const pCount = profile.length;

  const sweepAngle = Math.PI - turnAngle;

  const entryPoint = cornerWorldPos.clone().addScaledVector(dirA, -elbowR);
  const inwardDir = new THREE.Vector3().crossVectors(axis, dirA).normalize();
  const arcCenter = entryPoint.clone().addScaledVector(inwardDir, elbowR);

  const { right: initRight, up: initUp } = getInitialProfileFrame(dirA);

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const arcLength = elbowR * sweepAngle;

  for (let s = 0; s <= segments; s++) {
    const t = s / segments;
    const angle = t * sweepAngle;
    const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle);

    const right = initRight.clone().applyQuaternion(quat);
    const up = initUp.clone().applyQuaternion(quat);

    const radialOut = inwardDir.clone().negate().applyQuaternion(quat).normalize();
    const spinePoint = arcCenter.clone().addScaledVector(radialOut, elbowR);

    for (let p = 0; p < pCount; p++) {
      const pp = profile[p];
      const worldPt = spinePoint.clone()
        .addScaledVector(right, pp.x)
        .addScaledVector(up, pp.y);
      positions.push(worldPt.x, worldPt.y, worldPt.z);
      uvs.push(p / pCount, t * arcLength / 0.4);
    }
  }

  for (let s = 0; s < segments; s++) {
    for (let p = 0; p < pCount; p++) {
      const a = s * pCount + p;
      const b = s * pCount + (p + 1) % pCount;
      const c = (s + 1) * pCount + (p + 1) % pCount;
      const d = (s + 1) * pCount + p;
      indices.push(a, b, c, a, c, d);
    }
  }

  const capCenterStart = positions.length / 3;

  for (const ring of [0, segments]) {
    const base = ring * pCount;
    let cx = 0, cy = 0, cz = 0;
    for (let p = 0; p < pCount; p++) {
      cx += positions[(base + p) * 3];
      cy += positions[(base + p) * 3 + 1];
      cz += positions[(base + p) * 3 + 2];
    }
    positions.push(cx / pCount, cy / pCount, cz / pCount);
    uvs.push(0.5, 0.5);
  }

  const ci0 = capCenterStart;
  const ci1 = capCenterStart + 1;

  for (let p = 0; p < pCount; p++) {
    indices.push(ci0, (p + 1) % pCount, p);
  }
  for (let p = 0; p < pCount; p++) {
    const base = segments * pCount;
    indices.push(ci1, base + p, base + (p + 1) % pCount);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function FlangeRect({ w, h, tex }: { w: number; h: number; tex: THREE.CanvasTexture }) {
  const fw = w + FLANGE_OVERHANG * 2;
  const fh = h + FLANGE_OVERHANG * 2;
  const ft = FLANGE_THICKNESS;
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[fw, ft, fh]} />
        <meshStandardMaterial map={tex} color="#8fa0b0" metalness={0.75} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[fw + ft * 2, ft * 2.5, ft * 2]} />
        <meshStandardMaterial color="#7a8a99" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh castShadow position={[0, 0, 0]}>
        <boxGeometry args={[ft * 2, ft * 2.5, fh + ft * 2]} />
        <meshStandardMaterial color="#7a8a99" metalness={0.8} roughness={0.35} />
      </mesh>
    </group>
  );
}

function FlangeRound({ r, tex }: { r: number; tex: THREE.CanvasTexture }) {
  const fr = r + FLANGE_OVERHANG;
  return (
    <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[fr, fr, FLANGE_THICKNESS * 3, 16, 1, false]} />
      <meshStandardMaterial map={tex} color="#8fa0b0" metalness={0.75} roughness={0.4} />
    </mesh>
  );
}

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
  const w = duct.width || 0.3;
  const h = duct.height || 0.2;
  const isRound = duct.shape === 'round';
  const tex = useMemo(() => {
    const t = getCachedDuctTexture(color);
    t.repeat.set(1, 1);
    return t;
  }, [color]);
  const flangeTex = useMemo(() => getCachedFlangeTexture(), []);

  const segments = useMemo(
    () => computeDuctSegments(duct.points, offsetX, elev, w, h),
    [duct.points, offsetX, elev, w, h]
  );

  const flangePositionsPerSeg = useMemo(() => {
    return segments.map(seg => {
      const positions: number[] = [];
      const count = Math.floor(seg.len / FLANGE_SPACING);
      const step = seg.len / Math.max(count + 1, 2);
      for (let k = 1; k <= count; k++) {
        positions.push(-seg.len / 2 + step * k);
      }
      positions.push(-seg.len / 2 + FLANGE_THICKNESS * 2);
      positions.push(seg.len / 2 - FLANGE_THICKNESS * 2);
      return positions;
    });
  }, [segments]);

  const elbowData = useMemo(() => {
    const result: { geo: THREE.BufferGeometry }[] = [];
    const pts = duct.points;
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1];
      const cur  = pts[i];
      const next = pts[i + 1];
      const elevCur  = (cur  as any).elev !== undefined ? baseY + (cur  as any).elev : elev;
      const elevPrev = (prev as any).elev !== undefined ? baseY + (prev as any).elev : elev;
      const elevNext = (next as any).elev !== undefined ? baseY + (next as any).elev : elev;

      const dxA = cur.x - prev.x, dyA = elevCur - elevPrev, dzA = cur.y - prev.y;
      const dxB = next.x - cur.x, dyB = elevNext - elevCur, dzB = next.y - cur.y;
      const lenA = Math.sqrt(dxA*dxA + dyA*dyA + dzA*dzA) || 1;
      const lenB = Math.sqrt(dxB*dxB + dyB*dyB + dzB*dzB) || 1;
      const dirA = new THREE.Vector3(dxA/lenA, dyA/lenA, dzA/lenA);
      const dirB = new THREE.Vector3(dxB/lenB, dyB/lenB, dzB/lenB);

      const cornerWorldPos = new THREE.Vector3(cur.x + offsetX, elevCur, cur.y);
      const geo = buildElbowGeometry(w, h, isRound, cornerWorldPos, dirA, dirB);
      result.push({ geo });
    }
    return result;
  }, [duct.points, offsetX, elev, w, h, isRound, baseY]);

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {segments.map((seg, i) => {
        const quaternion = getSegmentQuaternion(seg.dir);

        return (
          <group key={i} position={seg.pos} quaternion={quaternion}>
            {isRound ? (
              <mesh castShadow>
                <cylinderGeometry args={[w / 2, w / 2, seg.len, 14, Math.max(1, Math.round(seg.len / 0.5))]} />
                <meshStandardMaterial color={color} map={tex} metalness={0.65} roughness={0.35} envMapIntensity={0.8} />
              </mesh>
            ) : (
              <mesh castShadow>
                <primitive object={buildRectDuctGeoSimple(w, h, seg.len)} />
                <meshStandardMaterial color={color} map={tex} metalness={0.6} roughness={0.38} envMapIntensity={0.8} />
              </mesh>
            )}

            {flangePositionsPerSeg[i]?.map((fp, fi) => (
              <group key={`fl-${fi}`} position={[0, fp, 0]}>
                {isRound
                  ? <FlangeRound r={w / 2} tex={flangeTex} />
                  : <FlangeRect w={w} h={h} tex={flangeTex} />
                }
              </group>
            ))}

            {selected && (
              <mesh>
                {isRound
                  ? <cylinderGeometry args={[w / 2 + 0.025, w / 2 + 0.025, seg.len + 0.03, 14]} />
                  : <boxGeometry args={[w + 0.03, seg.len + 0.03, h + 0.03]} />
                }
                <meshBasicMaterial color="#60a5fa" wireframe opacity={0.6} transparent />
              </mesh>
            )}
          </group>
        );
      })}

      {elbowData.map((eb, i) => (
        <mesh key={`elbow-${i}`} castShadow>
          <primitive object={eb.geo} />
          <meshStandardMaterial color={color} map={tex} metalness={0.6} roughness={0.38} />
        </mesh>
      ))}
    </group>
  );
}

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
  const insulationRadius = radius + 0.025;

  const segments = useMemo(
    () => computeDuctSegments(pipe.points, offsetX, elev),
    [pipe.points, offsetX, elev]
  );

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {segments.map((seg, i) => {
        const quaternion = getSegmentQuaternion(seg.dir);
        return (
          <group key={i} position={seg.pos} quaternion={quaternion}>
            <mesh castShadow>
              <cylinderGeometry args={[radius, radius, seg.len, 10]} />
              <meshStandardMaterial color={color} metalness={0.5} roughness={0.35} />
            </mesh>
            {pipe.insulated && (
              <mesh>
                <cylinderGeometry args={[insulationRadius, insulationRadius, seg.len, 10]} />
                <meshStandardMaterial color="#e2e8f0" transparent opacity={0.35} side={THREE.FrontSide} />
              </mesh>
            )}
            {selected && (
              <mesh>
                <cylinderGeometry args={[insulationRadius + 0.02, insulationRadius + 0.02, seg.len + 0.04, 10]} />
                <meshBasicMaterial color="#60a5fa" wireframe />
              </mesh>
            )}
          </group>
        );
      })}
      {pipe.points.slice(1, -1).map((pt, i) => {
        const ptElev = (pt as DuctPoint & { elev?: number }).elev !== undefined
          ? baseY + ((pt as any).elev as number)
          : elev;
        const jointR = pipe.insulated ? insulationRadius + 0.002 : radius + 0.005;
        return (
          <mesh key={`corner-${i}`} position={[pt.x + offsetX, ptElev, pt.y]} castShadow>
            <sphereGeometry args={[jointR, 10, 8]} />
            <meshStandardMaterial color={pipe.insulated ? '#e2e8f0' : color} metalness={0.5} roughness={0.35} />
          </mesh>
        );
      })}
    </group>
  );
}

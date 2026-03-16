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
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const c = new THREE.Color(color);
  const hex = '#' + c.getHexString();
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 128; i += 16) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  return tex;
}

const ductTextureCache = new Map<string, THREE.CanvasTexture>();
function getCachedDuctTexture(color: string): THREE.CanvasTexture {
  if (!ductTextureCache.has(color)) ductTextureCache.set(color, makeDuctTexture(color));
  return ductTextureCache.get(color)!;
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
      ) : (
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.38 * displaySize, 0.28 * displaySize, 0.06]} />
          <meshStandardMaterial
            color={baseColor}
            emissive={alarmActive ? new THREE.Color('#ef4444') : new THREE.Color(baseColor)}
            emissiveIntensity={alarmActive ? 0.5 : 0.08}
            metalness={0.25}
            roughness={0.55}
          />
        </mesh>
      )}

      {(isAlarm || alarmActive) && <PulseRing color={pulseColor} radius={0.22 * displaySize} />}

      {selected && !isRoomColor && (
        <mesh position={[0, 0, -0.005]}>
          <planeGeometry args={[0.52 * displaySize + 0.12, 0.52 * displaySize + 0.12]} />
          <meshBasicMaterial color="#60a5fa" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      <Html
        position={[0, isDuct ? 0.55 + 0.15 * displaySize : 0.32 * displaySize + 0.12, 0]}
        center
        sprite
        distanceFactor={6}
        zIndexRange={[10, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{
          background: 'rgba(15,23,42,0.92)',
          border: `1px solid ${alarmActive ? '#ef4444' : baseColor}60`,
          borderRadius: Math.round(5 * displaySize) + 'px',
          padding: `${Math.round(3 * displaySize)}px ${Math.round(7 * displaySize)}px`,
          minWidth: Math.round(56 * displaySize) + 'px',
          textAlign: 'center',
          backdropFilter: 'blur(4px)',
          boxShadow: alarmActive ? `0 0 ${Math.round(8 * displaySize)}px #ef444480` : 'none',
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
  buildings: import('../../types/building').Building[];
  liveValue?: string | number;
  alarmActive?: boolean;
  selected: boolean;
  onSelect: () => void;
}

export function RoomColorOverlay({ widget, baseY, floorHeight, buildings, liveValue, alarmActive, selected, onSelect }: RoomColorOverlayProps) {
  const roomIds: string[] = (widget as any).roomIds ?? [];

  const roomBoxes = useMemo(() => {
    const boxes: { x: number; z: number; w: number; d: number }[] = [];
    for (const building of buildings) {
      for (const floor of building.floors) {
        if (floor.id !== widget.floorId) continue;
        for (const room of floor.rooms) {
          if (roomIds.length === 0 || roomIds.includes(room.id)) {
            boxes.push({ x: room.x + room.width / 2, z: room.y + room.depth / 2, w: room.width, d: room.depth });
          }
        }
      }
    }
    return boxes;
  }, [buildings, widget.floorId, roomIds]);

  const active = alarmActive === true || (liveValue !== undefined && liveValue !== '0' && liveValue !== 'off' && liveValue !== false);
  const overlayColor = widget.color || '#ef4444';
  const opacity = active ? 0.45 : 0.0;

  if (!active) return null;

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {roomBoxes.map((b, i) => (
        <mesh key={i} position={[b.x, baseY + floorHeight - 0.01, b.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[b.w - 0.05, b.d - 0.05]} />
          <meshBasicMaterial color={overlayColor} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      {selected && roomBoxes.map((b, i) => (
        <lineSegments key={`sel-${i}`} position={[b.x, baseY + floorHeight * 0.5, b.z]}>
          <edgesGeometry args={[new THREE.BoxGeometry(b.w, floorHeight, b.d)]} />
          <lineBasicMaterial color="#60a5fa" />
        </lineSegments>
      ))}
    </group>
  );
}

interface DuctSegment {
  pos: [number, number, number];
  dir: THREE.Vector3;
  len: number;
  isVertical: boolean;
}

function computeDuctSegments(
  points: { x: number; y: number; elev?: number }[],
  offsetX: number,
  defaultElev: number,
  halfSize = 0
): DuctSegment[] {
  const segs: DuctSegment[] = [];
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
    const pullA = (i > 0 && halfSize > 0) ? halfSize : 0;
    const pullB = (i < points.length - 2 && halfSize > 0) ? halfSize : 0;
    const usedLen = Math.max(0.01, len - pullA - pullB);
    const ax = a.x + dir.x * pullA;
    const ay = elevA + dir.y * pullA;
    const az = a.y + dir.z * pullA;
    const mx = ax + dir.x * usedLen / 2 + offsetX;
    const my = ay + dir.y * usedLen / 2;
    const mz = az + dir.z * usedLen / 2;
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
  const halfSize = Math.max(w, h) / 2;
  const tex = useMemo(() => getCachedDuctTexture(color), [color]);

  const segments = useMemo(
    () => computeDuctSegments(duct.points, offsetX, elev, halfSize),
    [duct.points, offsetX, elev, halfSize]
  );

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {segments.map((seg, i) => {
        const quaternion = getSegmentQuaternion(seg.dir);
        return (
          <group key={i} position={seg.pos} quaternion={quaternion}>
            {isRound ? (
              <mesh castShadow>
                <cylinderGeometry args={[w / 2, w / 2, seg.len, 12]} />
                <meshStandardMaterial color={color} map={tex} metalness={0.35} roughness={0.5} />
              </mesh>
            ) : (
              <mesh castShadow>
                <boxGeometry args={[w, seg.len, h]} />
                <meshStandardMaterial color={color} map={tex} metalness={0.3} roughness={0.45} />
              </mesh>
            )}
            {selected && (
              <mesh>
                {isRound
                  ? <cylinderGeometry args={[w / 2 + 0.03, w / 2 + 0.03, seg.len + 0.04, 12]} />
                  : <boxGeometry args={[w + 0.04, seg.len + 0.04, h + 0.04]} />
                }
                <meshBasicMaterial color="#60a5fa" wireframe />
              </mesh>
            )}
          </group>
        );
      })}
      {duct.points.slice(1, -1).map((pt, i) => {
        const ptElev = (pt as DuctPoint & { elev?: number }).elev !== undefined
          ? baseY + ((pt as any).elev as number)
          : elev;
        const prevPt = duct.points[i];
        const nextPt = duct.points[i + 2];
        const ax = pt.x - prevPt.x, az = pt.y - prevPt.y;
        const bx = nextPt.x - pt.x, bz = nextPt.y - pt.y;
        const aLen = Math.sqrt(ax * ax + az * az) || 1;
        const bLen = Math.sqrt(bx * bx + bz * bz) || 1;
        const adx = ax / aLen, adz = az / aLen;
        const bdx = bx / bLen, bdz = bz / bLen;
        const bisectX = adx + bdx, bisectZ = adz + bdz;
        const bisectLen = Math.sqrt(bisectX * bisectX + bisectZ * bisectZ) || 1;
        const nbx = bisectX / bisectLen, nbz = bisectZ / bisectLen;
        const sinHalf = Math.max(0.2, Math.abs(adx * bdz - adz * bdx));
        const cornerDepth = halfSize / sinHalf * 2;
        const bisectAngle = Math.atan2(nbx, nbz);
        return (
          <mesh key={`corner-${i}`} position={[pt.x + offsetX, ptElev, pt.y]} rotation={[0, bisectAngle, 0]} castShadow>
            {isRound
              ? <sphereGeometry args={[w / 2 + 0.005, 12, 8]} />
              : <boxGeometry args={[w, h, Math.min(cornerDepth, halfSize * 4)]} />
            }
            <meshStandardMaterial color={color} map={tex} metalness={0.3} roughness={0.45} />
          </mesh>
        );
      })}
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

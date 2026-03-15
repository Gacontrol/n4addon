import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Widget3D, Widget3DType, Duct, Pipe, DuctType, PipeType } from '../../types/building';

export const WIDGET_COLORS: Record<Widget3DType, string> = {
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
  roomcolor:   '#22c55e',
};

export const WIDGET_LABELS: Record<Widget3DType, string> = {
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
  roomcolor:   'Raumeinfärbung',
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
  const scale = widget.scale || 1;
  const wx = widget.x;
  const wy = baseY + widget.z;
  const wz = widget.y;

  const isAlarm = widget.type === 'alarm';
  const isFan = widget.type === 'fan';
  const isPump = widget.type === 'pump';
  const isValve = widget.type === 'valve';
  const isLight = widget.type === 'light';
  const isRoomColor = widget.type === 'roomcolor';

  if (isRoomColor) return null;

  const pulseColor = alarmActive ? '#ef4444' : (isAlarm ? '#fbbf24' : baseColor);
  const displayValue = liveValue != null ? String(liveValue) : '–';
  const unit = widget.unit || '';

  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; startWX: number; startWZ: number } | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group
      ref={groupRef}
      position={[wx, wy, wz]}
      scale={[scale, scale, scale]}
      onClick={(e) => { e.stopPropagation(); if (!dragRef.current) onSelect(); }}
      onPointerDown={(e) => {
        if (!onDragEnd) return;
        e.stopPropagation();
        const nativeTarget = e.nativeEvent?.target as Element | undefined;
        nativeTarget?.setPointerCapture?.(e.pointerId);
        dragRef.current = { dragging: false, startX: e.clientX, startY: e.clientY, startWX: widget.x, startWZ: widget.y };
        onSelect();
      }}
      onPointerMove={(e) => {
        if (!dragRef.current || !onDragEnd) return;
        const dx = (e.clientX - dragRef.current.startX) * 0.02;
        const dz = (e.clientY - dragRef.current.startY) * 0.02;
        if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
          dragRef.current.dragging = true;
          e.stopPropagation();
        }
        if (dragRef.current.dragging && groupRef.current) {
          groupRef.current.position.x = wx + dx;
          groupRef.current.position.z = wz + dz;
        }
      }}
      onPointerUp={(e) => {
        if (!dragRef.current || !onDragEnd) return;
        e.stopPropagation();
        if (dragRef.current.dragging) {
          const dx = (e.clientX - dragRef.current.startX) * 0.02;
          const dz = (e.clientY - dragRef.current.startY) * 0.02;
          onDragEnd(dragRef.current.startWX + dx, dragRef.current.startWZ + dz, widget.z);
        }
        dragRef.current = null;
      }}
    >
      <mesh position={[0, -0.4, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.8, 8]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
      </mesh>

      <mesh position={[0, -0.82, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.04, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.5} />
      </mesh>

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

      {(isAlarm || alarmActive) && <PulseRing color={pulseColor} radius={0.25} />}

      {selected && (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.34, 32]} />
          <meshBasicMaterial color="#60a5fa" side={THREE.DoubleSide} />
        </mesh>
      )}

      <Html position={[0, 0.62, 0]} center distanceFactor={8} style={{ pointerEvents: 'none', userSelect: 'none' }}>
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
              fontSize: 13, fontWeight: 700,
              color: alarmActive ? '#ef4444' : baseColor,
              fontFamily: 'monospace', lineHeight: 1.2, letterSpacing: '-0.02em',
            }}>
              {displayValue}{unit ? <span style={{ fontSize: 9, color: '#64748b', marginLeft: 2 }}>{unit}</span> : null}
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

function computeDuctSegments(points: { x: number; y: number; elev?: number }[], offsetX: number, defaultElev: number): DuctSegment[] {
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
    const mx = (a.x + b.x) / 2 + offsetX;
    const mz = (a.y + b.y) / 2;
    const my = (elevA + elevB) / 2;
    const isVertical = Math.sqrt(dx * dx + dz * dz) < 0.01;
    const dir = new THREE.Vector3(dx / len, dy / len, dz / len);
    segs.push({ pos: [mx, my, mz], dir, len, isVertical });
  }
  return segs;
}

function getSegmentQuaternion(dir: THREE.Vector3): THREE.Quaternion {
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(dir.dot(up)) > 0.9999) {
    if (dir.y > 0) {
      q.identity();
    } else {
      q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    }
  } else {
    q.setFromUnitVectors(up, dir);
  }
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
  const tex = useMemo(() => getCachedDuctTexture(color), [color]);

  const segments = useMemo(() => computeDuctSegments(duct.points, offsetX, elev), [duct.points, offsetX, elev]);

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

      {duct.points.map((pt, i) => {
        if (i === 0 || i === duct.points.length - 1) return null;
        const prev = duct.points[i - 1];
        const next = duct.points[i + 1];

        const elevPrev = (prev as any).elev !== undefined ? (prev as any).elev : elev;
        const elevCur = (pt as any).elev !== undefined ? (pt as any).elev : elev;
        const elevNext = (next as any).elev !== undefined ? (next as any).elev : elev;

        const dx1 = pt.x - prev.x; const dz1 = pt.y - prev.y; const dy1 = elevCur - elevPrev;
        const dx2 = next.x - pt.x; const dz2 = next.y - pt.y; const dy2 = elevNext - elevCur;
        const len1 = Math.sqrt(dx1 * dx1 + dz1 * dz1 + dy1 * dy1);
        const len2 = Math.sqrt(dx2 * dx2 + dz2 * dz2 + dy2 * dy2);
        if (len1 < 0.01 || len2 < 0.01) return null;

        const dir1 = new THREE.Vector3(dx1 / len1, dy1 / len1, dz1 / len1);
        const dir2 = new THREE.Vector3(dx2 / len2, dy2 / len2, dz2 / len2);
        const dot = dir1.dot(dir2);
        const isElbow = Math.abs(dot) < 0.99;
        if (!isElbow) return null;

        const jx = pt.x + offsetX;
        const jy = elevCur;
        const jz = pt.y;

        if (isRound) {
          return (
            <mesh key={`jnt-${i}`} position={[jx, jy, jz]} castShadow>
              <sphereGeometry args={[w / 2 + 0.005, 10, 10]} />
              <meshStandardMaterial color={color} metalness={0.35} roughness={0.5} />
            </mesh>
          );
        }
        return (
          <mesh key={`jnt-${i}`} position={[jx, jy, jz]} castShadow>
            <boxGeometry args={[Math.max(w, h) + 0.01, Math.max(w, h) + 0.01, Math.max(w, h) + 0.01]} />
            <meshStandardMaterial color={color} map={tex} metalness={0.3} roughness={0.45} />
          </mesh>
        );
      })}

      {duct.points.map((pt, i) => {
        if (i === 0 || i === duct.points.length - 1) return null;
        const prev = duct.points[i - 1];
        const next = duct.points[i + 1];

        const elevPrev = (prev as any).elev !== undefined ? (prev as any).elev : elev;
        const elevCur = (pt as any).elev !== undefined ? (pt as any).elev : elev;
        const elevNext = (next as any).elev !== undefined ? (next as any).elev : elev;

        const dx1 = pt.x - prev.x; const dz1 = pt.y - prev.y; const dy1 = elevCur - elevPrev;
        const dx2 = next.x - pt.x; const dz2 = next.y - pt.y; const dy2 = elevNext - elevCur;
        const len1 = Math.sqrt(dx1 * dx1 + dz1 * dz1 + dy1 * dy1);
        const len2 = Math.sqrt(dx2 * dx2 + dz2 * dz2 + dy2 * dy2);
        if (len1 < 0.01 || len2 < 0.01) return null;

        const dir1 = new THREE.Vector3(dx1 / len1, 0, dz1 / len1);
        const dir2 = new THREE.Vector3(dx2 / len2, 0, dz2 / len2);
        const dot = dir1.normalize().dot(dir2.normalize());
        const isT = Math.abs(dot) < 0.15;

        if (!isT) return null;

        const jx = pt.x + offsetX;
        const jy = elevCur;
        const jz = pt.y;

        return (
          <mesh key={`t-${i}`} position={[jx, jy, jz]} castShadow>
            <sphereGeometry args={[Math.max(w, h) / 2 + 0.01, 8, 8]} />
            <meshStandardMaterial color={color} metalness={0.35} roughness={0.5} />
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

  const segments = useMemo(() => computeDuctSegments(pipe.points, offsetX, elev), [pipe.points, offsetX, elev]);

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

      {pipe.points.map((pt, i) => {
        if (i === 0 || i === pipe.points.length - 1) return null;
        const prev = pipe.points[i - 1];
        const next = pipe.points[i + 1];

        const elevPrev = (prev as any).elev !== undefined ? (prev as any).elev : elev;
        const elevCur = (pt as any).elev !== undefined ? (pt as any).elev : elev;
        const elevNext = (next as any).elev !== undefined ? (next as any).elev : elev;

        const dx1 = pt.x - prev.x; const dz1 = pt.y - prev.y; const dy1 = elevCur - elevPrev;
        const dx2 = next.x - pt.x; const dz2 = next.y - pt.y; const dy2 = elevNext - elevCur;
        const len1 = Math.sqrt(dx1 * dx1 + dz1 * dz1 + dy1 * dy1);
        const len2 = Math.sqrt(dx2 * dx2 + dz2 * dz2 + dy2 * dy2);
        if (len1 < 0.01 || len2 < 0.01) return null;

        const dir1 = new THREE.Vector3(dx1 / len1, dy1 / len1, dz1 / len1);
        const dir2 = new THREE.Vector3(dx2 / len2, dy2 / len2, dz2 / len2);
        const dot = dir1.dot(dir2);
        const isElbow = Math.abs(dot) < 0.99;
        if (!isElbow) return null;

        const jx = pt.x + offsetX;
        const jy = elevCur;
        const jz = pt.y;

        return (
          <mesh key={`jnt-${i}`} position={[jx, jy, jz]} castShadow>
            <sphereGeometry args={[radius * 1.5, 12, 12]} />
            <meshStandardMaterial color={color} metalness={0.5} roughness={0.35} />
          </mesh>
        );
      })}
    </group>
  );
}

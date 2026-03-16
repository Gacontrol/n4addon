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
    | { kind: 'poly'; extrudeGeo: THREE.BufferGeometry };

  const roomEntries = useMemo(() => {
    const entries: RoomEntry[] = [];
    for (const building of buildings) {
      for (const floor of building.floors) {
        if (floor.id !== widget.floorId) continue;
        for (const room of floor.rooms) {
          if (roomIds.length > 0 && !roomIds.includes(room.id)) continue;
          if (room.points && room.points.length >= 3) {
            const shape = new THREE.Shape();
            shape.moveTo(room.points[0].x, -room.points[0].y);
            for (let i = 1; i < room.points.length; i++) {
              shape.lineTo(room.points[i].x, -room.points[i].y);
            }
            shape.closePath();
            const extrudeGeo = new THREE.ExtrudeGeometry(shape, { depth: floorHeight, bevelEnabled: false });
            entries.push({ kind: 'poly', extrudeGeo });
          } else {
            entries.push({
              kind: 'box',
              x: room.x + room.width / 2,
              z: room.y + room.depth / 2,
              w: room.width,
              d: room.depth,
            });
          }
        }
      }
    }
    return entries;
  }, [buildings, widget.floorId, roomIds, floorHeight]);

  const isActive = alarmActive === true || (liveValue !== undefined && liveValue !== '0' && liveValue !== 'off' && liveValue !== false && liveValue !== 0);

  const colorTrue  = (widget as any).colorTrue  || widget.color || '#22c55e';
  const colorFalse = (widget as any).colorFalse || null;
  const configuredOpacity = (widget as any).opacity ?? 0.45;

  const overlayColor   = isActive ? colorTrue : colorFalse;
  const overlayOpacity = isActive ? configuredOpacity : (colorFalse ? configuredOpacity : 0);

  if (!overlayColor || overlayOpacity === 0) return null;

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {roomEntries.map((entry, i) => {
        if (entry.kind === 'poly') {
          return (
            <group key={i}>
              <mesh position={[offsetX, baseY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <primitive object={entry.extrudeGeo} />
                <meshBasicMaterial color={overlayColor} transparent opacity={overlayOpacity} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
              {selected && (
                <lineSegments position={[offsetX, baseY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <edgesGeometry args={[entry.extrudeGeo]} />
                  <lineBasicMaterial color="#60a5fa" />
                </lineSegments>
              )}
            </group>
          );
        }
        return (
          <group key={i}>
            <mesh position={[entry.x + offsetX, baseY + floorHeight / 2, entry.z]}>
              <boxGeometry args={[entry.w, floorHeight, entry.d]} />
              <meshBasicMaterial color={overlayColor} transparent opacity={overlayOpacity} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
            {selected && (
              <lineSegments position={[entry.x + offsetX, baseY + floorHeight / 2, entry.z]}>
                <edgesGeometry args={[new THREE.BoxGeometry(entry.w, floorHeight, entry.d)]} />
                <lineBasicMaterial color="#60a5fa" />
              </lineSegments>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DUCT NETWORK – node-based architecture (Revit / MagiCAD style)
// ─────────────────────────────────────────────────────────────────────────────

const FLANGE_SPACING   = 1.5;
const FLANGE_THICKNESS = 0.004;
const FLANGE_OVERHANG  = 0.030;
const ELBOW_SEGMENTS   = 20;

// ── stable world-up profile frame ──────────────────────────────────────────
// Creates an orthogonal coordinate frame aligned to duct direction:
//   Z-axis = duct direction (tangent)
//   Y-axis = world-up (gravity-aligned, or closest orthogonal for vertical ducts)
//   X-axis = cross product of Y and Z (perpendicular to both)
// This ensures flanges and duct profiles maintain consistent orientation.

function profileFrame(tangent: THREE.Vector3): { right: THREE.Vector3; up: THREE.Vector3 } {
  const worldUp = new THREE.Vector3(0, 1, 0);
  if (Math.abs(tangent.dot(worldUp)) > 0.999) {
    const right = new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3().crossVectors(right, tangent).normalize();
    return { right, up };
  }
  const right = new THREE.Vector3().crossVectors(worldUp, tangent).normalize();
  const up    = new THREE.Vector3().crossVectors(tangent, right).normalize();
  return { right, up };
}

function ductQuaternion(dir: THREE.Vector3): THREE.Quaternion {
  const { right, up } = profileFrame(dir);
  const m = new THREE.Matrix4().makeBasis(right, up, dir);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

// ── rect profile (CCW, for swept geometry) ─────────────────────────────────

function rectProfile(hw: number, hh: number): THREE.Vector2[] {
  return [
    new THREE.Vector2(-hw, -hh),
    new THREE.Vector2( hw, -hh),
    new THREE.Vector2( hw,  hh),
    new THREE.Vector2(-hw,  hh),
  ];
}

function circleProfile(r: number, n = 16): THREE.Vector2[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
  });
}

// ── swept tube geometry ─────────────────────────────────────────────────────
// Uses a stable world-up Frenet frame at every spine station so rectangular
// profiles keep correct orientation and never twist.

function buildSweptTube(
  profile: THREE.Vector2[],
  spine: THREE.Vector3[],
  tangents: THREE.Vector3[]
): THREE.BufferGeometry {
  const pCount = profile.length;
  const sCount = spine.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  let arcLen = 0;
  const arcLens = [0];
  for (let s = 1; s < sCount; s++) {
    arcLen += spine[s].distanceTo(spine[s - 1]);
    arcLens.push(arcLen);
  }

  for (let s = 0; s < sCount; s++) {
    const t  = arcLens[s] / Math.max(arcLen, 0.001);
    const pt = spine[s];

    // Use stable world-up frame at every station (no twist accumulation)
    const { right: curRight, up: curUp } = profileFrame(tangents[s]);

    for (let p = 0; p < pCount; p++) {
      const pp = profile[p];
      const wx = pt.x + curRight.x * pp.x + curUp.x * pp.y;
      const wy = pt.y + curRight.y * pp.x + curUp.y * pp.y;
      const wz = pt.z + curRight.z * pp.x + curUp.z * pp.y;
      positions.push(wx, wy, wz);
      uvs.push(p / pCount, t * arcLen / 0.5);
    }
  }

  for (let s = 0; s < sCount - 1; s++) {
    for (let p = 0; p < pCount; p++) {
      const a = s * pCount + p;
      const b = s * pCount + (p + 1) % pCount;
      const c = (s + 1) * pCount + (p + 1) % pCount;
      const d = (s + 1) * pCount + p;
      indices.push(a, b, c, a, c, d);
    }
  }

  const capCenterStart = positions.length / 3;
  for (const ring of [0, sCount - 1]) {
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

  const ci0 = capCenterStart, ci1 = capCenterStart + 1;
  for (let p = 0; p < pCount; p++) indices.push(ci0, (p + 1) % pCount, p);
  for (let p = 0; p < pCount; p++) {
    const base = (sCount - 1) * pCount;
    indices.push(ci1, base + p, base + (p + 1) % pCount);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ── straight duct ──────────────────────────────────────────────────────────

function createStraightDuct(
  start: THREE.Vector3,
  end: THREE.Vector3,
  w: number, h: number, isRound: boolean
): THREE.BufferGeometry {
  const dir = end.clone().sub(start).normalize();
  const len = start.distanceTo(end);
  const steps = Math.max(2, Math.ceil(len / 0.5) + 1);
  const spine: THREE.Vector3[] = [];
  const tangents: THREE.Vector3[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    spine.push(start.clone().lerp(end, t));
    tangents.push(dir.clone());
  }
  const profile = isRound ? circleProfile(w / 2) : rectProfile(w / 2, h / 2);
  return buildSweptTube(profile, spine, tangents);
}

// ── elbow ──────────────────────────────────────────────────────────────────
// Trim rule: trim = R * tan(sweepAngle / 2)
// sweepAngle = π - interiorAngle (the actual bend angle)
// Both straight ducts are shortened by `trim` before the elbow is inserted,
// guaranteeing a gap-free joint at any angle.

function elbowRadius(w: number, h: number): number {
  return Math.max(w, h) * 0.75;
}

function createElbow(
  nodePos: THREE.Vector3,
  inDir: THREE.Vector3,
  outDir: THREE.Vector3,
  w: number, h: number, isRound: boolean
): THREE.BufferGeometry {
  const dot = Math.max(-1, Math.min(1, inDir.dot(outDir)));
  const interiorAngle = Math.acos(dot);
  if (interiorAngle < 0.02) return new THREE.BufferGeometry();

  const axis = new THREE.Vector3().crossVectors(inDir, outDir);
  if (axis.lengthSq() < 1e-10) return new THREE.BufferGeometry();
  axis.normalize();

  // sweepAngle = the actual bend/deflection angle between the two duct directions
  const sweepAngle = interiorAngle;
  const R = elbowRadius(w, h);
  const trim = R * Math.tan(sweepAngle / 2);

  // Arc starts at nodePos - inDir*trim (where the trimmed straight ends).
  // Arc center is perpendicular (inward) at distance R from the start point.
  const inwardDir = new THREE.Vector3().crossVectors(axis, inDir).normalize();
  const arcCenter = nodePos.clone()
    .addScaledVector(inDir, -trim)
    .addScaledVector(inwardDir, R);

  const spine: THREE.Vector3[]    = [];
  const tangents: THREE.Vector3[] = [];

  for (let s = 0; s <= ELBOW_SEGMENTS; s++) {
    const frac   = s / ELBOW_SEGMENTS;
    const angle  = frac * sweepAngle;
    const quat   = new THREE.Quaternion().setFromAxisAngle(axis, angle);

    const tangent   = inDir.clone().applyQuaternion(quat).normalize();
    const radialOut = inwardDir.clone().negate().applyQuaternion(quat).normalize();
    const pt        = arcCenter.clone().addScaledVector(radialOut, R);

    spine.push(pt);
    tangents.push(tangent);
  }

  const profile = isRound ? circleProfile(w / 2) : rectProfile(w / 2, h / 2);
  return buildSweptTube(profile, spine, tangents);
}

// ── reducer ────────────────────────────────────────────────────────────────
// Interpolates the cross-section from (wA×hA) to (wB×hB) over the reducer
// length.  length = max(|wA-wB|, |hA-hB|) * 1.5 (minimum 0.05 m).

function createReducer(
  start: THREE.Vector3,
  end: THREE.Vector3,
  wA: number, hA: number,
  wB: number, hB: number,
  isRound: boolean
): THREE.BufferGeometry {
  const dir   = end.clone().sub(start).normalize();
  const len   = start.distanceTo(end);
  const steps = 12;

  const pCount   = isRound ? 16 : 4;
  const positions: number[] = [];
  const uvs: number[]       = [];
  const indices: number[]   = [];

  const { right, up } = profileFrame(dir);
  const arcLens: number[] = [];
  for (let i = 0; i <= steps; i++) arcLens.push((i / steps) * len);

  for (let s = 0; s <= steps; s++) {
    const t  = s / steps;
    const cw = wA + (wB - wA) * t;
    const ch = hA + (hB - hA) * t;
    const pt = start.clone().lerp(end, t);

    if (isRound) {
      const r = cw / 2;
      for (let p = 0; p < pCount; p++) {
        const a  = (p / pCount) * Math.PI * 2;
        positions.push(
          pt.x + right.x * Math.cos(a) * r + up.x * Math.sin(a) * r,
          pt.y + right.y * Math.cos(a) * r + up.y * Math.sin(a) * r,
          pt.z + right.z * Math.cos(a) * r + up.z * Math.sin(a) * r
        );
        uvs.push(p / pCount, arcLens[s] / len);
      }
    } else {
      const hw = cw / 2, hh = ch / 2;
      const corners = [
        new THREE.Vector2(-hw, -hh),
        new THREE.Vector2( hw, -hh),
        new THREE.Vector2( hw,  hh),
        new THREE.Vector2(-hw,  hh),
      ];
      for (let p = 0; p < 4; p++) {
        const pp = corners[p];
        positions.push(
          pt.x + right.x * pp.x + up.x * pp.y,
          pt.y + right.y * pp.x + up.y * pp.y,
          pt.z + right.z * pp.x + up.z * pp.y
        );
        uvs.push(p / 4, arcLens[s] / len);
      }
    }
  }

  for (let s = 0; s < steps; s++) {
    for (let p = 0; p < pCount; p++) {
      const a = s * pCount + p;
      const b = s * pCount + (p + 1) % pCount;
      const c = (s + 1) * pCount + (p + 1) % pCount;
      const d = (s + 1) * pCount + p;
      indices.push(a, b, c, a, c, d);
    }
  }

  const capStart = positions.length / 3;
  for (const ring of [0, steps]) {
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
  const ci0 = capStart, ci1 = capStart + 1;
  for (let p = 0; p < pCount; p++) indices.push(ci0, (p + 1) % pCount, p);
  for (let p = 0; p < pCount; p++) {
    const base = steps * pCount;
    indices.push(ci1, base + p, base + (p + 1) % pCount);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ── T-junction ─────────────────────────────────────────────────────────────
// For a node with 3 segments: identifies the two most collinear segments as
// the main duct and the remaining one as the branch.

function createTee(
  nodePos: THREE.Vector3,
  mainInDir: THREE.Vector3,
  mainOutDir: THREE.Vector3,
  branchDir: THREE.Vector3,
  w: number, h: number, isRound: boolean
): THREE.BufferGeometry[] {
  const trimR    = elbowRadius(w, h);
  const mainLen  = trimR * 2;

  // Main duct passes straight through the node
  const mainStart = nodePos.clone().addScaledVector(mainInDir,  -mainLen / 2);
  const mainEnd   = nodePos.clone().addScaledVector(mainOutDir,  mainLen / 2);
  const mainGeo   = createStraightDuct(mainStart, mainEnd, w, h, isRound);

  // Branch exits perpendicular to the main duct
  const branchW   = w * 0.7;
  const branchLen = mainLen * 0.8;
  const branchEnd = nodePos.clone().addScaledVector(branchDir, branchLen);
  const branchGeo = createStraightDuct(nodePos, branchEnd, branchW, h, isRound);

  return [mainGeo, branchGeo];
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE-BASED DUCT NETWORK
// ─────────────────────────────────────────────────────────────────────────────

interface DuctNetworkResult {
  straightGeos:  { geo: THREE.BufferGeometry; start: THREE.Vector3; end: THREE.Vector3; w: number; h: number }[];
  elbowGeos:     THREE.BufferGeometry[];
  reducerGeos:   THREE.BufferGeometry[];
  teeGeos:       THREE.BufferGeometry[];
  flangePositions: { pos: THREE.Vector3; dir: THREE.Vector3; w: number; h: number }[];
}

function buildDuctNetwork(
  points: { x: number; y: number; elev?: number }[],
  offsetX: number,
  defaultElev: number,
  w: number,
  h: number,
  isRound: boolean
): DuctNetworkResult {
  const result: DuctNetworkResult = {
    straightGeos:  [],
    elbowGeos:     [],
    reducerGeos:   [],
    teeGeos:       [],
    flangePositions: [],
  };

  if (points.length < 2) return result;

  // 1. Build raw world-space points
  const worldPts: THREE.Vector3[] = points.map(pt => new THREE.Vector3(
    pt.x + offsetX,
    pt.elev !== undefined ? pt.elev : defaultElev,
    pt.y
  ));

  // 2. Build raw segment directions
  const rawDirs: THREE.Vector3[] = [];
  for (let i = 0; i < worldPts.length - 1; i++) {
    const d = worldPts[i + 1].clone().sub(worldPts[i]);
    const len = d.length();
    if (len < 0.001) { rawDirs.push(new THREE.Vector3(1, 0, 0)); continue; }
    rawDirs.push(d.divideScalar(len));
  }

  // 3. Compute trim distances at each interior node
  //    trim = R * tan(sweepAngle / 2)   where sweepAngle = actual deflection angle
  const R = elbowRadius(w, h);
  const trims: number[] = new Array(worldPts.length).fill(0);

  for (let i = 1; i < worldPts.length - 1; i++) {
    const dIn  = rawDirs[i - 1];
    const dOut = rawDirs[i];
    const dot  = Math.max(-1, Math.min(1, dIn.dot(dOut)));
    const sweepAngle = Math.acos(dot);
    if (sweepAngle < 0.02) continue;
    trims[i] = R * Math.tan(sweepAngle / 2);
  }

  // 4. Generate trimmed straight segments
  for (let i = 0; i < worldPts.length - 1; i++) {
    const a       = worldPts[i];
    const dir     = rawDirs[i];
    const fullLen = a.distanceTo(worldPts[i + 1]);
    const pullA   = trims[i];
    const pullB   = trims[i + 1];
    const usedLen = fullLen - pullA - pullB;

    if (usedLen < 0.005) continue;

    const start = a.clone().addScaledVector(dir, pullA);
    const end   = a.clone().addScaledVector(dir, pullA + usedLen);
    const geo   = createStraightDuct(start, end, w, h, isRound);
    result.straightGeos.push({ geo, start, end, w, h });

    // Flanges
    const nFlanges = Math.max(0, Math.floor(usedLen / FLANGE_SPACING) - 1);
    for (let f = 1; f <= nFlanges; f++) {
      result.flangePositions.push({
        pos: start.clone().lerp(end, f / (nFlanges + 1)),
        dir: dir.clone(), w, h,
      });
    }
    result.flangePositions.push({ pos: start.clone().addScaledVector(dir,  FLANGE_THICKNESS * 2), dir: dir.clone(), w, h });
    result.flangePositions.push({ pos: end.clone().addScaledVector(dir,  -FLANGE_THICKNESS * 2), dir: dir.clone(), w, h });
  }

  // 5. Generate elbows at interior nodes where the direction changes
  for (let i = 1; i < worldPts.length - 1; i++) {
    const dIn   = rawDirs[i - 1];
    const dOut  = rawDirs[i];
    const dot   = Math.max(-1, Math.min(1, dIn.dot(dOut)));
    const angle = Math.acos(dot);
    if (angle < 0.02) continue;

    const geo = createElbow(worldPts[i], dIn, dOut, w, h, isRound);
    result.elbowGeos.push(geo);
  }

  // 6. Reducer: insert when adjacent segments have different cross-sections.
  //    For a single duct (uniform w/h) this never triggers, but the infra is
  //    in place for multi-segment networks with per-segment sizing.
  //    (Currently points do not carry size overrides, so reducerGeos stays empty.)

  // 7. T-junction detection: if any node is shared by 3 or more segments,
  //    generate a tee fitting.  In the current linear polyline model each
  //    interior point has exactly 2 segments so we detect branching by checking
  //    for duplicate world positions across the point array.
  const nodeMap = new Map<string, number[]>();
  for (let i = 0; i < worldPts.length; i++) {
    const key = `${worldPts[i].x.toFixed(3)},${worldPts[i].y.toFixed(3)},${worldPts[i].z.toFixed(3)}`;
    if (!nodeMap.has(key)) nodeMap.set(key, []);
    nodeMap.get(key)!.push(i);
  }

  for (const [, indices] of nodeMap) {
    if (indices.length < 2) continue;
    // Collect all segment directions touching this shared node
    const dirs: THREE.Vector3[] = [];
    const nodePos = worldPts[indices[0]];
    for (const idx of indices) {
      if (idx > 0) dirs.push(rawDirs[idx - 1]);
      if (idx < rawDirs.length) dirs.push(rawDirs[idx]);
    }
    if (dirs.length < 3) continue;

    // Find the two most collinear directions → main duct
    let bestDot = -2, mainA = 0, mainB = 1;
    for (let a = 0; a < dirs.length; a++) {
      for (let b = a + 1; b < dirs.length; b++) {
        const d = Math.abs(dirs[a].dot(dirs[b]));
        if (d > bestDot) { bestDot = d; mainA = a; mainB = b; }
      }
    }
    const branchIdx = dirs.findIndex((_, k) => k !== mainA && k !== mainB);
    if (branchIdx < 0) continue;

    const geos = createTee(
      nodePos,
      dirs[mainA].clone().negate(),
      dirs[mainB],
      dirs[branchIdx],
      w, h, isRound
    );
    result.teeGeos.push(...geos);
  }

  return result;
}

// ── flanges ────────────────────────────────────────────────────────────────

function FlangeRect({ w, h, tex }: { w: number; h: number; tex: THREE.CanvasTexture }) {
  const fw = w + FLANGE_OVERHANG * 2;
  const fh = h + FLANGE_OVERHANG * 2;
  const ft = FLANGE_THICKNESS;
  const bw = FLANGE_OVERHANG;
  const mat = <meshStandardMaterial map={tex} color="#8fa0b0" metalness={0.82} roughness={0.28} />;
  return (
    <group>
      <mesh castShadow position={[0, fh / 2 - bw / 2, 0]}>
        <boxGeometry args={[fw, bw, ft]} />
        {mat}
      </mesh>
      <mesh castShadow position={[0, -(fh / 2 - bw / 2), 0]}>
        <boxGeometry args={[fw, bw, ft]} />
        {mat}
      </mesh>
      <mesh castShadow position={[fw / 2 - bw / 2, 0, 0]}>
        <boxGeometry args={[bw, fh - bw * 2, ft]} />
        {mat}
      </mesh>
      <mesh castShadow position={[-(fw / 2 - bw / 2), 0, 0]}>
        <boxGeometry args={[bw, fh - bw * 2, ft]} />
        {mat}
      </mesh>
    </group>
  );
}

function FlangeRound({ r, tex }: { r: number; tex: THREE.CanvasTexture }) {
  const fr = r + FLANGE_OVERHANG;
  return (
    <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[fr, fr, FLANGE_THICKNESS, 24, 1, false]} />
      <meshStandardMaterial map={tex} color="#8fa0b0" metalness={0.82} roughness={0.28} />
    </mesh>
  );
}

// ── DuctMesh ───────────────────────────────────────────────────────────────

interface DuctMeshProps {
  duct: Duct;
  offsetX: number;
  baseY: number;
  selected: boolean;
  onSelect: () => void;
}

export function DuctMesh({ duct, offsetX, baseY, selected, onSelect }: DuctMeshProps) {
  const color    = duct.color || DUCT_COLORS[duct.type] || '#60a5fa';
  const elev     = baseY + (duct.elevation ?? 2.4);
  const w        = duct.width  || 0.3;
  const h        = duct.height || 0.2;
  const isRound  = duct.shape === 'round';

  const tex = useMemo(() => {
    const t = getCachedDuctTexture(color);
    t.repeat.set(1, 1);
    return t;
  }, [color]);
  const flangeTex = useMemo(() => getCachedFlangeTexture(), []);

  const network = useMemo(
    () => buildDuctNetwork(duct.points, offsetX, elev, w, h, isRound),
    [duct.points, offsetX, elev, w, h, isRound]
  );

  const mat = (
    <meshStandardMaterial
      color={color}
      map={tex}
      metalness={0.65}
      roughness={0.38}
      envMapIntensity={0.8}
    />
  );

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>

      {network.straightGeos.map(({ geo, start, end, w: sw, h: sh }, i) => {
        const mid = start.clone().lerp(end, 0.5);
        const len = start.distanceTo(end);
        return (
          <group key={`str-${i}`}>
            <mesh castShadow>
              <primitive object={geo} />
              {mat}
            </mesh>
            {selected && (
              <mesh position={mid.toArray()}>
                <boxGeometry args={[sw + 0.03, len + 0.03, sh + 0.03]} />
                <meshBasicMaterial color="#60a5fa" wireframe opacity={0.5} transparent />
              </mesh>
            )}
          </group>
        );
      })}

      {network.elbowGeos.map((geo, i) => (
        <mesh key={`elbow-${i}`} castShadow>
          <primitive object={geo} />
          {mat}
        </mesh>
      ))}

      {network.reducerGeos.map((geo, i) => (
        <mesh key={`red-${i}`} castShadow>
          <primitive object={geo} />
          {mat}
        </mesh>
      ))}

      {network.teeGeos.map((geo, i) => (
        <mesh key={`tee-${i}`} castShadow>
          <primitive object={geo} />
          {mat}
        </mesh>
      ))}

      {network.flangePositions.map((fl, i) => {
        const q = ductQuaternion(fl.dir);
        return (
          <group key={`fl-${i}`} position={fl.pos.toArray()} quaternion={q}>
            {isRound
              ? <FlangeRound r={fl.w / 2} tex={flangeTex} />
              : <FlangeRect  w={fl.w}    h={fl.h} tex={flangeTex} />
            }
          </group>
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
  const elev  = baseY + (pipe.elevation ?? 2.2);
  const r     = (pipe.diameter || 0.05) / 2;
  const ir    = r + 0.025;

  const pipeGeos = useMemo(() => {
    const geos: { geo: THREE.BufferGeometry; start: THREE.Vector3; end: THREE.Vector3}[] = [];
    if (pipe.points.length < 2) return geos;
    const worldPts = pipe.points.map(pt => new THREE.Vector3(
      pt.x + offsetX,
      (pt as any).elev !== undefined ? baseY + (pt as any).elev : elev,
      pt.y
    ));
    const R = r * 1.5;
    const rawDirs: THREE.Vector3[] = [];
    for (let i = 0; i < worldPts.length - 1; i++) {
      const d = worldPts[i + 1].clone().sub(worldPts[i]);
      const l = d.length();
      rawDirs.push(l < 0.001 ? new THREE.Vector3(1, 0, 0) : d.divideScalar(l));
    }
    const trims: number[] = new Array(worldPts.length).fill(0);
    for (let i = 1; i < worldPts.length - 1; i++) {
      const dot = Math.max(-1, Math.min(1, rawDirs[i - 1].dot(rawDirs[i])));
      const extAngle = Math.PI - Math.acos(dot);
      if (extAngle < 0.02) continue;
      trims[i] = R * Math.tan(extAngle / 2);
    }
    for (let i = 0; i < worldPts.length - 1; i++) {
      const dir     = rawDirs[i];
      const fullLen = worldPts[i].distanceTo(worldPts[i + 1]);
      const usedLen = fullLen - trims[i] - trims[i + 1];
      if (usedLen < 0.005) continue;
      const start = worldPts[i].clone().addScaledVector(dir, trims[i]);
      const end   = worldPts[i].clone().addScaledVector(dir, trims[i] + usedLen);
      geos.push({ geo: createStraightDuct(start, end, r * 2, r * 2, true), start, end });
    }
    return geos;
  }, [pipe.points, offsetX, elev, r, baseY]);

  const elbowGeos = useMemo(() => {
    const geos: THREE.BufferGeometry[] = [];
    if (pipe.points.length < 3) return geos;
    const worldPts = pipe.points.map(pt => new THREE.Vector3(
      pt.x + offsetX,
      (pt as any).elev !== undefined ? baseY + (pt as any).elev : elev,
      pt.y
    ));
    const rawDirs: THREE.Vector3[] = [];
    for (let i = 0; i < worldPts.length - 1; i++) {
      const d = worldPts[i + 1].clone().sub(worldPts[i]);
      const l = d.length();
      rawDirs.push(l < 0.001 ? new THREE.Vector3(1, 0, 0) : d.divideScalar(l));
    }
    for (let i = 1; i < worldPts.length - 1; i++) {
      const dot   = Math.max(-1, Math.min(1, rawDirs[i - 1].dot(rawDirs[i])));
      const angle = Math.acos(dot);
      if (angle < 0.02) continue;
      geos.push(createElbow(worldPts[i], rawDirs[i - 1], rawDirs[i], r * 2, r * 2, true));
    }
    return geos;
  }, [pipe.points, offsetX, elev, r, baseY]);

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {pipeGeos.map(({ geo }, i) => (
        <group key={`ps-${i}`}>
          <mesh castShadow>
            <primitive object={geo} />
            <meshStandardMaterial color={color} metalness={0.5} roughness={0.35} />
          </mesh>
          {pipe.insulated && (
            <mesh castShadow>
              <primitive object={createStraightDuct(
                pipeGeos[i].start, pipeGeos[i].end, ir * 2, ir * 2, true
              )} />
              <meshStandardMaterial color="#e2e8f0" transparent opacity={0.35} side={THREE.FrontSide} />
            </mesh>
          )}
        </group>
      ))}
      {elbowGeos.map((geo, i) => (
        <mesh key={`pe-${i}`} castShadow>
          <primitive object={geo} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.35} />
        </mesh>
      ))}
      {selected && pipeGeos.map(({ start, end }, i) => {
        const mid = start.clone().lerp(end, 0.5);
        const len = start.distanceTo(end);
        return (
          <mesh key={`psel-${i}`} position={mid.toArray()}>
            <sphereGeometry args={[ir + 0.02, 8, 6]} />
            <meshBasicMaterial color="#60a5fa" wireframe />
          </mesh>
        );
      })}
    </group>
  );
}

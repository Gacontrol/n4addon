import { Suspense, useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Building, Slab, DEFAULT_LAYERS } from '../../types/building';
import { Widget3DMesh, RoomColorOverlay, DuctMesh, PipeMesh } from './Building3DWidgets';
import { FurnitureMesh } from './Furniture3D';

export interface LightingSettings {
  ambientIntensity: number;
  sunIntensity: number;
  sunAngle: number;
  shadowEnabled: boolean;
  shadowSoftness: number;
  fillIntensity: number;
}

export const DEFAULT_LIGHTING: LightingSettings = {
  ambientIntensity: 0.4,
  sunIntensity: 1.6,
  sunAngle: 45,
  shadowEnabled: true,
  shadowSoftness: 2,
  fillIntensity: 0.35,
};

export interface ExplosionSettings {
  enabled: boolean;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

export const DEFAULT_EXPLOSION: ExplosionSettings = {
  enabled: false,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 4,
};

interface Props {
  buildings: Building[];
  activeFloorId: string | null;
  selectedRoomId: string | null;
  selectedWallId: string | null;
  selectedWidget3DId?: string | null;
  selectedDuctId?: string | null;
  selectedPipeId?: string | null;
  selectedFurnitureId?: string | null;
  onSelectRoom: (id: string | null) => void;
  onSelectWall: (id: string | null) => void;
  onSelectWidget3D?: (id: string | null) => void;
  onSelectDuct?: (id: string | null) => void;
  onSelectPipe?: (id: string | null) => void;
  onSelectFurniture?: (id: string | null) => void;
  onUpdateWidget3D?: (widgetId: string, x: number, y: number, z: number) => void;
  onPlaceWidget?: (x: number, y: number, z: number, floorId: string) => void;
  widgetPlacementMode?: boolean;
  liveValues?: Record<string, string | number>;
  alarmStates?: Record<string, boolean>;
  highlightFloor: boolean;
  bgColor?: string;
  floorTransparent?: boolean;
  bgTransparent?: boolean;
  showGrid?: boolean;
  lighting?: LightingSettings;
  explosion?: ExplosionSettings;
  wallsTransparent?: boolean;
  xrayOpacity?: number;
  onFloorClick?: (floorId: string, cx: number, baseY: number, cz: number, floorHeight: number, minX: number, maxX: number, minZ: number, maxZ: number) => void;
}

function hexToThree(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

const TEXTURE_PATTERNS: Record<string, (ctx: CanvasRenderingContext2D) => void> = {
  brick: (ctx) => {
    ctx.fillStyle = '#c0603a';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#b05530';
    const bw = 40, bh = 16;
    for (let row = 0; row < 8; row++) {
      const offset = (row % 2) * 20;
      for (let col = -1; col < 4; col++) {
        const x = col * bw + offset;
        const y = row * bh;
        ctx.fillRect(x, y, bw - 2, bh - 2);
      }
    }
    ctx.strokeStyle = '#8a4025';
    ctx.lineWidth = 1.5;
    for (let row = 0; row < 9; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * bh);
      ctx.lineTo(128, row * bh);
      ctx.stroke();
    }
    for (let row = 0; row < 8; row++) {
      const offset = (row % 2) * 20;
      for (let col = 0; col < 4; col++) {
        ctx.beginPath();
        ctx.moveTo(col * bw + offset, row * bh);
        ctx.lineTo(col * bw + offset, (row + 1) * bh);
        ctx.stroke();
      }
    }
  },
  concrete: (ctx) => {
    ctx.fillStyle = '#a0a8b0';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * 128;
      const y = Math.random() * 128;
      const r = Math.random() * 2;
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? 80 : 140},${Math.random() > 0.5 ? 85 : 145},${Math.random() > 0.5 ? 90 : 155},0.3)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  wood: (ctx) => {
    ctx.fillStyle = '#c49a5c';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#a0784a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 7 + Math.random() * 3);
      ctx.bezierCurveTo(40, i * 7 + Math.random() * 5 - 2, 90, i * 7 + Math.random() * 5 - 2, 128, i * 7 + Math.random() * 3);
      ctx.globalAlpha = 0.4 + Math.random() * 0.4;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
  drywall: (ctx) => {
    ctx.fillStyle = '#e8e4dc';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#c8c4bc';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 6; i++) {
      const y = i * 22;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i * 64, 0);
      ctx.lineTo(i * 64, 128);
      ctx.stroke();
    }
  },
  glass: (ctx) => {
    ctx.fillStyle = 'rgba(180,220,255,0.15)';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(200,235,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(128, 128);
    ctx.moveTo(20, 0); ctx.lineTo(128, 108);
    ctx.moveTo(0, 20); ctx.lineTo(108, 128);
    ctx.stroke();
  },
};

function makeTexture(materialType: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const painter = TEXTURE_PATTERNS[materialType] || TEXTURE_PATTERNS.concrete;
  painter(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

const textureCache = new Map<string, THREE.CanvasTexture>();
function getCachedTexture(materialType: string): THREE.CanvasTexture {
  if (!textureCache.has(materialType)) {
    textureCache.set(materialType, makeTexture(materialType));
  }
  return textureCache.get(materialType)!;
}

interface RoomMeshProps {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  selected: boolean;
  faded: boolean;
  onSelect: () => void;
  castShadow: boolean;
}

function RoomMesh({ x, y, z, width, depth, height, color, selected, faded, onSelect, castShadow: cs }: RoomMeshProps) {
  const baseColor = hexToThree(color);
  const opacity = faded ? 0.08 : 0.18;
  const emissive = selected ? baseColor : new THREE.Color(0x000000);
  const emissiveIntensity = selected ? 0.12 : 0.0;

  const mat = (
    <meshStandardMaterial
      color={baseColor}
      roughness={0.72}
      metalness={0.04}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      transparent
      opacity={opacity}
      depthWrite={false}
      side={THREE.DoubleSide}
    />
  );

  const hw = width / 2;
  const hd = depth / 2;
  const hh = height / 2;
  const cx = x + hw;
  const cy = z + hh;
  const cz = y + hd;

  return (
    <group position={[cx, cy, cz]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      <mesh castShadow={cs} receiveShadow position={[0, -hh, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        {mat}
      </mesh>
      <mesh castShadow={cs} receiveShadow position={[0, 0, -hd]} rotation={[0, 0, 0]}>
        <planeGeometry args={[width, height]} />
        {mat}
      </mesh>
      <mesh castShadow={cs} receiveShadow position={[0, 0, hd]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[width, height]} />
        {mat}
      </mesh>
      <mesh castShadow={cs} receiveShadow position={[-hw, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[depth, height]} />
        {mat}
      </mesh>
      <mesh castShadow={cs} receiveShadow position={[hw, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[depth, height]} />
        {mat}
      </mesh>
      {selected && (
        <lineSegments position={[0, hh / 2, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(width + 0.02, height + 0.02, depth + 0.02)]} />
          <lineBasicMaterial color="#60a5fa" linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
}

interface PolygonRoomMeshProps {
  points: { x: number; y: number }[];
  offsetX: number;
  baseY: number;
  height: number;
  color: string;
  selected: boolean;
  faded: boolean;
  onSelect: () => void;
}

function PolygonRoomMesh({ points, offsetX, baseY, height, color, selected, faded, onSelect }: PolygonRoomMeshProps) {
  const baseColor = hexToThree(color);
  const opacity = faded ? 0.08 : 0.18;

  const geo = useMemo(() => {
    if (points.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, -points[0].y);
    for (let i = 1; i < points.length; i++) shape.lineTo(points[i].x, -points[i].y);
    shape.closePath();
    const extGeo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
    return extGeo;
  }, [points, height]);

  if (!geo) return null;

  return (
    <mesh
      position={[offsetX, baseY, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      castShadow
      receiveShadow
    >
      <primitive object={geo} />
      <meshStandardMaterial
        color={baseColor}
        roughness={0.72}
        metalness={0.04}
        emissive={selected ? baseColor : new THREE.Color(0x000000)}
        emissiveIntensity={selected ? 0.15 : 0}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface WallSegmentProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  baseY: number;
  height: number;
  thickness: number;
  color: string;
  opacity: number;
  selected: boolean;
  faded: boolean;
  materialType: string;
  openings: { type: string; position: number; width: number; height: number; sillHeight: number }[];
  onSelect: () => void;
  castShadow: boolean;
}

function WallSegment({
  x1, y1, x2, y2, baseY, height, thickness, color, opacity: wallOpacity,
  selected, faded, materialType, openings, onSelect, castShadow: cs
}: WallSegmentProps) {
  const dx = x2 - x1;
  const dz = y2 - y1;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.01) return null;

  const cx = (x1 + x2) / 2;
  const cz = (y1 + y2) / 2;
  const angle = Math.atan2(dz, dx);

  const wallColor = hexToThree(color || '#94a3b8');
  const isGlass = materialType === 'glass';
  const effectiveOpacity = faded ? 0.12 : (isGlass ? 0.3 : wallOpacity);
  const transparent = faded || isGlass || wallOpacity < 1.0;

  let roughness = 0.85;
  let metalness = 0.0;
  if (materialType === 'glass') { roughness = 0.05; metalness = 0.15; }
  else if (materialType === 'concrete') { roughness = 0.92; }
  else if (materialType === 'brick') { roughness = 0.88; }
  else if (materialType === 'wood') { roughness = 0.78; }
  else if (materialType === 'drywall') { roughness = 0.82; }

  const tex = useMemo(() => isGlass ? null : getCachedTexture(materialType), [materialType, isGlass]);

  const wallParts: JSX.Element[] = [];

  if (openings.length === 0) {
    wallParts.push(
      <mesh key="solid" castShadow={cs} receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <boxGeometry args={[len, height, thickness]} />
        <meshStandardMaterial
          color={wallColor}
          map={tex}
          roughness={roughness}
          metalness={metalness}
          transparent={transparent}
          opacity={effectiveOpacity}
          depthWrite={!transparent || effectiveOpacity > 0.5}
          envMapIntensity={isGlass ? 1.5 : 0.3}
          side={isGlass ? THREE.DoubleSide : THREE.FrontSide}
        />
      </mesh>
    );
  } else {
    const sortedOpenings = [...openings].sort((a, b) => a.position - b.position);

    let prevPos = 0;
    sortedOpenings.forEach((op, idx) => {
      const opStart = op.position - op.width / 2;
      const opEnd = op.position + op.width / 2;
      const clampedStart = Math.max(0, opStart);
      const clampedEnd = Math.min(len, opEnd);

      if (clampedStart > prevPos + 0.01) {
        const segLen = clampedStart - prevPos;
        const segCx = prevPos + segLen / 2 - len / 2;
        wallParts.push(
          <mesh key={`seg-${idx}-before`} position={[segCx, 0, 0]} castShadow={cs} receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
            <boxGeometry args={[segLen, height, thickness]} />
            <meshStandardMaterial color={wallColor} map={tex} roughness={roughness} metalness={metalness} transparent={transparent} opacity={effectiveOpacity} depthWrite={!transparent || effectiveOpacity > 0.5} />
          </mesh>
        );
      }

      const sillH = op.sillHeight || 0;
      const openH = Math.min(op.height, height - sillH);
      const segCxOp = clampedStart + (clampedEnd - clampedStart) / 2 - len / 2;

      if (sillH > 0.01) {
        wallParts.push(
          <mesh key={`sill-${idx}`} position={[segCxOp, sillH / 2 - height / 2, 0]} castShadow={cs} receiveShadow>
            <boxGeometry args={[clampedEnd - clampedStart, sillH, thickness]} />
            <meshStandardMaterial color={wallColor} map={tex} roughness={roughness} metalness={metalness} transparent={transparent} opacity={effectiveOpacity} depthWrite={!transparent || effectiveOpacity > 0.5} />
          </mesh>
        );
      }

      const aboveH = height - sillH - openH;
      if (aboveH > 0.01) {
        wallParts.push(
          <mesh key={`above-${idx}`} position={[segCxOp, height / 2 - aboveH / 2, 0]} castShadow={cs} receiveShadow>
            <boxGeometry args={[clampedEnd - clampedStart, aboveH, thickness]} />
            <meshStandardMaterial color={wallColor} map={tex} roughness={roughness} metalness={metalness} transparent={transparent} opacity={effectiveOpacity} depthWrite={!transparent || effectiveOpacity > 0.5} />
          </mesh>
        );
      }

      const isDoor = op.type === 'door' || op.type === 'door-double' || op.type === 'door-arch';
      if (!isDoor) {
        wallParts.push(
          <mesh key={`glass-${idx}`} position={[segCxOp, sillH + openH / 2 - height / 2, 0]}>
            <boxGeometry args={[clampedEnd - clampedStart, openH, thickness * 0.15]} />
            <meshStandardMaterial
              color={new THREE.Color(0x88ccff)}
              roughness={0.05} metalness={0.1} transparent opacity={0.25} depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      }

      prevPos = clampedEnd;
    });

    if (prevPos < len - 0.01) {
      const segLen = len - prevPos;
      const segCx = prevPos + segLen / 2 - len / 2;
      wallParts.push(
        <mesh key="seg-last" position={[segCx, 0, 0]} castShadow={cs} receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <boxGeometry args={[segLen, height, thickness]} />
          <meshStandardMaterial color={wallColor} map={tex} roughness={roughness} metalness={metalness} transparent={transparent} opacity={effectiveOpacity} depthWrite={!transparent || effectiveOpacity > 0.5} />
        </mesh>
      );
    }
  }

  return (
    <group position={[cx, baseY + height / 2, cz]} rotation={[0, -angle, 0]}>
      {wallParts}
      {selected && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(len + 0.02, height + 0.02, thickness + 0.02)]} />
          <lineBasicMaterial color="#60a5fa" linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
}

interface FloorPlaneProps {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  baseY: number;
  color: string;
  active: boolean;
  faded: boolean;
  onClick?: () => void;
}

function FloorPlane({ minX, maxX, minZ, maxZ, baseY, color, active, faded, onClick }: FloorPlaneProps) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  if (w < 0.1 || d < 0.1) return null;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const floorColor = hexToThree(color || '#1e3a5f');
  const opacity = faded ? 0.08 : (active ? 0.92 : 0.45);
  const floorY = baseY + 0.001;

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, -d / 2);
    s.lineTo(w / 2, -d / 2);
    s.lineTo(w / 2, d / 2);
    s.lineTo(-w / 2, d / 2);
    s.closePath();
    return s;
  }, [w, d]);

  return (
    <mesh
      position={[cx, floorY, cz]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
    >
      <shapeGeometry args={[shape]} />
      <meshStandardMaterial
        color={floorColor}
        roughness={0.88}
        metalness={0.02}
        transparent
        opacity={opacity}
        depthWrite={opacity > 0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface WidgetPlacementHelperProps {
  buildings: Building[];
  activeFloorId: string | null;
  onPlace: (x: number, y: number, z: number, floorId: string) => void;
}

function WidgetPlacementHelper({ buildings, activeFloorId, onPlace }: WidgetPlacementHelperProps) {
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const point = e.point;

    let targetFloorId = activeFloorId;
    let baseY = 0;

    for (const building of buildings) {
      const sorted = [...building.floors].sort((a, b) => a.level - b.level);
      let yAcc = 0;
      for (const floor of sorted) {
        const floorTop = yAcc + floor.height;
        if (point.y >= yAcc && point.y < floorTop) {
          targetFloorId = floor.id;
          baseY = yAcc;
          break;
        }
        yAcc = floorTop;
      }
    }

    if (targetFloorId) {
      const worldX = point.x;
      const worldY = point.z;
      const worldZ = point.y - baseY;
      onPlace(worldX, worldY, worldZ, targetFloorId);
    }
  }, [buildings, activeFloorId, onPlace]);

  return (
    <mesh
      position={[0, 0.002, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onClick={handleClick}
    >
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

interface SlabMeshProps {
  slab: Slab;
  offsetX: number;
  baseY: number;
}

function SlabMesh({ slab, offsetX, baseY }: SlabMeshProps) {
  const thickness = slab.thickness ?? 0.15;
  const elevation = slab.elevation ?? 0;
  const opacity = slab.opacity ?? 0.85;
  const color = slab.color || '#94a3b8';

  const shape = useMemo(() => {
    if (slab.points.length < 3) return null;
    const s = new THREE.Shape();
    s.moveTo(slab.points[0].x, -slab.points[0].y);
    for (let i = 1; i < slab.points.length; i++) {
      s.lineTo(slab.points[i].x, -slab.points[i].y);
    }
    s.closePath();
    return s;
  }, [slab.points]);

  const extrudeSettings = useMemo(() => ({
    depth: thickness,
    bevelEnabled: false,
  }), [thickness]);

  if (!shape) return null;

  const y = baseY + elevation;

  return (
    <mesh
      position={[offsetX, y, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      castShadow
      receiveShadow
    >
      <extrudeGeometry args={[shape, extrudeSettings]} />
      <meshStandardMaterial
        color={color}
        roughness={0.8}
        metalness={0.05}
        transparent={opacity < 1}
        opacity={opacity}
        depthWrite={opacity > 0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function GroundGrid({ size, transparent, showGrid = true }: { size: number; transparent?: boolean; showGrid?: boolean }) {
  if (!showGrid) return null;
  return (
    <group>
      {!transparent && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
          <planeGeometry args={[size * 2, size * 2]} />
          <meshStandardMaterial color="#0d1929" roughness={1} metalness={0} />
        </mesh>
      )}
      <gridHelper args={[size * 2, size * 4, '#1e3a5f', transparent ? '#2a4a6f' : '#132035']} position={[0, 0, 0]} />
    </group>
  );
}

interface FocusFloorDetail {
  cx: number;
  baseY: number;
  cz: number;
  floorHeight: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function CameraFocusFloor() {
  const { camera, controls } = useThree();

  useEffect(() => {
    const handler = (e: Event) => {
      const { cx, baseY, cz, floorHeight, minX, maxX, minZ, maxZ } = (e as CustomEvent<FocusFloorDetail>).detail;
      const floorCenterY = baseY + floorHeight / 2;
      const spanX = maxX - minX;
      const spanZ = maxZ - minZ;
      const span = Math.max(spanX, spanZ, 4);

      const camHeight = floorCenterY + span * 1.1;
      const tiltOffset = span * 0.08;

      const startPos = camera.position.clone();
      const endPos = new THREE.Vector3(cx, camHeight, cz + tiltOffset);
      const startTarget = controls ? (controls as any).target.clone() : new THREE.Vector3(cx, floorCenterY, cz);
      const endTarget = new THREE.Vector3(cx, floorCenterY, cz);

      const duration = 700;
      const startTime = performance.now();

      const animate = (now: number) => {
        const t = Math.min((now - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(startPos, endPos, ease);
        camera.lookAt(endTarget.x, endTarget.y, endTarget.z);
        if (controls && (controls as any).target) {
          (controls as any).target.lerpVectors(startTarget, endTarget, ease);
          (controls as any).update?.();
        }
        if (t < 1) requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    };

    window.addEventListener('focus-floor', handler);
    return () => window.removeEventListener('focus-floor', handler);
  }, [camera, controls]);

  return null;
}

function CameraAutoFit({ buildings }: { buildings: Building[] }) {
  const { camera, controls } = useThree();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current) return;
    const allX: number[] = [];
    const allZ: number[] = [];
    let totalH = 0;

    for (const b of buildings) {
      for (const fl of b.floors) {
        for (const w of fl.walls) { allX.push(w.x1, w.x2); allZ.push(w.y1, w.y2); }
        for (const r of fl.rooms) { allX.push(r.x, r.x + r.width); allZ.push(r.y, r.y + r.depth); }
      }
      const sorted = [...b.floors].sort((a, bv) => a.level - bv.level);
      totalH = sorted.reduce((acc, f) => acc + f.height, 0);
    }

    if (allX.length < 2) return;

    const minX = Math.min(...allX), maxX = Math.max(...allX);
    const minZ = Math.min(...allZ), maxZ = Math.max(...allZ);
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const targetY = totalH * 0.4;
    const diag = Math.sqrt((maxX - minX) ** 2 + (maxZ - minZ) ** 2) || 10;

    const dist = Math.max(diag * 1.2, totalH * 1.5, 15);
    camera.position.set(cx + dist * 0.7, totalH + dist * 0.5, cz + dist * 0.7);
    camera.lookAt(cx, targetY, cz);

    if (controls && (controls as any).target) {
      (controls as any).target.set(cx, targetY, cz);
      (controls as any).update?.();
    }

    fitted.current = true;
  }, [buildings, camera, controls]);

  return null;
}

function DynamicOrbitTarget() {
  const { camera, controls, scene, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  useEffect(() => {
    const canvas = gl.domElement;

    const updateTargetToScreenCenter = () => {
      if (!controls || !(controls as any).target) return;

      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

      const intersects = raycaster.intersectObjects(scene.children, true);
      const validHit = intersects.find(i => i.object.visible && i.distance > 0.1);

      if (validHit) {
        (controls as any).target.copy(validHit.point);
      } else {
        const planeHit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(groundPlane, planeHit)) {
          (controls as any).target.copy(planeHit);
        } else {
          const dir = raycaster.ray.direction.clone();
          const fallbackDist = camera.position.length() * 0.5 || 10;
          const fallbackPoint = camera.position.clone().add(dir.multiplyScalar(fallbackDist));
          (controls as any).target.copy(fallbackPoint);
        }
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) {
        updateTargetToScreenCenter();
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    return () => canvas.removeEventListener('pointerdown', onPointerDown);
  }, [camera, controls, scene, gl, raycaster, groundPlane]);

  return null;
}

interface BuildingSceneProps {
  buildings: Building[];
  activeFloorId: string | null;
  selectedRoomId: string | null;
  selectedWallId: string | null;
  selectedWidget3DId?: string | null;
  selectedDuctId?: string | null;
  selectedPipeId?: string | null;
  selectedFurnitureId?: string | null;
  onSelectRoom: (id: string | null) => void;
  onSelectWall: (id: string | null) => void;
  onSelectWidget3D?: (id: string | null) => void;
  onSelectDuct?: (id: string | null) => void;
  onSelectPipe?: (id: string | null) => void;
  onSelectFurniture?: (id: string | null) => void;
  onUpdateWidget3D?: (widgetId: string, x: number, y: number, z: number) => void;
  onPlaceWidget?: (x: number, y: number, z: number, floorId: string) => void;
  widgetPlacementMode?: boolean;
  liveValues?: Record<string, string | number>;
  alarmStates?: Record<string, boolean>;
  highlightFloor: boolean;
  lighting: LightingSettings;
  floorTransparent?: boolean;
  showGrid?: boolean;
  explosion?: ExplosionSettings;
  wallsTransparent?: boolean;
  xrayOpacity?: number;
  onFloorClick?: (floorId: string, cx: number, baseY: number, cz: number, floorHeight: number, minX: number, maxX: number, minZ: number, maxZ: number) => void;
}

function BuildingScene({
  buildings, activeFloorId, selectedRoomId, selectedWallId,
  selectedWidget3DId, selectedDuctId, selectedPipeId, selectedFurnitureId,
  onSelectRoom, onSelectWall, onSelectWidget3D, onSelectDuct, onSelectPipe, onSelectFurniture, onUpdateWidget3D,
  onPlaceWidget, widgetPlacementMode,
  liveValues = {}, alarmStates = {},
  highlightFloor, lighting, floorTransparent, showGrid = true, explosion, wallsTransparent = false, xrayOpacity = 0.2,
  onFloorClick
}: BuildingSceneProps) {
  const elements: JSX.Element[] = [];
  let allSize = 20;

  const sunAngleRad = (lighting.sunAngle * Math.PI) / 180;
  const sunDist = 30;
  const sunX = Math.cos(sunAngleRad) * sunDist;
  const sunZ = Math.sin(sunAngleRad) * sunDist;

  const explode = explosion?.enabled ?? false;
  const expOffX = explosion?.offsetX ?? 0;
  const expOffY = explosion?.offsetY ?? 0;
  const expOffZ = explosion?.offsetZ ?? 4;

  let bldOffX = 0;
  for (const building of buildings) {
    const sorted = [...building.floors].sort((a, b) => a.level - b.level);

    const allX: number[] = [];
    const allZ: number[] = [];
    for (const fl of building.floors) {
      for (const w of fl.walls) { allX.push(w.x1, w.x2); allZ.push(w.y1, w.y2); }
      for (const r of fl.rooms) { allX.push(r.x, r.x + r.width); allZ.push(r.y, r.y + r.depth); }
    }

    if (allX.length === 0) { bldOffX += 12; continue; }

    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minZ = Math.min(...allZ);
    const maxZ = Math.max(...allZ);
    const bldW = maxX - minX + 2;

    allSize = Math.max(allSize, Math.max(bldW, maxZ - minZ) * 2 + 20);

    const floorBaseY: Record<string, number> = {};
    const floorExpOffX: Record<string, number> = {};
    const floorExpOffZ: Record<string, number> = {};
    let yAcc = 0;
    sorted.forEach((fl, idx) => {
      floorBaseY[fl.id] = yAcc;
      floorExpOffX[fl.id] = explode ? idx * expOffX : 0;
      floorExpOffZ[fl.id] = explode ? idx * expOffY : 0;
      yAcc += fl.height + (explode ? expOffZ : 0);
    });
    if (!explode) {
      let yAcc2 = 0;
      for (const fl of sorted) { floorBaseY[fl.id] = yAcc2; yAcc2 += fl.height; }
    }

    const offsetX = bldOffX - minX;

    for (const floor of sorted) {
      if (floor.hidden) continue;
      const baseY = floorBaseY[floor.id];
      const floorOffX = floorExpOffX[floor.id] ?? 0;
      const floorOffZ = floorExpOffZ[floor.id] ?? 0;
      const isActive = floor.id === activeFloorId;
      const faded = highlightFloor && !isActive;

      const floorElements: JSX.Element[] = [];

      const fpMinX = minX + offsetX;
      const fpMaxX = maxX + offsetX;
      const fpCX = (fpMinX + fpMaxX) / 2;
      const fpCZ = (minZ + maxZ) / 2;
      const handleFloorZoom = onFloorClick
        ? () => onFloorClick(floor.id, fpCX, baseY, fpCZ, floor.height, fpMinX, fpMaxX, minZ, maxZ)
        : undefined;

      if (floor.showFloorPlane !== false) {
        floorElements.push(
          <FloorPlane
            key={`floor-${floor.id}`}
            minX={fpMinX}
            maxX={fpMaxX}
            minZ={minZ}
            maxZ={maxZ}
            baseY={baseY}
            color={floor.floorColor || '#1e3a5f'}
            active={isActive}
            faded={faded}
            onClick={handleFloorZoom}
          />
        );
      }

      if (onFloorClick) {
        const fw = fpMaxX - fpMinX;
        const fd = maxZ - minZ;
        if (fw > 0.1 && fd > 0.1) {
          floorElements.push(
            <mesh
              key={`floor-hitbox-${floor.id}`}
              position={[fpCX, baseY + floor.height / 2, fpCZ]}
              onClick={(e) => { e.stopPropagation(); handleFloorZoom?.(); }}
            >
              <boxGeometry args={[fw, floor.height, fd]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          );
        }
      }

      const flLayers = { ...DEFAULT_LAYERS, ...(floor.layers ?? {}) };

      for (const room of floor.rooms) {
        if (!flLayers.rooms) break;
        if (room.points && room.points.length > 2) {
          floorElements.push(
            <PolygonRoomMesh
              key={`room-${room.id}`}
              points={room.points}
              offsetX={offsetX}
              baseY={baseY}
              height={floor.height}
              color={room.color}
              selected={room.id === selectedRoomId}
              faded={faded}
              onSelect={() => { onSelectRoom(room.id); onSelectWall(null); }}
            />
          );
        } else {
          floorElements.push(
            <RoomMesh
              key={`room-${room.id}`}
              x={room.x + offsetX}
              y={room.y}
              z={baseY}
              width={room.width}
              depth={room.depth}
              height={floor.height}
              color={room.color}
              selected={room.id === selectedRoomId}
              faded={faded}
              onSelect={() => { onSelectRoom(room.id); onSelectWall(null); }}
              castShadow={lighting.shadowEnabled}
            />
          );
        }
      }

      for (const wall of floor.walls) {
        if (!flLayers.walls) break;
        const wallH = wall.height > 0 ? wall.height : floor.height;
        const adjX1 = wall.x1 + offsetX;
        const adjX2 = wall.x2 + offsetX;

        const connectedWalls = floor.walls.filter(w => w.id !== wall.id);
        const dx = wall.x2 - wall.x1;
        const dz = wall.y2 - wall.y1;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.01) continue;

        let extStart = 0;
        let extEnd = 0;

        for (const other of connectedWalls) {
          const odx = other.x2 - other.x1;
          const odz = other.y2 - other.y1;
          const olen = Math.sqrt(odx * odx + odz * odz);
          if (olen < 0.01) continue;

          const checkPoints = [
            { wx: wall.x1, wy: wall.y1, isStart: true },
            { wx: wall.x2, wy: wall.y2, isStart: false },
          ];
          for (const cp of checkPoints) {
            const dToStart = Math.sqrt((cp.wx - other.x1) ** 2 + (cp.wy - other.y1) ** 2);
            const dToEnd = Math.sqrt((cp.wx - other.x2) ** 2 + (cp.wy - other.y2) ** 2);
            if (dToStart < other.thickness || dToEnd < other.thickness) {
              const ext = other.thickness / 2;
              if (cp.isStart) extStart = Math.max(extStart, ext);
              else extEnd = Math.max(extEnd, ext);
            }
          }
        }

        floorElements.push(
          <WallSegment
            key={`wall-${wall.id}`}
            x1={adjX1 - (dx / len) * extStart}
            y1={wall.y1 - (dz / len) * extStart}
            x2={adjX2 + (dx / len) * extEnd}
            y2={wall.y2 + (dz / len) * extEnd}
            baseY={baseY}
            height={wallH}
            thickness={wall.thickness || 0.25}
            color={wall.color || '#94a3b8'}
            opacity={wallsTransparent ? xrayOpacity : (wall.opacity ?? 1)}
            selected={wall.id === selectedWallId}
            faded={faded}
            materialType={wallsTransparent ? 'glass' : (wall.materialType || 'concrete')}
            openings={(wall.openings ?? []).map(o => ({
              type: o.type,
              position: o.position,
              width: o.width,
              height: o.height,
              sillHeight: o.sillHeight || 0,
            }))}
            onSelect={() => { onSelectWall(wall.id); onSelectRoom(null); }}
            castShadow={lighting.shadowEnabled && !wallsTransparent}
          />
        );
      }

      for (const duct of (floor.ducts ?? [])) {
        if (!flLayers.ducts) break;
        if (duct.isVertical) {
          if (!flLayers.verticalDucts) continue;
          if (explode && duct.verticalSectionPoints && duct.verticalSectionPoints.length >= 2) {
            const ys = duct.verticalSectionPoints.map(p => p.y);
            const minDuctY = Math.min(...ys);
            const maxDuctY = Math.max(...ys);
            for (let fi = 0; fi < sorted.length; fi++) {
              const segFloor = sorted[fi];
              const segBaseY = floorBaseY[segFloor.id];
              const segTopY = segBaseY + segFloor.height;
              const segStartY = Math.max(minDuctY, segBaseY);
              const segEndY = Math.min(maxDuctY, segTopY);
              if (segEndY <= segStartY) continue;
              const segExpOffX = floorExpOffX[segFloor.id] ?? 0;
              const segExpOffZ = floorExpOffZ[segFloor.id] ?? 0;
              const segDuct = {
                ...duct,
                verticalSectionPoints: [
                  { x: 0, y: segStartY - segBaseY },
                  { x: 0, y: segEndY - segBaseY }
                ]
              };
              elements.push(
                <group key={`vduct-${duct.id}-seg-${fi}`} position={[segExpOffX, 0, segExpOffZ]}>
                  <DuctMesh
                    duct={segDuct}
                    offsetX={offsetX}
                    baseY={segBaseY}
                    selected={duct.id === selectedDuctId}
                    faded={highlightFloor && segFloor.id !== activeFloorId}
                    onSelect={() => { onSelectDuct?.(duct.id); onSelectWall(null); onSelectRoom(null); }}
                  />
                </group>
              );
            }
            continue;
          }
        }
        floorElements.push(
          <DuctMesh
            key={`duct-${duct.id}`}
            duct={duct}
            offsetX={offsetX}
            baseY={baseY}
            selected={duct.id === selectedDuctId}
            faded={faded}
            onSelect={() => { onSelectDuct?.(duct.id); onSelectWall(null); onSelectRoom(null); }}
          />
        );
      }

      for (const pipe of (floor.pipes ?? [])) {
        if (!flLayers.pipes) break;
        floorElements.push(
          <PipeMesh
            key={`pipe-${pipe.id}`}
            pipe={pipe}
            offsetX={offsetX}
            baseY={baseY}
            selected={pipe.id === selectedPipeId}
            faded={faded}
            onSelect={() => { onSelectPipe?.(pipe.id); onSelectWall(null); onSelectRoom(null); }}
          />
        );
      }

      for (const slab of (floor.slabs ?? [])) {
        if (!flLayers.slabs) break;
        floorElements.push(
          <SlabMesh
            key={`slab-${slab.id}`}
            slab={slab}
            offsetX={offsetX}
            baseY={baseY}
          />
        );
      }

      if (flLayers.furniture !== false) {
        for (const fi of (floor.furniture ?? [])) {
          floorElements.push(
            <FurnitureMesh
              key={`furniture-${fi.id}`}
              item={fi}
              offsetX={offsetX}
              baseY={baseY}
              selected={fi.id === selectedFurnitureId}
              faded={faded}
              onSelect={() => { onSelectFurniture?.(fi.id); onSelectWall(null); onSelectRoom(null); }}
            />
          );
        }
      }

      elements.push(
        <group key={`floorgroup-${floor.id}`} position={[floorOffX, 0, floorOffZ]}>
          {floorElements}
        </group>
      );
    }

    for (const widget of (building.widgets3d ?? [])) {
      const widgetFloorIdx = sorted.findIndex(fl => fl.id === widget.floorId);
      const floorBaseYLocal = floorBaseY[widget.floorId] ?? (() => {
        const sorted2 = [...building.floors].sort((a, b) => a.level - b.level);
        let acc = 0;
        for (const fl of sorted2) {
          if (fl.id === widget.floorId) return acc;
          acc += fl.height;
        }
        return 0;
      })();
      const widOffX = explode && widgetFloorIdx >= 0 ? widgetFloorIdx * expOffX : 0;
      const widOffZ = explode && widgetFloorIdx >= 0 ? widgetFloorIdx * expOffY : 0;
      const floorForWidget = building.floors.find(f => f.id === widget.floorId);
      const floorH = floorForWidget?.height ?? 3;

      if (widget.type === 'roomcolor') {
        elements.push(
          <group key={`widget3d-group-${widget.id}`} position={[widOffX, 0, widOffZ]}>
            <RoomColorOverlay
              key={`widget3d-${widget.id}`}
              widget={widget}
              baseY={floorBaseYLocal}
              floorHeight={floorH}
              offsetX={offsetX}
              buildings={buildings}
              liveValue={liveValues[widget.datapoint]}
              alarmActive={widget.alarmDatapoint ? alarmStates[widget.alarmDatapoint] : undefined}
              selected={widget.id === selectedWidget3DId}
              onSelect={() => { onSelectWidget3D?.(widget.id); onSelectWall(null); onSelectRoom(null); }}
            />
          </group>
        );
      } else {
        const wid = widget;
        elements.push(
          <group key={`widget3d-group-${wid.id}`} position={[widOffX, 0, widOffZ]}>
            <Widget3DMesh
              key={`widget3d-${wid.id}`}
              widget={{ ...wid, x: wid.x + offsetX }}
              liveValue={liveValues[wid.datapoint]}
              alarmActive={wid.alarmDatapoint ? alarmStates[wid.alarmDatapoint] : undefined}
              selected={wid.id === selectedWidget3DId}
              onSelect={() => { onSelectWidget3D?.(wid.id); onSelectWall(null); onSelectRoom(null); }}
              baseY={floorBaseYLocal}
              onDragEnd={(nx, ny, nz) => onUpdateWidget3D?.(wid.id, nx - offsetX, ny, nz)}
            />
          </group>
        );
      }
    }

    bldOffX += bldW + 3;
  }

  return (
    <>
      <GroundGrid size={allSize} transparent={floorTransparent} showGrid={showGrid} />

      <ambientLight intensity={lighting.ambientIntensity} color="#c8d8f0" />

      <directionalLight
        position={[sunX, 28, sunZ]}
        intensity={lighting.sunIntensity}
        color="#fff5e0"
        castShadow={lighting.shadowEnabled}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={200}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-bias={-0.0005}
        shadow-radius={lighting.shadowSoftness}
      />

      <directionalLight
        position={[-12, 10, -8]}
        intensity={lighting.fillIntensity}
        color="#a0c4ff"
      />

      <hemisphereLight args={['#b0d0ff', '#1a2a40', 0.5]} />

      {elements}

      {widgetPlacementMode && onPlaceWidget && (
        <WidgetPlacementHelper
          buildings={buildings}
          activeFloorId={activeFloorId}
          onPlace={onPlaceWidget}
        />
      )}
    </>
  );
}

export function BuildingCanvas3D({
  buildings, activeFloorId, selectedRoomId, selectedWallId,
  selectedWidget3DId, selectedDuctId, selectedPipeId, selectedFurnitureId,
  onSelectRoom, onSelectWall, onSelectWidget3D, onSelectDuct, onSelectPipe, onSelectFurniture, onUpdateWidget3D,
  onPlaceWidget, widgetPlacementMode,
  liveValues, alarmStates,
  highlightFloor, bgColor = '#0a1020',
  floorTransparent = false,
  bgTransparent = false,
  showGrid = true,
  lighting = DEFAULT_LIGHTING,
  explosion = DEFAULT_EXPLOSION,
  wallsTransparent = false,
  xrayOpacity = 0.2,
  onFloorClick,
}: Props) {
  const effectiveBgColor = bgTransparent ? '#000000' : bgColor;
  return (
    <div className="relative w-full h-full select-none" style={bgTransparent ? { background: 'transparent' } : undefined}>
      <Canvas
        shadows={lighting.shadowEnabled ? 'soft' : false}
        camera={{ position: [14, 18, 20], fov: 45, near: 0.1, far: 1000 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
          outputColorSpace: THREE.SRGBColorSpace,
          alpha: bgTransparent,
        }}
        onPointerMissed={() => { onSelectRoom(null); onSelectWall(null); onSelectWidget3D?.(null); onSelectDuct?.(null); onSelectPipe?.(null); onSelectFurniture?.(null); }}
        style={{ background: bgTransparent ? 'transparent' : bgColor }}
      >
        {!bgTransparent && <color attach="background" args={[bgColor]} />}
        {!bgTransparent && <fog attach="fog" args={[effectiveBgColor, 60, 200]} />}

        <Suspense fallback={null}>
          <BuildingScene
            buildings={buildings}
            activeFloorId={activeFloorId}
            selectedRoomId={selectedRoomId}
            selectedWallId={selectedWallId}
            selectedWidget3DId={selectedWidget3DId}
            selectedDuctId={selectedDuctId}
            selectedPipeId={selectedPipeId}
            selectedFurnitureId={selectedFurnitureId}
            onSelectRoom={onSelectRoom}
            onSelectWall={onSelectWall}
            onSelectWidget3D={onSelectWidget3D}
            onSelectDuct={onSelectDuct}
            onSelectPipe={onSelectPipe}
            onSelectFurniture={onSelectFurniture}
            onUpdateWidget3D={onUpdateWidget3D}
            onPlaceWidget={onPlaceWidget}
            widgetPlacementMode={widgetPlacementMode}
            liveValues={liveValues}
            alarmStates={alarmStates}
            highlightFloor={highlightFloor}
            lighting={lighting}
            floorTransparent={floorTransparent}
            showGrid={showGrid}
            wallsTransparent={wallsTransparent}
            xrayOpacity={xrayOpacity}
            explosion={explosion}
            onFloorClick={onFloorClick}
          />
          <Environment preset="city" />
        </Suspense>

        <CameraAutoFit buildings={buildings} />
        <CameraFocusFloor />
        <DynamicOrbitTarget />

        <OrbitControls
          makeDefault
          minPolarAngle={0.05}
          maxPolarAngle={Math.PI / 2 - 0.01}
          minDistance={1}
          maxDistance={200}
          enableDamping
          dampingFactor={0.08}
          panSpeed={0.8}
          rotateSpeed={0.6}
          zoomSpeed={1.0}
          zoomToCursor
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
        />
      </Canvas>

      <ViewButtons />

      <div className="absolute bottom-3 left-3 text-slate-600 text-[10px] bg-slate-900/60 px-2 py-1 rounded">
        Ziehen: Drehen · Rechtsklick: Verschieben · Scroll: Zoom
      </div>
    </div>
  );
}

function ViewButtons() {
  const presets = [
    { label: 'Vorne', pos: [0, 8, 30] as [number, number, number] },
    { label: 'Seite', pos: [30, 8, 0] as [number, number, number] },
    { label: 'Oben', pos: [0, 40, 0.1] as [number, number, number] },
    { label: '3D', pos: [14, 18, 20] as [number, number, number] },
  ];

  return (
    <div className="absolute top-2 right-2 flex gap-1.5 z-10">
      {presets.map(v => (
        <ViewButton key={v.label} label={v.label} targetPos={v.pos} />
      ))}
    </div>
  );
}

function ViewButton({ label, targetPos }: { label: string; targetPos: [number, number, number] }) {
  return (
    <button
      onClick={() => {
        const event = new CustomEvent('set-camera-pos', { detail: targetPos });
        window.dispatchEvent(event);
      }}
      className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 rounded text-[10px] font-medium transition-colors"
    >
      {label}
    </button>
  );
}

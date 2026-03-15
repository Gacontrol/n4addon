import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { Building } from '../../types/building';

interface Props {
  buildings: Building[];
  activeFloorId: string | null;
  selectedRoomId: string | null;
  selectedWallId: string | null;
  onSelectRoom: (id: string | null) => void;
  onSelectWall: (id: string | null) => void;
  highlightFloor: boolean;
  bgColor?: string;
}

function hexToThree(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

interface RoomMeshProps {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: string;
  name: string;
  selected: boolean;
  faded: boolean;
  onSelect: () => void;
}

function RoomMesh({ x, y, z, width, depth, height, color, selected, faded, onSelect }: RoomMeshProps) {
  const baseColor = hexToThree(color);

  const opacity = faded ? 0.12 : 1.0;
  const emissiveIntensity = selected ? 0.18 : 0.0;

  return (
    <group position={[x + width / 2, z + height / 2, y + depth / 2]}>
      <mesh
        ref={meshRef}
        castShadow
        receiveShadow
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={baseColor}
          roughness={0.72}
          metalness={0.04}
          emissive={selected ? baseColor : new THREE.Color(0x000000)}
          emissiveIntensity={emissiveIntensity}
          transparent={faded}
          opacity={opacity}
          depthWrite={!faded}
        />
      </mesh>
      {selected && (
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(width + 0.02, height + 0.02, depth + 0.02)]} />
          <lineBasicMaterial color="#60a5fa" linewidth={2} />
        </lineSegments>
      )}
    </group>
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
  selected: boolean;
  faded: boolean;
  materialType: string;
  onSelect: () => void;
}

function WallSegment({ x1, y1, x2, y2, baseY, height, thickness, color, selected, faded, materialType, onSelect }: WallSegmentProps) {
  const dx = x2 - x1;
  const dz = y2 - y1;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.01) return null;

  const cx = (x1 + x2) / 2;
  const cz = (y1 + y2) / 2;
  const angle = Math.atan2(dz, dx);

  const wallColor = hexToThree(color || '#94a3b8');
  const opacity = faded ? 0.12 : 1.0;

  let roughness = 0.85;
  let metalness = 0.0;
  if (materialType === 'glass') { roughness = 0.05; metalness = 0.1; }
  else if (materialType === 'concrete') { roughness = 0.95; metalness = 0.0; }
  else if (materialType === 'brick') { roughness = 0.9; metalness = 0.0; }
  else if (materialType === 'wood') { roughness = 0.8; metalness = 0.0; }

  const isGlass = materialType === 'glass';

  return (
    <group position={[cx, baseY + height / 2, cz]} rotation={[0, -angle, 0]}>
      <mesh
        castShadow
        receiveShadow
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        <boxGeometry args={[len, height, thickness]} />
        <meshStandardMaterial
          color={wallColor}
          roughness={roughness}
          metalness={metalness}
          transparent={faded || isGlass}
          opacity={isGlass ? 0.25 : opacity}
          depthWrite={!faded && !isGlass}
          envMapIntensity={isGlass ? 1.5 : 0.3}
        />
      </mesh>
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
}

function FloorPlane({ minX, maxX, minZ, maxZ, baseY, color, active, faded }: FloorPlaneProps) {
  const w = maxX - minX;
  const d = maxZ - minZ;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const floorColor = hexToThree(color || '#1e3a5f');
  const opacity = faded ? 0.08 : (active ? 0.92 : 0.45);

  return (
    <mesh
      position={[cx, baseY, cz]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial
        color={floorColor}
        roughness={0.88}
        metalness={0.02}
        transparent
        opacity={opacity}
        depthWrite={opacity > 0.5}
      />
    </mesh>
  );
}

interface GroundGridProps {
  size: number;
}

function GroundGrid({ size }: GroundGridProps) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[size * 2, size * 2]} />
        <meshStandardMaterial color="#0d1929" roughness={1} metalness={0} />
      </mesh>
      <gridHelper args={[size * 2, size * 4, '#1e3a5f', '#132035']} position={[0, 0, 0]} />
    </group>
  );
}

interface BuildingSceneProps {
  buildings: Building[];
  activeFloorId: string | null;
  selectedRoomId: string | null;
  selectedWallId: string | null;
  onSelectRoom: (id: string | null) => void;
  onSelectWall: (id: string | null) => void;
  highlightFloor: boolean;
}

function BuildingScene({ buildings, activeFloorId, selectedRoomId, selectedWallId, onSelectRoom, onSelectWall, highlightFloor }: BuildingSceneProps) {
  const elements: JSX.Element[] = [];
  let allSize = 20;

  let bldOffX = 0;
  for (const building of buildings) {
    const sorted = [...building.floors].sort((a, b) => a.level - b.level);

    const allX: number[] = [];
    const allZ: number[] = [];
    for (const fl of building.floors) {
      for (const w of fl.walls) { allX.push(w.x1, w.x2); allZ.push(w.y1, w.y2); }
      for (const r of fl.rooms) { allX.push(r.x, r.x + r.width); allZ.push(r.y, r.y + r.depth); }
    }
    const minX = allX.length ? Math.min(...allX) : 0;
    const maxX = allX.length ? Math.max(...allX) : 10;
    const minZ = allZ.length ? Math.min(...allZ) : 0;
    const maxZ = allZ.length ? Math.max(...allZ) : 10;
    const bldW = maxX - minX + 2;

    allSize = Math.max(allSize, Math.max(bldW, maxZ - minZ) * 2 + 20);

    const floorBaseY: Record<string, number> = {};
    let yAcc = 0;
    for (const fl of sorted) { floorBaseY[fl.id] = yAcc; yAcc += fl.height; }

    for (const floor of sorted) {
      const baseY = floorBaseY[floor.id];
      const isActive = floor.id === activeFloorId;
      const faded = highlightFloor && !isActive;

      elements.push(
        <FloorPlane
          key={`floor-${floor.id}`}
          minX={minX + bldOffX - 0.3}
          maxX={maxX + bldOffX + 0.3}
          minZ={minZ - 0.3}
          maxZ={maxZ + 0.3}
          baseY={baseY}
          color={floor.floorColor || '#1e3a5f'}
          active={isActive}
          faded={faded}
        />
      );

      for (const room of floor.rooms) {
        elements.push(
          <RoomMesh
            key={`room-${room.id}`}
            x={room.x + bldOffX}
            y={room.y}
            z={baseY}
            width={room.width}
            depth={room.depth}
            height={floor.height}
            color={room.color}
            name={room.name}
            selected={room.id === selectedRoomId}
            faded={faded}
            onSelect={() => { onSelectRoom(room.id); onSelectWall(null); }}
          />
        );
      }

      for (const wall of floor.walls) {
        elements.push(
          <WallSegment
            key={`wall-${wall.id}`}
            x1={wall.x1 + bldOffX}
            y1={wall.y1}
            x2={wall.x2 + bldOffX}
            y2={wall.y2}
            baseY={baseY}
            height={wall.height > 0 ? wall.height : floor.height}
            thickness={wall.thickness || 0.25}
            color={wall.color || '#94a3b8'}
            selected={wall.id === selectedWallId}
            faded={faded}
            materialType={wall.materialType || 'concrete'}
            onSelect={() => { onSelectWall(wall.id); onSelectRoom(null); }}
          />
        );
      }
    }

    bldOffX += bldW + 3;
  }

  return (
    <>
      <GroundGrid size={allSize} />

      <ambientLight intensity={0.35} color="#c8d8f0" />

      <directionalLight
        position={[18, 28, 12]}
        intensity={1.8}
        color="#fff5e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={200}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-bias={-0.0005}
        shadow-radius={3}
      />

      <directionalLight
        position={[-12, 10, -8]}
        intensity={0.45}
        color="#a0c4ff"
      />

      <hemisphereLight args={['#b0d0ff', '#1a2a40', 0.6]} />

      <ContactShadows
        position={[0, -0.005, 0]}
        opacity={0.55}
        scale={allSize}
        blur={2.5}
        far={20}
        color="#000820"
      />

      {elements}
    </>
  );
}

export function BuildingCanvas3D({
  buildings, activeFloorId, selectedRoomId, selectedWallId,
  onSelectRoom, onSelectWall, highlightFloor, bgColor = '#0a1020',
}: Props) {
  return (
    <div className="relative w-full h-full select-none">
      <Canvas
        shadows="soft"
        camera={{ position: [14, 18, 20], fov: 45, near: 0.1, far: 1000 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        onPointerMissed={() => { onSelectRoom(null); onSelectWall(null); }}
        style={{ background: bgColor }}
      >
        <color attach="background" args={[bgColor]} />
        <fog attach="fog" args={[bgColor, 60, 200]} />

        <Suspense fallback={null}>
          <BuildingScene
            buildings={buildings}
            activeFloorId={activeFloorId}
            selectedRoomId={selectedRoomId}
            selectedWallId={selectedWallId}
            onSelectRoom={onSelectRoom}
            onSelectWall={onSelectWall}
            highlightFloor={highlightFloor}
          />
          <Environment preset="city" />
        </Suspense>

        <OrbitControls
          makeDefault
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI / 2 - 0.02}
          minDistance={2}
          maxDistance={120}
          enableDamping
          dampingFactor={0.08}
          panSpeed={0.8}
          rotateSpeed={0.6}
          zoomSpeed={1.0}
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

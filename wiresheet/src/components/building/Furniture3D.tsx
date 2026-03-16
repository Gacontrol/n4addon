import * as THREE from 'three';
import { FurnitureItem } from '../../types/building';

interface FurnitureMeshProps {
  item: FurnitureItem;
  offsetX: number;
  baseY: number;
  selected: boolean;
  faded: boolean;
  onSelect: () => void;
}

function hexToThree(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

function DeskMesh({ item, offsetX, baseY, selected, faded, onSelect }: FurnitureMeshProps) {
  const x = item.x + offsetX + item.width / 2;
  const z = item.y + item.depth / 2;
  const y = baseY + item.height / 2;
  const angle = (item.rotation * Math.PI) / 180;
  const color = hexToThree(item.color);
  const opacity = faded ? 0.12 : 0.9;

  return (
    <group position={[x, y, z]} rotation={[0, -angle, 0]}>
      <mesh
        castShadow
        receiveShadow
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        <boxGeometry args={[item.width, item.height, item.depth]} />
        <meshStandardMaterial
          color={selected ? '#60a5fa' : color}
          roughness={0.6}
          metalness={0.1}
          transparent={faded || opacity < 1}
          opacity={opacity}
        />
      </mesh>
      {selected && (
        <mesh>
          <boxGeometry args={[item.width + 0.06, item.height + 0.06, item.depth + 0.06]} />
          <meshStandardMaterial color="#60a5fa" transparent opacity={0.25} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function LShapeMesh({ item, offsetX, baseY, selected, faded, onSelect }: FurnitureMeshProps) {
  const bx = item.x + offsetX;
  const bz = item.y;
  const y = baseY + item.height / 2;
  const angle = (item.rotation * Math.PI) / 180;
  const color = hexToThree(item.color);
  const opacity = faded ? 0.12 : 0.9;

  const w1 = item.width;
  const d1 = item.depth * 0.5;
  const w2 = item.width * 0.5;
  const d2 = item.depth;

  return (
    <group position={[bx + item.width / 2, 0, bz + item.depth / 2]} rotation={[0, -angle, 0]}>
      <mesh
        position={[0, y - baseY, -item.depth / 2 + d1 / 2]}
        castShadow
        receiveShadow
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        <boxGeometry args={[w1, item.height, d1]} />
        <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.6} metalness={0.1} transparent={faded} opacity={opacity} />
      </mesh>
      <mesh
        position={[item.width / 2 - w2 / 2, y - baseY, item.depth / 2 - d2 / 2 + d1 / 2]}
        castShadow
        receiveShadow
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        <boxGeometry args={[w2, item.height, d2 - d1]} />
        <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.6} metalness={0.1} transparent={faded} opacity={opacity} />
      </mesh>
    </group>
  );
}

function CircleMesh({ item, offsetX, baseY, selected, faded, onSelect }: FurnitureMeshProps) {
  const x = item.x + offsetX + item.width / 2;
  const z = item.y + item.depth / 2;
  const y = baseY + item.height / 2;
  const r = Math.min(item.width, item.depth) / 2;
  const color = hexToThree(item.color);
  const opacity = faded ? 0.12 : 0.9;

  return (
    <group position={[x, y, z]}>
      <mesh
        castShadow
        receiveShadow
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        <cylinderGeometry args={[r, r, item.height, 16]} />
        <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.5} metalness={0.05} transparent={faded} opacity={opacity} />
      </mesh>
      {selected && (
        <mesh>
          <cylinderGeometry args={[r + 0.04, r + 0.04, item.height + 0.06, 16]} />
          <meshStandardMaterial color="#60a5fa" transparent opacity={0.25} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function HVACMesh({ item, offsetX, baseY, selected, faded, onSelect }: FurnitureMeshProps) {
  const x = item.x + offsetX + item.width / 2;
  const z = item.y + item.depth / 2;
  const y = baseY + item.height / 2;
  const angle = (item.rotation * Math.PI) / 180;
  const color = hexToThree(item.color);
  const opacity = faded ? 0.12 : 0.92;

  return (
    <group position={[x, y, z]} rotation={[0, -angle, 0]}>
      <mesh castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <boxGeometry args={[item.width, item.height, item.depth]} />
        <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.4} metalness={0.6} transparent={faded} opacity={opacity} />
      </mesh>
      <mesh position={[0, item.height / 2 + 0.02, 0]} receiveShadow>
        <boxGeometry args={[item.width - 0.1, 0.04, item.depth - 0.1]} />
        <meshStandardMaterial color="#374151" roughness={0.3} metalness={0.8} />
      </mesh>
      {selected && (
        <mesh>
          <boxGeometry args={[item.width + 0.06, item.height + 0.06, item.depth + 0.06]} />
          <meshStandardMaterial color="#60a5fa" transparent opacity={0.25} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function VehicleMesh({ item, offsetX, baseY, selected, faded, onSelect }: FurnitureMeshProps) {
  const x = item.x + offsetX + item.width / 2;
  const z = item.y + item.depth / 2;
  const y = baseY + item.height / 2;
  const angle = (item.rotation * Math.PI) / 180;
  const color = hexToThree(item.color);
  const opacity = faded ? 0.12 : 0.92;
  const isGarageDoor = item.templateId.startsWith('garage-door');

  if (isGarageDoor) {
    return (
      <group position={[x, baseY + item.height / 2, z]} rotation={[0, -angle, 0]}>
        <mesh castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <boxGeometry args={[item.width, item.height, item.depth]} />
          <meshStandardMaterial color="#9ca3af" roughness={0.3} metalness={0.7} transparent={faded} opacity={opacity} />
        </mesh>
        {[...Array(Math.floor(item.height / 0.5))].map((_, i) => (
          <mesh key={i} position={[0, -item.height / 2 + 0.25 + i * 0.5, 0.01]}>
            <boxGeometry args={[item.width - 0.05, 0.02, 0.01]} />
            <meshStandardMaterial color="#6b7280" roughness={0.5} metalness={0.5} />
          </mesh>
        ))}
      </group>
    );
  }

  const bodyH = item.height * 0.55;
  const cabinH = item.height * 0.45;
  const cabinW = item.width * 0.65;

  return (
    <group position={[x, y, z]} rotation={[0, -angle, 0]}>
      <mesh position={[0, -item.height / 2 + bodyH / 2, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <boxGeometry args={[item.width, bodyH, item.depth]} />
        <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.5} metalness={0.3} transparent={faded} opacity={opacity} />
      </mesh>
      <mesh position={[item.width * 0.05, -item.height / 2 + bodyH + cabinH / 2, 0]} castShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <boxGeometry args={[cabinW, cabinH, item.depth * 0.85]} />
        <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.5} metalness={0.3} transparent={faded} opacity={opacity} />
      </mesh>
      <mesh position={[item.width * 0.05, -item.height / 2 + bodyH + cabinH / 2, 0]}>
        <boxGeometry args={[cabinW - 0.1, cabinH - 0.1, item.depth * 0.85 - 0.1]} />
        <meshStandardMaterial color="#93c5fd" roughness={0.05} metalness={0.1} transparent opacity={0.5} />
      </mesh>
      {selected && (
        <mesh>
          <boxGeometry args={[item.width + 0.1, item.height + 0.1, item.depth + 0.1]} />
          <meshStandardMaterial color="#60a5fa" transparent opacity={0.2} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

export function FurnitureMesh({ item, offsetX, baseY, selected, faded, onSelect }: FurnitureMeshProps) {
  if (item.shape === 'circle') {
    return <CircleMesh item={item} offsetX={offsetX} baseY={baseY} selected={selected} faded={faded} onSelect={onSelect} />;
  }
  if (item.shape === 'l-shape') {
    return <LShapeMesh item={item} offsetX={offsetX} baseY={baseY} selected={selected} faded={faded} onSelect={onSelect} />;
  }
  if (item.category === 'hvac') {
    return <HVACMesh item={item} offsetX={offsetX} baseY={baseY} selected={selected} faded={faded} onSelect={onSelect} />;
  }
  if (item.category === 'vehicle') {
    return <VehicleMesh item={item} offsetX={offsetX} baseY={baseY} selected={selected} faded={faded} onSelect={onSelect} />;
  }
  return <DeskMesh item={item} offsetX={offsetX} baseY={baseY} selected={selected} faded={faded} onSelect={onSelect} />;
}

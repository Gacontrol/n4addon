import { memo } from 'react';
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

function SelectionBox({ w, h, d }: { w: number; h: number; d: number }) {
  return (
    <mesh>
      <boxGeometry args={[w + 0.08, h + 0.08, d + 0.08]} />
      <meshStandardMaterial color="#60a5fa" transparent opacity={0.18} depthWrite={false} />
    </mesh>
  );
}

// ---- Generic desk / furniture box ----
function DeskMesh({ item, offsetX, baseY, selected, faded, onSelect }: FurnitureMeshProps) {
  const x = item.x + offsetX + item.width / 2;
  const z = item.y + item.depth / 2;
  const y = baseY + item.height / 2;
  const angle = (item.rotation * Math.PI) / 180;
  const color = hexToThree(item.color);
  const opacity = faded ? 0.12 : 0.92;

  const isSofa = item.templateId.startsWith('sofa');
  const isChair = item.templateId === 'chair-office' || item.templateId === 'waiting-chair';

  if (isChair) {
    const r = Math.min(item.width, item.depth) / 2 * 0.85;
    const seatH = item.height * 0.45;
    const backH = item.height * 0.55;
    return (
      <group position={[x, baseY, z]} rotation={[0, -angle, 0]}>
        {/* seat */}
        <mesh position={[0, seatH / 2, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <cylinderGeometry args={[r, r * 0.9, seatH, 12]} />
          <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.7} metalness={0.05} transparent={faded} opacity={opacity} />
        </mesh>
        {/* backrest */}
        <mesh position={[0, seatH + backH * 0.5, -r * 0.7]} castShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <boxGeometry args={[r * 1.6, backH, r * 0.18]} />
          <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.7} metalness={0.05} transparent={faded} opacity={opacity} />
        </mesh>
        {/* leg */}
        <mesh position={[0, item.height * 0.06, 0]}>
          <cylinderGeometry args={[0.03, 0.05, item.height * 0.12, 5]} />
          <meshStandardMaterial color="#6b7280" roughness={0.3} metalness={0.7} />
        </mesh>
        {selected && <SelectionBox w={item.width} h={item.height} d={item.depth} />}
      </group>
    );
  }

  if (isSofa) {
    const legH = 0.08;
    const seatH = item.height * 0.4;
    const backH = item.height * 0.55;
    const armW = item.depth * 0.18;
    return (
      <group position={[x, baseY, z]} rotation={[0, -angle, 0]}>
        {/* seat cushion */}
        <mesh position={[0, legH + seatH / 2, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <boxGeometry args={[item.width - armW * 2, seatH, item.depth * 0.6]} />
          <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.9} metalness={0.0} transparent={faded} opacity={opacity} />
        </mesh>
        {/* backrest */}
        <mesh position={[0, legH + seatH + backH / 2, -item.depth * 0.18]} castShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <boxGeometry args={[item.width - armW * 2, backH, item.depth * 0.2]} />
          <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.9} metalness={0.0} transparent={faded} opacity={opacity} />
        </mesh>
        {/* left arm */}
        <mesh position={[-(item.width / 2 - armW / 2), legH + seatH * 0.6, 0]} castShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <boxGeometry args={[armW, seatH * 1.2, item.depth * 0.7]} />
          <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.9} metalness={0.0} transparent={faded} opacity={opacity} />
        </mesh>
        {/* right arm */}
        <mesh position={[(item.width / 2 - armW / 2), legH + seatH * 0.6, 0]} castShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <boxGeometry args={[armW, seatH * 1.2, item.depth * 0.7]} />
          <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.9} metalness={0.0} transparent={faded} opacity={opacity} />
        </mesh>
        {/* 4 legs */}
        {[[-item.width / 2 + 0.1, -item.depth * 0.28], [item.width / 2 - 0.1, -item.depth * 0.28],
          [-item.width / 2 + 0.1, item.depth * 0.28], [item.width / 2 - 0.1, item.depth * 0.28]].map(([lx, lz], i) => (
          <mesh key={i} position={[lx, legH / 2, lz]}>
            <boxGeometry args={[0.05, legH, 0.05]} />
            <meshStandardMaterial color="#92400e" roughness={0.4} metalness={0.1} />
          </mesh>
        ))}
        {selected && <SelectionBox w={item.width} h={item.height} d={item.depth} />}
      </group>
    );
  }

  // Default box furniture (desk, shelf, cabinet, etc.)
  const legH = item.height > 1.5 ? 0 : 0.06;
  const topThick = 0.04;
  return (
    <group position={[x, baseY, z]} rotation={[0, -angle, 0]}>
      {/* main body */}
      <mesh position={[0, legH + (item.height - legH) / 2, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <boxGeometry args={[item.width, item.height - legH, item.depth]} />
        <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.55} metalness={0.08} transparent={faded} opacity={opacity} />
      </mesh>
      {/* top surface highlight */}
      <mesh position={[0, legH + item.height - legH - topThick / 2, 0]}>
        <boxGeometry args={[item.width - 0.02, topThick, item.depth - 0.02]} />
        <meshStandardMaterial color={selected ? '#93c5fd' : new THREE.Color(item.color).multiplyScalar(1.35)} roughness={0.35} metalness={0.1} transparent={faded} opacity={opacity} />
      </mesh>
      {/* legs (only for low furniture) */}
      {legH > 0 && (
        [[-item.width / 2 + 0.05, -item.depth / 2 + 0.05], [item.width / 2 - 0.05, -item.depth / 2 + 0.05],
         [-item.width / 2 + 0.05, item.depth / 2 - 0.05], [item.width / 2 - 0.05, item.depth / 2 - 0.05]].map(([lx, lz], i) => (
          <mesh key={i} position={[lx, legH / 2, lz]}>
            <boxGeometry args={[0.04, legH, 0.04]} />
            <meshStandardMaterial color="#9ca3af" roughness={0.4} metalness={0.5} />
          </mesh>
        ))
      )}
      {selected && <SelectionBox w={item.width} h={item.height} d={item.depth} />}
    </group>
  );
}

// ---- L-shape ----
function LShapeMesh({ item, offsetX, baseY, selected, faded, onSelect }: FurnitureMeshProps) {
  const bx = item.x + offsetX;
  const bz = item.y;
  const angle = (item.rotation * Math.PI) / 180;
  const color = hexToThree(item.color);
  const opacity = faded ? 0.12 : 0.92;

  const w1 = item.width;
  const d1 = item.depth * 0.5;
  const w2 = item.width * 0.5;
  const d2 = item.depth;
  const h = item.height;
  const topT = 0.04;

  return (
    <group position={[bx + item.width / 2, baseY, bz + item.depth / 2]} rotation={[0, -angle, 0]}>
      {/* horizontal wing */}
      <mesh position={[0, h / 2, -item.depth / 2 + d1 / 2]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <boxGeometry args={[w1, h, d1]} />
        <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.55} metalness={0.08} transparent={faded} opacity={opacity} />
      </mesh>
      <mesh position={[0, h - topT / 2, -item.depth / 2 + d1 / 2]}>
        <boxGeometry args={[w1 - 0.02, topT, d1 - 0.02]} />
        <meshStandardMaterial color={selected ? '#93c5fd' : new THREE.Color(item.color).multiplyScalar(1.35)} roughness={0.35} metalness={0.1} transparent={faded} opacity={opacity} />
      </mesh>
      {/* vertical wing */}
      <mesh position={[item.width / 2 - w2 / 2, h / 2, item.depth / 2 - (d2 - d1) / 2 - d1 / 2 + d1 / 2]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <boxGeometry args={[w2, h, d2 - d1]} />
        <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.55} metalness={0.08} transparent={faded} opacity={opacity} />
      </mesh>
      <mesh position={[item.width / 2 - w2 / 2, h - topT / 2, item.depth / 2 - (d2 - d1) / 2 - d1 / 2 + d1 / 2]}>
        <boxGeometry args={[w2 - 0.02, topT, d2 - d1 - 0.02]} />
        <meshStandardMaterial color={selected ? '#93c5fd' : new THREE.Color(item.color).multiplyScalar(1.35)} roughness={0.35} metalness={0.1} transparent={faded} opacity={opacity} />
      </mesh>
    </group>
  );
}

// ---- Circle (chair base) ----
function CircleMesh({ item, offsetX, baseY, selected, faded, onSelect }: FurnitureMeshProps) {
  const x = item.x + offsetX + item.width / 2;
  const z = item.y + item.depth / 2;
  const r = Math.min(item.width, item.depth) / 2;
  const color = hexToThree(item.color);
  const opacity = faded ? 0.12 : 0.92;

  return (
    <group position={[x, baseY, z]}>
      <mesh position={[0, item.height / 2, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <cylinderGeometry args={[r, r * 0.92, item.height, 16]} />
        <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.5} metalness={0.05} transparent={faded} opacity={opacity} />
      </mesh>
      {selected && <SelectionBox w={item.width} h={item.height} d={item.depth} />}
    </group>
  );
}

// ---- HVAC / Technical equipment ----
function HVACMesh({ item, offsetX, baseY, selected, faded, onSelect }: FurnitureMeshProps) {
  const x = item.x + offsetX + item.width / 2;
  const z = item.y + item.depth / 2;
  const angle = (item.rotation * Math.PI) / 180;
  const color = hexToThree(item.color);
  const opacity = faded ? 0.12 : 0.95;

  const isElectrical = item.templateId === 'electrical-panel' || item.templateId === 'ups';
  const isBoiler = item.templateId === 'boiler';
  const isPump = item.templateId === 'pump-station';

  if (isBoiler) {
    const r = Math.min(item.width, item.depth) / 2 * 0.85;
    return (
      <group position={[x, baseY, z]} rotation={[0, -angle, 0]}>
        <mesh position={[0, item.height * 0.45, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <cylinderGeometry args={[r, r, item.height * 0.9, 14]} />
          <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.35} metalness={0.65} transparent={faded} opacity={opacity} />
        </mesh>
        {/* dome top */}
        <mesh position={[0, item.height * 0.9, 0]}>
          <sphereGeometry args={[r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.35} metalness={0.65} transparent={faded} opacity={opacity} />
        </mesh>
        {/* exhaust pipe */}
        <mesh position={[0, item.height * 0.95 + 0.15, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.3, 8]} />
          <meshStandardMaterial color="#374151" roughness={0.4} metalness={0.7} />
        </mesh>
        {selected && <SelectionBox w={item.width} h={item.height} d={item.depth} />}
      </group>
    );
  }

  if (isPump) {
    return (
      <group position={[x, baseY, z]} rotation={[0, -angle, 0]}>
        {/* base frame */}
        <mesh position={[0, item.height * 0.35, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <boxGeometry args={[item.width, item.height * 0.7, item.depth]} />
          <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.4} metalness={0.55} transparent={faded} opacity={opacity} />
        </mesh>
        {/* pump cylinders */}
        {[-item.width * 0.25, item.width * 0.25].map((px, i) => (
          <mesh key={i} position={[px, item.height * 0.7 + 0.12, 0]}>
            <cylinderGeometry args={[item.depth * 0.22, item.depth * 0.22, 0.24, 10]} />
            <meshStandardMaterial color="#2563eb" roughness={0.3} metalness={0.7} transparent={faded} opacity={opacity} />
          </mesh>
        ))}
        {selected && <SelectionBox w={item.width} h={item.height} d={item.depth} />}
      </group>
    );
  }

  if (isElectrical) {
    return (
      <group position={[x, baseY, z]} rotation={[0, -angle, 0]}>
        <mesh position={[0, item.height / 2, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <boxGeometry args={[item.width, item.height, item.depth]} />
          <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.3} metalness={0.65} transparent={faded} opacity={opacity} />
        </mesh>
        {/* door panel */}
        <mesh position={[0, item.height / 2, item.depth / 2 + 0.005]}>
          <boxGeometry args={[item.width * 0.85, item.height * 0.9, 0.01]} />
          <meshStandardMaterial color={new THREE.Color(item.color).multiplyScalar(1.4)} roughness={0.2} metalness={0.5} transparent={faded} opacity={opacity} />
        </mesh>
        {/* handle */}
        <mesh position={[item.width * 0.3, item.height / 2, item.depth / 2 + 0.02]}>
          <boxGeometry args={[0.02, 0.08, 0.02]} />
          <meshStandardMaterial color="#9ca3af" roughness={0.2} metalness={0.8} />
        </mesh>
        {selected && <SelectionBox w={item.width} h={item.height} d={item.depth} />}
      </group>
    );
  }

  // Default HVAC box with top panel detail
  return (
    <group position={[x, baseY, z]} rotation={[0, -angle, 0]}>
      <mesh position={[0, item.height / 2, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <boxGeometry args={[item.width, item.height, item.depth]} />
        <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.4} metalness={0.6} transparent={faded} opacity={opacity} />
      </mesh>
      {/* top grille panel */}
      <mesh position={[0, item.height + 0.015, 0]}>
        <boxGeometry args={[item.width - 0.08, 0.03, item.depth - 0.08]} />
        <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.8} />
      </mesh>
      {/* front vent strips */}
      {[0.3, 0.5, 0.7].map((t, i) => (
        <mesh key={i} position={[0, item.height * t, item.depth / 2 + 0.005]}>
          <boxGeometry args={[item.width * 0.7, 0.02, 0.01]} />
          <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
      {selected && <SelectionBox w={item.width} h={item.height} d={item.depth} />}
    </group>
  );
}

// ---- Vehicles ----
function VehicleMesh({ item, offsetX, baseY, selected, faded, onSelect }: FurnitureMeshProps) {
  const x = item.x + offsetX + item.width / 2;
  const z = item.y + item.depth / 2;
  const angle = (item.rotation * Math.PI) / 180;
  const color = hexToThree(item.color);
  const opacity = faded ? 0.12 : 0.95;
  const isGarageDoor = item.templateId.startsWith('garage-door');
  const isForklift = item.templateId === 'forklift';
  const isTruck = item.templateId === 'truck' || item.templateId === 'van';

  if (isGarageDoor) {
    return (
      <group position={[x, baseY, z]} rotation={[0, -angle, 0]}>
        <mesh position={[0, item.height / 2, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <boxGeometry args={[item.width, item.height, item.depth]} />
          <meshStandardMaterial color="#9ca3af" roughness={0.25} metalness={0.75} transparent={faded} opacity={opacity} />
        </mesh>
        {[...Array(Math.max(1, Math.floor(item.height / 0.45)))].map((_, i) => (
          <mesh key={i} position={[0, 0.22 + i * 0.45, item.depth / 2 + 0.006]}>
            <boxGeometry args={[item.width - 0.04, 0.016, 0.01]} />
            <meshStandardMaterial color="#6b7280" roughness={0.4} metalness={0.6} />
          </mesh>
        ))}
        {/* horizontal center line */}
        <mesh position={[0, item.height / 2, item.depth / 2 + 0.007]}>
          <boxGeometry args={[item.width - 0.06, 0.008, 0.01]} />
          <meshStandardMaterial color="#4b5563" roughness={0.3} metalness={0.7} />
        </mesh>
        {selected && <SelectionBox w={item.width} h={item.height} d={item.depth} />}
      </group>
    );
  }

  if (isForklift) {
    const bodyW = item.width * 0.7;
    const bodyH = item.height * 0.55;
    const mast = item.height;
    return (
      <group position={[x, baseY, z]} rotation={[0, -angle, 0]}>
        {/* body */}
        <mesh position={[0, bodyH / 2, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <boxGeometry args={[bodyW, bodyH, item.depth]} />
          <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.4} metalness={0.3} transparent={faded} opacity={opacity} />
        </mesh>
        {/* cab */}
        <mesh position={[bodyW * 0.1, bodyH + item.height * 0.22, 0]} castShadow>
          <boxGeometry args={[bodyW * 0.55, item.height * 0.44, item.depth * 0.75]} />
          <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.5} metalness={0.2} transparent={faded} opacity={opacity} />
        </mesh>
        {/* mast */}
        <mesh position={[-bodyW * 0.35, mast / 2, 0]}>
          <boxGeometry args={[0.1, mast, 0.08]} />
          <meshStandardMaterial color="#374151" roughness={0.5} metalness={0.6} />
        </mesh>
        {/* forks */}
        {[-item.depth * 0.2, item.depth * 0.2].map((fz, i) => (
          <mesh key={i} position={[-bodyW * 0.35 - 0.3, bodyH * 0.15, fz]}>
            <boxGeometry args={[0.6, 0.05, 0.06]} />
            <meshStandardMaterial color="#6b7280" roughness={0.4} metalness={0.6} />
          </mesh>
        ))}
        {/* wheels */}
        {[[-bodyW * 0.3, -item.depth * 0.36], [-bodyW * 0.3, item.depth * 0.36],
          [bodyW * 0.32, -item.depth * 0.36], [bodyW * 0.32, item.depth * 0.36]].map(([wx, wz], i) => (
          <mesh key={i} position={[wx, 0.12, wz]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.12, 0.12, 0.15, 10]} />
            <meshStandardMaterial color="#1f2937" roughness={0.9} metalness={0.1} />
          </mesh>
        ))}
        {selected && <SelectionBox w={item.width} h={item.height} d={item.depth} />}
      </group>
    );
  }

  if (isTruck) {
    const cabW = item.width * (item.templateId === 'van' ? 1.0 : 0.28);
    const cabH = item.height;
    const cargoW = item.templateId === 'van' ? 0 : item.width * 0.72;
    const cargoH = item.height * 0.9;
    const wheelR = 0.18;
    const wheelThick = 0.22;
    return (
      <group position={[x, baseY, z]} rotation={[0, -angle, 0]}>
        {/* cargo box */}
        {cargoW > 0 && (
          <mesh position={[item.width / 2 - cargoW / 2, cargoH / 2, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
            <boxGeometry args={[cargoW, cargoH, item.depth * 0.95]} />
            <meshStandardMaterial color={selected ? '#60a5fa' : new THREE.Color(item.color).multiplyScalar(1.1)} roughness={0.5} metalness={0.2} transparent={faded} opacity={opacity} />
          </mesh>
        )}
        {/* cab */}
        <mesh position={[-item.width / 2 + cabW / 2, cabH * 0.5, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <boxGeometry args={[cabW, cabH, item.depth * 0.92]} />
          <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.45} metalness={0.3} transparent={faded} opacity={opacity} />
        </mesh>
        {/* windscreen */}
        <mesh position={[-item.width / 2 + cabW * 0.65, cabH * 0.68, 0]}>
          <boxGeometry args={[cabW * 0.12, cabH * 0.32, item.depth * 0.7]} />
          <meshStandardMaterial color="#7dd3fc" roughness={0.05} metalness={0.1} transparent opacity={0.55} />
        </mesh>
        {/* wheels */}
        {(item.templateId === 'van'
          ? [[-item.width * 0.35, -item.depth * 0.42], [-item.width * 0.35, item.depth * 0.42],
             [item.width * 0.35, -item.depth * 0.42], [item.width * 0.35, item.depth * 0.42]]
          : [[-item.width * 0.38, -item.depth * 0.42], [-item.width * 0.38, item.depth * 0.42],
             [item.width * 0.18, -item.depth * 0.42], [item.width * 0.18, item.depth * 0.42],
             [item.width * 0.38, -item.depth * 0.42], [item.width * 0.38, item.depth * 0.42]]
        ).map(([wx, wz], i) => (
          <mesh key={i} position={[wx, wheelR, wz]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[wheelR, wheelR, wheelThick, 12]} />
            <meshStandardMaterial color="#111827" roughness={0.9} metalness={0.1} />
          </mesh>
        ))}
        {selected && <SelectionBox w={item.width} h={item.height} d={item.depth} />}
      </group>
    );
  }

  // Car (small / medium / SUV)
  const wheelR = 0.28;
  const wheelThick = 0.2;
  const bodyH = item.height * 0.48;
  const roofH = item.height * 0.52;
  const roofW = item.width * 0.72;
  const roofD = item.depth * 0.78;
  // roof shifted slightly toward rear
  const roofShift = item.width * 0.03;
  const bodyColor = selected ? new THREE.Color('#60a5fa') : color;
  const roofColor = selected ? new THREE.Color('#93c5fd') : new THREE.Color(item.color).multiplyScalar(0.85);

  return (
    <group position={[x, baseY, z]} rotation={[0, -angle, 0]}>
      {/* lower body */}
      <mesh position={[0, wheelR + bodyH / 2, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <boxGeometry args={[item.width, bodyH, item.depth]} />
        <meshStandardMaterial color={bodyColor} roughness={0.35} metalness={0.45} transparent={faded} opacity={opacity} />
      </mesh>
      {/* upper cabin */}
      <mesh position={[roofShift, wheelR + bodyH + roofH / 2, 0]} castShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <boxGeometry args={[roofW, roofH, roofD]} />
        <meshStandardMaterial color={roofColor} roughness={0.35} metalness={0.45} transparent={faded} opacity={opacity} />
      </mesh>
      {/* windscreen front */}
      <mesh position={[roofShift + roofW * 0.48, wheelR + bodyH + roofH * 0.45, 0]}>
        <boxGeometry args={[0.04, roofH * 0.65, roofD * 0.78]} />
        <meshStandardMaterial color="#7dd3fc" roughness={0.05} metalness={0.05} transparent opacity={0.52} />
      </mesh>
      {/* rear window */}
      <mesh position={[roofShift - roofW * 0.48, wheelR + bodyH + roofH * 0.45, 0]}>
        <boxGeometry args={[0.04, roofH * 0.58, roofD * 0.72]} />
        <meshStandardMaterial color="#7dd3fc" roughness={0.05} metalness={0.05} transparent opacity={0.45} />
      </mesh>
      {/* side windows L */}
      <mesh position={[roofShift, wheelR + bodyH + roofH * 0.42, -roofD * 0.51]}>
        <boxGeometry args={[roofW * 0.72, roofH * 0.6, 0.03]} />
        <meshStandardMaterial color="#7dd3fc" roughness={0.05} metalness={0.05} transparent opacity={0.48} />
      </mesh>
      {/* side windows R */}
      <mesh position={[roofShift, wheelR + bodyH + roofH * 0.42, roofD * 0.51]}>
        <boxGeometry args={[roofW * 0.72, roofH * 0.6, 0.03]} />
        <meshStandardMaterial color="#7dd3fc" roughness={0.05} metalness={0.05} transparent opacity={0.48} />
      </mesh>
      {/* headlights */}
      <mesh position={[item.width / 2 - 0.04, wheelR + bodyH * 0.65, -item.depth * 0.32]}>
        <boxGeometry args={[0.06, bodyH * 0.18, item.depth * 0.12]} />
        <meshStandardMaterial color="#fef3c7" emissive="#fde68a" emissiveIntensity={0.4} roughness={0.2} metalness={0.3} transparent={faded} opacity={opacity} />
      </mesh>
      <mesh position={[item.width / 2 - 0.04, wheelR + bodyH * 0.65, item.depth * 0.32]}>
        <boxGeometry args={[0.06, bodyH * 0.18, item.depth * 0.12]} />
        <meshStandardMaterial color="#fef3c7" emissive="#fde68a" emissiveIntensity={0.4} roughness={0.2} metalness={0.3} transparent={faded} opacity={opacity} />
      </mesh>
      {/* taillights */}
      <mesh position={[-item.width / 2 + 0.04, wheelR + bodyH * 0.65, -item.depth * 0.32]}>
        <boxGeometry args={[0.06, bodyH * 0.15, item.depth * 0.1]} />
        <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={0.3} roughness={0.2} metalness={0.2} transparent={faded} opacity={opacity} />
      </mesh>
      <mesh position={[-item.width / 2 + 0.04, wheelR + bodyH * 0.65, item.depth * 0.32]}>
        <boxGeometry args={[0.06, bodyH * 0.15, item.depth * 0.1]} />
        <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={0.3} roughness={0.2} metalness={0.2} transparent={faded} opacity={opacity} />
      </mesh>
      {/* 4 wheels */}
      {[[item.width * 0.36, -item.depth * 0.44], [item.width * 0.36, item.depth * 0.44],
        [-item.width * 0.36, -item.depth * 0.44], [-item.width * 0.36, item.depth * 0.44]].map(([wx, wz], i) => (
        <group key={i} position={[wx, wheelR, wz]}>
          {/* tyre */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[wheelR, wheelR, wheelThick, 14]} />
            <meshStandardMaterial color="#111827" roughness={0.95} metalness={0.05} />
          </mesh>
          {/* rim */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[wheelR * 0.58, wheelR * 0.58, wheelThick + 0.01, 10]} />
            <meshStandardMaterial color="#9ca3af" roughness={0.2} metalness={0.8} />
          </mesh>
        </group>
      ))}
      {selected && <SelectionBox w={item.width} h={item.height} d={item.depth} />}
    </group>
  );
}

// ---- Sanitary ----
function SanitaryMesh({ item, offsetX, baseY, selected, faded, onSelect }: FurnitureMeshProps) {
  const x = item.x + offsetX + item.width / 2;
  const z = item.y + item.depth / 2;
  const angle = (item.rotation * Math.PI) / 180;
  const color = hexToThree(item.color);
  const opacity = faded ? 0.12 : 0.95;

  if (item.templateId === 'wc') {
    return (
      <group position={[x, baseY, z]} rotation={[0, -angle, 0]}>
        {/* base */}
        <mesh position={[0, item.height * 0.35, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <boxGeometry args={[item.width, item.height * 0.7, item.depth * 0.65]} />
          <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.2} metalness={0.05} transparent={faded} opacity={opacity} />
        </mesh>
        {/* cistern */}
        <mesh position={[0, item.height * 0.82, -item.depth * 0.3]} castShadow>
          <boxGeometry args={[item.width, item.height * 0.5, item.depth * 0.28]} />
          <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.2} metalness={0.05} transparent={faded} opacity={opacity} />
        </mesh>
        {/* seat */}
        <mesh position={[0, item.height * 0.72, item.depth * 0.06]}>
          <boxGeometry args={[item.width * 0.96, 0.025, item.depth * 0.52]} />
          <meshStandardMaterial color="#d1d5db" roughness={0.3} metalness={0.02} />
        </mesh>
        {selected && <SelectionBox w={item.width} h={item.height} d={item.depth} />}
      </group>
    );
  }

  if (item.templateId === 'lavabo' || item.templateId === 'lavabo-round') {
    const isRound = item.templateId === 'lavabo-round';
    const r = Math.min(item.width, item.depth) / 2 * 0.75;
    return (
      <group position={[x, baseY, z]} rotation={[0, -angle, 0]}>
        {/* pedestal */}
        <mesh position={[0, item.height * 0.35, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <boxGeometry args={[item.width * 0.3, item.height * 0.7, item.depth * 0.3]} />
          <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.15} metalness={0.05} transparent={faded} opacity={opacity} />
        </mesh>
        {/* basin */}
        {isRound ? (
          <mesh position={[0, item.height * 0.76, 0]} castShadow>
            <cylinderGeometry args={[r, r * 0.85, item.height * 0.12, 14]} />
            <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.12} metalness={0.06} transparent={faded} opacity={opacity} />
          </mesh>
        ) : (
          <mesh position={[0, item.height * 0.76, 0]} castShadow>
            <boxGeometry args={[item.width, item.height * 0.12, item.depth]} />
            <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.12} metalness={0.06} transparent={faded} opacity={opacity} />
          </mesh>
        )}
        {/* tap */}
        <mesh position={[0, item.height * 0.88, -item.depth * 0.3]}>
          <cylinderGeometry args={[0.015, 0.015, 0.12, 6]} />
          <meshStandardMaterial color="#c0c0c0" roughness={0.1} metalness={0.9} />
        </mesh>
        {selected && <SelectionBox w={item.width} h={item.height} d={item.depth} />}
      </group>
    );
  }

  if (item.templateId === 'shower') {
    return (
      <group position={[x, baseY, z]} rotation={[0, -angle, 0]}>
        {/* tray */}
        <mesh position={[0, 0.035, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <boxGeometry args={[item.width, 0.07, item.depth]} />
          <meshStandardMaterial color={selected ? '#60a5fa' : new THREE.Color('#dbeafe')} roughness={0.1} metalness={0.05} transparent={faded} opacity={opacity} />
        </mesh>
        {/* walls (two sides, glass-like) */}
        <mesh position={[-item.width / 2 + 0.015, 1.0, 0]}>
          <boxGeometry args={[0.03, 2.0, item.depth]} />
          <meshStandardMaterial color="#bfdbfe" roughness={0.05} metalness={0.0} transparent opacity={0.35} />
        </mesh>
        <mesh position={[0, 1.0, -item.depth / 2 + 0.015]}>
          <boxGeometry args={[item.width, 2.0, 0.03]} />
          <meshStandardMaterial color="#bfdbfe" roughness={0.05} metalness={0.0} transparent opacity={0.35} />
        </mesh>
        {selected && <SelectionBox w={item.width} h={item.height} d={item.depth} />}
      </group>
    );
  }

  if (item.templateId === 'bathtub') {
    return (
      <group position={[x, baseY, z]} rotation={[0, -angle, 0]}>
        {/* outer shell */}
        <mesh position={[0, item.height / 2, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <boxGeometry args={[item.width, item.height, item.depth]} />
          <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.12} metalness={0.04} transparent={faded} opacity={opacity} />
        </mesh>
        {/* inner basin (dark tub inside) */}
        <mesh position={[0, item.height * 0.65, 0]}>
          <boxGeometry args={[item.width - 0.12, item.height * 0.6, item.depth - 0.1]} />
          <meshStandardMaterial color="#93c5fd" roughness={0.08} metalness={0.02} transparent opacity={0.4} />
        </mesh>
        {/* tap */}
        <mesh position={[item.width * 0.42, item.height + 0.1, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.2, 6]} />
          <meshStandardMaterial color="#c0c0c0" roughness={0.1} metalness={0.9} />
        </mesh>
        {selected && <SelectionBox w={item.width} h={item.height} d={item.depth} />}
      </group>
    );
  }

  // urinal, sink etc. — default
  return (
    <group position={[x, baseY, z]} rotation={[0, -angle, 0]}>
      <mesh position={[0, item.height / 2, 0]} castShadow receiveShadow onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <boxGeometry args={[item.width, item.height, item.depth]} />
        <meshStandardMaterial color={selected ? '#60a5fa' : color} roughness={0.15} metalness={0.05} transparent={faded} opacity={opacity} />
      </mesh>
      {selected && <SelectionBox w={item.width} h={item.height} d={item.depth} />}
    </group>
  );
}

export const FurnitureMesh = memo(function FurnitureMesh({ item, offsetX, baseY, selected, faded, onSelect }: FurnitureMeshProps) {
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
  if (item.category === 'sanitary') {
    return <SanitaryMesh item={item} offsetX={offsetX} baseY={baseY} selected={selected} faded={faded} onSelect={onSelect} />;
  }
  return <DeskMesh item={item} offsetX={offsetX} baseY={baseY} selected={selected} faded={faded} onSelect={onSelect} />;
});

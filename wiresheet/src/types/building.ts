export type RoomType =
  | 'room'
  | 'corridor'
  | 'staircase'
  | 'elevator'
  | 'bathroom'
  | 'kitchen'
  | 'office'
  | 'storage'
  | 'garage'
  | 'outdoor';

export type WallSide = 'north' | 'east' | 'south' | 'west';

export interface WallPoint {
  x: number;
  y: number;
}

export type WallOpeningType = 'door' | 'window' | 'door-double' | 'door-arch' | 'window-large';

export interface WallOpening {
  id: string;
  type: WallOpeningType;
  position: number;
  width: number;
  height: number;
  sillHeight: number;
}

export interface Wall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  height: number;
  color: string;
  opacity: number;
  materialType: 'concrete' | 'brick' | 'wood' | 'glass' | 'drywall';
  openings: WallOpening[];
}

export interface Door {
  id: string;
  wall: WallSide;
  position: number;
  width: number;
}

export interface Window2D {
  id: string;
  wall: WallSide;
  position: number;
  width: number;
  height: number;
  sillHeight: number;
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  x: number;
  y: number;
  width: number;
  depth: number;
  color: string;
  doors: Door[];
  windows: Window2D[];
  points?: { x: number; y: number }[];
}

// ---- 3D Widgets ----

export type Widget3DType =
  | 'temperature'
  | 'setpoint'
  | 'humidity'
  | 'alarm'
  | 'co2'
  | 'presence'
  | 'energy'
  | 'valve'
  | 'pump'
  | 'fan'
  | 'light'
  | 'blinds'
  | 'custom'
  | 'roomcolor'
  | 'duct'
  | 'fire-damper'
  | 'boolean';

export interface Widget3D {
  id: string;
  type: Widget3DType;
  label: string;
  datapoint: string;
  unit: string;
  x: number;
  y: number;
  z: number;
  floorId: string;
  scale: number;
  size?: number;
  color: string;
  showLabel: boolean;
  showValue: boolean;
  alarmDatapoint?: string;
  minValue?: number;
  maxValue?: number;
  roomIds?: string[];
  opacity?: number;
}

// ---- Ducts & Pipes ----

export type DuctShape = 'round' | 'rectangular';
export type DuctType = 'supply' | 'return' | 'exhaust' | 'fresh';
export type PipeType = 'supply' | 'return' | 'domestic-hot' | 'domestic-cold' | 'sprinkler' | 'gas';

export interface DuctPoint {
  x: number;
  y: number;
}

export interface Duct {
  id: string;
  points: DuctPoint[];
  shape: DuctShape;
  type: DuctType;
  width: number;
  height: number;
  elevation: number;
  color?: string;
  label?: string;
  insulated: boolean;
  isTransition?: boolean;
  transitionToWidth?: number;
  transitionToHeight?: number;
  transitionToShape?: DuctShape;
  isVertical?: boolean;
  verticalX?: number;
  verticalY?: number;
  verticalSectionPoints?: DuctPoint[];
}

export interface Pipe {
  id: string;
  points: DuctPoint[];
  type: PipeType;
  diameter: number;
  elevation: number;
  color?: string;
  label?: string;
  insulated: boolean;
}

// ---- Floor Slabs ----

export interface SlabPoint {
  x: number;
  y: number;
}

export interface Slab {
  id: string;
  points: SlabPoint[];
  color?: string;
  opacity?: number;
  thickness?: number;
  texture?: 'none' | 'concrete' | 'wood' | 'tile' | 'carpet';
  elevation?: number;
}

// ---- OBJ Models ----

export interface ObjFace {
  vertices: number[];
  normals: number[];
  uvs: number[];
}

export interface ObjMaterial {
  name: string;
  color: string;
  opacity: number;
}

export interface ObjModel {
  id: string;
  name: string;
  fileName: string;
  vertices: [number, number, number][];
  normals: [number, number, number][];
  uvs: [number, number][];
  faces: { vertexIndices: number[]; normalIndices: number[]; uvIndices: number[]; materialName?: string }[];
  materials: ObjMaterial[];
  x: number;
  y: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
  visible: boolean;
}

export interface BackgroundImage {
  dataUrl: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  rotation: number;
}

export interface FloorLayers {
  walls: boolean;
  ducts: boolean;
  pipes: boolean;
  background: boolean;
  rooms: boolean;
  slabs: boolean;
}

export const DEFAULT_LAYERS: FloorLayers = {
  walls: true,
  ducts: true,
  pipes: true,
  background: true,
  rooms: true,
  slabs: true,
};

export interface Floor {
  id: string;
  name: string;
  level: number;
  height: number;
  rooms: Room[];
  walls: Wall[];
  ducts: Duct[];
  pipes: Pipe[];
  slabs: Slab[];
  backgroundImage: BackgroundImage | null;
  floorColor?: string;
  showFloorPlane?: boolean;
  layers?: FloorLayers;
}

export interface Building {
  id: string;
  name: string;
  floors: Floor[];
  objModels: ObjModel[];
  widgets3d: Widget3D[];
  createdAt: number;
  updatedAt: number;
}

export type BuildingTool = 'select' | 'room' | 'polygon-room' | 'wall' | 'door' | 'window' | 'delete' | 'measure' | 'duct' | 'pipe' | 'slab';

export interface BuildingViewState {
  selectedBuildingId: string | null;
  selectedFloorId: string | null;
  selectedRoomId: string | null;
  selectedWallId: string | null;
  tool: BuildingTool;
  viewMode: '3d' | 'floor';
  camera: {
    rotX: number;
    rotY: number;
    zoom: number;
    panX: number;
    panY: number;
  };
}

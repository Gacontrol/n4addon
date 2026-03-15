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
}

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

export interface Floor {
  id: string;
  name: string;
  level: number;
  height: number;
  rooms: Room[];
  walls: Wall[];
  backgroundImage: BackgroundImage | null;
}

export interface Building {
  id: string;
  name: string;
  floors: Floor[];
  objModels: ObjModel[];
  createdAt: number;
  updatedAt: number;
}

export type BuildingTool = 'select' | 'room' | 'wall' | 'door' | 'window' | 'delete' | 'measure';

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

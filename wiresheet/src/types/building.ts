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

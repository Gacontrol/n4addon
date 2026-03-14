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

export interface Door {
  id: string;
  wall: WallSide;
  position: number;
  width: number;
}

export interface Window {
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
  windows: Window[];
}

export interface Floor {
  id: string;
  name: string;
  level: number;
  height: number;
  rooms: Room[];
}

export interface Building {
  id: string;
  name: string;
  floors: Floor[];
  createdAt: number;
  updatedAt: number;
}

export type BuildingTool = 'select' | 'room' | 'door' | 'window' | 'delete';

export interface BuildingViewState {
  selectedBuildingId: string | null;
  selectedFloorId: string | null;
  selectedRoomId: string | null;
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

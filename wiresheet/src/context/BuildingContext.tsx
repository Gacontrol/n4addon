import { createContext, useContext, ReactNode } from 'react';
import { Building, Floor, Room, Wall, WallOpening, BackgroundImage, BuildingTool, ObjModel, Duct, Pipe, Widget3D, Slab, FloorLayers, FurnitureItem } from '../types/building';
import { useBuildingEditor } from '../hooks/useBuildingEditor';
import { RoomMonitorConfig } from '../types/bms';
import { useBuildingMonitor } from '../hooks/useBuildingMonitor';
// Re-export the full hook return type so BuildingView can use context
type BuildingEditorHook = ReturnType<typeof useBuildingEditor>;

interface BuildingContextValue extends BuildingEditorHook {
  monitorConfigs: Record<string, RoomMonitorConfig>;
  saveRoomMonitorConfig: (config: RoomMonitorConfig) => void;
}

const BuildingContext = createContext<BuildingContextValue>({} as BuildingContextValue);

export function BuildingProvider({ children }: { children: ReactNode }) {
  const editor = useBuildingEditor();

  const allRoomIds = editor.buildings.flatMap(b => b.floors.flatMap(f => f.rooms.map(r => r.id)));
  const { monitorConfigs, saveRoomMonitorConfig } = useBuildingMonitor(allRoomIds);

  return (
    <BuildingContext.Provider value={{
      ...editor,
      monitorConfigs,
      saveRoomMonitorConfig,
    }}>
      {children}
    </BuildingContext.Provider>
  );
}

export function useBuildingContext() {
  return useContext(BuildingContext);
}

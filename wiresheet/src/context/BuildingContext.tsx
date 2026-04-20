import { createContext, useContext, ReactNode } from 'react';
import { Building } from '../types/building';
import { useBuildingEditor } from '../hooks/useBuildingEditor';
import { RoomMonitorConfig } from '../types/bms';
import { useBuildingMonitor } from '../hooks/useBuildingMonitor';

interface BuildingContextValue {
  buildings: Building[];
  activeBuildingId: string;
  activeFloorId: string;
  replaceBuilding: (b: Building) => void;
  isLoaded: boolean;
  monitorConfigs: Record<string, RoomMonitorConfig>;
  saveRoomMonitorConfig: (config: RoomMonitorConfig) => void;
}

const BuildingContext = createContext<BuildingContextValue>({
  buildings: [],
  activeBuildingId: '',
  activeFloorId: '',
  replaceBuilding: () => {},
  isLoaded: false,
  monitorConfigs: {},
  saveRoomMonitorConfig: () => {},
});

export function BuildingProvider({ children }: { children: ReactNode }) {
  const editor = useBuildingEditor();

  const allRoomIds = editor.buildings.flatMap(b => b.floors.flatMap(f => f.rooms.map(r => r.id)));
  const { monitorConfigs, saveRoomMonitorConfig } = useBuildingMonitor(allRoomIds);

  return (
    <BuildingContext.Provider value={{
      buildings: editor.buildings,
      activeBuildingId: editor.activeBuildingId,
      activeFloorId: editor.activeFloorId,
      replaceBuilding: editor.replaceBuilding,
      isLoaded: editor.isLoaded,
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

import { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import { useBuildingEditor } from '../hooks/useBuildingEditor';
import { RoomMonitorConfig } from '../types/bms';
import { useBuildingMonitor } from '../hooks/useBuildingMonitor';
import type { DatapointGroup } from '../components/building/RoomBindingsPanel';

type BuildingEditorHook = ReturnType<typeof useBuildingEditor>;

interface BuildingContextValue extends BuildingEditorHook {
  monitorConfigs: Record<string, RoomMonitorConfig>;
  saveRoomMonitorConfig: (config: RoomMonitorConfig) => void;
  datapointGroups: DatapointGroup[];
  setDatapointGroups: (groups: DatapointGroup[]) => void;
}

const BuildingContext = createContext<BuildingContextValue>({} as BuildingContextValue);

export function BuildingProvider({ children }: { children: ReactNode }) {
  const editor = useBuildingEditor();
  const [datapointGroups, setDatapointGroups] = useState<DatapointGroup[]>([]);

  const allRoomIds = useMemo(
    () => editor.buildings.flatMap(b => b.floors.flatMap(f => f.rooms.map(r => r.id))),
    [editor.buildings]
  );
  const { monitorConfigs, saveRoomMonitorConfig } = useBuildingMonitor(allRoomIds);

  return (
    <BuildingContext.Provider value={{
      ...editor,
      monitorConfigs,
      saveRoomMonitorConfig,
      datapointGroups,
      setDatapointGroups,
    }}>
      {children}
    </BuildingContext.Provider>
  );
}

export function useBuildingContext() {
  return useContext(BuildingContext);
}

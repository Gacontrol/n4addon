import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BuildingDisplayMode,
  BuildingDisplayState,
  RoomDisplayConfig,
} from '../types/roomDisplay';

const STORAGE_KEY_CONFIGS = 'wiresheet.roomDisplayConfigs';
const STORAGE_KEY_STATE = 'wiresheet.buildingDisplayState';

type ConfigsStore = Record<string, Record<string, RoomDisplayConfig>>;
type StateStore = Record<string, BuildingDisplayState>;

function readConfigsStore(): ConfigsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIGS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeConfigsStore(store: ConfigsStore) {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(store));
  } catch {
    // ignore
  }
}

function readStateStore(): StateStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STATE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStateStore(store: StateStore) {
  try {
    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(store));
  } catch {
    // ignore
  }
}

export function emptyRoomConfig(buildingId: string, floorId: string, roomId: string): RoomDisplayConfig {
  return {
    buildingId,
    floorId,
    roomId,
    primaryDatapoint: '',
    primaryLabel: '',
    primaryUnit: '',
    visibleDatapoints: [],
    description: '',
    metadata: {},
  };
}

export function useRoomDisplayConfig(buildingId: string | null) {
  const [configs, setConfigs] = useState<Record<string, RoomDisplayConfig>>({});
  const [buildingState, setBuildingState] = useState<BuildingDisplayState>({
    buildingId: buildingId || '',
    mode: 'none',
    modeConfig: {},
  });

  useEffect(() => {
    if (!buildingId) {
      setConfigs({});
      setBuildingState({ buildingId: '', mode: 'none', modeConfig: {} });
      return;
    }
    const store = readConfigsStore();
    setConfigs(store[buildingId] ?? {});
    const stateStore = readStateStore();
    setBuildingState(stateStore[buildingId] ?? { buildingId, mode: 'none', modeConfig: {} });
  }, [buildingId]);

  const saveRoomConfig = useCallback((cfg: RoomDisplayConfig) => {
    setConfigs(prev => {
      const next = { ...prev, [cfg.roomId]: cfg };
      const store = readConfigsStore();
      store[cfg.buildingId] = next;
      writeConfigsStore(store);
      return next;
    });
  }, []);

  const deleteRoomConfig = useCallback((bid: string, roomId: string) => {
    setConfigs(prev => {
      const next = { ...prev };
      delete next[roomId];
      const store = readConfigsStore();
      store[bid] = next;
      writeConfigsStore(store);
      return next;
    });
  }, []);

  const setBuildingMode = useCallback((mode: BuildingDisplayMode, modeConfig?: Record<string, unknown>) => {
    if (!buildingId) return;
    const next: BuildingDisplayState = { buildingId, mode, modeConfig: modeConfig ?? {} };
    setBuildingState(next);
    const store = readStateStore();
    store[buildingId] = next;
    writeStateStore(store);
  }, [buildingId]);

  const getConfig = useCallback(
    (roomId: string): RoomDisplayConfig | undefined => configs[roomId],
    [configs],
  );

  const configList = useMemo(() => Object.values(configs), [configs]);

  return {
    configs,
    configList,
    buildingState,
    loading: false,
    error: null,
    getConfig,
    saveRoomConfig,
    deleteRoomConfig,
    setBuildingMode,
    reload: () => {
      if (!buildingId) return;
      const store = readConfigsStore();
      setConfigs(store[buildingId] ?? {});
    },
  };
}

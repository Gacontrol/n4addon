import { useState, useCallback, useEffect } from 'react';
import { BuildingLayerMode, BuildingMonitorState, RoomLiveValue, DataPointCategory, RoomMonitorConfig } from '../types/bms';

const MONITOR_CONFIG_KEY = 'wiresheet_room_monitor_configs';

function loadMonitorConfigs(): Record<string, RoomMonitorConfig> {
  try {
    const stored = localStorage.getItem(MONITOR_CONFIG_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

function saveMonitorConfigs(configs: Record<string, RoomMonitorConfig>) {
  localStorage.setItem(MONITOR_CONFIG_KEY, JSON.stringify(configs));
}

function generateMockValue(category: DataPointCategory, roomId: string): number {
  const seed = roomId.charCodeAt(roomId.length - 1) || 42;
  const rand = ((seed * 9301 + 49297) % 233280) / 233280;
  switch (category) {
    case 'temperature': return 19 + rand * 8;
    case 'co2': return 400 + rand * 800;
    case 'humidity': return 35 + rand * 35;
    case 'airflow': return rand * 400;
    case 'energy': return rand * 1500;
    case 'occupancy': return rand > 0.5 ? 1 : 0;
    case 'alarm': return rand > 0.85 ? 1 : 0;
    default: return rand * 100;
  }
}

export function useBuildingMonitor(roomIds: string[]) {
  const [state, setState] = useState<BuildingMonitorState>({
    activeLayer: 'temperature',
    hoveredRoomId: null,
    selectedRoomId: null,
    selectedFloorId: null,
    roomValues: [],
  });

  const [monitorConfigs, setMonitorConfigs] = useState<Record<string, RoomMonitorConfig>>(loadMonitorConfigs);

  const updateRoomValues = useCallback((layer: BuildingLayerMode, ids: string[]) => {
    if (layer === 'normal' || ids.length === 0) {
      setState(s => ({ ...s, roomValues: [] }));
      return;
    }
    const category = layer as DataPointCategory;
    const values: RoomLiveValue[] = ids.map(roomId => {
      const value = generateMockValue(category, roomId);
      return {
        roomId,
        category,
        value,
        status: value > 0.8 ? 'alarm' : value > 0.6 ? 'warning' : 'ok',
        formattedValue: formatValue(value, layer),
      };
    });
    setState(s => ({ ...s, roomValues: values }));
  }, []);

  useEffect(() => {
    updateRoomValues(state.activeLayer, roomIds);
  }, [state.activeLayer, roomIds, updateRoomValues]);

  const setActiveLayer = useCallback((layer: BuildingLayerMode) => {
    setState(s => ({ ...s, activeLayer: layer }));
  }, []);

  const setHoveredRoom = useCallback((roomId: string | null) => {
    setState(s => ({ ...s, hoveredRoomId: roomId }));
  }, []);

  const setSelectedRoom = useCallback((roomId: string | null) => {
    setState(s => ({ ...s, selectedRoomId: roomId }));
  }, []);

  const setSelectedFloor = useCallback((floorId: string | null) => {
    setState(s => ({ ...s, selectedFloorId: floorId }));
  }, []);

  const saveRoomMonitorConfig = useCallback((config: RoomMonitorConfig) => {
    setMonitorConfigs(prev => {
      const next = { ...prev, [config.roomId]: config };
      saveMonitorConfigs(next);
      return next;
    });
  }, []);

  const getRoomMonitorConfig = useCallback((roomId: string): RoomMonitorConfig | null => {
    return monitorConfigs[roomId] ?? null;
  }, [monitorConfigs]);

  const getRoomLayerValue = useCallback((roomId: string): RoomLiveValue | null => {
    return state.roomValues.find(v => v.roomId === roomId) ?? null;
  }, [state.roomValues]);

  return {
    ...state,
    setActiveLayer,
    setHoveredRoom,
    setSelectedRoom,
    setSelectedFloor,
    saveRoomMonitorConfig,
    getRoomMonitorConfig,
    getRoomLayerValue,
    monitorConfigs,
  };
}

function formatValue(value: number, layer: BuildingLayerMode): string {
  switch (layer) {
    case 'temperature': return `${value.toFixed(1)} °C`;
    case 'co2': return `${Math.round(value)} ppm`;
    case 'humidity': return `${Math.round(value)} %`;
    case 'airflow': return `${Math.round(value)} m³/h`;
    case 'energy': return `${Math.round(value)} W`;
    case 'occupancy': return value > 0.5 ? 'Belegt' : 'Frei';
    case 'alarm': return value > 0.5 ? 'Alarm' : 'OK';
    default: return value.toFixed(1);
  }
}

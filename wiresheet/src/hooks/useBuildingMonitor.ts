import { useState, useCallback, useEffect } from 'react';
import { BuildingMonitorState, RoomLiveValue, DataPointCategory, RoomMonitorConfig } from '../types/bms';
import { MonitorLayer } from '../types/building';

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

function generateMockValue(roomId: string): number {
  const seed = roomId.charCodeAt(roomId.length - 1) || 42;
  return ((seed * 9301 + 49297) % 233280) / 233280;
}

function formatLayerValue(raw: number, layer: MonitorLayer): string {
  const { min, max } = layer.colorScale;
  const value = min + raw * (max - min);
  const unit = layer.unit ? ` ${layer.unit}` : '';
  if (max - min <= 1) {
    return `${value.toFixed(2)}${unit}`;
  }
  if (max - min <= 10) {
    return `${value.toFixed(1)}${unit}`;
  }
  return `${Math.round(value)}${unit}`;
}

export function useBuildingMonitor(roomIds: string[], monitorLayers?: MonitorLayer[]) {
  const [state, setState] = useState<BuildingMonitorState & { activeLayerId: string }>({
    activeLayer: 'temperature' as any,
    activeLayerId: 'normal',
    hoveredRoomId: null,
    selectedRoomId: null,
    selectedFloorId: null,
    roomValues: [],
  });

  const [monitorConfigs, setMonitorConfigs] = useState<Record<string, RoomMonitorConfig>>(loadMonitorConfigs);

  const updateRoomValues = useCallback((layerId: string, ids: string[], layers: MonitorLayer[] = []) => {
    if (layerId === 'normal' || ids.length === 0) {
      setState(s => ({ ...s, roomValues: [] }));
      return;
    }
    const layer = layers.find(l => l.id === layerId);
    const values: RoomLiveValue[] = ids.map(roomId => {
      const raw = generateMockValue(roomId);
      const { min, max } = layer?.colorScale ?? { min: 0, max: 1 };
      const value = min + raw * (max - min);
      const formattedValue = layer ? formatLayerValue(raw, layer) : value.toFixed(1);
      return {
        roomId,
        category: 'generic' as DataPointCategory,
        value,
        status: raw > 0.85 ? 'alarm' : raw > 0.65 ? 'warning' : 'ok',
        formattedValue,
      };
    });
    setState(s => ({ ...s, roomValues: values }));
  }, []);

  useEffect(() => {
    updateRoomValues(state.activeLayerId, roomIds, monitorLayers);
  }, [state.activeLayerId, roomIds, monitorLayers, updateRoomValues]);

  const setActiveLayer = useCallback((layerId: string) => {
    setState(s => ({ ...s, activeLayerId: layerId, activeLayer: layerId as any }));
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
    activeLayerId: state.activeLayerId,
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

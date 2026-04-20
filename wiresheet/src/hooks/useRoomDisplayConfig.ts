import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  BuildingDisplayMode,
  BuildingDisplayState,
  RoomDatapointDisplay,
  RoomDisplayConfig,
} from '../types/roomDisplay';

interface RoomConfigRow {
  building_id: string;
  floor_id: string;
  room_id: string;
  primary_datapoint: string;
  primary_label: string;
  primary_unit: string;
  visible_datapoints: RoomDatapointDisplay[] | null;
  description: string;
  metadata: Record<string, unknown> | null;
}

interface BuildingStateRow {
  building_id: string;
  mode: BuildingDisplayMode;
  mode_config: Record<string, unknown> | null;
}

function rowToConfig(r: RoomConfigRow): RoomDisplayConfig {
  return {
    buildingId: r.building_id,
    floorId: r.floor_id || '',
    roomId: r.room_id,
    primaryDatapoint: r.primary_datapoint || '',
    primaryLabel: r.primary_label || '',
    primaryUnit: r.primary_unit || '',
    visibleDatapoints: Array.isArray(r.visible_datapoints) ? r.visible_datapoints : [],
    description: r.description || '',
    metadata: r.metadata || {},
  };
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const loadAll = useCallback(async (bid: string) => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: roomRows, error: roomErr }, { data: stateRow, error: stateErr }] = await Promise.all([
        supabase.from('room_display_config').select('*').eq('building_id', bid),
        supabase.from('building_display_state').select('*').eq('building_id', bid).maybeSingle(),
      ]);

      if (roomErr) throw roomErr;
      if (stateErr) throw stateErr;

      const map: Record<string, RoomDisplayConfig> = {};
      (roomRows ?? []).forEach(r => {
        const cfg = rowToConfig(r as RoomConfigRow);
        map[cfg.roomId] = cfg;
      });
      setConfigs(map);

      if (stateRow) {
        setBuildingState({
          buildingId: bid,
          mode: (stateRow as BuildingStateRow).mode || 'none',
          modeConfig: (stateRow as BuildingStateRow).mode_config || {},
        });
      } else {
        setBuildingState({ buildingId: bid, mode: 'none', modeConfig: {} });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (buildingId) loadAll(buildingId);
  }, [buildingId, loadAll]);

  const persistRoomConfig = useCallback(async (cfg: RoomDisplayConfig) => {
    try {
      const { error: upErr } = await supabase
        .from('room_display_config')
        .upsert(
          {
            building_id: cfg.buildingId,
            floor_id: cfg.floorId,
            room_id: cfg.roomId,
            primary_datapoint: cfg.primaryDatapoint,
            primary_label: cfg.primaryLabel,
            primary_unit: cfg.primaryUnit,
            visible_datapoints: cfg.visibleDatapoints,
            description: cfg.description,
            metadata: cfg.metadata,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'building_id,room_id' },
        );
      if (upErr) throw upErr;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const scheduleSave = useCallback((cfg: RoomDisplayConfig) => {
    const key = `${cfg.buildingId}:${cfg.roomId}`;
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => { void persistRoomConfig(cfg); }, 300);
  }, [persistRoomConfig]);

  const saveRoomConfig = useCallback((cfg: RoomDisplayConfig) => {
    setConfigs(prev => ({ ...prev, [cfg.roomId]: cfg }));
    scheduleSave(cfg);
  }, [scheduleSave]);

  const deleteRoomConfig = useCallback(async (bid: string, roomId: string) => {
    setConfigs(prev => {
      const n = { ...prev };
      delete n[roomId];
      return n;
    });
    try {
      await supabase.from('room_display_config').delete().match({ building_id: bid, room_id: roomId });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const setBuildingMode = useCallback(async (mode: BuildingDisplayMode, modeConfig?: Record<string, unknown>) => {
    if (!buildingId) return;
    const next: BuildingDisplayState = { buildingId, mode, modeConfig: modeConfig ?? {} };
    setBuildingState(next);
    try {
      await supabase
        .from('building_display_state')
        .upsert(
          {
            building_id: buildingId,
            mode,
            mode_config: next.modeConfig,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'building_id' },
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
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
    loading,
    error,
    getConfig,
    saveRoomConfig,
    deleteRoomConfig,
    setBuildingMode,
    reload: () => { if (buildingId) void loadAll(buildingId); },
  };
}

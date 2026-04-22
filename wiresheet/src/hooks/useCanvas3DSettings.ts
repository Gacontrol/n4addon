import { useState, useEffect, useCallback } from 'react';
import { LightingSettings, DEFAULT_LIGHTING, ExplosionSettings, DEFAULT_EXPLOSION } from '../components/building/BuildingCanvas3D';
import type { BuildingDisplayMode } from '../types/building';

const STORAGE_KEY = 'wiresheet_canvas3d_settings';

export interface Canvas3DSettings {
  lighting: LightingSettings;
  explosion: ExplosionSettings;
  wallsTransparent: boolean;
  xrayOpacity: number;
  floorTransparent: boolean;
  bgColor: string;
  bgTransparent: boolean;
  showGrid: boolean;
  autoRotate: boolean;
  buildingMode: BuildingDisplayMode;
}

const DEFAULT_SETTINGS: Canvas3DSettings = {
  lighting: DEFAULT_LIGHTING,
  explosion: DEFAULT_EXPLOSION,
  wallsTransparent: false,
  xrayOpacity: 0.2,
  floorTransparent: false,
  bgColor: '#0a1020',
  bgTransparent: false,
  showGrid: true,
  autoRotate: false,
  buildingMode: 'normal',
};

function loadSettings(): Canvas3DSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      lighting: { ...DEFAULT_LIGHTING, ...(parsed.lighting ?? {}) },
      explosion: { ...DEFAULT_EXPLOSION, ...(parsed.explosion ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useCanvas3DSettings() {
  const [settings, setSettings] = useState<Canvas3DSettings>(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const updateSettings = useCallback(<K extends keyof Canvas3DSettings>(
    key: K,
    value: Canvas3DSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateLighting = useCallback((updates: Partial<LightingSettings>) => {
    setSettings(prev => ({ ...prev, lighting: { ...prev.lighting, ...updates } }));
  }, []);

  const updateExplosion = useCallback((updates: Partial<ExplosionSettings>) => {
    setSettings(prev => ({ ...prev, explosion: { ...prev.explosion, ...updates } }));
  }, []);

  const resetLighting = useCallback(() => {
    setSettings(prev => ({ ...prev, lighting: DEFAULT_LIGHTING }));
  }, []);

  const resetExplosion = useCallback(() => {
    setSettings(prev => ({ ...prev, explosion: DEFAULT_EXPLOSION }));
  }, []);

  return {
    settings,
    updateSettings,
    updateLighting,
    updateExplosion,
    resetLighting,
    resetExplosion,
  };
}

export function useCanvas3DSettingsReadOnly(): Canvas3DSettings {
  const [settings, setSettings] = useState<Canvas3DSettings>(loadSettings);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setSettings(loadSettings());
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return settings;
}

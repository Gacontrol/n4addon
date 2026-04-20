import { useCallback, useEffect, useState } from 'react';

export type AppMode = 'editor' | 'monitor' | 'service';

const STORAGE_KEY = 'wiresheet.appMode';

function readMode(): AppMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'editor' || raw === 'monitor' || raw === 'service') return raw;
  } catch {
    // ignore
  }
  return 'editor';
}

export function useAppMode() {
  const [mode, setModeState] = useState<AppMode>(() => readMode());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode]);

  const setMode = useCallback((m: AppMode) => setModeState(m), []);

  return { mode, setMode };
}

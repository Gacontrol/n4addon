import { useState, useCallback, useEffect } from 'react';
import { AlarmClass, AlarmConsole, ActiveAlarm, AlarmHistoryEntry } from '../types/alarm';

function getApiBase(): string {
  const path = window.location.pathname;
  const m = path.match(/^(\/api\/hassio_ingress\/[^/]+)/) || path.match(/^(\/app\/[^/]+)/);
  return m ? `${m[1]}/api` : '/api';
}

const DEFAULT_ALARM_CLASSES: AlarmClass[] = [];
const DEFAULT_ALARM_CONSOLES: AlarmConsole[] = [];

export function useAlarmManagement() {
  const [alarmClasses, setAlarmClasses] = useState<AlarmClass[]>(DEFAULT_ALARM_CLASSES);
  const [alarmConsoles, setAlarmConsoles] = useState<AlarmConsole[]>(DEFAULT_ALARM_CONSOLES);
  const [activeAlarms, setActiveAlarms] = useState<ActiveAlarm[]>([]);
  const [alarmHistory, setAlarmHistory] = useState<AlarmHistoryEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const apiBase = getApiBase();
        const resp = await fetch(`${apiBase}/alarm-config`);
        if (resp.ok) {
          const data = await resp.json();
          setAlarmClasses(data.alarmClasses || []);
          setAlarmConsoles(data.alarmConsoles || []);
          setActiveAlarms(data.activeAlarms || []);
          setAlarmHistory(data.alarmHistory || []);
        }
      } catch (err) {
        console.error('Failed to load alarm config:', err);
      }
      setIsLoaded(true);
    };
    loadConfig();
  }, []);

  const saveConfig = useCallback(async (
    classes: AlarmClass[],
    consoles: AlarmConsole[],
    active: ActiveAlarm[],
    history: AlarmHistoryEntry[]
  ) => {
    if (!isLoaded) return;
    try {
      const apiBase = getApiBase();
      await fetch(`${apiBase}/alarm-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alarmClasses: classes,
          alarmConsoles: consoles,
          activeAlarms: active,
          alarmHistory: history
        })
      });
    } catch (err) {
      console.error('Failed to save alarm config:', err);
    }
  }, [isLoaded]);

  const addAlarmClass = useCallback((alarmClass: Omit<AlarmClass, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newClass: AlarmClass = {
      ...alarmClass,
      id: `ac-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setAlarmClasses(prev => {
      const updated = [...prev, newClass];
      saveConfig(updated, alarmConsoles, activeAlarms, alarmHistory);
      return updated;
    });
    return newClass;
  }, [alarmConsoles, activeAlarms, alarmHistory, saveConfig]);

  const updateAlarmClass = useCallback((id: string, updates: Partial<AlarmClass>) => {
    setAlarmClasses(prev => {
      const updated = prev.map(ac =>
        ac.id === id ? { ...ac, ...updates, updatedAt: Date.now() } : ac
      );
      saveConfig(updated, alarmConsoles, activeAlarms, alarmHistory);
      return updated;
    });
  }, [alarmConsoles, activeAlarms, alarmHistory, saveConfig]);

  const deleteAlarmClass = useCallback((id: string) => {
    setAlarmClasses(prev => {
      const updated = prev.filter(ac => ac.id !== id);
      const updatedConsoles = alarmConsoles.map(console => ({
        ...console,
        alarmClassIds: console.alarmClassIds.filter(cid => cid !== id)
      }));
      setAlarmConsoles(updatedConsoles);
      saveConfig(updated, updatedConsoles, activeAlarms, alarmHistory);
      return updated;
    });
  }, [alarmConsoles, activeAlarms, alarmHistory, saveConfig]);

  const addAlarmConsole = useCallback((console: Omit<AlarmConsole, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newConsole: AlarmConsole = {
      ...console,
      id: `cons-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setAlarmConsoles(prev => {
      const updated = [...prev, newConsole];
      saveConfig(alarmClasses, updated, activeAlarms, alarmHistory);
      return updated;
    });
    return newConsole;
  }, [alarmClasses, activeAlarms, alarmHistory, saveConfig]);

  const updateAlarmConsole = useCallback((id: string, updates: Partial<AlarmConsole>) => {
    setAlarmConsoles(prev => {
      const updated = prev.map(c =>
        c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
      );
      saveConfig(alarmClasses, updated, activeAlarms, alarmHistory);
      return updated;
    });
  }, [alarmClasses, activeAlarms, alarmHistory, saveConfig]);

  const deleteAlarmConsole = useCallback((id: string) => {
    setAlarmConsoles(prev => {
      const updated = prev.filter(c => c.id !== id);
      saveConfig(alarmClasses, updated, activeAlarms, alarmHistory);
      return updated;
    });
  }, [alarmClasses, activeAlarms, alarmHistory, saveConfig]);

  const acknowledgeAlarm = useCallback((alarmId: string, acknowledgedBy?: string) => {
    setActiveAlarms(prev => {
      const updated = prev.map(a =>
        a.id === alarmId && a.state === 'active'
          ? { ...a, state: 'acknowledged' as const, acknowledgedAt: Date.now(), acknowledgedBy }
          : a
      );
      saveConfig(alarmClasses, alarmConsoles, updated, alarmHistory);
      return updated;
    });
  }, [alarmClasses, alarmConsoles, alarmHistory, saveConfig]);

  const clearAlarm = useCallback((alarmId: string) => {
    setActiveAlarms(prev => {
      const alarm = prev.find(a => a.id === alarmId);
      if (!alarm) return prev;

      const historyEntry: AlarmHistoryEntry = {
        ...alarm,
        state: 'cleared',
        clearedAt: Date.now(),
        archivedAt: Date.now()
      };

      const updatedActive = prev.filter(a => a.id !== alarmId);
      const updatedHistory = [historyEntry, ...alarmHistory].slice(0, 1000);

      setAlarmHistory(updatedHistory);
      saveConfig(alarmClasses, alarmConsoles, updatedActive, updatedHistory);
      return updatedActive;
    });
  }, [alarmClasses, alarmConsoles, alarmHistory, saveConfig]);

  interface TriggerAlarmOptions {
    sourceNodeName?: string;
    sourcePageId?: string;
    sourcePageName?: string;
    value?: unknown;
    unit?: string;
    limitValue?: number;
    limitType?: ActiveAlarm['limitType'];
  }

  const triggerAlarm = useCallback((
    sourceNodeId: string,
    alarmClassId: string,
    message: string,
    alarmType?: string,
    options?: TriggerAlarmOptions
  ) => {
    const sourceKey = `${sourceNodeId}:${alarmType || 'default'}`;

    setActiveAlarms(prev => {
      const existing = prev.find(a => a.sourceNodeId === sourceNodeId && a.alarmType === (alarmType || 'default'));

      if (existing) {
        if (options?.value !== undefined && existing.value !== options.value) {
          const updated = prev.map(a =>
            a.id === existing.id
              ? {
                  ...a,
                  value: options.value,
                  message,
                  occurrenceCount: (a.occurrenceCount || 1) + 1,
                  lastOccurrence: Date.now()
                }
              : a
          );
          saveConfig(alarmClasses, alarmConsoles, updated, alarmHistory);
          return updated;
        }
        return prev;
      }

      const newAlarm: ActiveAlarm = {
        id: `alarm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        alarmClassId,
        sourceNodeId,
        sourceNodeName: options?.sourceNodeName,
        sourcePageId: options?.sourcePageId,
        sourcePageName: options?.sourcePageName,
        sourceKey,
        alarmType: alarmType || 'default',
        message,
        triggeredAt: Date.now(),
        state: 'active',
        value: options?.value,
        unit: options?.unit,
        limitValue: options?.limitValue,
        limitType: options?.limitType,
        occurrenceCount: 1
      };

      const alarmClass = alarmClasses.find(ac => ac.id === alarmClassId);
      if (alarmClass?.autoAcknowledge) {
        newAlarm.state = 'acknowledged';
        newAlarm.acknowledgedAt = Date.now();
        newAlarm.acknowledgedBy = 'auto';
      }

      const updated = [...prev, newAlarm];
      saveConfig(alarmClasses, alarmConsoles, updated, alarmHistory);
      return updated;
    });
  }, [alarmClasses, alarmConsoles, alarmHistory, saveConfig]);

  const acknowledgeAll = useCallback((acknowledgedBy?: string) => {
    setActiveAlarms(prev => {
      const updated = prev.map(a =>
        a.state === 'active'
          ? { ...a, state: 'acknowledged' as const, acknowledgedAt: Date.now(), acknowledgedBy }
          : a
      );
      saveConfig(alarmClasses, alarmConsoles, updated, alarmHistory);
      return updated;
    });
  }, [alarmClasses, alarmConsoles, alarmHistory, saveConfig]);

  const shelveAlarm = useCallback((alarmId: string, durationMs: number, shelvedBy?: string, reason?: string) => {
    setActiveAlarms(prev => {
      const updated = prev.map(a =>
        a.id === alarmId
          ? {
              ...a,
              shelved: true,
              shelvedUntil: Date.now() + durationMs,
              shelvedBy,
              shelvedReason: reason
            }
          : a
      );
      saveConfig(alarmClasses, alarmConsoles, updated, alarmHistory);
      return updated;
    });
  }, [alarmClasses, alarmConsoles, alarmHistory, saveConfig]);

  const unshelveExpiredAlarms = useCallback(() => {
    const now = Date.now();
    setActiveAlarms(prev => {
      const hasExpired = prev.some(a => a.shelved && a.shelvedUntil && a.shelvedUntil <= now);
      if (!hasExpired) return prev;

      const updated = prev.map(a =>
        a.shelved && a.shelvedUntil && a.shelvedUntil <= now
          ? { ...a, shelved: false, shelvedUntil: undefined, shelvedBy: undefined, shelvedReason: undefined }
          : a
      );
      saveConfig(alarmClasses, alarmConsoles, updated, alarmHistory);
      return updated;
    });
  }, [alarmClasses, alarmConsoles, alarmHistory, saveConfig]);

  const clearAlarmBySource = useCallback((sourceNodeId: string, alarmType?: string) => {
    setActiveAlarms(prev => {
      const alarm = prev.find(a =>
        a.sourceNodeId === sourceNodeId &&
        a.alarmType === (alarmType || 'default')
      );
      if (!alarm) return prev;

      const historyEntry: AlarmHistoryEntry = {
        ...alarm,
        state: 'cleared',
        clearedAt: Date.now(),
        archivedAt: Date.now()
      };

      const updatedActive = prev.filter(a => a.id !== alarm.id);
      const updatedHistory = [historyEntry, ...alarmHistory].slice(0, 1000);

      setAlarmHistory(updatedHistory);
      saveConfig(alarmClasses, alarmConsoles, updatedActive, updatedHistory);
      return updatedActive;
    });
  }, [alarmClasses, alarmConsoles, alarmHistory, saveConfig]);

  const acknowledgeAllInConsole = useCallback((consoleId: string, acknowledgedBy?: string) => {
    const console = alarmConsoles.find(c => c.id === consoleId);
    if (!console) return;

    setActiveAlarms(prev => {
      const updated = prev.map(a =>
        console.alarmClassIds.includes(a.alarmClassId) && a.state === 'active'
          ? { ...a, state: 'acknowledged' as const, acknowledgedAt: Date.now(), acknowledgedBy }
          : a
      );
      saveConfig(alarmClasses, alarmConsoles, updated, alarmHistory);
      return updated;
    });
  }, [alarmClasses, alarmConsoles, alarmHistory, saveConfig]);

  const getAlarmsForConsole = useCallback((consoleId: string) => {
    const console = alarmConsoles.find(c => c.id === consoleId);
    if (!console) return [];
    return activeAlarms.filter(a => console.alarmClassIds.includes(a.alarmClassId));
  }, [alarmConsoles, activeAlarms]);

  const setAllAlarmClasses = useCallback((classes: AlarmClass[]) => {
    setAlarmClasses(classes);
    saveConfig(classes, alarmConsoles, activeAlarms, alarmHistory);
  }, [alarmConsoles, activeAlarms, alarmHistory, saveConfig]);

  const setAllAlarmConsoles = useCallback((consoles: AlarmConsole[]) => {
    setAlarmConsoles(consoles);
    saveConfig(alarmClasses, consoles, activeAlarms, alarmHistory);
  }, [alarmClasses, activeAlarms, alarmHistory, saveConfig]);

  return {
    alarmClasses,
    alarmConsoles,
    activeAlarms,
    alarmHistory,
    addAlarmClass,
    updateAlarmClass,
    deleteAlarmClass,
    addAlarmConsole,
    updateAlarmConsole,
    deleteAlarmConsole,
    acknowledgeAlarm,
    acknowledgeAll,
    clearAlarm,
    triggerAlarm,
    clearAlarmBySource,
    acknowledgeAllInConsole,
    getAlarmsForConsole,
    setAllAlarmClasses,
    setAllAlarmConsoles,
    shelveAlarm,
    unshelveExpiredAlarms
  };
}

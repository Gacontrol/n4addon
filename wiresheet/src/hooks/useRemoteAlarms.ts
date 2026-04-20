import { useEffect, useState } from 'react';
import { AlarmClass, AlarmConsole, ActiveAlarm } from '../types/alarm';
import { HaInstance } from '../types/flow';

function getApiBase(): string {
  const p = window.location.pathname;
  const m = p.match(/^(\/api\/hassio_ingress\/[^/]+)/) || p.match(/^(\/app\/[^/]+)/);
  return m ? `${m[1]}/api` : '/api';
}

export interface RemoteInstanceAlarms {
  instanceId: string;
  instanceName: string;
  online: boolean;
  alarmClasses: AlarmClass[];
  alarmConsoles: AlarmConsole[];
  activeAlarms: ActiveAlarm[];
  error?: string;
}

export function useRemoteAlarms(
  haInstances: HaInstance[],
  instanceStatus: Record<string, { online: boolean }>
): RemoteInstanceAlarms[] {
  const [remote, setRemote] = useState<RemoteInstanceAlarms[]>([]);

  useEffect(() => {
    let cancelled = false;
    const enabled = haInstances.filter(i => i.enabled && i.url && i.token);

    async function fetchOne(instance: HaInstance): Promise<RemoteInstanceAlarms> {
      const online = instanceStatus[instance.id]?.online !== false;
      if (!online) {
        return {
          instanceId: instance.id,
          instanceName: instance.name,
          online: false,
          alarmClasses: [],
          alarmConsoles: [],
          activeAlarms: [],
          error: 'offline'
        };
      }
      try {
        const apiBase = getApiBase();
        const r = await fetch(`${apiBase}/ha/instances/${instance.id}/alarm-config`);
        if (!r.ok) {
          return {
            instanceId: instance.id,
            instanceName: instance.name,
            online: true,
            alarmClasses: [],
            alarmConsoles: [],
            activeAlarms: [],
            error: `HTTP ${r.status}`
          };
        }
        const d = await r.json();
        return {
          instanceId: instance.id,
          instanceName: instance.name,
          online: true,
          alarmClasses: d.alarmClasses || [],
          alarmConsoles: d.alarmConsoles || [],
          activeAlarms: d.activeAlarms || [],
          ...(d.error ? { error: d.error } : {})
        };
      } catch (err) {
        return {
          instanceId: instance.id,
          instanceName: instance.name,
          online: true,
          alarmClasses: [],
          alarmConsoles: [],
          activeAlarms: [],
          error: (err as Error).message
        };
      }
    }

    async function loadAll() {
      if (cancelled) return;
      if (enabled.length === 0) {
        setRemote([]);
        return;
      }
      const results = await Promise.all(enabled.map(fetchOne));
      if (!cancelled) setRemote(results);
    }

    loadAll();
    const interval = setInterval(loadAll, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [haInstances, instanceStatus]);

  return remote;
}

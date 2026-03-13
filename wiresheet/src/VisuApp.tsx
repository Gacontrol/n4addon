import { useState, useEffect, useCallback, useRef } from 'react';
import { VisuCanvas } from './components/visualization/VisuCanvas';
import { VisuPage, VisuWidget } from './types/visualization';
import { FlowNode } from './types/flow';
import { AlarmClass, AlarmConsole, ActiveAlarm } from './types/alarm';
import { Monitor, ChevronLeft, Home, Maximize2 } from 'lucide-react';

function getApiBase(): string {
  const p = window.location.pathname;
  const m = p.match(/^(\/api\/hassio_ingress\/[^/]+)/) || p.match(/^(\/app\/[^/]+)/);
  if (m) return `${m[1]}/api`;
  return '/api';
}

const WRITE_DEBOUNCE_MS = 300;

export function VisuApp() {
  const [visuPages, setVisuPages] = useState<VisuPage[]>([]);
  const [activePageId, setActivePageId] = useState<string>('');
  const [liveValues, setLiveValues] = useState<Record<string, unknown>>({});
  const [logicNodes, setLogicNodes] = useState<FlowNode[]>([]);
  const [alarmClasses, setAlarmClasses] = useState<AlarmClass[]>([]);
  const [alarmConsoles, setAlarmConsoles] = useState<AlarmConsole[]>([]);
  const [activeAlarms, setActiveAlarms] = useState<ActiveAlarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pageHistoryRef = useRef<string[]>([]);
  const visuPagesRef = useRef<VisuPage[]>([]);
  const lastWriteRef = useRef<Map<string, number>>(new Map());
  const logicNodesRef = useRef<FlowNode[]>([]);
  const apiBase = getApiBase();

  visuPagesRef.current = visuPages;
  logicNodesRef.current = logicNodes;

  const applyNodeConfigs = useCallback((nodeConfigs: Record<string, Record<string, unknown>>) => {
    setLogicNodes(prev => prev.map(n => {
      const cfg = nodeConfigs[n.id];
      if (!cfg) return n;
      return { ...n, data: { ...n.data, config: { ...(n.data.config || {}), ...cfg } } };
    }));
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [visuRes, pagesRes, alarmRes] = await Promise.all([
        fetch(`${apiBase}/visu-pages`),
        fetch(`${apiBase}/pages`),
        fetch(`${apiBase}/alarm-config`)
      ]);

      if (visuRes.ok) {
        const data = await visuRes.json();
        if (Array.isArray(data) && data.length > 0) {
          setVisuPages(data);
          setActivePageId(prev => prev || data[0].id);
          if (pageHistoryRef.current.length === 0) {
            pageHistoryRef.current = [data[0].id];
          }
        }
      }

      if (pagesRes.ok) {
        const data = await pagesRes.json();
        if (Array.isArray(data)) {
          const allNodes = data.flatMap((p: { nodes: FlowNode[] }) => p.nodes || []);
          setLogicNodes(allNodes);
        }
      }

      if (alarmRes.ok) {
        const data = await alarmRes.json();
        setAlarmClasses(data.alarmClasses || []);
        setAlarmConsoles(data.alarmConsoles || []);
        setActiveAlarms(data.activeAlarms || []);
      }
    } catch (err) {
      console.error('loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  const loadAlarmData = useCallback(async () => {
    try {
      const alarmRes = await fetch(`${apiBase}/alarm-config`);
      if (alarmRes.ok) {
        const data = await alarmRes.json();
        setAlarmClasses(data.alarmClasses || []);
        setAlarmConsoles(data.alarmConsoles || []);
        setActiveAlarms(data.activeAlarms || []);
      }
    } catch (err) {
      console.error('loadAlarmData error:', err);
    }
  }, [apiBase]);

  useEffect(() => {
    const interval = setInterval(loadAlarmData, 2000);
    return () => clearInterval(interval);
  }, [loadAlarmData]);

  const handleAcknowledgeAlarm = useCallback(async (alarmId: string) => {
    try {
      await fetch(`${apiBase}/alarm/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alarmId })
      });
      loadAlarmData();
    } catch (err) {
      console.error('acknowledge alarm error:', err);
    }
  }, [apiBase, loadAlarmData]);

  const handleClearAlarm = useCallback(async (alarmId: string) => {
    try {
      await fetch(`${apiBase}/alarm/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alarmId })
      });
      loadAlarmData();
    } catch (err) {
      console.error('clear alarm error:', err);
    }
  }, [apiBase, loadAlarmData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    function connect() {
      if (!active) return;
      es = new EventSource(`${apiBase}/sse`);

      es.addEventListener('state', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.liveValues) setLiveValues(data.liveValues);
          if (data.nodeConfigs) applyNodeConfigs(data.nodeConfigs);
        } catch {}
      });

      es.onerror = () => {
        es?.close();
        if (active) reconnectTimer = setTimeout(connect, 2000);
      };
    }

    connect();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [apiBase, applyNodeConfigs]);

  const handleWidgetValueChange = useCallback(async (widgetId: string, value: unknown) => {
    console.log('[VISUAPP 8098 DEBUG] handleWidgetValueChange aufgerufen');
    console.log('[VISUAPP 8098 DEBUG]   widgetId:', widgetId);
    console.log('[VISUAPP 8098 DEBUG]   value:', value, 'type:', typeof value);
    const now = Date.now();
    const lastWrite = lastWriteRef.current.get(widgetId) || 0;
    if (now - lastWrite < WRITE_DEBOUNCE_MS) {
      console.log('[VISUAPP 8098 DEBUG] Debounced - zu schnell!');
      return;
    }
    lastWriteRef.current.set(widgetId, now);

    const pages = visuPagesRef.current;
    let binding: VisuWidget['binding'] | undefined;
    for (const page of pages) {
      const widget = page.widgets.find(w => w.id === widgetId);
      if (widget?.binding) {
        binding = widget.binding;
        break;
      }
    }
    if (!binding) {
      console.log('[VISUAPP 8098 DEBUG] Kein Binding gefunden fuer Widget:', widgetId);
      return;
    }
    console.log('[VISUAPP 8098 DEBUG] Binding gefunden:', JSON.stringify(binding));

    if (binding.paramKey) {
      setLogicNodes(prev => prev.map(n => {
        if (n.id !== binding.nodeId) return n;
        return {
          ...n,
          data: {
            ...n.data,
            config: { ...(n.data.config || {}), [binding.paramKey!]: value }
          }
        };
      }));
    }

    try {
      const payload = { nodeId: binding.nodeId, portId: binding.portId, paramKey: binding.paramKey, value };
      const resp = await fetch(`${apiBase}/visu/write-value`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const respData = await resp.json();
      console.log('[VISUAPP 8098 DEBUG] Server Response Status:', resp.status, JSON.stringify(respData));
    } catch (err) {
      console.error('[VISUAPP 8098 DEBUG] write value error:', err);
    }
  }, [apiBase]);

  const handleNavigateTo = useCallback((pageId: string) => {
    pageHistoryRef.current = [...pageHistoryRef.current, pageId];
    setActivePageId(pageId);
  }, []);

  const handleNavigateBack = useCallback(() => {
    const hist = pageHistoryRef.current;
    if (hist.length > 1) {
      const next = hist.slice(0, -1);
      pageHistoryRef.current = next;
      setActivePageId(next[next.length - 1]);
    }
  }, []);

  const handleNavigateHome = useCallback(() => {
    const pages = visuPagesRef.current;
    if (pages.length > 0) {
      pageHistoryRef.current = [pages[0].id];
      setActivePageId(pages[0].id);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const activePage = visuPages.find(p => p.id === activePageId) || visuPages[0];
  const canGoBack = pageHistoryRef.current.length > 1;

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Lade Visualisierung...</span>
        </div>
      </div>
    );
  }

  if (!activePage) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <Monitor className="w-12 h-12 text-slate-600" />
          <p className="text-slate-400 text-sm">Keine Visualisierung gefunden.</p>
          <p className="text-slate-600 text-xs">Erstelle zuerst eine Visualisierung im Wiresheet Editor.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950 overflow-hidden">
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800 bg-slate-900"
        style={{ minHeight: 40, flexShrink: 0 }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={handleNavigateHome}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Startseite"
          >
            <Home className="w-3.5 h-3.5" />
          </button>
          {canGoBack && (
            <button
              onClick={handleNavigateBack}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Zurueck"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 overflow-x-auto">
          {visuPages.map(page => (
            <button
              key={page.id}
              onClick={() => handleNavigateTo(page.id)}
              className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                activePageId === page.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {page.name}
            </button>
          ))}
        </div>

        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={isFullscreen ? 'Vollbild beenden' : 'Vollbild'}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <VisuCanvas
          page={activePage}
          liveValues={liveValues}
          logicNodes={logicNodes}
          isEditMode={false}
          selectedWidgetId={null}
          clipboard={null}
          onSelectWidget={() => {}}
          onUpdateWidget={() => {}}
          onDeleteWidget={() => {}}
          onDuplicateWidget={() => {}}
          onCopyWidget={() => {}}
          onPasteWidget={() => {}}
          onWidgetValueChange={handleWidgetValueChange}
          onEditWidgetProperties={() => {}}
          onNavigateToPage={handleNavigateTo}
          onNavigateBack={handleNavigateBack}
          onNavigateHome={handleNavigateHome}
          onBringToFront={() => {}}
          onBringForward={() => {}}
          onSendBackward={() => {}}
          onSendToBack={() => {}}
          alarmClasses={alarmClasses}
          alarmConsoles={alarmConsoles}
          activeAlarms={activeAlarms}
          onAcknowledgeAlarm={handleAcknowledgeAlarm}
          onClearAlarm={handleClearAlarm}
        />
      </div>
    </div>
  );
}

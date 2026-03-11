import { useState, useEffect, useCallback, useRef } from 'react';
import { VisuCanvas } from './components/visualization/VisuCanvas';
import { VisuPage, VisuWidget } from './types/visualization';
import { FlowNode } from './types/flow';
import { Monitor, ChevronLeft, Home, Maximize2, Lock } from 'lucide-react';

function getApiBase(): string {
  const p = window.location.pathname;
  const m = p.match(/^(\/api\/hassio_ingress\/[^/]+)/) || p.match(/^(\/app\/[^/]+)/);
  if (m) return `${m[1]}/api`;
  return '/api';
}

const POLL_INTERVAL = 300;
const WRITE_LOCK_MS = 8000;

const IS_PORT_8098 = window.location.port === '8098';

export function VisuApp() {
  const [visuPages, setVisuPages] = useState<VisuPage[]>([]);
  const [activePageId, setActivePageId] = useState<string>('');
  const [liveValues, setLiveValues] = useState<Record<string, unknown>>({});
  const [logicNodes, setLogicNodes] = useState<FlowNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [addonVisuDisabled, setAddonVisuDisabled] = useState(false);
  const [visuMode, setVisuMode] = useState<'addon' | 'port8098'>('addon');
  const pageHistoryRef = useRef<string[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visuPagesRef = useRef<VisuPage[]>([]);
  const writeLockRef = useRef<Map<string, number>>(new Map());
  const apiBase = getApiBase();

  const hideToolbar = IS_PORT_8098 || new URLSearchParams(window.location.search).get('kiosk') === '1';

  visuPagesRef.current = visuPages;

  const loadData = useCallback(async () => {
    try {
      const [visuRes, pagesRes] = await Promise.all([
        fetch(`${apiBase}/visu-pages`),
        fetch(`${apiBase}/pages`)
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
          const paramValues: Record<string, unknown> = {};
          for (const node of allNodes) {
            if (node.data?.config) {
              for (const [key, val] of Object.entries(node.data.config)) {
                paramValues[`${node.id}:param:${key}`] = val;
              }
            }
          }
          setLiveValues(prev => ({ ...paramValues, ...prev }));
        }
      }
    } catch (err) {
      console.error('loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  const pollLiveValues = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/live-values`);
      if (res.ok) {
        const data = await res.json();
        const now = Date.now();
        for (const [k, ts] of writeLockRef.current.entries()) {
          if (now >= ts) writeLockRef.current.delete(k);
        }
        setLiveValues(prev => {
          const merged: Record<string, unknown> = { ...prev };
          for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
            if (writeLockRef.current.has(k)) continue;
            merged[k] = v;
          }
          return merged;
        });
      }
    } catch {}
  }, [apiBase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const checkMode = () => {
      fetch(`${apiBase}/visu-mode`)
        .then(r => r.json())
        .then(d => {
          const mode = d.mode as 'addon' | 'port8098';
          setVisuMode(mode);
          if (!IS_PORT_8098) {
            setAddonVisuDisabled(mode === 'port8098');
          }
        })
        .catch(() => {
          if (!IS_PORT_8098) setAddonVisuDisabled(false);
        });
    };
    checkMode();
    const interval = setInterval(checkMode, 3000);
    return () => clearInterval(interval);
  }, [apiBase]);

  useEffect(() => {
    pollLiveValues();
    pollRef.current = setInterval(pollLiveValues, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pollLiveValues]);

  const handleWidgetValueChange = useCallback(async (widgetId: string, value: unknown) => {
    if (IS_PORT_8098 && visuMode !== 'port8098') return;
    if (!IS_PORT_8098 && visuMode !== 'addon') return;

    const pages = visuPagesRef.current;
    let binding: VisuWidget['binding'] | undefined;
    for (const page of pages) {
      const widget = page.widgets.find(w => w.id === widgetId);
      if (widget?.binding) {
        binding = widget.binding;
        break;
      }
    }
    if (!binding) return;

    const body: Record<string, unknown> = { nodeId: binding.nodeId, value };
    if (binding.paramKey) {
      body.paramKey = binding.paramKey;
    }

    const liveKey = binding.paramKey
      ? `${binding.nodeId}:param:${binding.paramKey}`
      : binding.nodeId;

    const portLiveKey = binding.portId && !binding.paramKey
      ? `${binding.nodeId}:${binding.portId}`
      : null;

    writeLockRef.current.set(liveKey, Date.now() + WRITE_LOCK_MS);
    if (portLiveKey) {
      writeLockRef.current.set(portLiveKey, Date.now() + WRITE_LOCK_MS);
    }
    setLiveValues(prev => {
      const next = { ...prev, [liveKey]: value };
      if (portLiveKey) next[portLiveKey] = value;
      return next;
    });

    try {
      await fetch(`${apiBase}/visu/write-value`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Visu-Source': IS_PORT_8098 ? 'port8098' : 'addon'
        },
        body: JSON.stringify(body)
      });
    } catch (err) {
      console.error('write value error:', err);
      writeLockRef.current.delete(liveKey);
      if (portLiveKey) writeLockRef.current.delete(portLiveKey);
    }
  }, [apiBase, visuMode]);

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

  if (!IS_PORT_8098 && addonVisuDisabled) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-center px-8 max-w-md">
          <div className="w-16 h-16 rounded-full bg-blue-950/50 border border-blue-800/50 flex items-center justify-center">
            <Monitor className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg mb-2">Visu laeuft auf Port 8098</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Die Visualisierung ist auf Port 8098 aktiv. Die Addon-Visu (Ingress) ist deaktiviert.
            </p>
            <p className="text-slate-500 text-xs mt-3">
              Um die Addon-Visu zu aktivieren, wechsle im Editor unter "Visu" den Modus auf "Addon (Ingress)".
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isReadOnly = (IS_PORT_8098 && visuMode !== 'port8098') || (!IS_PORT_8098 && visuMode !== 'addon');

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
      {!hideToolbar && (
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
      )}

      {isReadOnly && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/80 border-b border-amber-800/60" style={{ flexShrink: 0 }}>
          <Lock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span className="text-xs text-amber-300">
            {IS_PORT_8098
              ? 'Visu gesperrt – Addon-Modus aktiv. Wechsle im Editor auf "Port 8098" um Eingaben zu erlauben.'
              : 'Visu gesperrt – Port 8098 Modus aktiv. Eingaben sind deaktiviert.'}
          </span>
        </div>
      )}

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
          onWidgetValueChange={isReadOnly ? () => {} : handleWidgetValueChange}
          onEditWidgetProperties={() => {}}
          onNavigateToPage={handleNavigateTo}
          onNavigateBack={handleNavigateBack}
          onNavigateHome={handleNavigateHome}
          onBringToFront={() => {}}
          onBringForward={() => {}}
          onSendBackward={() => {}}
          onSendToBack={() => {}}
        />
      </div>
    </div>
  );
}

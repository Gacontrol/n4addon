import { useState, useEffect, useCallback, useRef } from 'react';
import { VisuCanvas } from './components/visualization/VisuCanvas';
import { VisuPage, VisuWidget } from './types/visualization';
import { FlowNode } from './types/flow';
import { Monitor, ChevronLeft, Home, Maximize2 } from 'lucide-react';

function getApiBase(): string {
  const p = window.location.pathname;
  const m = p.match(/^(\/api\/hassio_ingress\/[^/]+)/) || p.match(/^(\/app\/[^/]+)/);
  if (m) return `${m[1]}/api`;
  return '/api';
}

const POLL_INTERVAL = 1000;
const WRITE_HOLD_MS = 2000;
const WRITE_DEBOUNCE_MS = 300;

export function VisuApp() {
  const [visuPages, setVisuPages] = useState<VisuPage[]>([]);
  const [activePageId, setActivePageId] = useState<string>('');
  const [liveValues, setLiveValues] = useState<Record<string, unknown>>({});
  const [logicNodes, setLogicNodes] = useState<FlowNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pageHistoryRef = useRef<string[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visuPagesRef = useRef<VisuPage[]>([]);
  const pendingWritesRef = useRef<Map<string, { value: unknown; timestamp: number }>>(new Map());
  const lastWriteRef = useRef<Map<string, number>>(new Map());
  const apiBase = getApiBase();

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
        const pending = pendingWritesRef.current;
        for (const [key, entry] of pending.entries()) {
          if (now - entry.timestamp > WRITE_HOLD_MS) {
            pending.delete(key);
          } else {
            data[key] = entry.value;
          }
        }
        setLiveValues(data);
      }
    } catch {}
  }, [apiBase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    pollLiveValues();
    pollRef.current = setInterval(pollLiveValues, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pollLiveValues]);

  const handleWidgetValueChange = useCallback(async (widgetId: string, value: unknown) => {
    const now = Date.now();
    const lastWrite = lastWriteRef.current.get(widgetId) || 0;
    if (now - lastWrite < WRITE_DEBOUNCE_MS) {
      console.log('[VisuApp] handleWidgetValueChange DEBOUNCED:', widgetId, value);
      return;
    }
    lastWriteRef.current.set(widgetId, now);

    console.log('[VisuApp] handleWidgetValueChange called:', widgetId, value);
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
      console.log('[VisuApp] No binding found for widget:', widgetId);
      return;
    }

    const pending = pendingWritesRef.current;
    pending.set(binding.nodeId, { value, timestamp: now });
    if (binding.portId) {
      pending.set(`${binding.nodeId}:${binding.portId}`, { value, timestamp: now });
    }

    setLiveValues(prev => {
      const updates: Record<string, unknown> = { [binding!.nodeId]: value };
      if (binding!.portId) {
        updates[`${binding!.nodeId}:${binding!.portId}`] = value;
      }
      return { ...prev, ...updates };
    });

    console.log('[VisuApp] Sending to API:', apiBase, binding, value);
    try {
      const response = await fetch(`${apiBase}/visu/write-value`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: binding.nodeId,
          portId: binding.portId,
          value
        })
      });
      const result = await response.json();
      console.log('[VisuApp] API response:', response.status, result);
      if (response.ok) {
        pendingWritesRef.current.delete(binding.nodeId);
        if (binding.portId) {
          pendingWritesRef.current.delete(`${binding.nodeId}:${binding.portId}`);
        }
      }
    } catch (err) {
      console.error('[VisuApp] write value error:', err);
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
        />
      </div>
    </div>
  );
}

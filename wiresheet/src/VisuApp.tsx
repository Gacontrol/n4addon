import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { VisuCanvas } from './components/visualization/VisuCanvas';
import { VisuPage, VisuWidget, PageTransitionEffect } from './types/visualization';
import { FlowNode } from './types/flow';
import { AlarmClass, AlarmConsole, ActiveAlarm } from './types/alarm';
import { Monitor } from 'lucide-react';

function getTransitionStyles(effect: PageTransitionEffect, phase: 'enter' | 'exit', durationMs: number): React.CSSProperties {
  const d = `${durationMs}ms`;
  const base: React.CSSProperties = { transition: `all ${d} ease-in-out`, position: 'absolute', inset: 0, width: '100%', height: '100%' };
  if (effect === 'none') return base;
  if (effect === 'fade') {
    return { ...base, opacity: phase === 'enter' ? 1 : 0 };
  }
  if (effect === 'slide-left') {
    return { ...base, transform: phase === 'enter' ? 'translateX(0)' : 'translateX(-100%)' };
  }
  if (effect === 'slide-right') {
    return { ...base, transform: phase === 'enter' ? 'translateX(0)' : 'translateX(100%)' };
  }
  if (effect === 'slide-up') {
    return { ...base, transform: phase === 'enter' ? 'translateY(0)' : 'translateY(-100%)' };
  }
  if (effect === 'slide-down') {
    return { ...base, transform: phase === 'enter' ? 'translateY(0)' : 'translateY(100%)' };
  }
  if (effect === 'zoom-in') {
    return { ...base, transform: phase === 'enter' ? 'scale(1)' : 'scale(0.8)', opacity: phase === 'enter' ? 1 : 0 };
  }
  if (effect === 'zoom-out') {
    return { ...base, transform: phase === 'enter' ? 'scale(1)' : 'scale(1.2)', opacity: phase === 'enter' ? 1 : 0 };
  }
  if (effect === 'flip') {
    return { ...base, transform: phase === 'enter' ? 'rotateY(0deg)' : 'rotateY(90deg)', opacity: phase === 'enter' ? 1 : 0, transformOrigin: 'center' };
  }
  return base;
}

function getInitialTransitionStyles(effect: PageTransitionEffect, durationMs: number): React.CSSProperties {
  const d = `${durationMs}ms`;
  const base: React.CSSProperties = { transition: `all ${d} ease-in-out`, position: 'absolute', inset: 0, width: '100%', height: '100%' };
  if (effect === 'none') return base;
  if (effect === 'fade') return { ...base, opacity: 0 };
  if (effect === 'slide-left') return { ...base, transform: 'translateX(100%)' };
  if (effect === 'slide-right') return { ...base, transform: 'translateX(-100%)' };
  if (effect === 'slide-up') return { ...base, transform: 'translateY(100%)' };
  if (effect === 'slide-down') return { ...base, transform: 'translateY(-100%)' };
  if (effect === 'zoom-in') return { ...base, transform: 'scale(1.2)', opacity: 0 };
  if (effect === 'zoom-out') return { ...base, transform: 'scale(0.8)', opacity: 0 };
  if (effect === 'flip') return { ...base, transform: 'rotateY(-90deg)', opacity: 0, transformOrigin: 'center' };
  return base;
}

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
  const [transitioning, setTransitioning] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState<'enter' | 'exit'>('enter');
  const [pendingPageId, setPendingPageId] = useState<string | null>(null);
  const [displayedPageId, setDisplayedPageId] = useState<string>('');
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
          setDisplayedPageId(prev => prev || data[0].id);
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

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (!active) return;
      try {
        const res = await fetch(`${apiBase}/visu-poll`);
        if (res.ok) {
          const data = await res.json();
          if (data.liveValues) setLiveValues(data.liveValues);
          if (data.nodeConfigs) applyNodeConfigs(data.nodeConfigs);
          if (data.activeAlarms) setActiveAlarms(data.activeAlarms);
          if (data.alarmClasses) setAlarmClasses(data.alarmClasses);
          if (data.alarmConsoles) setAlarmConsoles(data.alarmConsoles);
        }
      } catch {}
      if (active) timer = setTimeout(poll, 200);
    }

    poll();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
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

  const navigateWithTransition = useCallback((pageId: string) => {
    const pages = visuPagesRef.current;
    const targetPage = pages.find(p => p.id === pageId);
    const effect: PageTransitionEffect = targetPage?.transitionEffect || 'none';
    const duration = targetPage?.transitionDuration ?? 300;

    if (effect === 'none' || transitioning) {
      setActivePageId(pageId);
      setDisplayedPageId(pageId);
      return;
    }

    setTransitioning(true);
    setTransitionPhase('exit');
    setPendingPageId(pageId);

    setTimeout(() => {
      setActivePageId(pageId);
      setDisplayedPageId(pageId);
      setTransitionPhase('enter');
      setTimeout(() => {
        setTransitioning(false);
        setPendingPageId(null);
      }, duration);
    }, duration / 2);
  }, [transitioning]);

  const handleNavigateTo = useCallback((pageId: string) => {
    pageHistoryRef.current = [...pageHistoryRef.current, pageId];
    navigateWithTransition(pageId);
  }, [navigateWithTransition]);

  const handleNavigateBack = useCallback(() => {
    const hist = pageHistoryRef.current;
    if (hist.length > 1) {
      const next = hist.slice(0, -1);
      pageHistoryRef.current = next;
      navigateWithTransition(next[next.length - 1]);
    }
  }, [navigateWithTransition]);

  const handleNavigateHome = useCallback(() => {
    const pages = visuPagesRef.current;
    if (pages.length > 0) {
      pageHistoryRef.current = [pages[0].id];
      navigateWithTransition(pages[0].id);
    }
  }, [navigateWithTransition]);

  const handleAcknowledgeAlarm = useCallback(async (alarmId: string) => {
    try {
      const resp = await fetch(`${apiBase}/alarm/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alarmId })
      });
      if (resp.ok) {
        setActiveAlarms(prev => prev.map(a =>
          a.id === alarmId ? { ...a, state: 'acknowledged', acknowledgedAt: Date.now() } : a
        ));
      }
    } catch (err) {
      console.error('Acknowledge alarm error:', err);
    }
  }, [apiBase]);

  const handleAcknowledgeAll = useCallback(async () => {
    try {
      const resp = await fetch(`${apiBase}/alarm/acknowledge-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (resp.ok) {
        setActiveAlarms(prev => prev.map(a =>
          a.state === 'active' ? { ...a, state: 'acknowledged', acknowledgedAt: Date.now() } : a
        ));
      }
    } catch (err) {
      console.error('Acknowledge all alarms error:', err);
    }
  }, [apiBase]);

  const handleClearAlarm = useCallback(async (alarmId: string) => {
    try {
      const resp = await fetch(`${apiBase}/alarm/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alarmId })
      });
      if (resp.ok) {
        setActiveAlarms(prev => prev.filter(a => a.id !== alarmId));
      }
    } catch (err) {
      console.error('Clear alarm error:', err);
    }
  }, [apiBase]);

  const handleShelveAlarm = useCallback(async (alarmId: string, durationMs: number, reason?: string) => {
    try {
      const resp = await fetch(`${apiBase}/alarm/shelve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alarmId, durationMs, reason })
      });
      if (resp.ok) {
        setActiveAlarms(prev => prev.map(a =>
          a.id === alarmId ? { ...a, shelved: true, shelvedUntil: Date.now() + durationMs } : a
        ));
      }
    } catch (err) {
      console.error('Shelve alarm error:', err);
    }
  }, [apiBase]);

  const activePage = visuPages.find(p => p.id === activePageId) || visuPages[0];
  const displayedPage = visuPages.find(p => p.id === displayedPageId) || activePage;
  const currentEffect: PageTransitionEffect = activePage?.transitionEffect || 'none';
  const currentDuration = activePage?.transitionDuration ?? 300;

  const canvasStyle: React.CSSProperties = transitioning
    ? (transitionPhase === 'exit'
      ? getTransitionStyles(currentEffect, 'exit', currentDuration / 2)
      : getInitialTransitionStyles(currentEffect, currentDuration / 2))
    : { position: 'absolute', inset: 0, width: '100%', height: '100%' };

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
      <div className="flex-1 overflow-hidden relative" style={{ perspective: '1000px' }}>
        <div style={canvasStyle}>
        <VisuCanvas
          page={displayedPage}
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
          onAcknowledgeAll={handleAcknowledgeAll}
          onClearAlarm={handleClearAlarm}
          onShelveAlarm={handleShelveAlarm}
        />
        </div>
      </div>
    </div>
  );
}

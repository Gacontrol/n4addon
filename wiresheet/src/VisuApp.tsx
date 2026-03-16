import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { VisuCanvas } from './components/visualization/VisuCanvas';
import { VisuPage, VisuWidget, PageTransitionEffect } from './types/visualization';
import { FlowNode } from './types/flow';
import { AlarmClass, AlarmConsole, ActiveAlarm } from './types/alarm';
import { Monitor } from 'lucide-react';

const DUAL_LAYER_EFFECTS: PageTransitionEffect[] = ['slide-left', 'slide-right', 'slide-up', 'slide-down', 'cube-left', 'cube-right', 'zoom-in-out', 'zoom-out-in'];

function isDualLayer(effect: PageTransitionEffect): boolean {
  return DUAL_LAYER_EFFECTS.includes(effect);
}

type TransitionLayerRole = 'outgoing' | 'incoming';

function getLayerStyle(
  effect: PageTransitionEffect,
  role: TransitionLayerRole,
  phase: 'exit' | 'enter',
  durationMs: number
): React.CSSProperties {
  const d = `${durationMs}ms`;
  const base: React.CSSProperties = {
    transition: `all ${d} cubic-bezier(0.4,0,0.2,1)`,
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
    willChange: 'transform, opacity',
  };

  if (effect === 'none') return base;

  if (effect === 'fade') {
    if (role === 'outgoing') return { ...base, opacity: phase === 'exit' ? 1 : 0 };
    return { ...base, opacity: phase === 'enter' ? 1 : 0 };
  }

  if (effect === 'slide-left') {
    if (role === 'outgoing') return { ...base, transform: phase === 'exit' ? 'translateX(0)' : 'translateX(-100%)' };
    return { ...base, transform: phase === 'enter' ? 'translateX(0)' : 'translateX(100%)' };
  }
  if (effect === 'slide-right') {
    if (role === 'outgoing') return { ...base, transform: phase === 'exit' ? 'translateX(0)' : 'translateX(100%)' };
    return { ...base, transform: phase === 'enter' ? 'translateX(0)' : 'translateX(-100%)' };
  }
  if (effect === 'slide-up') {
    if (role === 'outgoing') return { ...base, transform: phase === 'exit' ? 'translateY(0)' : 'translateY(-100%)' };
    return { ...base, transform: phase === 'enter' ? 'translateY(0)' : 'translateY(100%)' };
  }
  if (effect === 'slide-down') {
    if (role === 'outgoing') return { ...base, transform: phase === 'exit' ? 'translateY(0)' : 'translateY(100%)' };
    return { ...base, transform: phase === 'enter' ? 'translateY(0)' : 'translateY(-100%)' };
  }

  if (effect === 'zoom-in') {
    if (role === 'outgoing') return { ...base, opacity: phase === 'exit' ? 1 : 0, transform: 'scale(1)' };
    return { ...base, transform: phase === 'enter' ? 'scale(1)' : 'scale(1.15)', opacity: phase === 'enter' ? 1 : 0 };
  }
  if (effect === 'zoom-out') {
    if (role === 'outgoing') return { ...base, opacity: phase === 'exit' ? 1 : 0, transform: 'scale(1)' };
    return { ...base, transform: phase === 'enter' ? 'scale(1)' : 'scale(0.85)', opacity: phase === 'enter' ? 1 : 0 };
  }

  if (effect === 'flip') {
    if (role === 'outgoing') {
      return { ...base, transform: phase === 'exit' ? 'rotateY(0deg)' : 'rotateY(90deg)', opacity: phase === 'exit' ? 1 : 0, transformOrigin: 'center' };
    }
    return { ...base, transform: phase === 'enter' ? 'rotateY(0deg)' : 'rotateY(-90deg)', opacity: phase === 'enter' ? 1 : 0, transformOrigin: 'center' };
  }

  if (effect === 'cube-left') {
    if (role === 'outgoing') {
      return { ...base, transform: phase === 'exit' ? 'translateX(0) rotateY(0deg)' : 'translateX(-50%) rotateY(-90deg)', transformOrigin: 'right center', opacity: 1 };
    }
    return { ...base, transform: phase === 'enter' ? 'translateX(0) rotateY(0deg)' : 'translateX(50%) rotateY(90deg)', transformOrigin: 'left center', opacity: 1 };
  }
  if (effect === 'cube-right') {
    if (role === 'outgoing') {
      return { ...base, transform: phase === 'exit' ? 'translateX(0) rotateY(0deg)' : 'translateX(50%) rotateY(90deg)', transformOrigin: 'left center', opacity: 1 };
    }
    return { ...base, transform: phase === 'enter' ? 'translateX(0) rotateY(0deg)' : 'translateX(-50%) rotateY(-90deg)', transformOrigin: 'right center', opacity: 1 };
  }

  if (effect === 'zoom-in-out') {
    if (role === 'outgoing') {
      return { ...base, transform: phase === 'exit' ? 'scale(1)' : 'scale(0)', opacity: phase === 'exit' ? 1 : 0 };
    }
    return { ...base, transform: phase === 'enter' ? 'scale(1)' : 'scale(2)', opacity: phase === 'enter' ? 1 : 0 };
  }
  if (effect === 'zoom-out-in') {
    if (role === 'outgoing') {
      return { ...base, transform: phase === 'exit' ? 'scale(1)' : 'scale(2)', opacity: phase === 'exit' ? 1 : 0 };
    }
    return { ...base, transform: phase === 'enter' ? 'scale(1)' : 'scale(0)', opacity: phase === 'enter' ? 1 : 0 };
  }

  return base;
}

function getApiBase(): string {
  const p = window.location.pathname;
  const m = p.match(/^(\/api\/hassio_ingress\/[^/]+)/) || p.match(/^(\/app\/[^/]+)/);
  if (m) return `${m[1]}/api`;
  return '/api';
}

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
  const [transitionPhase, setTransitionPhase] = useState<'exit' | 'enter'>('exit');
  const [outgoingPageId, setOutgoingPageId] = useState<string | null>(null);
  const [incomingPageId, setIncomingPageId] = useState<string | null>(null);
  const [displayedPageId, setDisplayedPageId] = useState<string>('');
  const transitionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const displayedPageIdRef = useRef<string>('');
  const pageHistoryRef = useRef<string[]>([]);
  const visuPagesRef = useRef<VisuPage[]>([]);
  const lastWriteRef = useRef<Map<string, { time: number; value: unknown }>>(new Map());
  const logicNodesRef = useRef<FlowNode[]>([]);
  const apiBase = getApiBase();

  visuPagesRef.current = visuPages;
  logicNodesRef.current = logicNodes;
  displayedPageIdRef.current = displayedPageId;

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
    const now = Date.now();
    const last = lastWriteRef.current.get(widgetId);
    if (last && now - last.time < 50 && last.value === value) {
      return;
    }
    lastWriteRef.current.set(widgetId, { time: now, value });

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
      return;
    }

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
      await fetch(`${apiBase}/visu/write-value`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('write value error:', err);
    }
  }, [apiBase]);

  const navigateWithTransition = useCallback((pageId: string) => {
    const pages = visuPagesRef.current;
    const targetPage = pages.find(p => p.id === pageId);
    const effect: PageTransitionEffect = targetPage?.transitionEffect || 'none';
    const duration = targetPage?.transitionDuration ?? 300;

    transitionTimersRef.current.forEach(clearTimeout);
    transitionTimersRef.current = [];

    if (effect === 'none') {
      setActivePageId(pageId);
      setDisplayedPageId(pageId);
      setTransitioning(false);
      setOutgoingPageId(null);
      setIncomingPageId(null);
      return;
    }

    const currentId = displayedPageIdRef.current;
    const dual = isDualLayer(effect);

    if (dual) {
      setOutgoingPageId(currentId);
      setIncomingPageId(pageId);
      setTransitioning(true);
      setTransitionPhase('exit');

      const t1 = setTimeout(() => {
        setTransitionPhase('enter');
        setActivePageId(pageId);
        setDisplayedPageId(pageId);

        const t2 = setTimeout(() => {
          setTransitioning(false);
          setOutgoingPageId(null);
          setIncomingPageId(null);
        }, duration + 50);
        transitionTimersRef.current.push(t2);
      }, 16);
      transitionTimersRef.current.push(t1);
    } else {
      setOutgoingPageId(currentId);
      setIncomingPageId(null);
      setTransitioning(true);
      setTransitionPhase('exit');

      const t1 = setTimeout(() => {
        setActivePageId(pageId);
        setDisplayedPageId(pageId);
        setOutgoingPageId(null);
        setIncomingPageId(pageId);
        setTransitionPhase('enter');

        const t2 = setTimeout(() => {
          setTransitioning(false);
          setIncomingPageId(null);
        }, duration + 50);
        transitionTimersRef.current.push(t2);
      }, duration);
      transitionTimersRef.current.push(t1);
    }
  }, []);

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
  const outgoingPage = outgoingPageId ? visuPages.find(p => p.id === outgoingPageId) : null;
  const incomingPage = incomingPageId ? visuPages.find(p => p.id === incomingPageId) : null;

  const transitionTargetPage = activePage;
  const currentEffect: PageTransitionEffect = transitionTargetPage?.transitionEffect || 'none';
  const currentDuration = transitionTargetPage?.transitionDuration ?? 300;
  const bgTransparent = transitionTargetPage?.transitionBgTransparent ?? false;

  const sharedCanvasProps = {
    liveValues,
    logicNodes,
    isEditMode: false as const,
    selectedWidgetId: null,
    clipboard: null,
    onSelectWidget: () => {},
    onUpdateWidget: () => {},
    onDeleteWidget: () => {},
    onDuplicateWidget: () => {},
    onCopyWidget: () => {},
    onPasteWidget: () => {},
    onWidgetValueChange: handleWidgetValueChange,
    onEditWidgetProperties: () => {},
    onNavigateToPage: handleNavigateTo,
    onNavigateBack: handleNavigateBack,
    onNavigateHome: handleNavigateHome,
    onBringToFront: () => {},
    onBringForward: () => {},
    onSendBackward: () => {},
    onSendToBack: () => {},
    alarmClasses,
    alarmConsoles,
    activeAlarms,
    onAcknowledgeAlarm: handleAcknowledgeAlarm,
    onAcknowledgeAll: handleAcknowledgeAll,
    onClearAlarm: handleClearAlarm,
    onShelveAlarm: handleShelveAlarm,
  };

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

  const dual = isDualLayer(currentEffect);

  const needsPerspective = transitioning && (currentEffect === 'cube-left' || currentEffect === 'cube-right' || currentEffect === 'flip');

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950 overflow-hidden">
      <div
        className="flex-1 overflow-hidden relative"
        style={{
          background: transitioning && bgTransparent ? 'transparent' : undefined,
        }}
      >
        {!transitioning && (
          <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <VisuCanvas page={displayedPage} {...sharedCanvasProps} />
          </div>
        )}

        {transitioning && dual && (
          <div
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              perspective: needsPerspective ? '1200px' : undefined,
            }}
          >
            {outgoingPage && (
              <div
                style={{
                  ...getLayerStyle(currentEffect, 'outgoing', transitionPhase, currentDuration),
                  zIndex: 1,
                  overflow: 'hidden',
                }}
              >
                <VisuCanvas page={outgoingPage} {...sharedCanvasProps} />
              </div>
            )}
            {incomingPage && (
              <div
                style={{
                  ...getLayerStyle(currentEffect, 'incoming', transitionPhase, currentDuration),
                  zIndex: 2,
                  overflow: 'hidden',
                }}
              >
                <VisuCanvas page={incomingPage} {...sharedCanvasProps} />
              </div>
            )}
          </div>
        )}

        {transitioning && !dual && (
          <div
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              perspective: needsPerspective ? '1200px' : undefined,
            }}
          >
            {outgoingPage && transitionPhase === 'exit' && (
              <div
                style={{
                  ...getLayerStyle(currentEffect, 'outgoing', 'exit', currentDuration),
                  zIndex: 1,
                  overflow: 'hidden',
                }}
              >
                <VisuCanvas page={outgoingPage} {...sharedCanvasProps} />
              </div>
            )}
            {incomingPage && transitionPhase === 'enter' && (
              <div
                style={{
                  ...getLayerStyle(currentEffect, 'incoming', 'enter', currentDuration),
                  zIndex: 2,
                  overflow: 'hidden',
                }}
              >
                <VisuCanvas page={incomingPage} {...sharedCanvasProps} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

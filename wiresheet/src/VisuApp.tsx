import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VisuCanvas } from './components/visualization/VisuCanvas';
import { VisuPage, VisuWidget, PageTransitionEffect, migrateBinding } from './types/visualization';
import { FlowNode } from './types/flow';
import { AlarmClass, AlarmConsole, ActiveAlarm } from './types/alarm';
import { Monitor, RotateCcw } from 'lucide-react';

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

function getIngressPrefix(): string {
  const p = window.location.pathname;
  const m = p.match(/^(\/api\/hassio_ingress\/[^/]+)/) || p.match(/^(\/app\/[^/]+)/);
  if (m) return m[1];
  const segments = p.split('/').filter(Boolean);
  if (segments.length >= 2) {
    return '/' + segments[0];
  }
  return '';
}

function getApiBase(): string {
  const override = (window as Record<string, unknown>).__WS_REMOTE_API_BASE__ as string | undefined;
  if (override) return override;
  const prefix = getIngressPrefix();
  return prefix ? `${prefix}/api` : '/api';
}

function getWsBase(): string {
  const wsOverride = (window as Record<string, unknown>).__WS_REMOTE_WS_BASE__ as string | undefined;
  if (wsOverride) return wsOverride;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const prefix = getIngressPrefix();
  return prefix ? `${proto}//${host}${prefix}/ws` : `${proto}//${host}/ws`;
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
  const [pinchZoom, setPinchZoom] = useState(1);
  const [pinchOrigin, setPinchOrigin] = useState({ x: 0, y: 0 });
  const [isPortrait, setIsPortrait] = useState(false);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef(1);
  const transitionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const displayedPageIdRef = useRef<string>('');
  const pageHistoryRef = useRef<string[]>([]);
  const visuPagesRef = useRef<VisuPage[]>([]);
  const lastWriteRef = useRef<Map<string, { time: number; value: unknown }>>(new Map());
  const pendingWritesRef = useRef<Map<string, number>>(new Map());
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

  const applyLiveValues = useCallback((incoming: Record<string, unknown>) => {
    const now = Date.now();
    const pending = pendingWritesRef.current;
    const filtered: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(incoming)) {
      if (key.includes(':cfg:')) {
        filtered[key] = val;
        console.log(`[DEBUG 8098] applyLiveValues cfg key=${key} val=${JSON.stringify(val)}`);
        continue;
      }
      const writeTime = pending.get(key);
      if (writeTime && now - writeTime < 2000) continue;
      filtered[key] = val;
    }
    if (Object.keys(filtered).length > 0) {
      setLiveValues(prev => ({ ...prev, ...filtered }));
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [visuRes, pagesRes, alarmRes, pollRes] = await Promise.all([
        fetch(`${apiBase}/visu-pages`),
        fetch(`${apiBase}/pages`),
        fetch(`${apiBase}/alarm-config`),
        fetch(`${apiBase}/visu-poll`)
      ]);

      if (visuRes.ok) {
        const raw = await visuRes.json();
        const data: VisuPage[] = Array.isArray(raw) ? raw.map((page: VisuPage) => ({
          ...page,
          widgets: page.widgets.map(w => ({
            ...w,
            binding: w.binding && !w.binding.dpKey ? migrateBinding(w.binding as Parameters<typeof migrateBinding>[0]) : w.binding,
            statusBinding: w.statusBinding && !(w.statusBinding as { dpKey?: string }).dpKey ? migrateBinding(w.statusBinding as Parameters<typeof migrateBinding>[0]) : w.statusBinding
          }))
        })) : raw;
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

      if (pollRes.ok) {
        const data = await pollRes.json();
        if (data.liveValues) setLiveValues(prev => ({ ...prev, ...data.liveValues }));
        if (data.nodeConfigs) {
          setLogicNodes(prev => prev.map(n => {
            const cfg = data.nodeConfigs[n.id];
            if (!cfg) return n;
            return { ...n, data: { ...n.data, config: { ...(n.data.config || {}), ...cfg } } };
          }));
        }
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
    const checkOrientation = () => {
      const portrait = window.matchMedia('(orientation: portrait) and (max-width: 768px)').matches;
      setIsPortrait(portrait);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    const mq = window.matchMedia('(orientation: portrait) and (max-width: 768px)');
    mq.addEventListener('change', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      mq.removeEventListener('change', checkOrientation);
    };
  }, []);

  const sseActiveRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPoll = useCallback(async (debugTag?: string) => {
    try {
      const res = await fetch(`${apiBase}/visu-poll`);
      if (!res.ok) return;
      const data = await res.json();
      if (debugTag) {
        const cfgKeys = Object.keys(data.liveValues || {}).filter((k: string) => k.includes(':cfg:'));
        const cfgSummary = cfgKeys.map((k: string) => k + '=' + JSON.stringify((data.liveValues as Record<string, unknown>)[k])).join(', ');
        console.log(`[DEBUG 8098] fetchPoll[${debugTag}] cfgKeys=[${cfgSummary}]`);
        console.log(`[DEBUG 8098] fetchPoll[${debugTag}] nodeConfigsNodeIds=${JSON.stringify(Object.keys(data.nodeConfigs || {}))}`);
      }
      if (data.liveValues) applyLiveValues(data.liveValues);
      if (data.nodeConfigs) applyNodeConfigs(data.nodeConfigs);
    } catch {}
  }, [apiBase, applyLiveValues, applyNodeConfigs]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;
    sseActiveRef.current = false;
    const wsBase = getWsBase();

    function startFallbackPoll() {
      if (pollIntervalRef.current) return;
      pollIntervalRef.current = setInterval(fetchPoll, 1000);
    }

    function stopFallbackPoll() {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }

    function connect() {
      if (!active) return;
      ws = new WebSocket(wsBase);

      ws.onmessage = (e: MessageEvent) => {
        try {
          const msg = JSON.parse(e.data);
          const { event, data } = msg;
          if (event === 'state') {
            if (data.liveValues) applyLiveValues(data.liveValues);
            if (data.nodeConfigs) applyNodeConfigs(data.nodeConfigs);
            if (!sseActiveRef.current) {
              sseActiveRef.current = true;
              stopFallbackPoll();
            }
          } else if (event === 'alarms') {
            if (data.activeAlarms) setActiveAlarms(data.activeAlarms);
            if (data.alarmClasses) setAlarmClasses(data.alarmClasses);
            if (data.alarmConsoles) setAlarmConsoles(data.alarmConsoles);
          }
        } catch {}
      };

      ws.onerror = () => {
        sseActiveRef.current = false;
        startFallbackPoll();
      };

      ws.onclose = () => {
        sseActiveRef.current = false;
        startFallbackPoll();
        if (active) reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onopen = () => {
        sseActiveRef.current = true;
        stopFallbackPoll();
      };
    }

    connect();

    setTimeout(() => {
      if (active && !sseActiveRef.current) {
        startFallbackPoll();
      }
    }, 3000);

    return () => {
      active = false;
      sseActiveRef.current = false;
      ws?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [apiBase, applyNodeConfigs, fetchPoll]);

  const handleWidgetValueChange = useCallback(async (dpKey: string, value: unknown) => {
    if (!dpKey) return;

    const now = Date.now();
    const last = lastWriteRef.current.get(dpKey);
    console.log(`[DEBUG 8098] handleWidgetValueChange dpKey='${dpKey}' value=${JSON.stringify(value)} | dt=${last ? now - last.time : 'n/a'}ms | lastVal=${JSON.stringify(last?.value)}`);
    if (last && now - last.time < 50 && last.value === value) {
      console.warn(`[DEBUG 8098] THROTTLE BLOCK dpKey='${dpKey}'`);
      return;
    }
    lastWriteRef.current.set(dpKey, { time: now, value });

    pendingWritesRef.current.set(dpKey, Date.now());
    setLiveValues(prev => ({ ...prev, [dpKey]: value }));
    setTimeout(() => pendingWritesRef.current.delete(dpKey), 2000);

    const url = `${apiBase}/visu/write-value`;
    console.log(`[DEBUG 8098] fetch -> POST ${url}`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dpKey, value })
      });
      const json = await res.json().catch(() => null);
      console.log(`[DEBUG 8098] fetch response status=${res.status} ok=${res.ok} body=${JSON.stringify(json)}`);
      if (res.ok && dpKey.includes(':cfg:')) {
        setTimeout(() => fetchPoll('afterCfgWrite'), 300);
      }
    } catch (err) {
      console.error('[DEBUG 8098] fetch FEHLER:', err);
    }
  }, [apiBase, fetchPoll]);

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

  const containerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDistRef.current = Math.sqrt(dx * dx + dy * dy);
        pinchStartZoomRef.current = pinchZoom;
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        setPinchOrigin({ x: cx, y: cy });
      } else if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          setPinchZoom(1);
          setPinchOrigin({ x: 0, y: 0 });
        }
        lastTapRef.current = now;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const scale = dist / pinchStartDistRef.current;
        const newZoom = Math.min(4, Math.max(0.5, pinchStartZoomRef.current * scale));
        setPinchZoom(newZoom);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchStartDistRef.current = null;
        if (pinchZoom < 0.75) {
          setPinchZoom(1);
        }
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [pinchZoom]);

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

  if (isPortrait) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950">
        <style>{`
          @keyframes rotate-hint {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(0deg); }
            50% { transform: rotate(-90deg); }
            75% { transform: rotate(-90deg); }
          }
          @keyframes pulse-ring {
            0%, 100% { opacity: 0.15; transform: scale(1); }
            50% { opacity: 0.3; transform: scale(1.15); }
          }
        `}</style>
        <div className="relative flex items-center justify-center mb-8">
          <div style={{
            position: 'absolute',
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'rgba(59,130,246,0.12)',
            animation: 'pulse-ring 2.5s ease-in-out infinite',
          }} />
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(59,130,246,0.1)',
            border: '1.5px solid rgba(59,130,246,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <RotateCcw style={{
              width: 36,
              height: 36,
              color: '#60a5fa',
              animation: 'rotate-hint 2.5s ease-in-out infinite',
            }} />
          </div>
        </div>
        <div className="text-center px-10">
          <p className="text-white text-xl font-semibold mb-3">Bitte Gerat drehen</p>
          <p className="text-slate-400 text-sm leading-relaxed">
            Drehen Sie Ihr Gerat in die<br />
            <span className="text-blue-400 font-medium">Querausrichtung</span>, um die<br />
            Visualisierung zu verwenden.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex flex-col bg-slate-950 overflow-hidden"
      style={{ touchAction: 'none' }}
    >
      <div
        className="flex-1 relative"
        style={{
          overflow: pinchZoom !== 1 ? 'visible' : 'hidden',
          background: transitioning && bgTransparent ? 'transparent' : undefined,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            transform: pinchZoom !== 1 ? `scale(${pinchZoom})` : undefined,
            transformOrigin: pinchZoom !== 1 ? `${pinchOrigin.x}px ${pinchOrigin.y}px` : undefined,
            transition: pinchStartDistRef.current === null && pinchZoom === 1 ? 'transform 0.3s ease' : undefined,
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
    </div>
  );
}

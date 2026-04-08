import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CreditCard as Edit3, Eye, Grid2x2 as Grid, Plus, Trash2, Settings, Layers, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, FolderOpen, ExternalLink, AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter } from 'lucide-react';
import { VisuPage, VisuWidget, WidgetTemplate, PolylineConfig, LineConfig, PolygonConfig } from '../../types/visualization';
import { FlowNode, HaInstance } from '../../types/flow';
import { AlarmClass, AlarmConsole, ActiveAlarm } from '../../types/alarm';
import { VisuCanvas } from './VisuCanvas';
import { WidgetPalette, CustomBlockEntry } from './WidgetPalette';
import { WidgetPropertiesPanel, TrackedTrend } from './WidgetPropertiesPanel';
import { FileManager } from './FileManager';
import { getWidgetTemplate } from '../../data/widgetTemplates';

function getApiBase(): string {
  const p = window.location.pathname;
  const m = p.match(/^(\/api\/hassio_ingress\/[^/]+)/) || p.match(/^(\/app\/[^/]+)/);
  return m ? m[1] : '';
}

function getVisuUrl(): string {
  const ingressMatch = window.location.pathname.match(/^(\/api\/hassio_ingress\/[^/]+)/);
  const appMatch = window.location.pathname.match(/^(\/app\/[^/]+)/);
  if (ingressMatch) return `${window.location.origin}${ingressMatch[1]}/visu`;
  if (appMatch) return `${window.location.origin}${appMatch[1]}/visu`;
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:8101`;
}

interface VisualizationViewProps {
  visuPages: VisuPage[];
  activeVisuPageId: string;
  onSetActiveVisuPage: (pageId: string) => void;
  onAddVisuPage: () => void;
  onDeleteVisuPage: (pageId: string) => void;
  onRenameVisuPage: (pageId: string, name: string) => void;
  onUpdateVisuPage: (pageId: string, updates: Partial<VisuPage>) => void;
  liveValues: Record<string, unknown>;
  logicNodes: FlowNode[];
  logicSheets?: { id: string; name: string; nodeIds: string[] }[];
  customBlocks?: CustomBlockEntry[];
  onWidgetValueChange: (dpKey: string, value: unknown) => void;
  highlightedWidgetId?: string | null;
  alarmClasses?: AlarmClass[];
  alarmConsoles?: AlarmConsole[];
  activeAlarms?: ActiveAlarm[];
  onAcknowledgeAlarm?: (alarmId: string) => void;
  onAcknowledgeAll?: () => void;
  onClearAlarm?: (alarmId: string) => void;
  onShelveAlarm?: (alarmId: string, durationMs: number, reason?: string) => void;
  haInstances?: HaInstance[];
}

export const VisualizationView: React.FC<VisualizationViewProps> = ({
  visuPages,
  activeVisuPageId,
  onSetActiveVisuPage,
  onAddVisuPage,
  onDeleteVisuPage,
  onRenameVisuPage,
  onUpdateVisuPage,
  liveValues,
  logicNodes,
  logicSheets,
  customBlocks = [],
  onWidgetValueChange,
  highlightedWidgetId,
  alarmClasses = [],
  alarmConsoles = [],
  activeAlarms = [],
  onAcknowledgeAlarm,
  onAcknowledgeAll,
  onClearAlarm,
  onShelveAlarm,
  haInstances = []
}) => {
  const CLIPBOARD_KEY = 'visu-clipboard';
  const MULTI_CLIPBOARD_KEY = 'visu-multi-clipboard';

  function readClipboard(): VisuWidget | null {
    try { return JSON.parse(localStorage.getItem(CLIPBOARD_KEY) || 'null'); } catch { return null; }
  }
  function readMultiClipboard(): VisuWidget[] | null {
    try { return JSON.parse(localStorage.getItem(MULTI_CLIPBOARD_KEY) || 'null'); } catch { return null; }
  }

  const [isEditMode, setIsEditMode] = useState(true);
  const [editZoom, setEditZoom] = useState(1);
  const editScrollRef = useRef<HTMLDivElement>(null);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [selectedWidgetIds, setSelectedWidgetIds] = useState<string[]>([]);
  const [showProperties, setShowProperties] = useState(false);
  const [editingPageName, setEditingPageName] = useState<string | null>(null);
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [clipboard, setClipboard] = useState<VisuWidget | null>(readClipboard);
  const [multiClipboard, setMultiClipboard] = useState<VisuWidget[] | null>(readMultiClipboard);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [showFileManager, setShowFileManager] = useState(false);
  const [trackedTrends, setTrackedTrends] = useState<TrackedTrend[]>([]);
  const pageHistoryRef = useRef<string[]>([activeVisuPageId]);

  useEffect(() => {
    const apiBase = getApiBase();
    fetch(`${apiBase}/api/trend-config`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.trackedNodes) {
          setTrackedTrends(data.trackedNodes.filter((n: TrackedTrend & { enabled?: boolean }) => n.enabled !== false));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CLIPBOARD_KEY) setClipboard(readClipboard());
      if (e.key === MULTI_CLIPBOARD_KEY) setMultiClipboard(readMultiClipboard());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const el = editScrollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setEditZoom(z => Math.min(3, Math.max(0.2, z - e.deltaY * 0.001)));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [isEditMode]);

  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) return;
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
    return () => {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
    };
  }, []);

  const handleNavigateToPage = useCallback((pageId: string) => {
    pageHistoryRef.current = [...pageHistoryRef.current, pageId];
    onSetActiveVisuPage(pageId);
  }, [onSetActiveVisuPage]);

  const handleNavigateBack = useCallback(() => {
    const history = pageHistoryRef.current;
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      pageHistoryRef.current = newHistory;
      onSetActiveVisuPage(newHistory[newHistory.length - 1]);
    }
  }, [onSetActiveVisuPage]);

  const handleNavigateHome = useCallback(() => {
    if (visuPages.length > 0) {
      pageHistoryRef.current = [visuPages[0].id];
      onSetActiveVisuPage(visuPages[0].id);
    }
  }, [visuPages, onSetActiveVisuPage]);

  const activePage = visuPages.find(p => p.id === activeVisuPageId) || visuPages[0];

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();

    const customBlockJson = e.dataTransfer.getData('custom-block-entry');
    if (customBlockJson) {
      const block: CustomBlockEntry = JSON.parse(customBlockJson);
      const rawX = (e.clientX - rect.left + el.scrollLeft) / editZoom;
      const rawY = (e.clientY - rect.top + el.scrollTop) / editZoom;
      const gridSize = activePage.gridSize || 10;
      const snappedX = activePage.showGrid ? Math.round(rawX / gridSize) * gridSize : rawX;
      const snappedY = activePage.showGrid ? Math.round(rawY / gridSize) * gridSize : rawY;
      const newWidget: VisuWidget = {
        id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'visu-label',
        position: { x: Math.max(0, snappedX - 60), y: Math.max(0, snappedY - 20) },
        size: { width: 120, height: 40 },
        label: block.name,
        config: { text: block.name, fontSize: 14, color: block.color || '#e879f9', fontWeight: 'bold' },
        style: { showLabel: false, labelPosition: 'top' },
        zIndex: activePage.widgets.length + 1
      };
      onUpdateVisuPage(activePage.id, { widgets: [...activePage.widgets, newWidget] });
      setSelectedWidgetId(newWidget.id);
      setShowProperties(true);
      return;
    }

    const templateJson = e.dataTransfer.getData('widget-template');
    if (!templateJson) return;

    const template: WidgetTemplate = JSON.parse(templateJson);
    const rawX = (e.clientX - rect.left + el.scrollLeft) / editZoom - template.defaultSize.width / 2;
    const rawY = (e.clientY - rect.top + el.scrollTop) / editZoom - template.defaultSize.height / 2;

    const gridSize = activePage.gridSize || 10;
    const snappedX = activePage.showGrid ? Math.round(rawX / gridSize) * gridSize : rawX;
    const snappedY = activePage.showGrid ? Math.round(rawY / gridSize) * gridSize : rawY;

    const newWidget: VisuWidget = {
      id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: template.type,
      position: { x: Math.max(0, snappedX), y: Math.max(0, snappedY) },
      size: { ...template.defaultSize },
      label: template.label,
      config: { ...template.defaultConfig },
      style: { ...template.defaultStyle },
      zIndex: activePage.widgets.length + 1
    };

    onUpdateVisuPage(activePage.id, {
      widgets: [...activePage.widgets, newWidget]
    });

    setSelectedWidgetId(newWidget.id);
    setShowProperties(true);
  }, [activePage, onUpdateVisuPage, editZoom]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleUpdateWidget = useCallback((widgetId: string, updates: Partial<VisuWidget>) => {
    const updatedWidgets = activePage.widgets.map(w =>
      w.id === widgetId ? { ...w, ...updates } : w
    );
    onUpdateVisuPage(activePage.id, { widgets: updatedWidgets });
  }, [activePage, onUpdateVisuPage]);

  const handleDeleteWidget = useCallback((widgetId: string) => {
    const updatedWidgets = activePage.widgets.filter(w => w.id !== widgetId);
    onUpdateVisuPage(activePage.id, { widgets: updatedWidgets });
    setSelectedWidgetId(null);
    setShowProperties(false);
  }, [activePage, onUpdateVisuPage]);

  const handleCopyWidget = useCallback((widgetId: string) => {
    const widget = activePage.widgets.find(w => w.id === widgetId);
    if (widget) {
      setClipboard(widget);
      setMultiClipboard(null);
      localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(widget));
      localStorage.removeItem(MULTI_CLIPBOARD_KEY);
    }
  }, [activePage.widgets]);

  const handleDuplicateWidget = useCallback((widgetId: string) => {
    const widget = activePage.widgets.find(w => w.id === widgetId);
    if (!widget) return;
    const newId = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newWidget: VisuWidget = {
      ...widget,
      id: newId,
      position: { x: widget.position.x + 20, y: widget.position.y + 20 },
      config: widget.type === 'visu-polyline'
        ? { ...(widget.config as PolylineConfig), points: (widget.config as PolylineConfig).points.map(p => ({ ...p })) }
        : { ...widget.config },
      zIndex: activePage.widgets.length + 1
    };
    onUpdateVisuPage(activePage.id, { widgets: [...activePage.widgets, newWidget] });
    setSelectedWidgetId(newId);
  }, [activePage, onUpdateVisuPage]);

  const offsetWidgetConfig = (src: VisuWidget, dx: number, dy: number): VisuWidget['config'] => {
    if (src.type === 'visu-line' || src.type === 'visu-arrow') {
      const lc = src.config as LineConfig;
      return { ...lc, x1: (lc.x1 ?? 0) + dx, y1: (lc.y1 ?? 0) + dy, x2: (lc.x2 ?? 0) + dx, y2: (lc.y2 ?? 0) + dy };
    }
    if (src.type === 'visu-polyline') {
      const pc = src.config as PolylineConfig;
      return { ...pc, points: pc.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
    }
    if (src.type === 'visu-polygon') {
      const pg = src.config as PolygonConfig;
      const pts = pg.points || [];
      return { ...pg, points: pts.map(p => ({ x: p.x + dx, y: p.y + dy })) };
    }
    return { ...src.config };
  };

  const handlePasteWidget = useCallback(() => {
    const freshMulti = readMultiClipboard();
    const freshSingle = readClipboard();
    const dx = 20, dy = 20;
    if (freshMulti !== null && freshMulti.length > 0) {
      const now = Date.now();
      const newWidgets = freshMulti.map((src, i) => ({
        ...src,
        id: `widget-${now + i}-${Math.random().toString(36).substr(2, 9)}`,
        position: { x: src.position.x + dx, y: src.position.y + dy },
        config: offsetWidgetConfig(src, dx, dy),
        zIndex: activePage.widgets.length + 1 + i
      }));
      const updatedClipboard = freshMulti.map((src) => ({
        ...src,
        position: { x: src.position.x + dx, y: src.position.y + dy },
        config: offsetWidgetConfig(src, dx, dy)
      }));
      setMultiClipboard(updatedClipboard);
      localStorage.setItem(MULTI_CLIPBOARD_KEY, JSON.stringify(updatedClipboard));
      localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(updatedClipboard[0]));
      onUpdateVisuPage(activePage.id, { widgets: [...activePage.widgets, ...newWidgets] });
      setSelectedWidgetIds(newWidgets.map(w => w.id));
      setSelectedWidgetId(newWidgets[newWidgets.length - 1].id);
      return;
    }
    const pasteSource = freshSingle;
    if (!pasteSource) return;
    const newId = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newWidget: VisuWidget = {
      ...pasteSource,
      id: newId,
      position: { x: pasteSource.position.x + dx, y: pasteSource.position.y + dy },
      config: offsetWidgetConfig(pasteSource, dx, dy),
      zIndex: activePage.widgets.length + 1
    };
    const updatedSource = { ...pasteSource, position: newWidget.position, config: newWidget.config };
    setClipboard(updatedSource);
    localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(updatedSource));
    onUpdateVisuPage(activePage.id, { widgets: [...activePage.widgets, newWidget] });
    setSelectedWidgetId(newId);
  }, [clipboard, multiClipboard, activePage, onUpdateVisuPage]);

  const handleCopyWidgets = useCallback((widgetIds: string[]) => {
    const widgets = widgetIds.map(id => activePage.widgets.find(w => w.id === id)).filter(Boolean) as VisuWidget[];
    if (widgets.length === 1) {
      setClipboard(widgets[0]);
      setMultiClipboard(null);
      localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(widgets[0]));
      localStorage.removeItem(MULTI_CLIPBOARD_KEY);
    } else if (widgets.length > 1) {
      setMultiClipboard(widgets);
      setClipboard(widgets[0]);
      localStorage.setItem(MULTI_CLIPBOARD_KEY, JSON.stringify(widgets));
      localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(widgets[0]));
    }
  }, [activePage.widgets]);

  const handleDeleteWidgets = useCallback((widgetIds: string[]) => {
    const idSet = new Set(widgetIds);
    const updatedWidgets = activePage.widgets.filter(w => !idSet.has(w.id));
    onUpdateVisuPage(activePage.id, { widgets: updatedWidgets });
    setSelectedWidgetId(null);
    setSelectedWidgetIds([]);
    setShowProperties(false);
  }, [activePage, onUpdateVisuPage]);

  const handleUpdateWidgets = useCallback((updates: { widgetId: string; updates: Partial<VisuWidget> }[]) => {
    const updateMap = new Map(updates.map(u => [u.widgetId, u.updates]));
    const updatedWidgets = activePage.widgets.map(w => {
      const upd = updateMap.get(w.id);
      return upd ? { ...w, ...upd } : w;
    });
    onUpdateVisuPage(activePage.id, { widgets: updatedWidgets });
  }, [activePage, onUpdateVisuPage]);

  const handleWidgetValueChange = useCallback((dpKey: string, value: unknown) => {
    onWidgetValueChange(dpKey, value);
  }, [onWidgetValueChange]);

  const reindexZOrder = (widgets: VisuWidget[]) =>
    widgets.map((w, i) => ({ ...w, zIndex: i + 1 }));

  const handleBringToFront = useCallback((widgetId: string) => {
    const widgets = [...activePage.widgets];
    const idx = widgets.findIndex(w => w.id === widgetId);
    if (idx < 0) return;
    const [item] = widgets.splice(idx, 1);
    widgets.push(item);
    onUpdateVisuPage(activePage.id, { widgets: reindexZOrder(widgets) });
  }, [activePage, onUpdateVisuPage]);

  const handleSendToBack = useCallback((widgetId: string) => {
    const widgets = [...activePage.widgets];
    const idx = widgets.findIndex(w => w.id === widgetId);
    if (idx < 0) return;
    const [item] = widgets.splice(idx, 1);
    widgets.unshift(item);
    onUpdateVisuPage(activePage.id, { widgets: reindexZOrder(widgets) });
  }, [activePage, onUpdateVisuPage]);

  const handleBringForward = useCallback((widgetId: string) => {
    const widgets = [...activePage.widgets];
    const idx = widgets.findIndex(w => w.id === widgetId);
    if (idx < 0 || idx === widgets.length - 1) return;
    [widgets[idx], widgets[idx + 1]] = [widgets[idx + 1], widgets[idx]];
    onUpdateVisuPage(activePage.id, { widgets: reindexZOrder(widgets) });
  }, [activePage, onUpdateVisuPage]);

  const handleSendBackward = useCallback((widgetId: string) => {
    const widgets = [...activePage.widgets];
    const idx = widgets.findIndex(w => w.id === widgetId);
    if (idx <= 0) return;
    [widgets[idx], widgets[idx - 1]] = [widgets[idx - 1], widgets[idx]];
    onUpdateVisuPage(activePage.id, { widgets: reindexZOrder(widgets) });
  }, [activePage, onUpdateVisuPage]);

  const handleLayerDragStart = useRef<number | null>(null);

  const handleLayerDrop = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const widgets = [...activePage.widgets];
    const [item] = widgets.splice(fromIdx, 1);
    widgets.splice(toIdx, 0, item);
    onUpdateVisuPage(activePage.id, { widgets: reindexZOrder(widgets) });
  }, [activePage, onUpdateVisuPage]);

  const sortedWidgets = [...activePage.widgets].sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));

  const getWidgetBounds = (w: VisuWidget): { left: number; top: number; right: number; bottom: number } => {
    if ((w.type === 'visu-line' || w.type === 'visu-arrow')) {
      const cfg = w.config as { x1?: number; y1?: number; x2?: number; y2?: number };
      if (cfg.x1 !== undefined && cfg.y1 !== undefined && cfg.x2 !== undefined && cfg.y2 !== undefined) {
        return {
          left: Math.min(cfg.x1, cfg.x2),
          top: Math.min(cfg.y1, cfg.y2),
          right: Math.max(cfg.x1, cfg.x2),
          bottom: Math.max(cfg.y1, cfg.y2)
        };
      }
    }
    if (w.type === 'visu-polyline' || w.type === 'visu-polygon') {
      const cfg = w.config as { points?: { x: number; y: number }[] };
      if (cfg.points && cfg.points.length > 0) {
        const xs = cfg.points.map(p => p.x);
        const ys = cfg.points.map(p => p.y);
        return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
      }
    }
    return { left: w.position.x, top: w.position.y, right: w.position.x + w.size.width, bottom: w.position.y + w.size.height };
  };

  const buildLineUpdate = (w: VisuWidget, dx: number, dy: number): Partial<VisuWidget> => {
    if ((w.type === 'visu-line' || w.type === 'visu-arrow')) {
      const cfg = w.config as { x1?: number; y1?: number; x2?: number; y2?: number };
      if (cfg.x1 !== undefined && cfg.y1 !== undefined && cfg.x2 !== undefined && cfg.y2 !== undefined) {
        const nx1 = cfg.x1 + dx, ny1 = cfg.y1 + dy, nx2 = cfg.x2 + dx, ny2 = cfg.y2 + dy;
        return {
          config: { ...w.config, x1: nx1, y1: ny1, x2: nx2, y2: ny2 },
          position: { x: Math.min(nx1, nx2), y: Math.min(ny1, ny2) },
          size: { width: Math.max(Math.abs(nx2 - nx1), 1), height: Math.max(Math.abs(ny2 - ny1), 1) }
        };
      }
    }
    if (w.type === 'visu-polyline' || w.type === 'visu-polygon') {
      const cfg = w.config as { points?: { x: number; y: number }[] };
      if (cfg.points) {
        const newPts = cfg.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
        const xs = newPts.map(p => p.x), ys = newPts.map(p => p.y);
        return {
          config: { ...w.config, points: newPts },
          position: { x: Math.min(...xs), y: Math.min(...ys) },
          size: { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
        };
      }
    }
    return { position: { x: w.position.x + dx, y: w.position.y + dy } };
  };

  const handleAlignWidgets = useCallback((alignment: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => {
    if (selectedWidgetIds.length < 2) return;
    const widgets = selectedWidgetIds.map(id => activePage.widgets.find(w => w.id === id)).filter(Boolean) as VisuWidget[];
    let updates: { widgetId: string; updates: Partial<VisuWidget> }[] = [];

    if (alignment === 'left') {
      const target = Math.min(...widgets.map(w => getWidgetBounds(w).left));
      updates = widgets.map(w => {
        const b = getWidgetBounds(w);
        return { widgetId: w.id, updates: buildLineUpdate(w, target - b.left, 0) };
      });
    } else if (alignment === 'right') {
      const target = Math.max(...widgets.map(w => getWidgetBounds(w).right));
      updates = widgets.map(w => {
        const b = getWidgetBounds(w);
        return { widgetId: w.id, updates: buildLineUpdate(w, target - b.right, 0) };
      });
    } else if (alignment === 'center-h') {
      const allBounds = widgets.map(w => getWidgetBounds(w));
      const minX = Math.min(...allBounds.map(b => b.left));
      const maxX = Math.max(...allBounds.map(b => b.right));
      const centerX = (minX + maxX) / 2;
      updates = widgets.map(w => {
        const b = getWidgetBounds(w);
        const cx = (b.left + b.right) / 2;
        return { widgetId: w.id, updates: buildLineUpdate(w, centerX - cx, 0) };
      });
    } else if (alignment === 'top') {
      const target = Math.min(...widgets.map(w => getWidgetBounds(w).top));
      updates = widgets.map(w => {
        const b = getWidgetBounds(w);
        return { widgetId: w.id, updates: buildLineUpdate(w, 0, target - b.top) };
      });
    } else if (alignment === 'bottom') {
      const target = Math.max(...widgets.map(w => getWidgetBounds(w).bottom));
      updates = widgets.map(w => {
        const b = getWidgetBounds(w);
        return { widgetId: w.id, updates: buildLineUpdate(w, 0, target - b.bottom) };
      });
    } else if (alignment === 'center-v') {
      const allBounds = widgets.map(w => getWidgetBounds(w));
      const minY = Math.min(...allBounds.map(b => b.top));
      const maxY = Math.max(...allBounds.map(b => b.bottom));
      const centerY = (minY + maxY) / 2;
      updates = widgets.map(w => {
        const b = getWidgetBounds(w);
        const cy = (b.top + b.bottom) / 2;
        return { widgetId: w.id, updates: buildLineUpdate(w, 0, centerY - cy) };
      });
    }
    handleUpdateWidgets(updates);
  }, [selectedWidgetIds, activePage.widgets, handleUpdateWidgets]);

  const handleDistributeWidgets = useCallback((axis: 'h' | 'v') => {
    if (selectedWidgetIds.length < 3) return;
    const widgets = selectedWidgetIds.map(id => activePage.widgets.find(w => w.id === id)).filter(Boolean) as VisuWidget[];
    if (axis === 'h') {
      const sorted = [...widgets].sort((a, b) => a.position.x - b.position.x);
      const minX = sorted[0].position.x;
      const maxX = sorted[sorted.length - 1].position.x + sorted[sorted.length - 1].size.width;
      const totalWidth = sorted.reduce((s, w) => s + w.size.width, 0);
      const gap = (maxX - minX - totalWidth) / (sorted.length - 1);
      let curX = minX;
      const updates = sorted.map(w => {
        const upd = { widgetId: w.id, updates: { position: { x: Math.round(curX), y: w.position.y } } };
        curX += w.size.width + gap;
        return upd;
      });
      handleUpdateWidgets(updates);
    } else {
      const sorted = [...widgets].sort((a, b) => a.position.y - b.position.y);
      const minY = sorted[0].position.y;
      const maxY = sorted[sorted.length - 1].position.y + sorted[sorted.length - 1].size.height;
      const totalHeight = sorted.reduce((s, w) => s + w.size.height, 0);
      const gap = (maxY - minY - totalHeight) / (sorted.length - 1);
      let curY = minY;
      const updates = sorted.map(w => {
        const upd = { widgetId: w.id, updates: { position: { x: w.position.x, y: Math.round(curY) } } };
        curY += w.size.height + gap;
        return upd;
      });
      handleUpdateWidgets(updates);
    }
  }, [selectedWidgetIds, activePage.widgets, handleUpdateWidgets]);

  const handleSameSizeWidgets = useCallback((dimension: 'width' | 'height' | 'both') => {
    if (selectedWidgetIds.length < 2) return;
    const widgets = selectedWidgetIds.map(id => activePage.widgets.find(w => w.id === id)).filter(Boolean) as VisuWidget[];
    const ref = widgets[0];
    const updates = widgets.slice(1).map(w => ({
      widgetId: w.id,
      updates: {
        size: {
          width: dimension !== 'height' ? ref.size.width : w.size.width,
          height: dimension !== 'width' ? ref.size.height : w.size.height,
        }
      }
    }));
    handleUpdateWidgets(updates);
  }, [selectedWidgetIds, activePage.widgets, handleUpdateWidgets]);

  const selectedWidget = selectedWidgetId
    ? activePage.widgets.find(w => w.id === selectedWidgetId)
    : null;

  return (
    <>
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-900">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            {visuPages.map((page) => (
              <div key={page.id} className="relative">
                {editingPageName === page.id ? (
                  <input
                    type="text"
                    defaultValue={page.name}
                    autoFocus
                    onBlur={(e) => {
                      onRenameVisuPage(page.id, e.target.value);
                      setEditingPageName(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onRenameVisuPage(page.id, e.currentTarget.value);
                        setEditingPageName(null);
                      }
                    }}
                    className="px-3 py-1 bg-slate-700 border border-blue-500 rounded text-sm text-slate-200 w-24"
                  />
                ) : (
                  <button
                    onClick={() => onSetActiveVisuPage(page.id)}
                    onDoubleClick={() => isEditMode && setEditingPageName(page.id)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      page.id === activeVisuPageId
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    {page.name}
                  </button>
                )}
              </div>
            ))}
            {isEditMode && (
              <button
                onClick={onAddVisuPage}
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded"
                title="Neue Seite"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
          {isEditMode && visuPages.length > 1 && (
            <button
              onClick={() => onDeleteVisuPage(activeVisuPageId)}
              className="p-1.5 text-red-400 hover:bg-red-900/30 rounded"
              title="Seite loeschen"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isEditMode && (
            <>
              <button
                onClick={() => setShowLayerPanel(!showLayerPanel)}
                className={`p-2 rounded transition-colors ${showLayerPanel ? 'bg-slate-700 text-slate-200' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                title="Ebenen"
              >
                <Layers className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowFileManager(true)}
                className="p-2 rounded transition-colors text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                title="Datei-Manager"
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => setShowPageSettings(!showPageSettings)}
            className={`p-2 rounded transition-colors ${showPageSettings ? 'bg-slate-700 text-slate-200' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            title="Seiten-Einstellungen"
          >
            <Settings className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setIsEditMode(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                  isEditMode ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Edit3 className="w-4 h-4" />
                Bearbeiten
              </button>
              <button
                onClick={() => {
                  setIsEditMode(false);
                  setSelectedWidgetId(null);
                  setShowProperties(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                  !isEditMode ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="w-4 h-4" />
                Ansicht
              </button>
            </div>
            {isEditMode && (
              <button
                onClick={() => setEditZoom(1)}
                className="px-2 py-1 text-xs rounded bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors min-w-12 text-center"
                title="Zoom zuruecksetzen (Strg+Mausrad zum Zoomen)"
              >
                {Math.round(editZoom * 100)}%
              </button>
            )}
            {!isEditMode && (
              <button
                onClick={() => window.open(getVisuUrl(), '_blank')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white"
                title="Visualisierung in neuem Fenster oeffnen"
              >
                <ExternalLink className="w-4 h-4" />
                Neues Fenster
              </button>
            )}
          </div>
        </div>
      </div>

      {isEditMode && showPageSettings && (
        <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={activePage.showGrid ?? false}
              onChange={(e) => onUpdateVisuPage(activePage.id, { showGrid: e.target.checked })}
              className="rounded"
            />
            <Grid className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400">Raster</span>
          </div>
          {activePage.showGrid && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Groesse:</label>
              <input
                type="number"
                min="5"
                max="50"
                value={activePage.gridSize || 10}
                onChange={(e) => onUpdateVisuPage(activePage.id, { gridSize: parseInt(e.target.value) })}
                className="w-16 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Hintergrund:</label>
            <input
              type="color"
              value={activePage.backgroundColor || '#0f172a'}
              onChange={(e) => onUpdateVisuPage(activePage.id, { backgroundColor: e.target.value })}
              className="w-8 h-6 rounded cursor-pointer"
            />
          </div>
          <div className="w-px h-4 bg-slate-600" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Seitenuebergang:</label>
            <select
              value={activePage.transitionEffect || 'none'}
              onChange={(e) => onUpdateVisuPage(activePage.id, { transitionEffect: e.target.value as VisuPage['transitionEffect'] })}
              className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200"
            >
              <option value="none">Kein</option>
              <option value="fade">Einblenden</option>
              <option value="slide-left">Schieben Links</option>
              <option value="slide-right">Schieben Rechts</option>
              <option value="slide-up">Schieben Oben</option>
              <option value="slide-down">Schieben Unten</option>
              <option value="zoom-in">Zoom Rein</option>
              <option value="zoom-out">Zoom Raus</option>
              <option value="flip">Umdrehen</option>
              <option value="cube-left">Wurfel Links</option>
              <option value="cube-right">Wurfel Rechts</option>
              <option value="zoom-in-out">Zoom In-Out</option>
              <option value="zoom-out-in">Zoom Out-In</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Dauer (ms):</label>
            <input
              type="number"
              min="100"
              max="2000"
              step="100"
              value={activePage.transitionDuration ?? 300}
              onChange={(e) => onUpdateVisuPage(activePage.id, { transitionDuration: parseInt(e.target.value) || 300 })}
              className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Transparenter Hintergrund:</label>
            <input
              type="checkbox"
              checked={activePage.transitionBgTransparent ?? false}
              onChange={(e) => onUpdateVisuPage(activePage.id, { transitionBgTransparent: e.target.checked })}
              className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
            />
          </div>
          <div className="w-px h-4 bg-slate-600" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Breite:</label>
            <input
              type="number"
              min="400"
              max="7680"
              step="10"
              placeholder="Auto"
              value={activePage.canvasWidth || ''}
              onChange={(e) => onUpdateVisuPage(activePage.id, { canvasWidth: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Hoehe:</label>
            <input
              type="number"
              min="300"
              max="4320"
              step="10"
              placeholder="Auto"
              value={activePage.canvasHeight || ''}
              onChange={(e) => onUpdateVisuPage(activePage.id, { canvasHeight: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-20 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500"
            />
          </div>
          <button
            onClick={() => onUpdateVisuPage(activePage.id, { canvasWidth: 1920, canvasHeight: 900 })}
            className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
          >
            1920×900
          </button>
          <button
            onClick={() => onUpdateVisuPage(activePage.id, { canvasWidth: undefined, canvasHeight: undefined })}
            className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
          >
            Auto
          </button>
        </div>
      )}

      {isEditMode && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-700 bg-slate-800/50">
          <span className="text-[10px] text-slate-500 mr-1 flex-shrink-0">
            {selectedWidgetIds.length >= 2 ? `${selectedWidgetIds.length} Widgets:` : 'Ausrichten:'}
          </span>
          <div className="flex items-center gap-0.5">
            <button onClick={() => handleAlignWidgets('left')} disabled={selectedWidgetIds.length < 2} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Links ausrichten"><AlignLeft className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleAlignWidgets('center-h')} disabled={selectedWidgetIds.length < 2} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Horizontal zentrieren"><AlignCenter className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleAlignWidgets('right')} disabled={selectedWidgetIds.length < 2} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Rechts ausrichten"><AlignRight className="w-3.5 h-3.5" /></button>
          </div>
          <div className="w-px h-4 bg-slate-700 mx-0.5" />
          <div className="flex items-center gap-0.5">
            <button onClick={() => handleAlignWidgets('top')} disabled={selectedWidgetIds.length < 2} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Oben ausrichten"><AlignStartVertical className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleAlignWidgets('center-v')} disabled={selectedWidgetIds.length < 2} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Vertikal zentrieren"><AlignCenterVertical className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleAlignWidgets('bottom')} disabled={selectedWidgetIds.length < 2} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Unten ausrichten"><AlignEndVertical className="w-3.5 h-3.5" /></button>
          </div>
          <div className="w-px h-4 bg-slate-700 mx-0.5" />
          <div className="flex items-center gap-0.5">
            <button onClick={() => handleDistributeWidgets('h')} disabled={selectedWidgetIds.length < 3} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Horizontal verteilen"><AlignHorizontalDistributeCenter className="w-3.5 h-3.5" /></button>
            <button onClick={() => handleDistributeWidgets('v')} disabled={selectedWidgetIds.length < 3} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Vertikal verteilen"><AlignVerticalDistributeCenter className="w-3.5 h-3.5" /></button>
          </div>
          <div className="w-px h-4 bg-slate-700 mx-0.5" />
          <div className="flex items-center gap-0.5">
            <button onClick={() => handleSameSizeWidgets('width')} disabled={selectedWidgetIds.length < 2} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-[10px] font-mono" title="Gleiche Breite">W</button>
            <button onClick={() => handleSameSizeWidgets('height')} disabled={selectedWidgetIds.length < 2} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-[10px] font-mono" title="Gleiche Hoehe">H</button>
            <button onClick={() => handleSameSizeWidgets('both')} disabled={selectedWidgetIds.length < 2} className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-[10px] font-mono" title="Gleiche Groesse">W+H</button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {isEditMode ? (
          <>
            <WidgetPalette onDragStart={() => {}} customBlocks={customBlocks} />
            <div
              ref={editScrollRef}
              className="flex-1 relative overflow-auto"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <div style={{ transform: `scale(${editZoom})`, transformOrigin: 'top left', display: 'inline-block' }}>
              <VisuCanvas
                page={activePage}
                liveValues={liveValues}
                logicNodes={logicNodes}
                isEditMode={isEditMode}
                zoom={editZoom}
                selectedWidgetId={selectedWidgetId}
                selectedWidgetIds={selectedWidgetIds}
                clipboard={multiClipboard ? multiClipboard[0] : clipboard}
                onSelectWidget={(id) => {
                  setSelectedWidgetId(id);
                  if (id) {
                    setSelectedWidgetIds([id]);
                    setShowProperties(true);
                  } else {
                    setSelectedWidgetIds([]);
                  }
                }}
                onSelectWidgets={(ids) => {
                  setSelectedWidgetIds(ids);
                  if (ids.length > 0) {
                    setSelectedWidgetId(ids[ids.length - 1]);
                    setShowProperties(ids.length === 1);
                  } else {
                    setSelectedWidgetId(null);
                    setShowProperties(false);
                  }
                }}
                onUpdateWidget={handleUpdateWidget}
                onUpdateWidgets={handleUpdateWidgets}
                onDeleteWidget={handleDeleteWidget}
                onDeleteWidgets={handleDeleteWidgets}
                onDuplicateWidget={handleDuplicateWidget}
                onCopyWidget={handleCopyWidget}
                onCopyWidgets={handleCopyWidgets}
                onPasteWidget={handlePasteWidget}
                onWidgetValueChange={handleWidgetValueChange}
                onEditWidgetProperties={(id) => {
                  setSelectedWidgetId(id);
                  setShowProperties(true);
                }}
                onNavigateToPage={handleNavigateToPage}
                onNavigateBack={handleNavigateBack}
                onNavigateHome={handleNavigateHome}
                onBringToFront={handleBringToFront}
                onSendToBack={handleSendToBack}
                onBringForward={handleBringForward}
                onSendBackward={handleSendBackward}
                highlightedWidgetId={highlightedWidgetId}
                alarmClasses={alarmClasses}
                alarmConsoles={alarmConsoles}
                activeAlarms={activeAlarms}
                onAcknowledgeAlarm={onAcknowledgeAlarm}
                onAcknowledgeAll={onAcknowledgeAll}
                onClearAlarm={onClearAlarm}
                onShelveAlarm={onShelveAlarm}
                logicSheets={logicSheets}
              />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 relative overflow-hidden">
            <VisuCanvas
              page={activePage}
              liveValues={liveValues}
              logicNodes={logicNodes}
              isEditMode={false}
              selectedWidgetId={null}
              selectedWidgetIds={[]}
              clipboard={null}
              onSelectWidget={() => {}}
              onSelectWidgets={() => {}}
              onUpdateWidget={() => {}}
              onUpdateWidgets={() => {}}
              onDeleteWidget={() => {}}
              onDeleteWidgets={() => {}}
              onDuplicateWidget={() => {}}
              onCopyWidget={() => {}}
              onCopyWidgets={() => {}}
              onPasteWidget={() => {}}
              onWidgetValueChange={handleWidgetValueChange}
              onEditWidgetProperties={() => {}}
              onNavigateToPage={handleNavigateToPage}
              onNavigateBack={handleNavigateBack}
              onNavigateHome={handleNavigateHome}
              onBringToFront={() => {}}
              onSendToBack={() => {}}
              onBringForward={() => {}}
              onSendBackward={() => {}}
              alarmClasses={alarmClasses}
              alarmConsoles={alarmConsoles}
              activeAlarms={activeAlarms}
              onAcknowledgeAlarm={onAcknowledgeAlarm}
              onAcknowledgeAll={onAcknowledgeAll}
              onClearAlarm={onClearAlarm}
              onShelveAlarm={onShelveAlarm}
            />
          </div>
        )}

        {isEditMode && showProperties && selectedWidget && (
          <WidgetPropertiesPanel
            widget={selectedWidget}
            availableNodes={logicNodes}
            logicSheets={logicSheets}
            visuPages={visuPages.map(p => ({ id: p.id, name: p.name }))}
            alarmConsoles={alarmConsoles}
            trackedTrends={trackedTrends}
            liveValues={liveValues}
            haInstances={haInstances}
            onUpdate={(updates) => handleUpdateWidget(selectedWidget.id, updates)}
            onDelete={() => handleDeleteWidget(selectedWidget.id)}
            onClose={() => setShowProperties(false)}
          />
        )}

        {isEditMode && showLayerPanel && (
          <div className="w-56 bg-slate-900 border-l border-slate-700 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-slate-700 flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-300 flex-1">Ebenen</h2>
              <span className="text-xs text-slate-500">{activePage.widgets.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {sortedWidgets.map((widget, visIdx) => {
                const realIdx = activePage.widgets.findIndex(w => w.id === widget.id);
                const isSelected = widget.id === selectedWidgetId;
                return (
                  <div
                    key={widget.id}
                    draggable
                    onDragStart={() => { handleLayerDragStart.current = realIdx; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (handleLayerDragStart.current !== null) {
                        handleLayerDrop(handleLayerDragStart.current, realIdx);
                        handleLayerDragStart.current = null;
                      }
                    }}
                    onClick={() => {
                      setSelectedWidgetId(widget.id);
                      setShowProperties(true);
                    }}
                    className={`flex items-center gap-1.5 px-2 py-1.5 mx-1 rounded cursor-pointer transition-colors group ${
                      isSelected
                        ? 'bg-blue-600/30 border border-blue-500/50'
                        : 'hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <span className="text-[10px] text-slate-600 w-4 text-right flex-shrink-0">{widget.zIndex ?? visIdx + 1}</span>
                    <span className={`text-xs truncate flex-1 ${isSelected ? 'text-blue-300' : 'text-slate-400'}`}>
                      {widget.label || widget.type.replace('visu-', '')}
                    </span>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        title="Ganz nach vorne"
                        onClick={(e) => { e.stopPropagation(); handleBringToFront(widget.id); }}
                        className="p-0.5 rounded hover:bg-slate-600 text-slate-400 hover:text-white"
                      >
                        <ChevronsUp className="w-3 h-3" />
                      </button>
                      <button
                        title="Eine Ebene nach vorne"
                        onClick={(e) => { e.stopPropagation(); handleBringForward(widget.id); }}
                        className="p-0.5 rounded hover:bg-slate-600 text-slate-400 hover:text-white"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        title="Eine Ebene nach hinten"
                        onClick={(e) => { e.stopPropagation(); handleSendBackward(widget.id); }}
                        className="p-0.5 rounded hover:bg-slate-600 text-slate-400 hover:text-white"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      <button
                        title="Ganz nach hinten"
                        onClick={(e) => { e.stopPropagation(); handleSendToBack(widget.id); }}
                        className="p-0.5 rounded hover:bg-slate-600 text-slate-400 hover:text-white"
                      >
                        <ChevronsDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {activePage.widgets.length === 0 && (
                <div className="px-3 py-4 text-xs text-slate-600 text-center">Keine Widgets</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>

    {showFileManager && (
      <FileManager
        apiBase={getApiBase()}
        onClose={() => setShowFileManager(false)}
      />
    )}
    </>
  );
};

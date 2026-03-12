import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CreditCard as Edit3, Eye, Grid2x2 as Grid, Plus, Trash2, Settings, Layers, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, FolderOpen } from 'lucide-react';
import { VisuPage, VisuWidget, WidgetTemplate, PolylineConfig } from '../../types/visualization';
import { FlowNode } from '../../types/flow';
import { VisuCanvas } from './VisuCanvas';
import { WidgetPalette } from './WidgetPalette';
import { WidgetPropertiesPanel } from './WidgetPropertiesPanel';
import { FileManager } from './FileManager';
import { getWidgetTemplate } from '../../data/widgetTemplates';

function getApiBase(): string {
  const p = window.location.pathname;
  const m = p.match(/^(\/api\/hassio_ingress\/[^/]+)/) || p.match(/^(\/app\/[^/]+)/);
  return m ? m[1] : '';
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
  onWidgetValueChange: (widgetId: string, binding: { nodeId: string; portId?: string }, value: unknown) => void;
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
  onWidgetValueChange
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
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [selectedWidgetIds, setSelectedWidgetIds] = useState<string[]>([]);
  const [showProperties, setShowProperties] = useState(false);
  const [editingPageName, setEditingPageName] = useState<string | null>(null);
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [clipboard, setClipboard] = useState<VisuWidget | null>(readClipboard);
  const [multiClipboard, setMultiClipboard] = useState<VisuWidget[] | null>(readMultiClipboard);
  const [showLayerPanel, setShowLayerPanel] = useState(false);
  const [showFileManager, setShowFileManager] = useState(false);
  const pageHistoryRef = useRef<string[]>([activeVisuPageId]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CLIPBOARD_KEY) setClipboard(readClipboard());
      if (e.key === MULTI_CLIPBOARD_KEY) setMultiClipboard(readMultiClipboard());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
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
    const templateJson = e.dataTransfer.getData('widget-template');
    if (!templateJson) return;

    const template: WidgetTemplate = JSON.parse(templateJson);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - template.defaultSize.width / 2;
    const y = e.clientY - rect.top - template.defaultSize.height / 2;

    const gridSize = activePage.gridSize || 10;
    const snappedX = activePage.showGrid ? Math.round(x / gridSize) * gridSize : x;
    const snappedY = activePage.showGrid ? Math.round(y / gridSize) * gridSize : y;

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
  }, [activePage, onUpdateVisuPage]);

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

  const handlePasteWidget = useCallback(() => {
    const freshMulti = readMultiClipboard();
    const freshSingle = readClipboard();
    if (freshMulti !== null && freshMulti.length > 0) {
      const now = Date.now();
      const newWidgets = freshMulti.map((src, i) => ({
        ...src,
        id: `widget-${now + i}-${Math.random().toString(36).substr(2, 9)}`,
        position: { x: src.position.x + 20, y: src.position.y + 20 },
        config: src.type === 'visu-polyline'
          ? { ...(src.config as PolylineConfig), points: (src.config as PolylineConfig).points.map(p => ({ ...p })) }
          : { ...src.config },
        zIndex: activePage.widgets.length + 1 + i
      }));
      setMultiClipboard(freshMulti);
      onUpdateVisuPage(activePage.id, { widgets: [...activePage.widgets, ...newWidgets] });
      setSelectedWidgetIds(newWidgets.map(w => w.id));
      setSelectedWidgetId(newWidgets[newWidgets.length - 1].id);
      return;
    }
    const pasteSource = freshSingle;
    if (!pasteSource) return;
    setClipboard(pasteSource);
    const newId = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newWidget: VisuWidget = {
      ...pasteSource,
      id: newId,
      position: { x: pasteSource.position.x + 20, y: pasteSource.position.y + 20 },
      config: pasteSource.type === 'visu-polyline'
        ? { ...(pasteSource.config as PolylineConfig), points: (pasteSource.config as PolylineConfig).points.map(p => ({ ...p })) }
        : { ...pasteSource.config },
      zIndex: activePage.widgets.length + 1
    };
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

  const handleWidgetValueChange = useCallback((widgetId: string, value: unknown) => {
    const widget = activePage.widgets.find(w => w.id === widgetId);
    if (widget?.binding) {
      if (widget.type === 'visu-pump') {
        const pumpValue = value as Record<string, unknown>;
        onWidgetValueChange(widgetId, widget.binding, { pumpControl: pumpValue });
      } else {
        onWidgetValueChange(widgetId, widget.binding, value);
      }
    }
  }, [activePage.widgets, onWidgetValueChange]);

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
                    onDoubleClick={() => setEditingPageName(page.id)}
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
            <button
              onClick={onAddVisuPage}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded"
              title="Neue Seite"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {visuPages.length > 1 && (
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
        </div>
      </div>

      {showPageSettings && (
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

      <div className="flex-1 flex overflow-hidden">
        {isEditMode && (
          <WidgetPalette onDragStart={() => {}} />
        )}

        <div
          className="flex-1 relative overflow-auto"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <VisuCanvas
            page={activePage}
            liveValues={liveValues}
            logicNodes={logicNodes}
            isEditMode={isEditMode}
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
          />
        </div>

        {isEditMode && showProperties && selectedWidget && (
          <WidgetPropertiesPanel
            widget={selectedWidget}
            availableNodes={logicNodes}
            visuPages={visuPages.map(p => ({ id: p.id, name: p.name }))}
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

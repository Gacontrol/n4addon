import React, { useState, useCallback } from 'react';
import { CreditCard as Edit3, Eye, Grid2x2 as Grid, Plus, Trash2, Settings } from 'lucide-react';
import { VisuPage, VisuWidget, WidgetTemplate } from '../../types/visualization';
import { FlowNode } from '../../types/flow';
import { VisuCanvas } from './VisuCanvas';
import { WidgetPalette } from './WidgetPalette';
import { WidgetPropertiesPanel } from './WidgetPropertiesPanel';
import { getWidgetTemplate } from '../../data/widgetTemplates';

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
  const [isEditMode, setIsEditMode] = useState(true);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [showProperties, setShowProperties] = useState(false);
  const [editingPageName, setEditingPageName] = useState<string | null>(null);
  const [showPageSettings, setShowPageSettings] = useState(false);

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

  const handleWidgetValueChange = useCallback((widgetId: string, value: unknown) => {
    const widget = activePage.widgets.find(w => w.id === widgetId);
    if (widget?.binding) {
      onWidgetValueChange(widgetId, widget.binding, value);
    }
  }, [activePage.widgets, onWidgetValueChange]);

  const selectedWidget = selectedWidgetId
    ? activePage.widgets.find(w => w.id === selectedWidgetId)
    : null;

  return (
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
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {isEditMode && (
          <WidgetPalette onDragStart={() => {}} />
        )}

        <div
          className="flex-1 relative overflow-hidden"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <VisuCanvas
            page={activePage}
            liveValues={liveValues}
            isEditMode={isEditMode}
            selectedWidgetId={selectedWidgetId}
            onSelectWidget={(id) => {
              setSelectedWidgetId(id);
              if (id) setShowProperties(true);
            }}
            onUpdateWidget={handleUpdateWidget}
            onDeleteWidget={handleDeleteWidget}
            onWidgetValueChange={handleWidgetValueChange}
            onEditWidgetProperties={(id) => {
              setSelectedWidgetId(id);
              setShowProperties(true);
            }}
          />
        </div>

        {isEditMode && showProperties && selectedWidget && (
          <WidgetPropertiesPanel
            widget={selectedWidget}
            availableNodes={logicNodes}
            onUpdate={(updates) => handleUpdateWidget(selectedWidget.id, updates)}
            onDelete={() => handleDeleteWidget(selectedWidget.id)}
            onClose={() => setShowProperties(false)}
          />
        )}
      </div>
    </div>
  );
};

import { useState, useCallback, useRef, useEffect } from 'react';
import { VisuPage, VisuWidget } from '../types/visualization';

function getApiBase(): string {
  const path = window.location.pathname;
  const match = path.match(/^(\/api\/hassio_ingress\/[^/]+)/);
  if (match) {
    return `${match[1]}/api`;
  }
  const appMatch = path.match(/^(\/app\/[^/]+)/);
  if (appMatch) {
    return `${appMatch[1]}/api`;
  }
  return '/api';
}

const API_BASE = getApiBase();

const defaultVisuPage = (): VisuPage => ({
  id: `visu-page-${Date.now()}`,
  name: 'Visu 1',
  widgets: [],
  backgroundColor: '#0f172a',
  gridSize: 10,
  showGrid: true
});

export const useVisualization = () => {
  const [visuPages, setVisuPages] = useState<VisuPage[]>([defaultVisuPage()]);
  const [activeVisuPageId, setActiveVisuPageId] = useState<string>(visuPages[0].id);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInProgress = useRef(false);

  const loadVisuPages = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/visu-pages`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setVisuPages(data);
          setActiveVisuPageId(data[0].id);
        }
      }
    } catch (err) {
      console.error('loadVisuPages error:', err);
    }
  }, []);

  const saveVisuPages = useCallback(async (updatedPages: VisuPage[]) => {
    setSaveStatus('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (saveInProgress.current) return;
      saveInProgress.current = true;
      try {
        const res = await fetch(`${API_BASE}/visu-pages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedPages)
        });
        if (res.ok) {
          setSaveStatus('saved');
        } else {
          setSaveStatus('error');
        }
      } catch {
        setSaveStatus('error');
      } finally {
        saveInProgress.current = false;
      }
    }, 400);
  }, []);

  useEffect(() => {
    loadVisuPages();
  }, [loadVisuPages]);

  const updateVisuPages = useCallback((updater: (prev: VisuPage[]) => VisuPage[]) => {
    setVisuPages(prev => {
      const next = updater(prev);
      setSaveStatus('unsaved');
      saveVisuPages(next);
      return next;
    });
  }, [saveVisuPages]);

  const addVisuPage = useCallback(() => {
    const newPage = defaultVisuPage();
    newPage.name = `Visu ${visuPages.length + 1}`;
    updateVisuPages(prev => [...prev, newPage]);
    setActiveVisuPageId(newPage.id);
  }, [visuPages.length, updateVisuPages]);

  const deleteVisuPage = useCallback((pageId: string) => {
    if (visuPages.length <= 1) return;
    updateVisuPages(prev => {
      const next = prev.filter(p => p.id !== pageId);
      if (activeVisuPageId === pageId) {
        setActiveVisuPageId(next[0].id);
      }
      return next;
    });
  }, [visuPages.length, activeVisuPageId, updateVisuPages]);

  const renameVisuPage = useCallback((pageId: string, name: string) => {
    updateVisuPages(prev => prev.map(p => p.id === pageId ? { ...p, name } : p));
  }, [updateVisuPages]);

  const updateVisuPage = useCallback((pageId: string, updates: Partial<VisuPage>) => {
    updateVisuPages(prev => prev.map(p => p.id === pageId ? { ...p, ...updates } : p));
  }, [updateVisuPages]);

  const addWidget = useCallback((pageId: string, widget: VisuWidget) => {
    updateVisuPages(prev => prev.map(p => {
      if (p.id !== pageId) return p;
      return { ...p, widgets: [...p.widgets, widget] };
    }));
  }, [updateVisuPages]);

  const updateWidget = useCallback((pageId: string, widgetId: string, updates: Partial<VisuWidget>) => {
    updateVisuPages(prev => prev.map(p => {
      if (p.id !== pageId) return p;
      return {
        ...p,
        widgets: p.widgets.map(w => w.id === widgetId ? { ...w, ...updates } : w)
      };
    }));
  }, [updateVisuPages]);

  const deleteWidget = useCallback((pageId: string, widgetId: string) => {
    updateVisuPages(prev => prev.map(p => {
      if (p.id !== pageId) return p;
      return { ...p, widgets: p.widgets.filter(w => w.id !== widgetId) };
    }));
  }, [updateVisuPages]);

  const setAllVisuPages = useCallback((newPages: VisuPage[]) => {
    const safe = newPages.length > 0 ? newPages : [defaultVisuPage()];
    setVisuPages(safe);
    setActiveVisuPageId(safe[0].id);
    setSaveStatus('unsaved');
    saveVisuPages(safe);
  }, [saveVisuPages]);

  const activeVisuPage = visuPages.find(p => p.id === activeVisuPageId) || visuPages[0];

  return {
    visuPages,
    activeVisuPage,
    activeVisuPageId,
    setActiveVisuPageId,
    addVisuPage,
    deleteVisuPage,
    renameVisuPage,
    updateVisuPage,
    addWidget,
    updateWidget,
    deleteWidget,
    saveStatus,
    loadVisuPages,
    setAllVisuPages
  };
};

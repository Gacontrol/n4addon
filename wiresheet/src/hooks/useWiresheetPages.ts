import { useState, useCallback, useRef, useEffect } from 'react';
import { WiresheetPage, FlowNode, Connection, DatapointOverride } from '../types/flow';

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

const defaultPage = (): WiresheetPage => ({
  id: `page-${Date.now()}`,
  name: 'Seite 1',
  cycleMs: 1000,
  running: false,
  nodes: [],
  connections: []
});

export const useWiresheetPages = () => {
  const [pages, setPages] = useState<WiresheetPage[]>([defaultPage()]);
  const [activePageId, setActivePageId] = useState<string>(pages[0].id);
  const [liveValues, setLiveValues] = useState<Record<string, unknown>>({});
  const [haEntities, setHaEntities] = useState<Array<{ entity_id: string; state: string; attributes: Record<string, unknown> }>>([]);
  const [haLoading, setHaLoading] = useState(false);
  const [haError, setHaError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [loadError, setLoadError] = useState<string | null>(null);
  const cycleTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInProgress = useRef(false);
  const pagesRef = useRef<WiresheetPage[]>(pages);

  const activePage = pages.find(p => p.id === activePageId) || pages[0];

  const loadPages = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`${API_BASE}/pages`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setPages(data);
          setActivePageId(data[0].id);
        }
      } else {
        const text = await res.text().catch(() => `HTTP ${res.status}`);
        console.error('loadPages failed:', res.status, text);
        setLoadError(`Laden fehlgeschlagen (${res.status})`);
      }
    } catch (err) {
      console.error('loadPages error:', err);
      setLoadError(`Verbindung fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  const savePages = useCallback(async (updatedPages: WiresheetPage[]) => {
    setSaveStatus('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (saveInProgress.current) return;
      saveInProgress.current = true;
      try {
        const res = await fetch(`${API_BASE}/pages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedPages)
        });
        if (res.ok) {
          setSaveStatus('saved');
        } else {
          const text = await res.text().catch(() => `HTTP ${res.status}`);
          console.error('Save failed:', res.status, text);
          setSaveStatus('error');
        }
      } catch (err) {
        console.error('Save error:', err);
        setSaveStatus('error');
      } finally {
        saveInProgress.current = false;
      }
    }, 400);
  }, []);

  const loadHaEntities = useCallback(async () => {
    setHaLoading(true);
    setHaError(null);
    try {
      const res = await fetch(`${API_BASE}/ha/states`);
      const text = await res.text();
      if (res.ok) {
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            setHaEntities(data.sort((a, b) => a.entity_id.localeCompare(b.entity_id)));
          } else {
            setHaError('Ungueltige Antwort vom Server');
          }
        } catch {
          console.error('JSON parse error:', text.substring(0, 200));
          setHaError('Server-Antwort ist kein gueltiges JSON');
        }
      } else {
        let msg = `HTTP ${res.status}`;
        try {
          const body = JSON.parse(text);
          msg = body?.error || body?.details || msg;
        } catch {
          msg = text.substring(0, 100) || msg;
        }
        console.error('loadHaEntities failed:', res.status, msg);
        setHaError(msg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('loadHaEntities error:', msg);
      setHaError(`Verbindung fehlgeschlagen: ${msg}`);
    } finally {
      setHaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPages();
    loadHaEntities();
  }, [loadPages, loadHaEntities]);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const updatePages = useCallback((updater: (prev: WiresheetPage[]) => WiresheetPage[]) => {
    setPages(prev => {
      const next = updater(prev);
      setSaveStatus('unsaved');
      savePages(next);
      return next;
    });
  }, [savePages]);

  const updateActivePage = useCallback((updater: (page: WiresheetPage) => WiresheetPage) => {
    updatePages(prev => prev.map(p => p.id === activePageId ? updater(p) : p));
  }, [activePageId, updatePages]);

  const addPage = useCallback(() => {
    const newPage = defaultPage();
    newPage.id = `page-${Date.now()}`;
    newPage.name = `Seite ${pages.length + 1}`;
    updatePages(prev => [...prev, newPage]);
    setActivePageId(newPage.id);
  }, [pages.length, updatePages]);

  const deletePage = useCallback((pageId: string) => {
    if (pages.length <= 1) return;
    if (cycleTimers.current[pageId]) {
      clearInterval(cycleTimers.current[pageId]);
      delete cycleTimers.current[pageId];
    }
    updatePages(prev => {
      const next = prev.filter(p => p.id !== pageId);
      if (activePageId === pageId) setActivePageId(next[0].id);
      return next;
    });
  }, [pages.length, activePageId, updatePages]);

  const renamePage = useCallback((pageId: string, name: string) => {
    updatePages(prev => prev.map(p => p.id === pageId ? { ...p, name } : p));
  }, [updatePages]);

  const setCycleTime = useCallback((pageId: string, ms: number) => {
    updatePages(prev => prev.map(p => p.id === pageId ? { ...p, cycleMs: ms } : p));
    const page = pages.find(p => p.id === pageId);
    if (page?.running) {
      if (cycleTimers.current[pageId]) clearInterval(cycleTimers.current[pageId]);
      cycleTimers.current[pageId] = setInterval(() => executePage(pageId), ms);
    }
  }, [pages, updatePages]);

  const executePage = useCallback(async (pageId: string) => {
    const page = pagesRef.current.find(p => p.id === pageId);
    if (!page) return;

    const manualOverrides: Record<string, unknown> = {};
    for (const node of page.nodes) {
      if (node.data.override?.manual) {
        manualOverrides[node.id] = node.data.override.value;
      }
    }

    try {
      const res = await fetch(`${API_BASE}/pages/${pageId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: page.nodes, connections: page.connections, manualOverrides })
      });
      if (res.ok) {
        const { nodeValues } = await res.json();
        setLiveValues(prev => ({ ...prev, ...nodeValues }));
      }
    } catch {
      // silent
    }
  }, []);

  const startPage = useCallback((pageId: string) => {
    updatePages(prev => prev.map(p => p.id === pageId ? { ...p, running: true } : p));
    const page = pagesRef.current.find(p => p.id === pageId);
    if (!page) return;
    if (cycleTimers.current[pageId]) clearInterval(cycleTimers.current[pageId]);
    executePage(pageId);
    cycleTimers.current[pageId] = setInterval(() => executePage(pageId), page.cycleMs);
  }, [updatePages, executePage]);

  const stopPage = useCallback((pageId: string) => {
    updatePages(prev => prev.map(p => p.id === pageId ? { ...p, running: false } : p));
    if (cycleTimers.current[pageId]) {
      clearInterval(cycleTimers.current[pageId]);
      delete cycleTimers.current[pageId];
    }
  }, [updatePages]);

  useEffect(() => {
    return () => {
      Object.values(cycleTimers.current).forEach(clearInterval);
    };
  }, []);

  const addNode = useCallback((node: FlowNode) => {
    updateActivePage(p => ({ ...p, nodes: [...p.nodes, node] }));
  }, [updateActivePage]);

  const updateNodePosition = useCallback((nodeId: string, x: number, y: number) => {
    updateActivePage(p => ({
      ...p,
      nodes: p.nodes.map(n => n.id === nodeId ? { ...n, position: { x, y } } : n)
    }));
  }, [updateActivePage]);

  const updateNodeData = useCallback((nodeId: string, updates: Partial<FlowNode['data']>) => {
    updateActivePage(p => ({
      ...p,
      nodes: p.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n)
    }));
  }, [updateActivePage]);

  const deleteNode = useCallback((nodeId: string) => {
    updateActivePage(p => ({
      ...p,
      nodes: p.nodes.filter(n => n.id !== nodeId),
      connections: p.connections.filter(c => c.source !== nodeId && c.target !== nodeId)
    }));
  }, [updateActivePage]);

  const addConnection = useCallback((connection: Connection) => {
    updateActivePage(p => {
      const exists = p.connections.some(
        c => c.source === connection.source && c.sourcePort === connection.sourcePort &&
             c.target === connection.target && c.targetPort === connection.targetPort
      );
      if (exists) return p;
      return { ...p, connections: [...p.connections, connection] };
    });
  }, [updateActivePage]);

  const deleteConnection = useCallback((connectionId: string) => {
    updateActivePage(p => ({ ...p, connections: p.connections.filter(c => c.id !== connectionId) }));
  }, [updateActivePage]);

  const updateNodeOverride = useCallback((nodeId: string, override: DatapointOverride) => {
    updateActivePage(p => ({
      ...p,
      nodes: p.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, override } } : n)
    }));
  }, [updateActivePage]);

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; portId: string } | null>(null);

  const startConnection = useCallback((nodeId: string, portId: string) => {
    setConnectingFrom({ nodeId, portId });
  }, []);

  const endConnection = useCallback((nodeId: string, portId: string) => {
    if (connectingFrom && connectingFrom.nodeId !== nodeId) {
      const connection: Connection = {
        id: `${connectingFrom.nodeId}-${connectingFrom.portId}-${nodeId}-${portId}`,
        source: connectingFrom.nodeId,
        sourcePort: connectingFrom.portId,
        target: nodeId,
        targetPort: portId
      };
      addConnection(connection);
    }
    setConnectingFrom(null);
  }, [connectingFrom, addConnection]);

  const cancelConnection = useCallback(() => setConnectingFrom(null), []);

  return {
    pages,
    activePage,
    activePageId,
    setActivePageId,
    addPage,
    deletePage,
    renamePage,
    setCycleTime,
    startPage,
    stopPage,
    liveValues,
    haEntities,
    haLoading,
    haError,
    loadHaEntities,
    saveStatus,
    loadError,
    loadPages,
    nodes: activePage.nodes,
    connections: activePage.connections,
    selectedNode,
    connectingFrom,
    addNode,
    updateNodePosition,
    updateNodeData,
    deleteNode,
    addConnection,
    deleteConnection,
    updateNodeOverride,
    startConnection,
    endConnection,
    cancelConnection,
    setSelectedNode
  };
};

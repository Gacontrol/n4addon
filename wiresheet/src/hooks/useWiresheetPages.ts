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
  const localCycleTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInProgress = useRef(false);
  const pagesRef = useRef<WiresheetPage[]>(pages);
  const visuOverridesRef = useRef<Record<string, unknown>>({});

  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<{ nodes: FlowNode[]; connections: Connection[] } | null>(null);

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

          for (const page of data) {
            if (page.running) {
              if (localCycleTimers.current[page.id]) {
                clearInterval(localCycleTimers.current[page.id]);
              }
              const interval = Math.max(200, page.cycleMs || 1000);
              localCycleTimers.current[page.id] = setInterval(() => {
                const currentPage = pagesRef.current.find(p => p.id === page.id);
                if (!currentPage) return;

                const manualOverrides: Record<string, unknown> = {};
                for (const node of currentPage.nodes) {
                  if (node.data.override?.manual) {
                    manualOverrides[node.id] = node.data.override.value;
                  }
                }

                const visuOverrides = { ...visuOverridesRef.current };
                fetch(`${API_BASE}/pages/${page.id}/execute`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ nodes: currentPage.nodes, connections: currentPage.connections, manualOverrides, visuOverrides })
                })
                  .then(r => r.ok ? r.json() : null)
                  .then(result => {
                    if (result?.nodeValues) {
                      setLiveValues(prev => ({ ...prev, ...result.nodeValues, ...visuOverridesRef.current }));
                    }
                  })
                  .catch(() => {});
              }, interval);
            }
          }
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
    if (localCycleTimers.current[pageId]) {
      clearInterval(localCycleTimers.current[pageId]);
      delete localCycleTimers.current[pageId];
    }
    fetch(`${API_BASE}/pages/${pageId}/stop`, { method: 'POST' }).catch(() => {});
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
    const clampedMs = Math.max(20, ms);
    updatePages(prev => prev.map(p => p.id === pageId ? { ...p, cycleMs: clampedMs } : p));

    const page = pages.find(p => p.id === pageId);
    if (page?.running) {
      fetch(`${API_BASE}/pages/${pageId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycleMs: clampedMs })
      }).catch(() => {});
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

    const visuOverrides = { ...visuOverridesRef.current };

    try {
      const res = await fetch(`${API_BASE}/pages/${pageId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: page.nodes, connections: page.connections, manualOverrides, visuOverrides })
      });
      if (res.ok) {
        const { nodeValues } = await res.json();
        setLiveValues(prev => ({ ...prev, ...nodeValues, ...visuOverridesRef.current }));
      }
    } catch {
    }
  }, []);

  const startPage = useCallback(async (pageId: string) => {
    const page = pagesRef.current.find(p => p.id === pageId);
    if (!page) return;

    updatePages(prev => prev.map(p => p.id === pageId ? { ...p, running: true } : p));

    try {
      await fetch(`${API_BASE}/pages/${pageId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycleMs: page.cycleMs })
      });
    } catch {
    }

    if (localCycleTimers.current[pageId]) clearInterval(localCycleTimers.current[pageId]);
    executePage(pageId);
    const interval = Math.max(200, page.cycleMs);
    localCycleTimers.current[pageId] = setInterval(() => executePage(pageId), interval);
  }, [updatePages, executePage]);

  const stopPage = useCallback(async (pageId: string) => {
    updatePages(prev => prev.map(p => p.id === pageId ? { ...p, running: false } : p));

    try {
      await fetch(`${API_BASE}/pages/${pageId}/stop`, { method: 'POST' });
    } catch {
    }

    if (localCycleTimers.current[pageId]) {
      clearInterval(localCycleTimers.current[pageId]);
      delete localCycleTimers.current[pageId];
    }
  }, [updatePages]);

  useEffect(() => {
    return () => {
      Object.values(localCycleTimers.current).forEach(clearInterval);
    };
  }, []);

  const addNode = useCallback((node: FlowNode) => {
    updateActivePage(p => ({ ...p, nodes: [...p.nodes, node] }));
  }, [updateActivePage]);

  const addNodes = useCallback((newNodes: FlowNode[]) => {
    updateActivePage(p => ({ ...p, nodes: [...p.nodes, ...newNodes] }));
  }, [updateActivePage]);

  const updateNodePosition = useCallback((nodeId: string, x: number, y: number) => {
    updateActivePage(p => ({
      ...p,
      nodes: p.nodes.map(n => n.id === nodeId ? { ...n, position: { x, y } } : n)
    }));
  }, [updateActivePage]);

  const updateMultipleNodePositions = useCallback((updates: Array<{ id: string; x: number; y: number }>) => {
    updateActivePage(p => ({
      ...p,
      nodes: p.nodes.map(n => {
        const upd = updates.find(u => u.id === n.id);
        return upd ? { ...n, position: { x: upd.x, y: upd.y } } : n;
      })
    }));
  }, [updateActivePage]);

  const updateNodeData = useCallback((nodeId: string, updates: Partial<FlowNode['data']>) => {
    updateActivePage(p => ({
      ...p,
      nodes: p.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n)
    }));
  }, [updateActivePage]);

  const deleteNode = useCallback((nodeId: string) => {
    updateActivePage(p => {
      const nodeToDelete = p.nodes.find(n => n.id === nodeId);

      if (nodeToDelete?.type === 'case-container') {
        const headerHeight = 36;
        const caseHeaderHeight = 24;
        const cases = nodeToDelete.data.config?.cases || [];
        const defaultCaseHeight = 120;

        const updatedNodes = p.nodes.map(n => {
          if (n.data.parentContainerId === nodeId) {
            const caseIndex = n.data.caseIndex ?? 0;
            let caseOffsetY = 0;
            for (let i = 0; i < caseIndex; i++) {
              caseOffsetY += (cases[i]?.height || defaultCaseHeight);
            }
            caseOffsetY += caseHeaderHeight;

            return {
              ...n,
              position: {
                x: nodeToDelete.position.x + n.position.x + 4,
                y: nodeToDelete.position.y + headerHeight + caseOffsetY + n.position.y + 4
              },
              data: {
                ...n.data,
                parentContainerId: undefined,
                caseIndex: undefined
              }
            };
          }
          return n;
        });

        return {
          ...p,
          nodes: updatedNodes.filter(n => n.id !== nodeId),
          connections: p.connections.filter(c => c.source !== nodeId && c.target !== nodeId)
        };
      }

      return {
        ...p,
        nodes: p.nodes.filter(n => n.id !== nodeId),
        connections: p.connections.filter(c => c.source !== nodeId && c.target !== nodeId)
      };
    });
    setSelectedNodes(prev => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
  }, [updateActivePage]);

  const deleteNodes = useCallback((nodeIds: string[]) => {
    const idSet = new Set(nodeIds);
    updateActivePage(p => ({
      ...p,
      nodes: p.nodes.filter(n => !idSet.has(n.id)),
      connections: p.connections.filter(c => !idSet.has(c.source) && !idSet.has(c.target))
    }));
    setSelectedNodes(new Set());
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

  const addConnections = useCallback((newConns: Connection[]) => {
    updateActivePage(p => ({ ...p, connections: [...p.connections, ...newConns] }));
  }, [updateActivePage]);

  const deleteConnection = useCallback((connectionId: string) => {
    updateActivePage(p => ({ ...p, connections: p.connections.filter(c => c.id !== connectionId) }));
    if (selectedConnection === connectionId) {
      setSelectedConnection(null);
    }
  }, [updateActivePage, selectedConnection]);

  const updateNodeOverride = useCallback((nodeId: string, override: DatapointOverride) => {
    updateActivePage(p => ({
      ...p,
      nodes: p.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, override } } : n)
    }));
  }, [updateActivePage]);

  const selectNode = useCallback((nodeId: string, addToSelection = false) => {
    setSelectedConnection(null);
    if (addToSelection) {
      setSelectedNodes(prev => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        return next;
      });
    } else {
      setSelectedNodes(new Set([nodeId]));
    }
  }, []);

  const selectNodes = useCallback((nodeIds: string[]) => {
    setSelectedConnection(null);
    setSelectedNodes(new Set(nodeIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodes(new Set());
    setSelectedConnection(null);
  }, []);

  const selectConnectionFn = useCallback((connId: string | null) => {
    setSelectedNodes(new Set());
    setSelectedConnection(connId);
  }, []);

  const copySelection = useCallback(() => {
    const page = pagesRef.current.find(p => p.id === activePageId);
    if (!page) return;

    const nodesToCopy = page.nodes.filter(n => selectedNodes.has(n.id));
    if (nodesToCopy.length === 0) return;

    const nodeIdSet = new Set(nodesToCopy.map(n => n.id));
    const connsToCopy = page.connections.filter(
      c => nodeIdSet.has(c.source) && nodeIdSet.has(c.target)
    );

    setClipboard({ nodes: nodesToCopy, connections: connsToCopy });
  }, [activePageId, selectedNodes]);

  const pasteClipboard = useCallback((offsetX = 50, offsetY = 50) => {
    if (!clipboard || clipboard.nodes.length === 0) return;

    const idMap = new Map<string, string>();
    const newNodes: FlowNode[] = clipboard.nodes.map(n => {
      const newId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + offsetX, y: n.position.y + offsetY }
      };
    });

    const newConns: Connection[] = clipboard.connections.map(c => ({
      ...c,
      id: `${idMap.get(c.source)}-${c.sourcePort}-${idMap.get(c.target)}-${c.targetPort}`,
      source: idMap.get(c.source)!,
      target: idMap.get(c.target)!
    }));

    addNodes(newNodes);
    addConnections(newConns);
    setSelectedNodes(new Set(newNodes.map(n => n.id)));
  }, [clipboard, addNodes, addConnections]);

  const deleteSelected = useCallback(() => {
    if (selectedConnection) {
      deleteConnection(selectedConnection);
    } else if (selectedNodes.size > 0) {
      deleteNodes(Array.from(selectedNodes));
    }
  }, [selectedConnection, selectedNodes, deleteConnection, deleteNodes]);

  const duplicateSelected = useCallback(() => {
    const page = pagesRef.current.find(p => p.id === activePageId);
    if (!page || selectedNodes.size === 0) return;

    const nodesToDupe = page.nodes.filter(n => selectedNodes.has(n.id));
    if (nodesToDupe.length === 0) return;

    const idMap = new Map<string, string>();
    const newNodes: FlowNode[] = nodesToDupe.map(n => {
      const newId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + 30, y: n.position.y + 30 }
      };
    });

    const nodeIdSet = new Set(nodesToDupe.map(n => n.id));
    const connsToDupe = page.connections.filter(
      c => nodeIdSet.has(c.source) && nodeIdSet.has(c.target)
    );
    const newConns: Connection[] = connsToDupe.map(c => ({
      ...c,
      id: `${idMap.get(c.source)}-${c.sourcePort}-${idMap.get(c.target)}-${c.targetPort}`,
      source: idMap.get(c.source)!,
      target: idMap.get(c.target)!
    }));

    addNodes(newNodes);
    addConnections(newConns);
    setSelectedNodes(new Set(newNodes.map(n => n.id)));
  }, [activePageId, selectedNodes, addNodes, addConnections]);

  const addTextAnnotation = useCallback((x: number, y: number) => {
    const textNode: FlowNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'text-annotation',
      position: { x, y },
      data: {
        label: 'Neuer Text',
        inputs: [],
        outputs: [],
        config: {
          textContent: 'Doppelklicken zum Bearbeiten',
          fontSize: 14,
          textColor: '#94a3b8'
        }
      }
    };
    addNode(textNode);
    setSelectedNodes(new Set([textNode.id]));
  }, [addNode]);

  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string; portId: string } | null>(null);
  const connectingFromRef = useRef<{ nodeId: string; portId: string } | null>(null);

  const startConnection = useCallback((nodeId: string, portId: string) => {
    console.log('[useWiresheetPages] startConnection:', nodeId, portId);
    const newValue = { nodeId, portId };
    connectingFromRef.current = newValue;
    setConnectingFrom(newValue);
  }, []);

  const endConnection = useCallback((targetNodeId: string, targetPortId: string, sourceNodeId: string, sourcePortId: string) => {
    console.log('[useWiresheetPages] endConnection:', { targetNodeId, targetPortId, sourceNodeId, sourcePortId });
    if (sourceNodeId !== targetNodeId) {
      const connection: Connection = {
        id: `${sourceNodeId}-${sourcePortId}-${targetNodeId}-${targetPortId}`,
        source: sourceNodeId,
        sourcePort: sourcePortId,
        target: targetNodeId,
        targetPort: targetPortId
      };
      console.log('[useWiresheetPages] Creating connection:', connection);
      addConnection(connection);
    } else {
      console.log('[useWiresheetPages] Same node - not creating connection');
    }
    connectingFromRef.current = null;
    setConnectingFrom(null);
  }, [addConnection]);

  const cancelConnection = useCallback(() => {
    connectingFromRef.current = null;
    setConnectingFrom(null);
  }, []);

  const updateContainerSize = useCallback((nodeId: string, width: number, height: number) => {
    updateActivePage(p => ({
      ...p,
      nodes: p.nodes.map(n => n.id === nodeId ? {
        ...n,
        data: {
          ...n.data,
          config: {
            ...n.data.config,
            containerWidth: width,
            containerHeight: height
          }
        }
      } : n)
    }));
  }, [updateActivePage]);

  const updateCaseSize = useCallback((nodeId: string, caseIndex: number, height: number) => {
    updateActivePage(p => ({
      ...p,
      nodes: p.nodes.map(n => {
        if (n.id !== nodeId) return n;
        const cases = [...(n.data.config?.cases || [])];
        if (cases[caseIndex]) {
          cases[caseIndex] = { ...cases[caseIndex], height };
        }
        return {
          ...n,
          data: {
            ...n.data,
            config: {
              ...n.data.config,
              cases
            }
          }
        };
      })
    }));
  }, [updateActivePage]);

  const moveNodeToContainer = useCallback((nodeId: string, containerId: string | null, caseIndex?: number) => {
    updateActivePage(p => {
      const node = p.nodes.find(n => n.id === nodeId);
      if (!node) return p;

      const oldContainerId = node.data.parentContainerId;
      const oldCaseIndex = node.data.caseIndex;

      let updatedNodes = p.nodes.map(n => {
        if (n.id === nodeId) {
          const containerNode = containerId ? p.nodes.find(cn => cn.id === containerId) : null;
          let newX = node.position.x;
          let newY = node.position.y;

          if (oldContainerId && !containerId) {
            const oldContainer = p.nodes.find(cn => cn.id === oldContainerId);
            if (oldContainer && oldContainer.type === 'case-container') {
              const headerHeight = 36;
              const caseHeaderHeight = 24;
              const cases = oldContainer.data.config?.cases || [];
              const defaultCaseHeight = 120;
              let caseOffsetY = 0;
              for (let i = 0; i < (oldCaseIndex ?? 0); i++) {
                caseOffsetY += (cases[i]?.height || defaultCaseHeight);
              }
              caseOffsetY += caseHeaderHeight;
              newX = oldContainer.position.x + node.position.x + 4;
              newY = oldContainer.position.y + headerHeight + caseOffsetY + node.position.y + 4;
            }
          } else if (!oldContainerId && containerId && containerNode) {
            const headerHeight = 36;
            const caseHeaderHeight = 24;
            const cases = containerNode.data.config?.cases || [];
            const defaultCaseHeight = 120;
            let caseOffsetY = 0;
            for (let i = 0; i < (caseIndex ?? 0); i++) {
              caseOffsetY += (cases[i]?.height || defaultCaseHeight);
            }
            caseOffsetY += caseHeaderHeight;
            newX = Math.max(4, node.position.x - containerNode.position.x - 4);
            newY = Math.max(4, node.position.y - containerNode.position.y - headerHeight - caseOffsetY - 4);
          }

          return {
            ...n,
            position: { x: newX, y: newY },
            data: {
              ...n.data,
              parentContainerId: containerId || undefined,
              caseIndex: containerId ? caseIndex : undefined
            }
          };
        }
        return n;
      });

      if (oldContainerId) {
        updatedNodes = updatedNodes.map(n => {
          if (n.id === oldContainerId && n.data.config?.cases) {
            const cases = n.data.config.cases.map((c: { id: string; label: string; nodeIds?: string[]; height?: number }, idx: number) => {
              if (idx === oldCaseIndex && c.nodeIds) {
                return { ...c, nodeIds: c.nodeIds.filter((id: string) => id !== nodeId) };
              }
              return c;
            });
            return { ...n, data: { ...n.data, config: { ...n.data.config, cases } } };
          }
          return n;
        });
      }

      if (containerId && caseIndex !== undefined) {
        updatedNodes = updatedNodes.map(n => {
          if (n.id === containerId && n.data.config?.cases) {
            const cases = n.data.config.cases.map((c: { id: string; label: string; nodeIds?: string[]; height?: number }, idx: number) => {
              if (idx === caseIndex) {
                return { ...c, nodeIds: [...(c.nodeIds || []), nodeId] };
              }
              return c;
            });
            return { ...n, data: { ...n.data, config: { ...n.data.config, cases } } };
          }
          return n;
        });
      }

      return { ...p, nodes: updatedNodes };
    });
  }, [updateActivePage]);

  const releaseContainerNodes = useCallback((containerId: string) => {
    updateActivePage(p => {
      const containerNode = p.nodes.find(n => n.id === containerId);
      if (!containerNode || containerNode.type !== 'case-container') return p;

      const headerHeight = 36;
      const caseHeaderHeight = 24;
      const cases = containerNode.data.config?.cases || [];
      const defaultCaseHeight = 120;

      const updatedNodes = p.nodes.map(n => {
        if (n.data.parentContainerId === containerId) {
          const caseIndex = n.data.caseIndex ?? 0;
          let caseOffsetY = 0;
          for (let i = 0; i < caseIndex; i++) {
            caseOffsetY += (cases[i]?.height || defaultCaseHeight);
          }
          caseOffsetY += caseHeaderHeight;

          return {
            ...n,
            position: {
              x: containerNode.position.x + n.position.x + 4,
              y: containerNode.position.y + headerHeight + caseOffsetY + n.position.y + 4
            },
            data: {
              ...n.data,
              parentContainerId: undefined,
              caseIndex: undefined
            }
          };
        }
        return n;
      });

      return { ...p, nodes: updatedNodes };
    });
  }, [updateActivePage]);

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
    selectedNodes,
    selectedConnection,
    connectingFrom,
    connectingFromRef,
    clipboard,
    addNode,
    addNodes,
    updateNodePosition,
    updateMultipleNodePositions,
    updateNodeData,
    deleteNode,
    deleteNodes,
    addConnection,
    deleteConnection,
    updateNodeOverride,
    selectNode,
    selectNodes,
    clearSelection,
    selectConnection: selectConnectionFn,
    copySelection,
    pasteClipboard,
    deleteSelected,
    duplicateSelected,
    addTextAnnotation,
    startConnection,
    endConnection,
    cancelConnection,
    updateContainerSize,
    updateCaseSize,
    moveNodeToContainer,
    releaseContainerNodes,
    setLiveValue: (key: string, value: unknown) => {
      visuOverridesRef.current = { ...visuOverridesRef.current, [key]: value };
      setLiveValues(prev => ({ ...prev, [key]: value }));
    },
    executeAllPages: async () => {
      const currentPages = pagesRef.current;
      for (const page of currentPages) {
        const manualOverrides: Record<string, unknown> = {};
        for (const node of page.nodes) {
          if (node.data.override?.manual) {
            manualOverrides[node.id] = node.data.override.value;
          }
        }
        const visuOverrides = { ...visuOverridesRef.current };
        try {
          const res = await fetch(`${API_BASE}/pages/${page.id}/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodes: page.nodes, connections: page.connections, manualOverrides, visuOverrides })
          });
          if (res.ok) {
            const { nodeValues } = await res.json();
            setLiveValues(prev => ({ ...prev, ...nodeValues, ...visuOverridesRef.current }));
          }
        } catch { }
      }
    }
  };
};

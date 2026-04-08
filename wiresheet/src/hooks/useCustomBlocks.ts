import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { CustomBlockDefinition } from '../types/flow';
import { allBuiltinBlocks } from '../data/builtinBlocks';

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

export const useCustomBlocks = () => {
  const [blocks, setBlocks] = useState<CustomBlockDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const builtinIds = useMemo(() => new Set(allBuiltinBlocks.map(b => b.id)), []);

  const loadBlocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/blocks`);
      if (res.ok) {
        const data = await res.json();
        const userBlocks: CustomBlockDefinition[] = Array.isArray(data) ? data.filter((b: CustomBlockDefinition) => !builtinIds.has(b.id)) : [];
        setBlocks([...allBuiltinBlocks, ...userBlocks]);
      } else {
        console.error('loadBlocks failed:', res.status);
        setError('Laden fehlgeschlagen');
        setBlocks([...allBuiltinBlocks]);
      }
    } catch (err) {
      console.error('loadBlocks error:', err);
      setError('Verbindung fehlgeschlagen');
      setBlocks([...allBuiltinBlocks]);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveBlocks = useCallback(async (updatedBlocks: CustomBlockDefinition[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const toSave = updatedBlocks.filter(b => !builtinIds.has(b.id));
        const res = await fetch(`${API_BASE}/blocks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSave)
        });
        if (!res.ok) {
          console.error('saveBlocks failed:', res.status);
        }
      } catch (err) {
        console.error('saveBlocks error:', err);
      }
    }, 300);
  }, []);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  const addBlock = useCallback((block: CustomBlockDefinition) => {
    setBlocks(prev => {
      const existing = prev.findIndex(b => b.id === block.id);
      let next: CustomBlockDefinition[];
      if (existing >= 0) {
        next = prev.map((b, i) => i === existing ? block : b);
      } else {
        next = [...prev, block];
      }
      saveBlocks(next);
      return next;
    });
  }, [saveBlocks]);

  const updateBlock = useCallback((blockId: string, updates: Partial<CustomBlockDefinition>) => {
    setBlocks(prev => {
      const next = prev.map(b => b.id === blockId ? { ...b, ...updates, updatedAt: Date.now() } : b);
      saveBlocks(next);
      return next;
    });
  }, [saveBlocks]);

  const deleteBlock = useCallback((blockId: string) => {
    if (builtinIds.has(blockId)) return;
    setBlocks(prev => {
      const next = prev.filter(b => b.id !== blockId);
      saveBlocks(next);
      return next;
    });
  }, [saveBlocks]);

  const duplicateBlock = useCallback((block: CustomBlockDefinition) => {
    const now = Date.now();
    const newBlock: CustomBlockDefinition = {
      ...block,
      id: `custom-block-${now}`,
      name: `${block.name} (Kopie)`,
      createdAt: now,
      updatedAt: now
    };
    setBlocks(prev => {
      const next = [...prev, newBlock];
      saveBlocks(next);
      return next;
    });
    return newBlock;
  }, [saveBlocks]);

  const importBlocks = useCallback((newBlocks: CustomBlockDefinition[], overwrite = false) => {
    const validBlocks = newBlocks.filter(b => b.id && b.name && Array.isArray(b.nodes));

    setBlocks(prev => {
      if (overwrite) {
        const userBlocks = validBlocks.filter(b => !builtinIds.has(b.id));
        const next = [...allBuiltinBlocks, ...userBlocks];
        saveBlocks(next);
        return next;
      }
      const blockMap = new Map(prev.map(b => [b.id, b]));
      for (const b of validBlocks) {
        if (!builtinIds.has(b.id)) {
          blockMap.set(b.id, b);
        }
      }
      const next = [...blockMap.values()];
      saveBlocks(next);
      return next;
    });
  }, [saveBlocks, builtinIds]);

  const exportBlock = useCallback((block: CustomBlockDefinition) => {
    const json = JSON.stringify(block, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${block.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const exportAllBlocks = useCallback(() => {
    const json = JSON.stringify(blocks, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wiresheet-blocks-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [blocks]);

  return {
    blocks,
    loading,
    error,
    loadBlocks,
    addBlock,
    updateBlock,
    deleteBlock,
    duplicateBlock,
    importBlocks,
    exportBlock,
    exportAllBlocks,
    isBuiltin: (blockId: string) => builtinIds.has(blockId)
  };
};

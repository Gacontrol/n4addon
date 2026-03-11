import { WiresheetPage } from '../types/flow';
import { VisuPage } from '../types/visualization';
import { CustomBlockDefinition } from '../types/flow';

export const BACKUP_VERSION = 2;

export interface BackupImage {
  filename: string;
  mimeType: string;
  data: string;
}

export interface WiresheetBackup {
  version: number;
  exportedAt: string;
  appVersion: string;
  wiresheets: WiresheetPage[];
  visuPages: VisuPage[];
  customBlocks: CustomBlockDefinition[];
  images?: BackupImage[];
}

export interface BackupImportSelection {
  wiresheets: string[];
  visuPages: string[];
  customBlocks: string[];
}

export function createBackup(
  wiresheets: WiresheetPage[],
  visuPages: VisuPage[],
  customBlocks: CustomBlockDefinition[],
  images?: BackupImage[]
): WiresheetBackup {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    wiresheets,
    visuPages,
    customBlocks,
    images: images ?? []
  };
}

export async function fetchImagesForBackup(apiBase: string): Promise<BackupImage[]> {
  try {
    const res = await fetch(`${apiBase}/images`);
    if (!res.ok) return [];
    const list = await res.json() as { filename: string; url: string }[];
    const results: BackupImage[] = [];
    for (const img of list) {
      try {
        const imgRes = await fetch(`${apiBase}/images/${img.filename}`);
        if (!imgRes.ok) continue;
        const blob = await imgRes.blob();
        const reader = new FileReader();
        const data = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        results.push({ filename: img.filename, mimeType: blob.type, data });
      } catch {}
    }
    return results;
  } catch {
    return [];
  }
}

export async function restoreImagesFromBackup(apiBase: string, images: BackupImage[]): Promise<void> {
  for (const img of images) {
    try {
      const binary = atob(img.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: img.mimeType });
      const formData = new FormData();
      formData.append('image', blob, img.filename);
      await fetch(`${apiBase}/images/upload`, { method: 'POST', body: formData });
    } catch {}
  }
}

export function downloadBackup(backup: WiresheetBackup, filename?: string): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.download = filename ?? `wiresheet-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function migrateBackup(raw: Record<string, unknown>): WiresheetBackup {
  const version = typeof raw.version === 'number' ? raw.version : 0;

  if (version === 0) {
    return {
      version: BACKUP_VERSION,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
      appVersion: '1.0.0',
      wiresheets: Array.isArray(raw.wiresheets) ? (raw.wiresheets as WiresheetPage[]) :
                 Array.isArray(raw.pages) ? (raw.pages as WiresheetPage[]) : [],
      visuPages: Array.isArray(raw.visuPages) ? (raw.visuPages as VisuPage[]) : [],
      customBlocks: Array.isArray(raw.customBlocks) ? (raw.customBlocks as CustomBlockDefinition[]) : []
    };
  }

  return raw as unknown as WiresheetBackup;
}

export function parseBackupFile(text: string): { backup: WiresheetBackup | null; error: string | null } {
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    if (typeof raw !== 'object' || raw === null) {
      return { backup: null, error: 'Ungueltige Backup-Datei' };
    }
    const backup = migrateBackup(raw);
    if (!Array.isArray(backup.wiresheets) || !Array.isArray(backup.visuPages)) {
      return { backup: null, error: 'Backup-Format unbekannt' };
    }
    return { backup, error: null };
  } catch {
    return { backup: null, error: 'JSON Parsing-Fehler' };
  }
}

export function applyImport(
  selection: BackupImportSelection,
  backup: WiresheetBackup,
  currentWiresheets: WiresheetPage[],
  currentVisuPages: VisuPage[],
  currentBlocks: CustomBlockDefinition[],
  mode: 'merge' | 'replace'
): {
  wiresheets: WiresheetPage[];
  visuPages: VisuPage[];
  customBlocks: CustomBlockDefinition[];
} {
  const now = Date.now();

  const importedWiresheets = backup.wiresheets.filter(w => selection.wiresheets.includes(w.id));
  const importedVisuPages = backup.visuPages.filter(v => selection.visuPages.includes(v.id));
  const importedBlocks = backup.customBlocks.filter(b => selection.customBlocks.includes(b.id));

  if (mode === 'replace') {
    const newWiresheets = importedWiresheets.length > 0 ? importedWiresheets : currentWiresheets;
    const newVisuPages = importedVisuPages.length > 0 ? importedVisuPages : currentVisuPages;
    const newBlocks = importedBlocks.length > 0 ? importedBlocks : currentBlocks;
    return { wiresheets: newWiresheets, visuPages: newVisuPages, customBlocks: newBlocks };
  }

  const existingWiresheetIds = new Set(currentWiresheets.map(w => w.id));
  const mergedWiresheets = [...currentWiresheets];
  for (const ws of importedWiresheets) {
    if (existingWiresheetIds.has(ws.id)) {
      const newId = `page-${now}-${Math.random().toString(36).substr(2, 5)}`;
      mergedWiresheets.push({ ...ws, id: newId, name: `${ws.name} (Import)` });
    } else {
      mergedWiresheets.push(ws);
    }
  }

  const existingVisuIds = new Set(currentVisuPages.map(v => v.id));
  const mergedVisuPages = [...currentVisuPages];
  for (const vp of importedVisuPages) {
    if (existingVisuIds.has(vp.id)) {
      const newId = `visu-page-${now}-${Math.random().toString(36).substr(2, 5)}`;
      mergedVisuPages.push({ ...vp, id: newId, name: `${vp.name} (Import)` });
    } else {
      mergedVisuPages.push(vp);
    }
  }

  const existingBlockIds = new Set(currentBlocks.map(b => b.id));
  const mergedBlocks = [...currentBlocks];
  for (const block of importedBlocks) {
    if (existingBlockIds.has(block.id)) {
      const newId = `custom-block-${now}-${Math.random().toString(36).substr(2, 5)}`;
      mergedBlocks.push({ ...block, id: newId, name: `${block.name} (Import)` });
    } else {
      mergedBlocks.push(block);
    }
  }

  return { wiresheets: mergedWiresheets, visuPages: mergedVisuPages, customBlocks: mergedBlocks };
}

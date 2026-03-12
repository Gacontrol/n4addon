import { WiresheetPage, ModbusDevice, DriverBinding } from '../types/flow';
import { VisuPage } from '../types/visualization';
import { CustomBlockDefinition } from '../types/flow';

export const BACKUP_VERSION = 3;

export interface BackupImage {
  filename: string;
  url: string;
  data: string;
  mimeType: string;
}

export interface CustomLibraryDevice {
  id: string;
  name: string;
  category: string;
  datapoints: Omit<ModbusDevice['datapoints'][0], 'id'>[];
}

export interface DriverConfig {
  modbusDevices: ModbusDevice[];
  modbusDriverEnabled: boolean;
  driverBindings: DriverBinding[];
  customModbusLibrary: CustomLibraryDevice[];
}

export interface WiresheetBackup {
  version: number;
  exportedAt: string;
  appVersion: string;
  wiresheets: WiresheetPage[];
  visuPages: VisuPage[];
  customBlocks: CustomBlockDefinition[];
  images?: BackupImage[];
  driverConfig?: DriverConfig;
}

function getApiBase(): string {
  const p = window.location.pathname;
  const m = p.match(/^(\/api\/hassio_ingress\/[^/]+)/) || p.match(/^(\/app\/[^/]+)/);
  return m ? m[1] : '';
}

export async function fetchImagesForBackup(visuPages: VisuPage[]): Promise<BackupImage[]> {
  const apiBase = getApiBase();
  const imageUrls = new Set<string>();

  for (const page of visuPages) {
    for (const widget of page.widgets) {
      const cfg = widget.config as Record<string, unknown>;
      if (cfg?.imageUrl && typeof cfg.imageUrl === 'string') {
        const url = cfg.imageUrl as string;
        if (url.startsWith('/api/images/')) {
          imageUrls.add(url);
        } else {
          const ingressMatch = url.match(/^(?:\/api\/hassio_ingress\/[^/]+|\/app\/[^/]+)(\/api\/images\/.*)/);
          if (ingressMatch) imageUrls.add(ingressMatch[1]);
        }
      }
    }
  }

  const images: BackupImage[] = [];
  for (const url of imageUrls) {
    try {
      const res = await fetch(`${apiBase}${url}`);
      if (!res.ok) continue;
      const blob = await res.blob();
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const filename = url.split('/').pop() || '';
      images.push({ filename, url, data, mimeType: blob.type });
    } catch {}
  }
  return images;
}

export async function restoreImagesFromBackup(images: BackupImage[]): Promise<void> {
  const apiBase = getApiBase();
  for (const img of images) {
    try {
      const res = await fetch(img.data);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append('image', new File([blob], img.filename, { type: img.mimeType }));
      await fetch(`${apiBase}/api/images/upload`, { method: 'POST', body: formData });
    } catch {}
  }
}

export interface BackupImportSelection {
  wiresheets: string[];
  visuPages: string[];
  customBlocks: string[];
  modbusDevices: string[];
  customLibrary: string[];
  includeBindings: boolean;
  includeImages: boolean;
}

export interface BackupExportSelection {
  wiresheets: string[];
  visuPages: string[];
  customBlocks: string[];
  modbusDevices: string[];
  customLibrary: string[];
  includeBindings: boolean;
  includeImages: boolean;
}

export function createBackup(
  wiresheets: WiresheetPage[],
  visuPages: VisuPage[],
  customBlocks: CustomBlockDefinition[],
  images?: BackupImage[],
  driverConfig?: DriverConfig
): WiresheetBackup {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    wiresheets,
    visuPages,
    customBlocks,
    images: images || [],
    driverConfig
  };
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
  mode: 'merge' | 'replace',
  currentDriverConfig?: DriverConfig
): {
  wiresheets: WiresheetPage[];
  visuPages: VisuPage[];
  customBlocks: CustomBlockDefinition[];
  driverConfig?: DriverConfig;
} {
  const now = Date.now();

  const importedWiresheets = backup.wiresheets.filter(w => selection.wiresheets.includes(w.id));
  const importedVisuPages = backup.visuPages.filter(v => selection.visuPages.includes(v.id));
  const importedBlocks = backup.customBlocks.filter(b => selection.customBlocks.includes(b.id));

  if (mode === 'replace') {
    const newWiresheets = importedWiresheets.length > 0 ? importedWiresheets : currentWiresheets;
    const newVisuPages = importedVisuPages.length > 0 ? importedVisuPages : currentVisuPages;
    const newBlocks = importedBlocks.length > 0 ? importedBlocks : currentBlocks;

    let finalDriverConfig: DriverConfig | undefined = currentDriverConfig;
    if (backup.driverConfig) {
      const selectedDevices = backup.driverConfig.modbusDevices.filter(d => selection.modbusDevices.includes(d.id));
      const selectedLibrary = backup.driverConfig.customModbusLibrary.filter(l => selection.customLibrary.includes(l.id));
      finalDriverConfig = {
        modbusDevices: selectedDevices.length > 0 ? selectedDevices : (currentDriverConfig?.modbusDevices || []),
        modbusDriverEnabled: backup.driverConfig.modbusDriverEnabled,
        driverBindings: selection.includeBindings ? backup.driverConfig.driverBindings : (currentDriverConfig?.driverBindings || []),
        customModbusLibrary: selectedLibrary.length > 0 ? selectedLibrary : (currentDriverConfig?.customModbusLibrary || [])
      };
    }

    return { wiresheets: newWiresheets, visuPages: newVisuPages, customBlocks: newBlocks, driverConfig: finalDriverConfig };
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

  let finalDriverConfig: DriverConfig | undefined = currentDriverConfig;
  if (backup.driverConfig && currentDriverConfig) {
    const selectedDevices = backup.driverConfig.modbusDevices.filter(d => selection.modbusDevices.includes(d.id));
    const selectedLibrary = backup.driverConfig.customModbusLibrary.filter(l => selection.customLibrary.includes(l.id));

    const mergedDevices = [...currentDriverConfig.modbusDevices];
    for (const dev of selectedDevices) {
      const exists = mergedDevices.some(d => d.id === dev.id);
      if (exists) {
        mergedDevices.push({ ...dev, id: `modbus-device-${now}-${Math.random().toString(36).substr(2, 9)}`, name: `${dev.name} (Import)` });
      } else {
        mergedDevices.push(dev);
      }
    }

    const mergedBindings = selection.includeBindings
      ? [...currentDriverConfig.driverBindings, ...backup.driverConfig.driverBindings]
      : currentDriverConfig.driverBindings;

    const mergedLibrary = [...currentDriverConfig.customModbusLibrary];
    for (const lib of selectedLibrary) {
      const exists = mergedLibrary.some(l => l.id === lib.id);
      if (exists) {
        mergedLibrary.push({ ...lib, id: `custom-${now}-${Math.random().toString(36).substr(2, 9)}`, name: `${lib.name} (Import)` });
      } else {
        mergedLibrary.push(lib);
      }
    }

    finalDriverConfig = {
      modbusDevices: mergedDevices,
      modbusDriverEnabled: currentDriverConfig.modbusDriverEnabled || backup.driverConfig.modbusDriverEnabled,
      driverBindings: mergedBindings,
      customModbusLibrary: mergedLibrary
    };
  } else if (backup.driverConfig) {
    const selectedDevices = backup.driverConfig.modbusDevices.filter(d => selection.modbusDevices.includes(d.id));
    const selectedLibrary = backup.driverConfig.customModbusLibrary.filter(l => selection.customLibrary.includes(l.id));
    finalDriverConfig = {
      modbusDevices: selectedDevices,
      modbusDriverEnabled: backup.driverConfig.modbusDriverEnabled,
      driverBindings: selection.includeBindings ? backup.driverConfig.driverBindings : [],
      customModbusLibrary: selectedLibrary
    };
  }

  return { wiresheets: mergedWiresheets, visuPages: mergedVisuPages, customBlocks: mergedBlocks, driverConfig: finalDriverConfig };
}

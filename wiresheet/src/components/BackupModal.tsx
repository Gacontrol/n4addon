import React, { useState, useRef, useCallback } from 'react';
import {
  X, Download, Upload, Check, AlertCircle, ChevronDown, ChevronRight,
  FileJson, Workflow, Monitor, Blocks, RefreshCw, FolderOpen, Image as ImageIcon
} from 'lucide-react';
import { WiresheetPage } from '../types/flow';
import { VisuPage, } from '../types/visualization';
import { CustomBlockDefinition } from '../types/flow';
import {
  WiresheetBackup,
  BackupImportSelection,
  createBackup,
  downloadBackup,
  parseBackupFile,
  applyImport,
  fetchImagesForBackup,
  restoreImagesFromBackup
} from '../utils/backup';

interface BackupModalProps {
  wiresheets: WiresheetPage[];
  visuPages: VisuPage[];
  customBlocks: CustomBlockDefinition[];
  onImport: (
    wiresheets: WiresheetPage[],
    visuPages: VisuPage[],
    customBlocks: CustomBlockDefinition[]
  ) => void;
  onClose: () => void;
}

type ModalView = 'main' | 'export' | 'import-select' | 'import-confirm';

interface ExportSelection {
  wiresheets: string[];
  visuPages: string[];
  customBlocks: string[];
}

export const BackupModal: React.FC<BackupModalProps> = ({
  wiresheets,
  visuPages,
  customBlocks,
  onImport,
  onClose
}) => {
  const [view, setView] = useState<ModalView>('main');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [loadedBackup, setLoadedBackup] = useState<WiresheetBackup | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSelection, setImportSelection] = useState<BackupImportSelection>({
    wiresheets: [],
    visuPages: [],
    customBlocks: []
  });
  const [exportSelection, setExportSelection] = useState<ExportSelection>({
    wiresheets: wiresheets.map(w => w.id),
    visuPages: visuPages.map(v => v.id),
    customBlocks: customBlocks.map(b => b.id)
  });
  const [importDone, setImportDone] = useState(false);
  const [wiresheetsOpen, setWiresheetsOpen] = useState(true);
  const [visuOpen, setVisuOpen] = useState(true);
  const [blocksOpen, setBlocksOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { backup, error } = parseBackupFile(text);
      if (error || !backup) {
        setParseError(error ?? 'Unbekannter Fehler');
        setLoadedBackup(null);
        return;
      }
      setParseError(null);
      setLoadedBackup(backup);
      setImportSelection({
        wiresheets: backup.wiresheets.map(w => w.id),
        visuPages: backup.visuPages.map(v => v.id),
        customBlocks: backup.customBlocks.map(b => b.id)
      });
      setView('import-select');
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const toggleExportItem = (key: keyof ExportSelection, id: string) => {
    setExportSelection(prev => ({
      ...prev,
      [key]: prev[key].includes(id) ? prev[key].filter(i => i !== id) : [...prev[key], id]
    }));
  };

  const toggleAllExport = (key: keyof ExportSelection, ids: string[]) => {
    setExportSelection(prev => {
      const allSelected = ids.every(id => prev[key].includes(id));
      return { ...prev, [key]: allSelected ? prev[key].filter(id => !ids.includes(id)) : [...new Set([...prev[key], ...ids])] };
    });
  };

  const toggleImportItem = (key: keyof BackupImportSelection, id: string) => {
    setImportSelection(prev => ({
      ...prev,
      [key]: prev[key].includes(id) ? prev[key].filter(i => i !== id) : [...prev[key], id]
    }));
  };

  const toggleAllImport = (key: keyof BackupImportSelection, ids: string[]) => {
    setImportSelection(prev => {
      const allSelected = ids.every(id => prev[key].includes(id));
      return { ...prev, [key]: allSelected ? prev[key].filter(id => !ids.includes(id)) : [...new Set([...prev[key], ...ids])] };
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const selectedWiresheets = wiresheets.filter(w => exportSelection.wiresheets.includes(w.id));
      const selectedVisus = visuPages.filter(v => exportSelection.visuPages.includes(v.id));
      const selectedBlocks = customBlocks.filter(b => exportSelection.customBlocks.includes(b.id));
      const images = await fetchImagesForBackup(selectedVisus);
      const backup = createBackup(selectedWiresheets, selectedVisus, selectedBlocks, images);
      downloadBackup(backup);
      onClose();
    } finally {
      setExporting(false);
    }
  };

  const handleImportConfirm = async () => {
    if (!loadedBackup) return;
    setImporting(true);
    try {
      if (loadedBackup.images && loadedBackup.images.length > 0) {
        await restoreImagesFromBackup(loadedBackup.images);
      }
      const result = applyImport(
        importSelection,
        loadedBackup,
        wiresheets,
        visuPages,
        customBlocks,
        importMode
      );
      onImport(result.wiresheets, result.visuPages, result.customBlocks);
      setImportDone(true);
      setTimeout(() => onClose(), 1200);
    } finally {
      setImporting(false);
    }
  };

  const totalImportSelected =
    importSelection.wiresheets.length +
    importSelection.visuPages.length +
    importSelection.customBlocks.length;

  const totalExportSelected =
    exportSelection.wiresheets.length +
    exportSelection.visuPages.length +
    exportSelection.customBlocks.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{
          width: 540,
          maxHeight: '90vh',
          background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileSelect}
        />

        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(59,130,246,0.15)' }}>
              <FileJson className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                {view === 'main' && 'Backup & Import'}
                {view === 'export' && 'Backup erstellen'}
                {view === 'import-select' && 'Import – Auswahl'}
                {view === 'import-confirm' && 'Import – Bestätigen'}
              </h2>
              {loadedBackup && view !== 'main' && view !== 'export' && (
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {new Date(loadedBackup.exportedAt).toLocaleString('de-DE')}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/[0.06] text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {view === 'main' && (
            <div className="p-5 flex flex-col gap-3">
              <button
                onClick={() => setView('export')}
                className="flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)', border: '1px solid rgba(59,130,246,0.2)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(59,130,246,0.2)' }}>
                  <Download className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Backup erstellen</div>
                  <div className="text-xs text-slate-400 mt-0.5">Wiresheets, Visus und Bausteine als JSON exportieren</div>
                </div>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(16,185,129,0.2)' }}>
                  <Upload className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Backup importieren</div>
                  <div className="text-xs text-slate-400 mt-0.5">JSON-Backup laden und selektiv wiederherstellen</div>
                </div>
              </button>

              {parseError && (
                <div className="flex items-center gap-2 p-3 rounded-lg text-red-400 text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {parseError}
                </div>
              )}
            </div>
          )}

          {view === 'export' && (
            <div className="p-5 flex flex-col gap-4">
              <p className="text-xs text-slate-400">Wähle aus, was im Backup enthalten sein soll:</p>

              <SectionGroup
                icon={<Workflow className="w-3.5 h-3.5" />}
                label="Wiresheets"
                color="#3b82f6"
                isOpen={wiresheetsOpen}
                onToggle={() => setWiresheetsOpen(v => !v)}
                allIds={wiresheets.map(w => w.id)}
                selectedIds={exportSelection.wiresheets}
                onToggleAll={() => toggleAllExport('wiresheets', wiresheets.map(w => w.id))}
              >
                {wiresheets.map(ws => (
                  <CheckItem
                    key={ws.id}
                    label={ws.name}
                    sublabel={`${ws.nodes.length} Bausteine, ${ws.connections.length} Verbindungen`}
                    checked={exportSelection.wiresheets.includes(ws.id)}
                    onChange={() => toggleExportItem('wiresheets', ws.id)}
                  />
                ))}
                {wiresheets.length === 0 && <EmptyHint label="Keine Wiresheets vorhanden" />}
              </SectionGroup>

              <SectionGroup
                icon={<Monitor className="w-3.5 h-3.5" />}
                label="Visualisierungen"
                color="#10b981"
                isOpen={visuOpen}
                onToggle={() => setVisuOpen(v => !v)}
                allIds={visuPages.map(v => v.id)}
                selectedIds={exportSelection.visuPages}
                onToggleAll={() => toggleAllExport('visuPages', visuPages.map(v => v.id))}
              >
                {visuPages.map(vp => (
                  <CheckItem
                    key={vp.id}
                    label={vp.name}
                    sublabel={`${vp.widgets.length} Widgets`}
                    checked={exportSelection.visuPages.includes(vp.id)}
                    onChange={() => toggleExportItem('visuPages', vp.id)}
                  />
                ))}
                {visuPages.length === 0 && <EmptyHint label="Keine Visualisierungen vorhanden" />}
              </SectionGroup>

              <SectionGroup
                icon={<Blocks className="w-3.5 h-3.5" />}
                label="Benutzerdefinierte Bausteine"
                color="#f59e0b"
                isOpen={blocksOpen}
                onToggle={() => setBlocksOpen(v => !v)}
                allIds={customBlocks.map(b => b.id)}
                selectedIds={exportSelection.customBlocks}
                onToggleAll={() => toggleAllExport('customBlocks', customBlocks.map(b => b.id))}
              >
                {customBlocks.map(b => (
                  <CheckItem
                    key={b.id}
                    label={b.name}
                    sublabel={b.description || b.category}
                    checked={exportSelection.customBlocks.includes(b.id)}
                    onChange={() => toggleExportItem('customBlocks', b.id)}
                  />
                ))}
                {customBlocks.length === 0 && <EmptyHint label="Keine Bausteine vorhanden" />}
              </SectionGroup>
            </div>
          )}

          {view === 'import-select' && loadedBackup && (
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <FolderOpen className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-slate-300">
                    {loadedBackup.wiresheets.length} Wiresheets &nbsp;·&nbsp;
                    {loadedBackup.visuPages.length} Visus &nbsp;·&nbsp;
                    {loadedBackup.customBlocks.length} Bausteine
                    {loadedBackup.images && loadedBackup.images.length > 0 && (
                      <> &nbsp;·&nbsp; {loadedBackup.images.length} Bilder</>
                    )}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Exportiert: {new Date(loadedBackup.exportedAt).toLocaleString('de-DE')}
                  </p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="ml-auto text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Andere Datei
                </button>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-400 mb-2">Importmodus</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['merge', 'replace'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setImportMode(mode)}
                      className="p-3 rounded-xl text-left transition-all"
                      style={{
                        background: importMode === mode
                          ? 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(59,130,246,0.08) 100%)'
                          : 'rgba(255,255,255,0.03)',
                        border: importMode === mode ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.06)'
                      }}
                    >
                      <div className="text-xs font-semibold text-white mb-0.5">
                        {mode === 'merge' ? 'Zusammenfuehren' : 'Ersetzen'}
                      </div>
                      <div className="text-[10px] text-slate-500 leading-snug">
                        {mode === 'merge'
                          ? 'Importierte Elemente werden hinzugefuegt (Duplikate erhalten neuen Namen)'
                          : 'Ausgewaehlte Elemente ersetzen die bestehenden vollstaendig'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-400">Wähle was importiert werden soll:</p>

              <SectionGroup
                icon={<Workflow className="w-3.5 h-3.5" />}
                label="Wiresheets"
                color="#3b82f6"
                isOpen={wiresheetsOpen}
                onToggle={() => setWiresheetsOpen(v => !v)}
                allIds={loadedBackup.wiresheets.map(w => w.id)}
                selectedIds={importSelection.wiresheets}
                onToggleAll={() => toggleAllImport('wiresheets', loadedBackup.wiresheets.map(w => w.id))}
              >
                {loadedBackup.wiresheets.map(ws => (
                  <CheckItem
                    key={ws.id}
                    label={ws.name}
                    sublabel={`${ws.nodes.length} Bausteine, ${ws.connections.length} Verbindungen`}
                    checked={importSelection.wiresheets.includes(ws.id)}
                    onChange={() => toggleImportItem('wiresheets', ws.id)}
                  />
                ))}
                {loadedBackup.wiresheets.length === 0 && <EmptyHint label="Keine Wiresheets im Backup" />}
              </SectionGroup>

              <SectionGroup
                icon={<Monitor className="w-3.5 h-3.5" />}
                label="Visualisierungen"
                color="#10b981"
                isOpen={visuOpen}
                onToggle={() => setVisuOpen(v => !v)}
                allIds={loadedBackup.visuPages.map(v => v.id)}
                selectedIds={importSelection.visuPages}
                onToggleAll={() => toggleAllImport('visuPages', loadedBackup.visuPages.map(v => v.id))}
              >
                {loadedBackup.visuPages.map(vp => (
                  <CheckItem
                    key={vp.id}
                    label={vp.name}
                    sublabel={`${vp.widgets.length} Widgets`}
                    checked={importSelection.visuPages.includes(vp.id)}
                    onChange={() => toggleImportItem('visuPages', vp.id)}
                  />
                ))}
                {loadedBackup.visuPages.length === 0 && <EmptyHint label="Keine Visualisierungen im Backup" />}
              </SectionGroup>

              <SectionGroup
                icon={<Blocks className="w-3.5 h-3.5" />}
                label="Benutzerdefinierte Bausteine"
                color="#f59e0b"
                isOpen={blocksOpen}
                onToggle={() => setBlocksOpen(v => !v)}
                allIds={loadedBackup.customBlocks.map(b => b.id)}
                selectedIds={importSelection.customBlocks}
                onToggleAll={() => toggleAllImport('customBlocks', loadedBackup.customBlocks.map(b => b.id))}
              >
                {loadedBackup.customBlocks.map(b => (
                  <CheckItem
                    key={b.id}
                    label={b.name}
                    sublabel={b.description || b.category}
                    checked={importSelection.customBlocks.includes(b.id)}
                    onChange={() => toggleImportItem('customBlocks', b.id)}
                  />
                ))}
                {loadedBackup.customBlocks.length === 0 && <EmptyHint label="Keine Bausteine im Backup" />}
              </SectionGroup>
            </div>
          )}

          {importDone && (
            <div className="p-10 flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(16,185,129,0.15)' }}>
                <Check className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-white">Import abgeschlossen</p>
              <p className="text-xs text-slate-400 text-center">
                {importSelection.wiresheets.length} Wiresheets, {importSelection.visuPages.length} Visus, {importSelection.customBlocks.length} Bausteine importiert
              </p>
            </div>
          )}
        </div>

        {!importDone && (
          <div className="flex items-center gap-2 px-5 py-4 border-t border-white/[0.06]">
            {view !== 'main' && (
              <button
                onClick={() => setView(view === 'export' ? 'main' : 'main')}
                className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                Zurück
              </button>
            )}
            <div className="flex-1" />

            {view === 'main' && (
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors">
                Schließen
              </button>
            )}

            {view === 'export' && (
              <button
                disabled={totalExportSelected === 0 || exporting}
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#3b82f6' }}
              >
                {exporting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {exporting ? 'Bilder werden geladen...' : `Backup speichern (${totalExportSelected})`}
              </button>
            )}

            {view === 'import-select' && loadedBackup && (
              <button
                disabled={totalImportSelected === 0 || importing}
                onClick={handleImportConfirm}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#10b981' }}
              >
                {importing ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {importing ? 'Wird importiert...' : `Importieren (${totalImportSelected})`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface SectionGroupProps {
  icon: React.ReactNode;
  label: string;
  color: string;
  isOpen: boolean;
  onToggle: () => void;
  allIds: string[];
  selectedIds: string[];
  onToggleAll: () => void;
  children: React.ReactNode;
}

const SectionGroup: React.FC<SectionGroupProps> = ({
  icon, label, color, isOpen, onToggle, allIds, selectedIds, onToggleAll, children
}) => {
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.includes(id));
  const someSelected = selectedIds.some(id => allIds.includes(id));

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
        style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
      >
        <span style={{ color }}>{icon}</span>
        <span className="text-xs font-semibold text-slate-300 flex-1">{label}</span>
        {allIds.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleAll(); }}
            className="text-[10px] px-2 py-0.5 rounded-md transition-colors"
            style={{
              backgroundColor: allSelected ? `${color}20` : 'rgba(255,255,255,0.04)',
              color: allSelected ? color : 'rgba(255,255,255,0.3)',
              border: `1px solid ${allSelected ? color + '30' : 'rgba(255,255,255,0.06)'}`
            }}
          >
            {allSelected ? 'Alle ab' : someSelected ? 'Alle' : 'Alle'}
          </button>
        )}
        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-600" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
      </button>
      {isOpen && (
        <div className="divide-y divide-white/[0.04]">
          {children}
        </div>
      )}
    </div>
  );
};

interface CheckItemProps {
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: () => void;
}

const CheckItem: React.FC<CheckItemProps> = ({ label, sublabel, checked, onChange }) => (
  <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-white/[0.02] transition-colors">
    <div
      onClick={onChange}
      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all cursor-pointer"
      style={{
        backgroundColor: checked ? '#3b82f6' : 'rgba(255,255,255,0.06)',
        border: checked ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.12)'
      }}
    >
      {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-xs text-slate-200 truncate">{label}</div>
      {sublabel && <div className="text-[10px] text-slate-500 truncate">{sublabel}</div>}
    </div>
  </label>
);

const EmptyHint: React.FC<{ label: string }> = ({ label }) => (
  <div className="px-3 py-3 text-[10px] text-slate-600 italic">{label}</div>
);

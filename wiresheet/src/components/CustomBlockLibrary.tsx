import React, { useState, useRef } from 'react';
import { CustomBlockDefinition } from '../types/flow';
import * as Icons from 'lucide-react';

interface CustomBlockLibraryProps {
  blocks: CustomBlockDefinition[];
  onCreateBlock: () => void;
  onEditBlock: (block: CustomBlockDefinition) => void;
  onDeleteBlock: (blockId: string) => void;
  onDuplicateBlock: (block: CustomBlockDefinition) => void;
  onExportBlock: (block: CustomBlockDefinition) => void;
  onExportAll: () => void;
  onImportBlocks: (blocks: CustomBlockDefinition[]) => void;
  onAddBlockToCanvas: (block: CustomBlockDefinition) => void;
  canCreateFromSelection: boolean;
}

export const CustomBlockLibrary: React.FC<CustomBlockLibraryProps> = ({
  blocks,
  onCreateBlock,
  onEditBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onExportBlock,
  onExportAll,
  onImportBlocks,
  onAddBlockToCanvas,
  canCreateFromSelection
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; block: CustomBlockDefinition } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredBlocks = blocks.filter(block =>
    block.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    block.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    block.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedBlocks = filteredBlocks.reduce((acc, block) => {
    const cat = block.category || 'Allgemein';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(block);
    return acc;
  }, {} as Record<string, CustomBlockDefinition[]>);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        const data = JSON.parse(content);

        if (Array.isArray(data)) {
          onImportBlocks(data);
        } else if (data.id && data.nodes) {
          onImportBlocks([data]);
        } else {
          alert('Ungueltiges Format');
        }
      } catch {
        alert('Fehler beim Lesen der Datei');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleContextMenu = (e: React.MouseEvent, block: CustomBlockDefinition) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, block });
  };

  const handleDeleteConfirm = (blockId: string) => {
    onDeleteBlock(blockId);
    setConfirmDelete(null);
  };

  const IconComponent = (iconName: string) => {
    const Icon = Icons[iconName as keyof typeof Icons] as React.FC<{ className?: string }>;
    return Icon ? <Icon className="w-4 h-4" /> : <Icons.Box className="w-4 h-4" />;
  };

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="p-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Icons.Blocks className="w-4 h-4 text-cyan-400" />
            Eigene Bausteine
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={handleImportClick}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
              title="Bausteine importieren"
            >
              <Icons.Upload className="w-4 h-4" />
            </button>
            {blocks.length > 0 && (
              <button
                onClick={onExportAll}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                title="Alle exportieren"
              >
                <Icons.Download className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="relative mb-3">
          <Icons.Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Baustein suchen..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <button
          onClick={onCreateBlock}
          disabled={!canCreateFromSelection}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
            canCreateFromSelection
              ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Icons.Plus className="w-4 h-4" />
          {canCreateFromSelection ? 'Aus Auswahl erstellen' : 'Nodes auswaehlen'}
        </button>
        {!canCreateFromSelection && (
          <p className="text-[10px] text-slate-500 mt-1.5 text-center">
            Waehle mehrere Nodes aus um einen Baustein zu erstellen
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {blocks.length === 0 ? (
          <div className="text-center py-8">
            <Icons.Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-1">Keine Bausteine vorhanden</p>
            <p className="text-xs text-slate-600">
              Waehle Nodes aus und klicke "Aus Auswahl erstellen"
            </p>
          </div>
        ) : filteredBlocks.length === 0 ? (
          <div className="text-center py-8">
            <Icons.SearchX className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Keine Treffer</p>
          </div>
        ) : (
          Object.entries(groupedBlocks).map(([category, categoryBlocks]) => (
            <div key={category} className="mb-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-1.5 mb-1">
                {category}
              </h4>
              <div className="space-y-1">
                {categoryBlocks.map(block => (
                  <div
                    key={block.id}
                    className="group relative bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-cyan-600/50 rounded-lg p-2.5 cursor-pointer transition-all"
                    onClick={() => onAddBlockToCanvas(block)}
                    onContextMenu={e => handleContextMenu(e, block)}
                    onDoubleClick={() => onEditBlock(block)}
                    title="Klick: Hinzufuegen | Doppelklick: Bearbeiten | Rechtsklick: Menu"
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: block.color + '30', color: block.color }}
                      >
                        {IconComponent(block.icon)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-white truncate">{block.name}</span>
                        </div>
                        {block.description && (
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{block.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[9px] text-slate-500 flex items-center gap-1">
                            <Icons.ArrowRightToLine className="w-3 h-3" />
                            {block.inputs.length}
                          </span>
                          <span className="text-[9px] text-slate-500 flex items-center gap-1">
                            <Icons.ArrowRightFromLine className="w-3 h-3" />
                            {block.outputs.length}
                          </span>
                          <span className="text-[9px] text-slate-500 flex items-center gap-1">
                            <Icons.Layers className="w-3 h-3" />
                            {block.nodes.length}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleContextMenu(e, block); }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white transition-all"
                      >
                        <Icons.MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl py-1 w-44"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => { onAddBlockToCanvas(contextMenu.block); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white hover:bg-slate-700 transition-colors"
            >
              <Icons.Plus className="w-3.5 h-3.5" />
              Zum Canvas hinzufuegen
            </button>
            <button
              onClick={() => { onEditBlock(contextMenu.block); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white hover:bg-slate-700 transition-colors"
            >
              <Icons.Pencil className="w-3.5 h-3.5" />
              Bearbeiten
            </button>
            <button
              onClick={() => { onDuplicateBlock(contextMenu.block); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white hover:bg-slate-700 transition-colors"
            >
              <Icons.Copy className="w-3.5 h-3.5" />
              Duplizieren
            </button>
            <button
              onClick={() => { onExportBlock(contextMenu.block); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white hover:bg-slate-700 transition-colors"
            >
              <Icons.Download className="w-3.5 h-3.5" />
              Exportieren
            </button>
            <div className="border-t border-slate-700 my-1" />
            <button
              onClick={() => { setConfirmDelete(contextMenu.block.id); setContextMenu(null); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-900/30 transition-colors"
            >
              <Icons.Trash2 className="w-3.5 h-3.5" />
              Loeschen
            </button>
          </div>
        </>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-5 w-80 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center">
                <Icons.AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Baustein loeschen?</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {blocks.find(b => b.id === confirmDelete)?.name}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Diese Aktion kann nicht rueckgaengig gemacht werden.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleDeleteConfirm(confirmDelete)}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
              >
                Loeschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

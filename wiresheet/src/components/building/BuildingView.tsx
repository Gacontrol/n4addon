import { useState } from 'react';
import {
  Building2, Plus, Trash2, ChevronUp, ChevronDown, Pencil, Check, X,
  Layers, Box, Move, Square, MousePointer, Settings2
} from 'lucide-react';
import { useBuildingEditor } from '../../hooks/useBuildingEditor';
import { BuildingCanvas3D } from './BuildingCanvas3D';
import { FloorPlanEditor } from './FloorPlanEditor';
import { Room, RoomType } from '../../types/building';

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  room: 'Zimmer',
  corridor: 'Flur',
  staircase: 'Treppenhaus',
  elevator: 'Aufzug',
  bathroom: 'Bad',
  kitchen: 'Küche',
  office: 'Büro',
  storage: 'Lager',
  garage: 'Garage',
  outdoor: 'Außenbereich',
};

const ROOM_TYPE_COLORS: Record<RoomType, string> = {
  room: '#94a3b8',
  corridor: '#cbd5e1',
  staircase: '#fbbf24',
  elevator: '#60a5fa',
  bathroom: '#67e8f9',
  kitchen: '#86efac',
  office: '#a78bfa',
  storage: '#d1d5db',
  garage: '#9ca3af',
  outdoor: '#6ee7b7',
};

type ViewMode = '3d' | 'floor';

export function BuildingView() {
  const {
    buildings,
    activeBuildingId,
    activeFloorId,
    activeBuilding,
    activeFloor,
    selectedRoomId,
    tool,
    setActiveBuildingId,
    setActiveFloorId,
    setSelectedRoomId,
    setTool,
    addBuilding,
    renameBuilding,
    deleteBuilding,
    addFloor,
    addFloorBelow,
    renameFloor,
    updateFloorHeight,
    deleteFloor,
    addRoom,
    updateRoom,
    deleteRoom,
    ROOM_COLORS,
  } = useBuildingEditor();

  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null);
  const [editingBuildingName, setEditingBuildingName] = useState('');
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [editingFloorName, setEditingFloorName] = useState('');
  const [newRoomType, setNewRoomType] = useState<RoomType>('room');
  const [showRoomPanel, setShowRoomPanel] = useState(true);

  const selectedRoom = activeFloor?.rooms.find(r => r.id === selectedRoomId) ?? null;

  const handleAddRoom = (x: number, y: number, w: number, d: number) => {
    if (!activeBuilding || !activeFloor) return;
    addRoom(activeBuilding.id, activeFloor.id, x, y, w, d, newRoomType);
  };

  const handleMoveRoom = (roomId: string, x: number, y: number) => {
    if (!activeBuilding || !activeFloor) return;
    updateRoom(activeBuilding.id, activeFloor.id, roomId, { x, y });
  };

  const handleDeleteRoom = (roomId: string) => {
    if (!activeBuilding || !activeFloor) return;
    deleteRoom(activeBuilding.id, activeFloor.id, roomId);
  };

  const handleUpdateRoom = (changes: Partial<Room>) => {
    if (!activeBuilding || !activeFloor || !selectedRoomId) return;
    updateRoom(activeBuilding.id, activeFloor.id, selectedRoomId, changes);
  };

  return (
    <div className="flex h-full overflow-hidden bg-slate-900 text-slate-100">
      <div className="w-56 flex-shrink-0 flex flex-col border-r border-slate-700 bg-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            Gebäude
          </span>
          <button
            onClick={addBuilding}
            className="w-5 h-5 rounded hover:bg-slate-600 text-slate-400 hover:text-white flex items-center justify-center"
            title="Gebäude hinzufügen"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {buildings.map(building => (
            <div key={building.id}>
              <div
                className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer group ${
                  building.id === activeBuildingId ? 'bg-slate-700' : 'hover:bg-slate-750'
                }`}
                onClick={() => {
                  setActiveBuildingId(building.id);
                  setActiveFloorId(building.floors[0]?.id || '');
                }}
              >
                <Building2 className={`w-3.5 h-3.5 flex-shrink-0 ${building.id === activeBuildingId ? 'text-blue-400' : 'text-slate-500'}`} />
                {editingBuildingId === building.id ? (
                  <input
                    className="flex-1 bg-slate-600 text-white text-xs px-1 py-0.5 rounded outline-none border border-blue-500"
                    value={editingBuildingName}
                    onChange={e => setEditingBuildingName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { renameBuilding(building.id, editingBuildingName); setEditingBuildingId(null); }
                      if (e.key === 'Escape') setEditingBuildingId(null);
                    }}
                    onClick={e => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 text-xs text-slate-300 truncate">{building.name}</span>
                )}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={e => { e.stopPropagation(); setEditingBuildingId(building.id); setEditingBuildingName(building.name); }}
                    className="w-4 h-4 hover:text-white text-slate-500 flex items-center justify-center"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                  {buildings.length > 1 && (
                    <button
                      onClick={e => { e.stopPropagation(); deleteBuilding(building.id); }}
                      className="w-4 h-4 hover:text-red-400 text-slate-500 flex items-center justify-center"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>

              {building.id === activeBuildingId && (
                <div className="ml-3 border-l border-slate-700 pl-1">
                  {[...building.floors].sort((a, b) => b.level - a.level).map(floor => (
                    <div
                      key={floor.id}
                      className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer group ${
                        floor.id === activeFloorId ? 'bg-slate-600 rounded-r' : 'hover:bg-slate-700 rounded-r'
                      }`}
                      onClick={() => setActiveFloorId(floor.id)}
                    >
                      <Layers className={`w-3 h-3 flex-shrink-0 ${floor.id === activeFloorId ? 'text-blue-400' : 'text-slate-500'}`} />
                      {editingFloorId === floor.id ? (
                        <input
                          className="flex-1 bg-slate-600 text-white text-xs px-1 py-0.5 rounded outline-none border border-blue-500"
                          value={editingFloorName}
                          onChange={e => setEditingFloorName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { renameFloor(building.id, floor.id, editingFloorName); setEditingFloorId(null); }
                            if (e.key === 'Escape') setEditingFloorId(null);
                          }}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <span className="flex-1 text-xs text-slate-300 truncate">{floor.name}</span>
                      )}
                      <span className="text-[10px] text-slate-500">{floor.level >= 0 ? `EG+${floor.level}` : `UG${Math.abs(floor.level)}`}</span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                        <button onClick={e => { e.stopPropagation(); setEditingFloorId(floor.id); setEditingFloorName(floor.name); }} className="w-4 h-4 hover:text-white text-slate-500 flex items-center justify-center">
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                        {building.floors.length > 1 && (
                          <button onClick={e => { e.stopPropagation(); deleteFloor(building.id, floor.id); }} className="w-4 h-4 hover:text-red-400 text-slate-500 flex items-center justify-center">
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-1 px-2 py-1">
                    <button
                      onClick={() => addFloor(building.id)}
                      className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-400 px-1 py-0.5 rounded hover:bg-slate-700"
                    >
                      <ChevronUp className="w-3 h-3" /> Stockwerk oben
                    </button>
                    <button
                      onClick={() => addFloorBelow(building.id)}
                      className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-400 px-1 py-0.5 rounded hover:bg-slate-700"
                    >
                      <ChevronDown className="w-3 h-3" /> Unter
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-800 flex-shrink-0 gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-200">{activeBuilding?.name}</span>
            {activeFloor && (
              <>
                <span className="text-slate-600">/</span>
                <span className="text-sm text-slate-400">{activeFloor.name}</span>
                <span className="text-xs text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">{activeFloor.height}m Deckenhöhe</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 bg-slate-700 rounded-md p-0.5">
              <button
                onClick={() => setViewMode('3d')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${viewMode === '3d' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <Box className="w-3.5 h-3.5" />
                3D
              </button>
              <button
                onClick={() => setViewMode('floor')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'floor' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <Layers className="w-3.5 h-3.5" />
                Grundriss
              </button>
            </div>

            {viewMode === 'floor' && (
              <div className="flex items-center gap-0.5 bg-slate-700 rounded-md p-0.5">
                <button
                  onClick={() => setTool('select')}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${tool === 'select' ? 'bg-slate-500 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="Auswählen / Verschieben"
                >
                  <MousePointer className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setTool('room')}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${tool === 'room' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="Raum zeichnen"
                >
                  <Square className="w-3.5 h-3.5" />
                  Raum
                </button>
                <button
                  onClick={() => setTool('delete')}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${tool === 'delete' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  title="Raum löschen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {viewMode === 'floor' && tool === 'room' && (
              <select
                value={newRoomType}
                onChange={e => setNewRoomType(e.target.value as RoomType)}
                className="bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1 outline-none"
              >
                {(Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map(t => (
                  <option key={t} value={t}>{ROOM_TYPE_LABELS[t]}</option>
                ))}
              </select>
            )}

            <button
              onClick={() => setShowRoomPanel(p => !p)}
              className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white rounded text-xs border border-slate-600"
              title="Eigenschaften"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            {viewMode === '3d' ? (
              <BuildingCanvas3D
                buildings={buildings}
                activeFloorId={activeFloorId}
                selectedRoomId={selectedRoomId}
                onSelectRoom={setSelectedRoomId}
                highlightFloor={true}
              />
            ) : activeFloor ? (
              <FloorPlanEditor
                floor={activeFloor}
                selectedRoomId={selectedRoomId}
                tool={tool}
                onAddRoom={handleAddRoom}
                onSelectRoom={setSelectedRoomId}
                onMoveRoom={handleMoveRoom}
                onResizeRoom={() => {}}
                onDeleteRoom={handleDeleteRoom}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                Kein Stockwerk ausgewählt
              </div>
            )}
          </div>

          {showRoomPanel && (
            <div className="w-60 flex-shrink-0 border-l border-slate-700 bg-slate-800 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Eigenschaften</span>
                <button onClick={() => setShowRoomPanel(false)} className="w-4 h-4 text-slate-500 hover:text-white flex items-center justify-center">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-3 space-y-4">
                {selectedRoom ? (
                  <>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Name</label>
                      <input
                        className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                        value={selectedRoom.name}
                        onChange={e => handleUpdateRoom({ name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Typ</label>
                      <select
                        className="w-full bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded px-2 py-1.5 outline-none"
                        value={selectedRoom.type}
                        onChange={e => handleUpdateRoom({ type: e.target.value as RoomType, color: ROOM_COLORS[e.target.value] || selectedRoom.color })}
                      >
                        {(Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map(t => (
                          <option key={t} value={t}>{ROOM_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Breite (m)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                          value={selectedRoom.width}
                          onChange={e => handleUpdateRoom({ width: parseFloat(e.target.value) || 1 })}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Tiefe (m)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="1"
                          className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                          value={selectedRoom.depth}
                          onChange={e => handleUpdateRoom({ depth: parseFloat(e.target.value) || 1 })}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">X-Position (m)</label>
                        <input
                          type="number"
                          step="0.5"
                          className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                          value={selectedRoom.x}
                          onChange={e => handleUpdateRoom({ x: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Y-Position (m)</label>
                        <input
                          type="number"
                          step="0.5"
                          className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                          value={selectedRoom.y}
                          onChange={e => handleUpdateRoom({ y: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Farbe</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          className="w-8 h-7 rounded cursor-pointer bg-transparent border-0"
                          value={selectedRoom.color}
                          onChange={e => handleUpdateRoom({ color: e.target.value })}
                        />
                        <span className="text-xs text-slate-400">{selectedRoom.color}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-700">
                      <div className="text-[10px] text-slate-500 mb-1">Fläche</div>
                      <div className="text-sm font-semibold text-slate-200">
                        {(selectedRoom.width * selectedRoom.depth).toFixed(1)} m²
                      </div>
                    </div>
                    <button
                      onClick={() => { if (activeBuilding && activeFloor) deleteRoom(activeBuilding.id, activeFloor.id, selectedRoom.id); }}
                      className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 border border-red-800 rounded text-xs mt-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Raum löschen
                    </button>
                  </>
                ) : activeFloor ? (
                  <>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Stockwerk</label>
                      <input
                        className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                        value={activeFloor.name}
                        onChange={e => activeBuilding && renameFloor(activeBuilding.id, activeFloor.id, e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Deckenhöhe (m)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="2.0"
                        max="10"
                        className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs px-2 py-1.5 rounded outline-none focus:border-blue-500"
                        value={activeFloor.height}
                        onChange={e => activeBuilding && updateFloorHeight(activeBuilding.id, activeFloor.id, parseFloat(e.target.value) || 3)}
                      />
                    </div>
                    <div className="pt-2 border-t border-slate-700">
                      <div className="text-[10px] text-slate-500 mb-2">Räume ({activeFloor.rooms.length})</div>
                      <div className="space-y-1">
                        {activeFloor.rooms.map(r => (
                          <div
                            key={r.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded bg-slate-700 cursor-pointer hover:bg-slate-600"
                            onClick={() => setSelectedRoomId(r.id)}
                          >
                            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: r.color }} />
                            <span className="flex-1 text-xs text-slate-300 truncate">{r.name}</span>
                            <span className="text-[10px] text-slate-500">{(r.width * r.depth).toFixed(0)}m²</span>
                          </div>
                        ))}
                        {activeFloor.rooms.length === 0 && (
                          <div className="text-xs text-slate-500 text-center py-4">
                            Zum Grundriss wechseln und Räume einzeichnen
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-500 text-center py-8">
                    Stockwerk auswählen
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-slate-700">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Raumtypen</div>
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map(t => (
                    <div key={t} className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ROOM_TYPE_COLORS[t] }} />
                      <span className="text-[10px] text-slate-400">{ROOM_TYPE_LABELS[t]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

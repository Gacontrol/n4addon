import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard as Edit3, Layers, Search, AlertTriangle } from 'lucide-react';
import { BuildingLayerMode, LAYER_MODES } from '../types/bms';
import { BuildingCanvas3D } from '../components/building/BuildingCanvas3D';
import { LayerSelector } from '../components/bms/LayerSelector';
import { LegendPanel } from '../components/bms/LegendPanel';
import { RoomTooltip } from '../components/bms/RoomTooltip';
import { useBuildingMonitor } from '../hooks/useBuildingMonitor';
import { useBuildingContext } from '../context/BuildingContext';

function getRoomLayerColor(value: number | null, layer: BuildingLayerMode): string {
  const mode = LAYER_MODES.find(m => m.id === layer);
  if (!mode || !value || mode.colorScale.stops.length === 0) return '';
  const { stops, min, max } = mode.colorScale;
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].at && t <= stops[i + 1].at) {
      const localT = (t - stops[i].at) / (stops[i + 1].at - stops[i].at);
      return interpolateHex(stops[i].color, stops[i + 1].color, localT);
    }
  }
  return stops[stops.length - 1]?.color ?? '';
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function interpolateHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

export function BuildingMonitorPage() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<string>('all');
  const { buildings } = useBuildingContext();

  const building = buildings.find(b => b.id === buildingId);

  const allRoomIds = useMemo(() => {
    if (!building) return [];
    return building.floors.flatMap(f => f.rooms.map(r => r.id));
  }, [building]);

  const {
    activeLayer,
    hoveredRoomId,
    roomValues,
    setActiveLayer,
    setHoveredRoom,
    getRoomLayerValue,
  } = useBuildingMonitor(allRoomIds);

  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleRoomHover = useCallback((roomId: string | null, clientX?: number, clientY?: number) => {
    setHoveredRoom(roomId);
    if (clientX !== undefined && clientY !== undefined) {
      setTooltipPos({ x: clientX, y: clientY });
    }
  }, [setHoveredRoom]);

  const handleRoomClick = useCallback((roomId: string | null) => {
    if (roomId) {
      navigate(`/building/${buildingId}/room/${roomId}/monitor`);
    }
  }, [buildingId, navigate]);

  const buildingsWithLayerColors = useMemo(() => {
    if (!building || activeLayer === 'normal') return buildings;
    const coloredBuilding = {
      ...building,
      floors: building.floors.map(floor => ({
        ...floor,
        rooms: floor.rooms.map(room => {
          const lv = getRoomLayerValue(room.id);
          const layerColor = lv?.value !== null && lv?.value !== undefined
            ? getRoomLayerColor(lv.value as number, activeLayer)
            : '';
          return layerColor ? { ...room, color: layerColor } : room;
        }),
      })),
    };
    return buildings.map(b => b.id === buildingId ? coloredBuilding : b);
  }, [buildings, building, activeLayer, buildingId, getRoomLayerValue]);

  const hoveredRoom = useMemo(() => {
    if (!hoveredRoomId || !building) return null;
    for (const f of building.floors) {
      const r = f.rooms.find(r => r.id === hoveredRoomId);
      if (r) return r;
    }
    return null;
  }, [hoveredRoomId, building]);

  const hoveredRoomLiveValue = hoveredRoomId ? getRoomLayerValue(hoveredRoomId) : null;

  const filteredRooms = useMemo(() => {
    if (!building) return [];
    return building.floors
      .filter(f => selectedFloorFilter === 'all' || f.id === selectedFloorFilter)
      .flatMap(f => f.rooms.map(r => ({ room: r, floor: f })))
      .filter(({ room }) => !searchQuery || room.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [building, selectedFloorFilter, searchQuery]);

  const alarmRooms = useMemo(() => {
    return roomValues.filter(v => v.status === 'alarm').map(v => v.roomId);
  }, [roomValues]);

  if (!building) {
    return (
      <div className="flex h-screen bg-slate-950 items-center justify-center text-slate-400">
        <div className="text-center">
          <p className="mb-4">Gebäude nicht gefunden</p>
          <button onClick={() => navigate(-1)} className="px-4 py-2 bg-slate-700 rounded-lg text-sm hover:bg-slate-600 transition-colors">
            Zurück
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200">
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={15} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-semibold text-white">{building.name}</span>
          <span className="text-xs text-slate-500">Monitor</span>
        </div>
        {alarmRooms.length > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-950/60 border border-red-800/50 text-xs text-red-300 ml-2">
            <AlertTriangle size={11} />
            {alarmRooms.length} Alarm{alarmRooms.length > 1 ? 'e' : ''}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => navigate(`/building/${buildingId}/editor`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-200 transition-colors"
          >
            <Edit3 size={12} />
            Editor
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${sidebarOpen ? 'bg-slate-700 text-slate-200' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            <Layers size={12} />
            Ebenen
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <div className="w-52 border-r border-slate-800 flex flex-col bg-slate-900 overflow-y-auto">
            <LayerSelector active={activeLayer} onChange={setActiveLayer} />
            <div className="border-t border-slate-800 p-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1 mb-2">
                Etagen
              </p>
              <button
                onClick={() => setSelectedFloorFilter('all')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors mb-1 ${selectedFloorFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
              >
                Alle Etagen
              </button>
              {building.floors.slice().sort((a, b) => b.level - a.level).map(floor => (
                <button
                  key={floor.id}
                  onClick={() => setSelectedFloorFilter(floor.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors mb-0.5 ${selectedFloorFilter === floor.id ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                >
                  {floor.name}
                  <span className="ml-1 text-slate-500">({floor.rooms.length})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 relative overflow-hidden">
          <BuildingCanvas3D
            buildings={buildingsWithLayerColors}
            activeFloorId={selectedFloorFilter === 'all' ? null : selectedFloorFilter}
            selectedRoomId={null}
            selectedWallId={null}
            onSelectRoom={handleRoomClick}
            onSelectWall={() => {}}
            highlightFloor={false}
            bgColor="#0a0f1a"
            buildingMode="normal"
            onRoomHover={handleRoomHover}
          />

          <div className="absolute bottom-4 left-4 pointer-events-none">
            <LegendPanel activeLayer={activeLayer} />
          </div>

          <div className="absolute top-3 left-3 flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Raum suchen..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-600 w-44"
              />
            </div>
          </div>

          {searchQuery && filteredRooms.length > 0 && (
            <div className="absolute top-12 left-3 bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl overflow-hidden w-52 max-h-48 overflow-y-auto z-20">
              {filteredRooms.slice(0, 8).map(({ room, floor }) => (
                <button
                  key={room.id}
                  onClick={() => navigate(`/building/${buildingId}/room/${room.id}/monitor`)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700 transition-colors text-left"
                >
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: room.color || '#94a3b8' }} />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-200 truncate">{room.name}</p>
                    <p className="text-xs text-slate-500">{floor.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="absolute bottom-4 right-4 bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-3 text-xs text-slate-400">
            <p className="font-medium text-slate-300 mb-1">{building.name}</p>
            <p>{building.floors.length} Etagen · {allRoomIds.length} Räume</p>
            {alarmRooms.length > 0 && (
              <p className="text-red-400 mt-1 flex items-center gap-1">
                <AlertTriangle size={10} />
                {alarmRooms.length} aktive Alarme
              </p>
            )}
          </div>
        </div>

        {sidebarOpen && filteredRooms.length > 0 && (
          <div className="w-52 border-l border-slate-800 flex flex-col bg-slate-900 overflow-hidden">
            <div className="p-2 border-b border-slate-800">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                Räume ({filteredRooms.length})
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5">
              {filteredRooms.map(({ room, floor }) => {
                const lv = getRoomLayerValue(room.id);
                const hasAlarm = lv?.status === 'alarm';
                return (
                  <button
                    key={room.id}
                    onClick={() => navigate(`/building/${buildingId}/room/${room.id}/monitor`)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-slate-800 transition-colors text-left group"
                  >
                    <span
                      className="w-2 h-2 rounded-sm shrink-0"
                      style={{ background: lv && activeLayer !== 'normal' ? (getRoomLayerColor(lv.value as number, activeLayer) || room.color) : room.color || '#94a3b8' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 truncate group-hover:text-white">{room.name}</p>
                      {lv && activeLayer !== 'normal' && (
                        <p className={`text-xs ${hasAlarm ? 'text-red-400' : 'text-slate-500'}`}>
                          {lv.formattedValue}
                        </p>
                      )}
                      {!lv && (
                        <p className="text-xs text-slate-600">{floor.name}</p>
                      )}
                    </div>
                    {hasAlarm && <AlertTriangle size={10} className="text-red-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {hoveredRoom && (
        <RoomTooltip
          room={hoveredRoom}
          liveValue={hoveredRoomLiveValue}
          activeLayer={activeLayer}
          x={tooltipPos.x}
          y={tooltipPos.y}
        />
      )}
    </div>
  );
}

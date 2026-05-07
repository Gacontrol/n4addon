import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCanvas3DSettingsReadOnly } from '../hooks/useCanvas3DSettings';
import { ArrowLeft, CreditCard as Edit3, Layers, Search, AlertTriangle } from 'lucide-react';
import { MonitorLayer } from '../types/building';
import { BuildingCanvas3D } from '../components/building/BuildingCanvas3D';
import { LayerSelector } from '../components/bms/LayerSelector';
import { LegendPanel } from '../components/bms/LegendPanel';
import { RoomTooltip } from '../components/bms/RoomTooltip';
import { RoomMonitorPage } from './RoomMonitorPage';
import { useBuildingMonitor } from '../hooks/useBuildingMonitor';
import { useBuildingContext } from '../context/BuildingContext';
import { RoomDataPointConfig } from '../types/bms';

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

function getRoomLayerColor(value: number, layer: MonitorLayer): string {
  const { stops, min, max } = layer.colorScale;
  if (stops.length === 0) return '';
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].at && t <= stops[i + 1].at) {
      const localT = (t - stops[i].at) / (stops[i + 1].at - stops[i].at);
      return interpolateHex(stops[i].color, stops[i + 1].color, localT);
    }
  }
  return stops[stops.length - 1]?.color ?? '';
}

interface BuildingMonitorPageProps {
  buildingId?: string;
  onBack?: () => void;
  onOpenEditor?: () => void;
  onOpenRoom?: (roomId: string) => void;
  liveValues?: Record<string, unknown>;
}

export function BuildingMonitorPage({ buildingId: propBuildingId, onBack, onOpenEditor, liveValues = {} }: BuildingMonitorPageProps) {
  const params = useParams<{ buildingId: string }>();
  const navigate = useNavigate();
  const buildingId = propBuildingId ?? params.buildingId;

  const handleBack = onBack ?? (() => navigate('/'));
  const handleOpenEditor = onOpenEditor ?? (() => navigate(`/building/${buildingId}/editor`));

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<string>('all');
  const [openRoomId, setOpenRoomId] = useState<string | null>(null);
  const { buildings, monitorConfigs } = useBuildingContext();

  const building = buildings.find(b => b.id === buildingId);
  const monitorLayers: MonitorLayer[] = building?.monitorLayers ?? [];

  const allRoomIds = useMemo(() => {
    if (!building) return [];
    return building.floors.flatMap(f => f.rooms.map(r => r.id));
  }, [building]);

  const {
    activeLayerId,
    hoveredRoomId,
    roomValues,
    setActiveLayer,
    setHoveredRoom,
    getRoomLayerValue,
  } = useBuildingMonitor(allRoomIds, monitorLayers);

  const activeMonitorLayer = useMemo(
    () => monitorLayers.find(l => l.id === activeLayerId) ?? null,
    [monitorLayers, activeLayerId]
  );

  const canvas3D = useCanvas3DSettingsReadOnly();
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleRoomHover = useCallback((roomId: string | null, clientX?: number, clientY?: number) => {
    setHoveredRoom(roomId);
    if (clientX !== undefined && clientY !== undefined) {
      setTooltipPos({ x: clientX, y: clientY });
    }
  }, [setHoveredRoom]);

  const handleRoomClick = useCallback((roomId: string | null) => {
    setOpenRoomId(roomId);
  }, []);

  const buildingsWithLayerColors = useMemo(() => {
    if (!building || activeLayerId === 'normal' || !activeMonitorLayer) return buildings;
    const coloredBuilding = {
      ...building,
      floors: building.floors.map(floor => ({
        ...floor,
        rooms: floor.rooms.map(room => {
          const lv = getRoomLayerValue(room.id);
          const layerColor = lv?.value !== null && lv?.value !== undefined
            ? getRoomLayerColor(lv.value as number, activeMonitorLayer)
            : '';
          return layerColor ? { ...room, color: layerColor } : room;
        }),
      })),
    };
    return buildings.map(b => b.id === buildingId ? coloredBuilding : b);
  }, [buildings, building, activeLayerId, activeMonitorLayer, buildingId, getRoomLayerValue]);

  const hoveredRoom = useMemo(() => {
    if (!hoveredRoomId || !building) return null;
    for (const f of building.floors) {
      const r = f.rooms.find(r => r.id === hoveredRoomId);
      if (r) return r;
    }
    return null;
  }, [hoveredRoomId, building]);

  const hoveredRoomLiveValue = hoveredRoomId ? getRoomLayerValue(hoveredRoomId) : null;

  const hoveredRoomTooltipDps = useMemo((): Array<{ dp: RoomDataPointConfig; value: unknown }> => {
    if (!hoveredRoomId) return [];
    const cfg = monitorConfigs[hoveredRoomId];
    if (!cfg) return [];
    return cfg.datapoints
      .filter(dp => dp.showInTooltip || dp.isPrimaryRoomKPI)
      .sort((a, b) => {
        if (a.isPrimaryRoomKPI && !b.isPrimaryRoomKPI) return -1;
        if (!a.isPrimaryRoomKPI && b.isPrimaryRoomKPI) return 1;
        return a.order - b.order;
      })
      .map(dp => {
        const key = dp.sourceDatapoint || dp.datapointId;
        const cleanKey = key.startsWith('ext-') ? key.slice(4) : key;
        return { dp, value: liveValues[cleanKey] ?? liveValues[key] };
      });
  }, [hoveredRoomId, monitorConfigs, liveValues]);

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
          <button onClick={handleBack} className="px-4 py-2 bg-slate-700 rounded-lg text-sm hover:bg-slate-600 transition-colors">
            Zurück
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center gap-3">
        <button
          onClick={handleBack}
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
            onClick={handleOpenEditor}
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
            <LayerSelector
              active={activeLayerId}
              onChange={setActiveLayer}
              monitorLayers={monitorLayers}
            />
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
            isolateActiveFloor={selectedFloorFilter !== 'all'}
            selectedRoomId={openRoomId}
            selectedWallId={null}
            onSelectRoom={handleRoomClick}
            onSelectWall={() => {}}
            highlightFloor={selectedFloorFilter !== 'all'}
            bgColor={canvas3D.bgColor}
            bgTransparent={canvas3D.bgTransparent}
            buildingMode={canvas3D.buildingMode}
            lighting={canvas3D.lighting}
            explosion={canvas3D.explosion}
            wallsTransparent={canvas3D.wallsTransparent}
            xrayOpacity={canvas3D.xrayOpacity}
            floorTransparent={canvas3D.floorTransparent}
            showGrid={canvas3D.showGrid}
            autoRotate={canvas3D.autoRotate}
            onRoomHover={handleRoomHover}
            liveValues={liveValues as Record<string, string | number>}
          />

          <div className="absolute bottom-4 left-4 pointer-events-none">
            <LegendPanel activeLayerId={activeLayerId} monitorLayers={monitorLayers} />
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
                  onClick={() => setOpenRoomId(room.id)}
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
          <div className="w-56 border-l border-slate-800 flex flex-col bg-slate-900 overflow-hidden">
            <div className="p-2 border-b border-slate-800 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                Räume ({filteredRooms.length})
              </p>
              {activeMonitorLayer && (
                <span className="text-[10px] text-sky-400 px-1">{activeMonitorLayer.name}</span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-1.5">
              {filteredRooms.map(({ room, floor }) => {
                const lv = getRoomLayerValue(room.id);
                const hasAlarm = lv?.status === 'alarm';
                const displayColor = lv && activeLayerId !== 'normal' && activeMonitorLayer
                  ? (getRoomLayerColor(lv.value as number, activeMonitorLayer) || room.color)
                  : room.color || '#94a3b8';
                const roomCfg = monitorConfigs[room.id];
                const primaryDps = roomCfg?.datapoints
                  .filter(dp => dp.isPrimaryRoomKPI || dp.showInTooltip)
                  .sort((a, b) => {
                    if (a.isPrimaryRoomKPI && !b.isPrimaryRoomKPI) return -1;
                    if (!a.isPrimaryRoomKPI && b.isPrimaryRoomKPI) return 1;
                    return a.order - b.order;
                  })
                  .slice(0, 2) ?? [];
                return (
                  <button
                    key={room.id}
                    onClick={() => setOpenRoomId(room.id)}
                    className="w-full flex items-start gap-2 px-2 py-2 rounded-md hover:bg-slate-800 transition-colors text-left group border-b border-slate-800/50 last:border-0"
                  >
                    <span className="w-2 h-2 rounded-sm shrink-0 mt-1" style={{ background: displayColor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 truncate group-hover:text-white font-medium">{room.name}</p>
                      {lv && activeLayerId !== 'normal' ? (
                        <p className={`text-xs font-semibold ${hasAlarm ? 'text-red-400' : 'text-sky-300'}`}>
                          {lv.formattedValue}
                        </p>
                      ) : primaryDps.length > 0 ? (
                        <div className="mt-0.5 space-y-0.5">
                          {primaryDps.map(dp => {
                            const key = dp.sourceDatapoint || dp.datapointId;
                            const cleanKey = key.startsWith('ext-') ? key.slice(4) : key;
                            const rawVal = liveValues[cleanKey] ?? liveValues[key];
                            const formatted = rawVal === undefined || rawVal === null ? '—'
                              : typeof rawVal === 'boolean' ? (rawVal ? 'Ein' : 'Aus')
                              : typeof rawVal === 'number' ? (Number.isInteger(rawVal) ? String(rawVal) : rawVal.toFixed(1)) + (dp.unit ? ' ' + dp.unit : '')
                              : String(rawVal) + (dp.unit ? ' ' + dp.unit : '');
                            return (
                              <div key={dp.datapointId} className="flex items-center justify-between gap-1">
                                <span className="text-[10px] text-slate-500 truncate">{dp.label}</span>
                                <span className="text-[10px] font-semibold text-slate-300 shrink-0">{formatted}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-600">{floor.name}</p>
                      )}
                    </div>
                    {hasAlarm && <AlertTriangle size={10} className="text-red-400 shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {hoveredRoom && !openRoomId && (
        <RoomTooltip
          room={hoveredRoom}
          liveValue={hoveredRoomLiveValue}
          activeLayerId={activeLayerId}
          activeLayer={activeMonitorLayer}
          tooltipDps={hoveredRoomTooltipDps}
          x={tooltipPos.x}
          y={tooltipPos.y}
        />
      )}

      {openRoomId && (
        <RoomMonitorPage
          buildingId={buildingId}
          roomId={openRoomId}
          asPanel
          liveValues={liveValues}
          onBack={() => setOpenRoomId(null)}
          onOpenConfig={() => navigate(`/building/${buildingId}/room/${openRoomId}/config`)}
        />
      )}
    </div>
  );
}

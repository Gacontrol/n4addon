import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Hexagon } from 'lucide-react';
import { Breadcrumbs } from '../components/bms/Breadcrumbs';
import { useBuildingContext } from '../context/BuildingContext';
import { PanelDesigner } from '../components/building/PanelDesigner';
import type { DatapointGroup } from '../components/building/RoomBindingsPanel';

interface RoomConfigPageProps {
  buildingId?: string;
  roomId?: string;
  onBack?: () => void;
  onOpenMonitor?: () => void;
  onSwitchTo3D?: () => void;
  onSwitchToRooms?: () => void;
  datapointGroups?: DatapointGroup[];
}

export function RoomConfigPage({
  buildingId: propBuildingId,
  roomId: propRoomId,
  onBack,
  onOpenMonitor,
  onSwitchTo3D,
  onSwitchToRooms,
  datapointGroups: propDatapointGroups,
}: RoomConfigPageProps) {
  const params = useParams<{ buildingId: string; roomId: string }>();
  const navigate = useNavigate();
  const bId = propBuildingId ?? params.buildingId;
  const rId = propRoomId ?? params.roomId;
  const goBack = onBack ?? (() => navigate(-1));
  const goMonitor = onOpenMonitor ?? (() => navigate(`/building/${bId}/room/${rId}/monitor`));
  const { buildings, datapointGroups: ctxGroups } = useBuildingContext();
  const datapointGroups = propDatapointGroups ?? ctxGroups;

  const building = buildings.find(b => b.id === bId);
  const { floor, room } = useMemo(() => {
    if (!building) return { floor: null, room: null };
    for (const f of building.floors) {
      const r = f.rooms.find(r => r.id === rId);
      if (r) return { floor: f, room: r };
    }
    return { floor: null, room: null };
  }, [building, rId]);

  if (!building || !room || !floor) {
    return (
      <div className="flex h-full bg-slate-950 text-slate-200 items-center justify-center">
        <p className="text-slate-400 mr-4">Raum nicht gefunden</p>
        <button onClick={goBack} className="px-4 py-2 bg-slate-700 rounded-lg text-sm">Zurück</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200 overflow-hidden">
      <header className="bg-slate-900 border-b border-slate-800 px-5 py-2.5 shrink-0 flex items-center gap-3">
        <button onClick={goBack} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft size={15} />
        </button>
        <Building2 size={15} className="text-slate-400" />
        <span className="text-sm font-semibold text-slate-200">{building.name}</span>
        {(onSwitchTo3D || onSwitchToRooms) && (
          <div className="ml-2 flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            <button
              onClick={onSwitchTo3D}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-slate-400 hover:text-slate-200"
            >
              <Building2 size={13} />
              3D Gebäude-Editor
            </button>
            <button
              onClick={onSwitchToRooms}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all text-slate-400 hover:text-slate-200"
            >
              <Hexagon size={13} />
              Raum-Editor
            </button>
          </div>
        )}
        <Breadcrumbs items={[
          { label: room.name, onClick: goMonitor, icon: 'room' },
          { label: 'Panel-Designer' },
        ]} />
      </header>

      <div className="flex-1 overflow-hidden">
        <PanelDesigner
          key={room.id}
          room={room}
          floorName={floor.name}
          buildingId={building.id}
          datapointGroups={datapointGroups}
          onOpenMonitor={goMonitor}
        />
      </div>
    </div>
  );
}

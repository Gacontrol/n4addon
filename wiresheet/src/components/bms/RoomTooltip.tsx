import { AlertTriangle, Clock } from 'lucide-react';
import { Room } from '../../types/building';
import { RoomLiveValue } from '../../types/bms';
import { MonitorLayer } from '../../types/building';

interface RoomTooltipProps {
  room: Room;
  liveValue: RoomLiveValue | null;
  activeLayerId: string;
  activeLayer?: MonitorLayer | null;
  x: number;
  y: number;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'alarm': return '#ef4444';
    case 'warning': return '#f59e0b';
    case 'ok': return '#22c55e';
    default: return '#64748b';
  }
}

export function RoomTooltip({ room, liveValue, activeLayerId, activeLayer, x, y }: RoomTooltipProps) {
  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ left: x + 14, top: y - 8 }}
    >
      <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-3 min-w-[180px] max-w-[240px]">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <p className="text-sm font-semibold text-white leading-tight">{room.name}</p>
            {room.number && (
              <p className="text-xs text-slate-400">{room.number}</p>
            )}
          </div>
          {liveValue && (
            <div
              className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0"
              style={{ background: getStatusColor(liveValue.status) }}
            />
          )}
        </div>

        {liveValue && activeLayerId !== 'normal' && (
          <div className="bg-slate-700/60 rounded-md px-2.5 py-1.5 mb-2">
            <p className="text-xs text-slate-400">{activeLayer?.name ?? activeLayerId}</p>
            <p className="text-base font-bold text-white leading-tight">
              {liveValue.formattedValue}
            </p>
          </div>
        )}

        {liveValue?.status === 'alarm' && (
          <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-950/40 rounded px-2 py-1">
            <AlertTriangle size={11} />
            <span>Aktiver Alarm</span>
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-slate-700 flex items-center gap-1 text-xs text-slate-500">
          <Clock size={10} />
          <span>Klicken für Details</span>
        </div>
      </div>
    </div>
  );
}

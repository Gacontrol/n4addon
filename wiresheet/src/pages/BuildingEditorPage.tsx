import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Monitor, Hexagon, Building2 } from 'lucide-react';
import { BuildingView } from '../components/building/BuildingView';
import { RoomEditorView } from '../components/building/RoomEditorView';
import { useBuildingContext } from '../context/BuildingContext';
import { WiresheetPage, HaEntity } from '../types/flow';

type EditorSubMode = '3d' | 'rooms';

interface BuildingEditorPageProps {
  onBack?: () => void;
  onMonitor?: () => void;
  onOpenRoom?: (roomId: string) => void;
  onConfigRoom?: (roomId: string) => void;
  pages?: WiresheetPage[];
  haEntities?: HaEntity[];
  haLoading?: boolean;
  onLoadHaEntities?: () => void;
  liveValues?: Record<string, unknown>;
  editorMode?: EditorSubMode;
  onSetEditorMode?: (mode: EditorSubMode) => void;
}

export function BuildingEditorPage({ onBack, onMonitor, onOpenRoom, onConfigRoom, pages = [], haEntities = [], haLoading = false, onLoadHaEntities, liveValues = {}, editorMode: propEditorMode, onSetEditorMode }: BuildingEditorPageProps) {
  const params = useParams<{ buildingId: string }>();
  const navigate = useNavigate();
  const [localEditorMode, setLocalEditorMode] = useState<EditorSubMode>(propEditorMode ?? '3d');
  const editorMode = propEditorMode ?? localEditorMode;
  const setEditorMode = (m: EditorSubMode) => { setLocalEditorMode(m); onSetEditorMode?.(m); };
  const { buildings, replaceBuilding, isLoaded, activeBuildingId } = useBuildingContext();

  const logicPageGroups = useMemo(() => {
    return pages.map(page => ({
      pageId: page.id,
      pageName: page.name,
      datapoints: page.nodes
        .filter(n => n.type === 'datapoint' || n.type === 'dp-read' || n.type === 'dp-write'
          || n.type === 'ha-entity' || n.type === 'dp-boolean' || n.type === 'dp-numeric' || n.type === 'dp-enum')
        .map(n => {
          const cfg = n.data.config as Record<string, unknown> | undefined;
          // entityId must be the node's ID (= dpStore key used by server)
          // dpFacet / label are human-readable display names only
          const entityId = n.id;
          const facet = (cfg?.['dpFacet'] as string) || '';
          const label = facet || (n.data.label as string) || (cfg?.['label'] as string) || n.id;
          return { entityId, label };
        })
        .filter(d => d.entityId),
    })).filter(g => g.datapoints.length > 0);
  }, [pages]);

  const datapointLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const grp of logicPageGroups) {
      for (const dp of grp.datapoints) {
        if (dp.label && dp.label !== dp.entityId && !map[dp.entityId]) map[dp.entityId] = dp.label;
      }
    }
    for (const e of haEntities) {
      const friendly = (e.attributes as Record<string, unknown> | undefined)?.['friendly_name'];
      if (typeof friendly === 'string' && friendly.trim()) map[e.entity_id] = friendly;
    }
    return map;
  }, [logicPageGroups, haEntities]);

  const buildingId = params.buildingId ?? activeBuildingId;
  const building = buildings.find(b => b.id === buildingId);

  const handleBack = onBack ?? (() => navigate('/'));
  const handleMonitor = onMonitor ?? (() => navigate(`/building/${buildingId}/monitor`));

  if (!isLoaded) {
    return (
      <div className="flex h-screen bg-slate-950 items-center justify-center text-slate-400">
        <div className="text-center">
          <p className="text-sm">Gebäude wird geladen...</p>
        </div>
      </div>
    );
  }

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
    <div className="flex flex-col h-full bg-slate-950">
      <header className="bg-slate-900 border-b border-slate-700 px-4 py-2.5 flex items-center gap-3 shrink-0">
        <button
          onClick={handleBack}
          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={15} />
        </button>
        <Building2 size={15} className="text-slate-400" />
        <span className="text-sm font-semibold text-slate-200">{building.name}</span>
        <span className="text-xs text-slate-500">Editor</span>

        <div className="ml-4 flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setEditorMode('3d')}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              editorMode === '3d' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            <Building2 size={13} />
            3D Gebäude-Editor
          </button>
          <button
            onClick={() => setEditorMode('rooms')}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              editorMode === 'rooms' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            <Hexagon size={13} />
            Raum-Editor
          </button>
        </div>

        <div className="ml-auto">
          <button
            onClick={handleMonitor}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs text-white font-medium transition-colors"
          >
            <Monitor size={13} />
            Monitor-Modus
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {editorMode === '3d' ? (
          <BuildingView
            liveValues={{}}
            pages={pages}
            haEntities={haEntities}
            haLoading={haLoading}
            onLoadHaEntities={onLoadHaEntities}
          />
        ) : (
          <RoomEditorView
            building={building}
            onUpdateBuilding={replaceBuilding}
            onOpenRoom={onOpenRoom}
            onConfigRoom={onConfigRoom}
            datapointGroups={logicPageGroups}
            datapointLabels={datapointLabels}
            liveValues={liveValues}
          />
        )}
      </div>
    </div>
  );
}

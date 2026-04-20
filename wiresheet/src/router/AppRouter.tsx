import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BuildingProvider } from '../context/BuildingContext';
import { BuildingEditorPage } from '../pages/BuildingEditorPage';
import { BuildingMonitorPage } from '../pages/BuildingMonitorPage';
import { RoomMonitorPage } from '../pages/RoomMonitorPage';
import { RoomConfigPage } from '../pages/RoomConfigPage';

interface AppRouterProps {
  mainApp: React.ReactNode;
}

export function AppRouter({ mainApp }: AppRouterProps) {
  return (
    <HashRouter>
      <BuildingProvider>
        <Routes>
          <Route path="/" element={<>{mainApp}</>} />
          <Route path="/building/:buildingId/editor" element={<BuildingEditorPage />} />
          <Route path="/building/:buildingId/monitor" element={<BuildingMonitorPage />} />
          <Route path="/building/:buildingId/room/:roomId/monitor" element={<RoomMonitorPage />} />
          <Route path="/building/:buildingId/room/:roomId/config" element={<RoomConfigPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BuildingProvider>
    </HashRouter>
  );
}

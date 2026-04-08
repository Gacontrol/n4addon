import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Globe, RefreshCw, AlertTriangle, Loader2, ExternalLink, Maximize2 } from 'lucide-react';
import { RemoteVisuConfig } from '../../types/visualization';

interface VisuRemoteVisuProps {
  config: RemoteVisuConfig;
  isEditMode: boolean;
  width: number;
  height: number;
}

function getApiBase(): string {
  const path = window.location.pathname;
  const m = path.match(/^(\/api\/hassio_ingress\/[^/]+)/) || path.match(/^(\/app\/[^/]+)/);
  return m ? `${m[1]}/api` : '/api';
}

export const VisuRemoteVisu: React.FC<VisuRemoteVisuProps> = ({
  config,
  isEditMode,
  width,
  height
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reloadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasConfig = !!(config.instanceUrl && config.instanceToken);

  const targetPath = config.targetPath || '/';
  const cleanPath = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;

  const proxyUrl = hasConfig
    ? `${getApiBase()}/remote-visu-proxy?url=${encodeURIComponent(config.instanceUrl!)}${encodeURIComponent(cleanPath)}&token=${encodeURIComponent(config.instanceToken!)}&_rk=${reloadKey}`
    : null;

  const scale = config.scale ?? 1;

  const handleLoad = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  const handleError = useCallback(() => {
    setLoading(false);
    setError('Verbindung fehlgeschlagen');
  }, []);

  const triggerReload = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey(k => k + 1);
  }, []);

  useEffect(() => {
    if (reloadTimerRef.current) clearInterval(reloadTimerRef.current);
    if (config.refreshIntervalMs && config.refreshIntervalMs > 0 && hasConfig) {
      reloadTimerRef.current = setInterval(() => {
        setReloadKey(k => k + 1);
      }, config.refreshIntervalMs);
    }
    return () => {
      if (reloadTimerRef.current) clearInterval(reloadTimerRef.current);
    };
  }, [config.refreshIntervalMs, hasConfig]);

  useEffect(() => {
    if (hasConfig) {
      setLoading(true);
      setError(null);
    }
  }, [config.instanceUrl, config.instanceToken, config.targetPath, reloadKey, hasConfig]);

  const borderRadius = config.borderRadius ?? 6;
  const borderStyle = config.showBorder
    ? `1px solid ${config.borderColor || '#334155'}`
    : 'none';

  if (!hasConfig) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-900/80 rounded"
        style={{ borderRadius, border: borderStyle }}
      >
        <Globe className="w-8 h-8 text-slate-600" />
        <div className="text-center px-3">
          <div className="text-xs font-medium text-slate-400 mb-1">Externe Visu</div>
          <div className="text-[10px] text-slate-600">
            {isEditMode
              ? 'Instanz und Pfad in den Einstellungen konfigurieren'
              : 'Nicht konfiguriert'}
          </div>
        </div>
      </div>
    );
  }

  const scaledWidth = width / scale;
  const scaledHeight = height / scale;

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{ borderRadius, border: borderStyle, background: '#0f172a' }}
    >
      {loading && config.showLoadingIndicator !== false && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-900/70 pointer-events-none">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-2 bg-slate-900/90">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          <div className="text-xs text-red-300 text-center px-4">{error}</div>
          <button
            onClick={triggerReload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded text-xs transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Neu laden
          </button>
        </div>
      )}

      {isEditMode && (
        <div className="absolute top-1.5 right-1.5 z-20 flex gap-1">
          <button
            onClick={triggerReload}
            className="p-1 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded transition-colors"
            title="Neu laden"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <a
            href={`${config.instanceUrl}${cleanPath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded transition-colors"
            title="In neuem Tab öffnen"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {!isEditMode && (
        <div className="absolute top-1.5 right-1.5 z-20 flex gap-1 opacity-0 hover:opacity-100 transition-opacity">
          <button
            onClick={triggerReload}
            className="p-1 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded transition-colors"
            title="Neu laden"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <a
            href={`${config.instanceUrl}${cleanPath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded transition-colors"
            title="Vollbild öffnen"
          >
            <Maximize2 className="w-3 h-3" />
          </a>
        </div>
      )}

      {proxyUrl && !error && (
        <iframe
          ref={iframeRef}
          key={`rv-${reloadKey}-${config.instanceUrl}-${config.targetPath}`}
          src={proxyUrl}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            width: scale !== 1 ? `${scaledWidth}px` : '100%',
            height: scale !== 1 ? `${scaledHeight}px` : '100%',
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: scale !== 1 ? 'top left' : undefined,
            border: 'none',
            display: 'block',
            borderRadius,
          }}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          allow="fullscreen"
          title={`Remote Visu: ${config.instanceUrl}`}
        />
      )}
    </div>
  );
};

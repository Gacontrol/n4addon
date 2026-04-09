import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Globe, RefreshCw, AlertTriangle, Loader2, ExternalLink, Maximize2, WifiOff } from 'lucide-react';
import { RemoteVisuConfig } from '../../types/visualization';

interface VisuRemoteVisuProps {
  config: RemoteVisuConfig;
  isEditMode: boolean;
  width: number;
  height: number;
}

const apiBase = (() => {
  const path = window.location.pathname;
  const m = path.match(/^(\/api\/hassio_ingress\/[^/]+)/) || path.match(/^(\/app\/[^/]+)/);
  return m ? m[1] : '';
})();

export const VisuRemoteVisu: React.FC<VisuRemoteVisuProps> = React.memo(({
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
  const abortRef = useRef<AbortController | null>(null);

  const hasConfig = !!(config.visuBaseUrl && config.instanceToken && config.visuPageId);

  const visuUrl = useMemo(() => {
    if (!config.instanceToken) return null;
    const base = (config.visuBaseUrl || '').replace(/\/$/, '');
    if (!base) return null;
    const pageParam = config.visuPageId ? `?page=${encodeURIComponent(config.visuPageId)}` : '';
    return `${base}${pageParam}`;
  }, [config.instanceToken, config.visuBaseUrl, config.visuPageId]);

  const proxyUrl = useMemo(() => {
    if (!hasConfig || !visuUrl) return null;
    return `${apiBase}/api/remote-visu-proxy?url=${encodeURIComponent(visuUrl)}&token=${encodeURIComponent(config.instanceToken!)}&instanceId=${encodeURIComponent(config.instanceId || '')}${config.wiresheetApiBase ? `&assetBase=${encodeURIComponent(config.wiresheetApiBase)}` : ''}&_rk=${reloadKey}`;
  }, [hasConfig, visuUrl, config.instanceToken, config.instanceId, config.wiresheetApiBase, reloadKey]);

  const scale = config.scale ?? 1;

  const checkProxyError = useCallback(async (url: string) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    try {
      const resp = await fetch(url, { signal: abortRef.current.signal });
      if (!resp.ok) {
        const contentType = resp.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await resp.json();
          if (data.__proxyError) {
            setError(data.message || `Fehler ${resp.status}`);
            setLoading(false);
            return;
          }
        }
        setError(`Externe Instanz nicht erreichbar (${resp.status})`);
        setLoading(false);
      } else {
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setError('Verbindung fehlgeschlagen');
      setLoading(false);
    }
  }, []);

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
    if (hasConfig && proxyUrl) {
      setLoading(true);
      setError(null);
      checkProxyError(proxyUrl);
    }
  }, [proxyUrl, hasConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const borderRadius = config.borderRadius ?? 6;
  const borderStyle = config.showBorder
    ? `1px solid ${config.borderColor || '#334155'}`
    : 'none';

  if (!hasConfig) {
    const notConfiguredMsg = !config.instanceId
      ? 'Instanz auswählen'
      : !config.visuPageId
      ? 'Visu-Seite auswählen'
      : 'Nicht konfiguriert';

    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-900/80 rounded"
        style={{ borderRadius, border: borderStyle }}
      >
        <Globe className="w-8 h-8 text-slate-600" />
        <div className="text-center px-3">
          <div className="text-xs font-medium text-slate-400 mb-1">Externe Visu</div>
          <div className="text-[10px] text-slate-600">
            {isEditMode ? notConfiguredMsg : 'Nicht konfiguriert'}
          </div>
        </div>
      </div>
    );
  }

  const cropTop = config.cropTop ?? 0;
  const cropRight = config.cropRight ?? 0;
  const cropBottom = config.cropBottom ?? 0;
  const cropLeft = config.cropLeft ?? 0;
  const hasCrop = cropTop > 0 || cropRight > 0 || cropBottom > 0 || cropLeft > 0;

  const iframeWidth = (width + cropLeft + cropRight) / scale;
  const iframeHeight = (height + cropTop + cropBottom) / scale;

  return (
    <div
      className="w-full h-full relative overflow-hidden"
      style={{ borderRadius, border: borderStyle, background: 'transparent' }}
    >
      {loading && config.showLoadingIndicator !== false && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-slate-900/70 pointer-events-none gap-2">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          <div className="text-[10px] text-slate-500 truncate max-w-[80%]">
            {config.visuPageName || 'Lade...'}
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 gap-2.5 bg-slate-900/95 px-4">
          <WifiOff className="w-8 h-8 text-slate-600" />
          <div className="text-center">
            <div className="text-xs font-medium text-slate-400 mb-1">Externe Visu nicht erreichbar</div>
            <div className="text-[10px] text-slate-500 leading-relaxed">{error}</div>
          </div>
          <button
            onClick={triggerReload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded text-xs transition-colors mt-1"
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
          {config.visuBaseUrl && (
            <a
              href={visuUrl || config.visuBaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded transition-colors"
              title="In neuem Tab öffnen"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
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
          {config.visuBaseUrl && (
            <a
              href={visuUrl || config.visuBaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 rounded transition-colors"
              title="Vollbild öffnen"
            >
              <Maximize2 className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {proxyUrl && !error && (
        <iframe
          ref={iframeRef}
          key={`rv-${reloadKey}-${config.visuBaseUrl}-${config.visuPageId}`}
          src={proxyUrl}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            width: `${iframeWidth}px`,
            height: `${iframeHeight}px`,
            position: 'absolute',
            top: `${-cropTop}px`,
            left: `${-cropLeft}px`,
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: 'top left',
            border: 'none',
            display: 'block',
          }}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          allow="fullscreen"
          title={`Remote Visu: ${config.visuPageName || config.visuPageId}`}
        />
      )}
    </div>
  );
});

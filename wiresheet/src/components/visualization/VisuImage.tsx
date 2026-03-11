import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Upload, X, FolderOpen } from 'lucide-react';
import { ImageConfig } from '../../types/visualization';
import { FileManager } from './FileManager';

function getApiBase(): string {
  const p = window.location.pathname;
  const m = p.match(/^(\/api\/hassio_ingress\/[^/]+)/) || p.match(/^(\/app\/[^/]+)/);
  return m ? m[1] : '';
}

interface VisuImageProps {
  config: ImageConfig;
  isEditMode: boolean;
  onUpdateConfig: (config: ImageConfig) => void;
  width: number;
  height: number;
}

export const VisuImage: React.FC<VisuImageProps> = ({ config, isEditMode, onUpdateConfig, width, height }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilePicker, setShowFilePicker] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    if (fileRef.current) fileRef.current.value = '';

    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload fehlgeschlagen');

      const data = await response.json();
      onUpdateConfig({ ...config, imageUrl: data.url, storagePath: data.url });
    } catch (err) {
      setError('Upload fehlgeschlagen');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (config.storagePath) {
      const filename = config.storagePath.split('/').pop();
      if (filename) {
        try {
          await fetch(`/api/images/${filename}`, { method: 'DELETE' });
        } catch {}
      }
    }
    onUpdateConfig({ ...config, imageUrl: undefined, storagePath: undefined });
  };

  if (!config.imageUrl) {
    if (!isEditMode) return null;
    return (
      <>
        <div
          className="w-full h-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-600 rounded-lg"
          style={{ backgroundColor: 'rgba(15,23,42,0.5)' }}
        >
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml,image/bmp,image/tiff,image/ico,image/x-icon,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp,.tif,.tiff,.ico" className="hidden" onChange={handleFileChange} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400">Hochladen...</span>
            </div>
          ) : (
            <>
              <ImageIcon className="w-8 h-8 text-slate-500" />
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 rounded text-xs text-blue-400 transition-colors"
                >
                  <Upload className="w-3 h-3" />
                  Bild hochladen
                </button>
                <button
                  onClick={() => setShowFilePicker(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded text-xs text-slate-300 transition-colors"
                >
                  <FolderOpen className="w-3 h-3" />
                  Aus Dateimanager
                </button>
              </div>
            </>
          )}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
        {showFilePicker && (
          <FileManager
            apiBase={getApiBase()}
            pickerMode
            onSelectImage={(url, rawUrl) => {
              const storeUrl = rawUrl ?? url;
              onUpdateConfig({ ...config, imageUrl: storeUrl, storagePath: storeUrl });
              setShowFilePicker(false);
            }}
            onClose={() => setShowFilePicker(false)}
          />
        )}
      </>
    );
  }

  const apiBase = getApiBase();
  const resolvedUrl = config.imageUrl
    ? config.imageUrl.startsWith('/api/')
      ? apiBase
        ? `${apiBase}${config.imageUrl.slice(4)}`
        : config.imageUrl
      : config.imageUrl
    : undefined;

  return (
    <div className="w-full h-full relative group" style={{ borderRadius: config.borderRadius ?? 0 }}>
      <img
        src={resolvedUrl}
        alt="Visu Bild"
        style={{
          width: '100%',
          height: '100%',
          objectFit: config.objectFit ?? 'contain',
          opacity: config.opacity ?? 1,
          borderRadius: config.borderRadius ?? 0,
          display: 'block'
        }}
      />
      {isEditMode && (
        <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-lg p-2">
          <button
            className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors"
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
          >
            <Upload className="w-3 h-3" />
            Hochladen
          </button>
          <button
            className="flex items-center gap-1 px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white text-xs rounded transition-colors"
            onClick={(e) => { e.stopPropagation(); setShowFilePicker(true); }}
          >
            <FolderOpen className="w-3 h-3" />
            Dateimanager
          </button>
          <button
            className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
            onClick={(e) => { e.stopPropagation(); handleRemove(); }}
          >
            <X className="w-3 h-3" />
            Entfernen
          </button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml,image/bmp,image/tiff,image/ico,image/x-icon,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp,.tif,.tiff,.ico" className="hidden" onChange={handleFileChange} />
        </div>
      )}
      {showFilePicker && (
        <FileManager
          apiBase={getApiBase()}
          pickerMode
          onSelectImage={(url, rawUrl) => {
            const storeUrl = rawUrl ?? url;
            onUpdateConfig({ ...config, imageUrl: storeUrl, storagePath: storeUrl });
            setShowFilePicker(false);
          }}
          onClose={() => setShowFilePicker(false)}
        />
      )}
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

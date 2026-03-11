import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Upload, X } from 'lucide-react';
import { ImageConfig } from '../../types/visualization';

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const response = await fetch('/api/images/upload', {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
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
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-slate-400 transition-colors"
        style={{ backgroundColor: 'rgba(15,23,42,0.5)' }}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">Hochladen...</span>
          </div>
        ) : (
          <>
            <ImageIcon className="w-8 h-8 text-slate-500" />
            <span className="text-xs text-slate-400 text-center px-2">Bild hochladen</span>
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-600/20 border border-blue-500/30 rounded text-xs text-blue-400">
              <Upload className="w-3 h-3" />
              Datei waehlen
            </div>
          </>
        )}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    );
  }

  return (
    <div className="w-full h-full relative group" style={{ borderRadius: config.borderRadius ?? 0 }}>
      <img
        src={config.imageUrl}
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
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-lg">
          <button
            className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors"
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
          >
            <Upload className="w-3 h-3" />
            Ersetzen
          </button>
          <button
            className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
            onClick={(e) => { e.stopPropagation(); handleRemove(); }}
          >
            <X className="w-3 h-3" />
            Entfernen
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
      )}
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};

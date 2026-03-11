import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Upload, Trash2, RefreshCw, FolderOpen, Image as ImageIcon, AlertCircle, Check } from 'lucide-react';

interface ImageFile {
  filename: string;
  url: string;
  size: number;
  mtime: string | null;
}

interface FileManagerProps {
  onClose: () => void;
  apiBase: string;
  onSelectImage?: (url: string, rawUrl?: string) => void;
  pickerMode?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const FileManager: React.FC<FileManagerProps> = ({ onClose, apiBase, onSelectImage, pickerMode = false }) => {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/images`);
      if (res.ok) {
        const data = await res.json();
        setImages(Array.isArray(data) ? data : []);
      }
    } catch {
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${apiBase}/api/images/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload fehlgeschlagen');
      await loadImages();
    } catch {
      setUploadError('Upload fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fileRef.current) fileRef.current.value = '';
    for (const file of files) {
      await uploadFile(file);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    for (const file of files) {
      await uploadFile(file);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Datei "${filename}" wirklich loeschen?`)) return;
    setDeletingFile(filename);
    try {
      await fetch(`${apiBase}/api/images/${filename}`, { method: 'DELETE' });
      setImages(prev => prev.filter(f => f.filename !== filename));
      if (selectedFile === filename) setSelectedFile(null);
    } catch {}
    setDeletingFile(null);
  };

  const imageUrl = (img: ImageFile) => `${apiBase}${img.url}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div
        className="flex flex-col rounded-xl overflow-hidden shadow-2xl"
        style={{
          width: 900,
          maxWidth: '95vw',
          height: 620,
          maxHeight: '90vh',
          background: '#0f172a',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-200">
              {pickerMode ? 'Bild auswaehlen' : 'Datei-Manager'}
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">({images.length} Dateien)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadImages}
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
              title="Aktualisieren"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-col flex-1 overflow-hidden">
            <div
              className={`mx-4 mt-4 mb-3 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 py-5 cursor-pointer transition-all duration-200 ${
                isDraggingOver
                  ? 'border-blue-400 bg-blue-900/20'
                  : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/30'
              }`}
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
              onDragLeave={() => setIsDraggingOver(false)}
            >
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml,image/bmp,image/tiff,image/ico,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp,.tif,.tiff,.ico"
                className="hidden"
                onChange={handleFileChange}
              />
              {uploading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-slate-400">Hochladen...</span>
                </div>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-slate-500" />
                  <span className="text-xs text-slate-400">Dateien hierher ziehen oder klicken zum Hochladen</span>
                  <span className="text-[10px] text-slate-600">PNG, JPG, GIF, WebP, SVG, BMP, TIFF, ICO</span>
                </>
              )}
            </div>

            {uploadError && (
              <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 bg-red-900/20 border border-red-700/40 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="text-xs text-red-400">{uploadError}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {loading && images.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
                  <div className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin mr-2" />
                  Lade...
                </div>
              ) : images.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-600 gap-2">
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-sm">Noch keine Bilder hochgeladen</span>
                </div>
              ) : (
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                  {images.map((img) => (
                    <div
                      key={img.filename}
                      className={`group relative rounded-lg overflow-hidden cursor-pointer border transition-all duration-150 ${
                        selectedFile === img.filename
                          ? 'border-blue-500 ring-1 ring-blue-500'
                          : 'border-slate-700 hover:border-slate-500'
                      }`}
                      style={{ aspectRatio: '4/3', backgroundColor: '#1e293b' }}
                      onClick={() => setSelectedFile(selectedFile === img.filename ? null : img.filename)}
                      onDoubleClick={() => {
                        if (pickerMode && onSelectImage) {
                          onSelectImage(imageUrl(img), img.url);
                          onClose();
                        }
                      }}
                    >
                      <img
                        src={imageUrl(img)}
                        alt={img.filename}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-[10px] text-slate-300 truncate">{img.filename}</p>
                        <p className="text-[9px] text-slate-500">{formatBytes(img.size)}</p>
                      </div>
                      {pickerMode ? (
                        <button
                          className="absolute top-1 right-1 p-1 bg-blue-600/90 hover:bg-blue-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectImage) {
                              onSelectImage(imageUrl(img), img.url);
                              onClose();
                            }
                          }}
                          title="Auswaehlen"
                        >
                          <Check className="w-3 h-3 text-white" />
                        </button>
                      ) : (
                        <button
                          className="absolute top-1 right-1 p-1 bg-red-600/80 hover:bg-red-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); handleDelete(img.filename); }}
                          disabled={deletingFile === img.filename}
                          title="Loeschen"
                        >
                          {deletingFile === img.filename
                            ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                            : <Trash2 className="w-3 h-3 text-white" />
                          }
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedFile && (() => {
            const img = images.find(i => i.filename === selectedFile);
            if (!img) return null;
            return (
              <div className="w-64 border-l border-slate-800 flex flex-col overflow-hidden">
                <div className="p-3 border-b border-slate-800">
                  <p className="text-xs font-semibold text-slate-300">Vorschau</p>
                </div>
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                  <div className="rounded-lg overflow-hidden bg-slate-800 flex items-center justify-center" style={{ minHeight: 140 }}>
                    <img src={imageUrl(img)} alt={img.filename} className="max-w-full max-h-48 object-contain" />
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Dateiname</p>
                      <p className="text-xs text-slate-300 break-all">{img.filename}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Groesse</p>
                      <p className="text-xs text-slate-300">{formatBytes(img.size)}</p>
                    </div>
                    {img.mtime && (
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Datum</p>
                        <p className="text-xs text-slate-300">{new Date(img.mtime).toLocaleString('de-DE')}</p>
                      </div>
                    )}
                  </div>
                  {pickerMode ? (
                    <button
                      onClick={() => {
                        if (onSelectImage) {
                          onSelectImage(imageUrl(img), img.url);
                          onClose();
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Bild auswaehlen
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDelete(img.filename)}
                      disabled={deletingFile === img.filename}
                      className="flex items-center gap-2 px-3 py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-700/40 text-red-400 text-xs rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Datei loeschen
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

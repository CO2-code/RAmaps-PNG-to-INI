import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, Image as ImageIcon, Check, Compass } from 'lucide-react';

interface ImageUploaderProps {
  onImageLoaded: (canvas: HTMLCanvasElement, filename: string) => void;
  currentFilename: string;
  onOpenMprModal?: () => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageLoaded,
  currentFilename,
  onOpenMprModal,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [justPasted, setJustPasted] = useState(false);

  // Handle image or map file load
  const processImageFile = (file: File) => {
    const isMapFile =
      file.name.toLowerCase().endsWith('.mpr') ||
      file.name.toLowerCase().endsWith('.ini');

    if (isMapFile && onOpenMprModal) {
      onOpenMprModal();
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, WebP) or click "Battlefield View" for .MPR map files.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          onImageLoaded(canvas, file.name);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Clipboard paste support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            processImageFile(file);
            setJustPasted(true);
            setTimeout(() => setJustPasted(false), 2500);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4 transition-colors">
      {/* Central Large Drag & Drop Box with solid border and cloud upload icon */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative rounded-xl p-8 sm:p-14 text-center cursor-pointer transition-all duration-200 border ${
          isDragging
            ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20 ring-2 ring-red-500/20'
            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-50/90 dark:hover:bg-slate-800/70'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/bmp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              processImageFile(e.target.files[0]);
            }
          }}
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-xs group-hover:scale-105 group-hover:text-red-600 dark:group-hover:text-red-400 group-hover:border-red-200 dark:group-hover:border-red-900/60 transition-all">
            <UploadCloud className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
              Drop your map image here, or <span className="text-red-600 dark:text-red-400 underline decoration-red-300 dark:decoration-red-600 underline-offset-4 group-hover:text-red-700 dark:group-hover:text-red-300">browse files</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Supports PNG, JPG, or WebP up to 10MB · Paste directly with{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-mono shadow-2xs">
                Ctrl+V
              </kbd>
            </p>
          </div>

          {currentFilename && (
            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800/60 px-3.5 py-1 rounded-full font-mono shadow-2xs">
              <ImageIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Loaded: {currentFilename}</span>
            </div>
          )}

          {justPasted && (
            <div className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-full font-medium">
              <Check className="w-3 h-3 text-amber-600 dark:text-amber-400" /> Image pasted from clipboard!
            </div>
          )}
        </div>
      </div>

      {onOpenMprModal && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onOpenMprModal}
            className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span>Have a .MPR map file? Generate from game assets →</span>
          </button>
        </div>
      )}
    </div>
  );
};

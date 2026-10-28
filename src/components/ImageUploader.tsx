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
    <div className="bg-[#0c0d12] border border-[#331015] rounded-2xl p-6 sm:p-8 shadow-[0_4px_25px_rgba(0,0,0,0.7)] space-y-4 ra-radar-grid">
      {/* Central Large Drag & Drop Box with solid border and cloud upload icon */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative rounded-xl p-8 sm:p-14 text-center cursor-pointer transition-all duration-200 border-2 border-dashed ${
          isDragging
            ? 'border-red-500 bg-[#1f0a0d] ring-2 ring-red-500/40'
            : 'border-[#3a151b] hover:border-red-600/80 bg-[#07070a]/80 hover:bg-[#140b0e]'
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
          <div className="w-16 h-16 rounded-2xl bg-[#141520] border border-[#4a151b] flex items-center justify-center text-red-500 shadow-[0_0_15px_rgba(220,38,38,0.25)] group-hover:scale-105 group-hover:text-red-400 group-hover:border-red-600 transition-all">
            <UploadCloud className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold font-['Rajdhani',sans-serif] uppercase tracking-wide text-white">
              Drop your map image here, or <span className="text-red-500 underline decoration-red-700 underline-offset-4 group-hover:text-red-400">browse files</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 font-mono">
              Supports PNG, JPG, or WebP up to 10MB · Paste directly with{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-[#1c1d29] border border-[#3d1217] text-xs text-red-400 font-mono">
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

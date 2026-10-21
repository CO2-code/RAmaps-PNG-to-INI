import React, { useRef, useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, Sparkles, Clipboard, Check, Compass } from 'lucide-react';
import { SAMPLE_MAPS, SampleMap } from '../lib/sampleMaps';

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
      alert('Please select an image file (PNG, JPG, WebP) or click the "*.MPR → *.PNG" button above for map files.');
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

  const loadSampleMap = (sample: SampleMap) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      sample.draw(ctx, 128);
      onImageLoaded(canvas, `${sample.id}.png`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Drag & Drop Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-red-500 bg-red-950/20 scale-[1.01]'
            : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/50 hover:bg-neutral-900/80'
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

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-red-500 shadow-md">
            <Upload className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Click to Upload PNG or Drag & Drop Here
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              Supports PNG, JPG, WebP · You can also press{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-[11px] text-neutral-200 font-mono">
                Ctrl+V
              </kbd>{' '}
              to paste from clipboard!
            </p>
          </div>

          {currentFilename && (
            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1 rounded-full font-mono">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Loaded: {currentFilename}</span>
            </div>
          )}

          {justPasted && (
            <div className="inline-flex items-center gap-1 text-xs text-amber-400 font-mono">
              <Check className="w-3 h-3" /> Image pasted from clipboard!
            </div>
          )}
        </div>
      </div>

      {/* Preset sample map buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1 mr-1">
          <Sparkles className="w-3 h-3 text-red-500" /> Demo Maps:
        </span>
        {SAMPLE_MAPS.map((sample) => (
          <button
            key={sample.id}
            type="button"
            onClick={() => loadSampleMap(sample)}
            className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800 text-xs font-medium text-neutral-300 transition-colors"
          >
            {sample.name}
          </button>
        ))}

        {onOpenMprModal && (
          <button
            type="button"
            onClick={onOpenMprModal}
            className="ml-auto px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-800/60 hover:border-red-600 text-red-300 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Compass className="w-3.5 h-3.5 text-red-400" />
            <span>Generate PNG from *.MPR Map</span>
          </button>
        )}
      </div>
    </div>
  );
};

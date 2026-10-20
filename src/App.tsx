import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { ControlPanel } from './components/ControlPanel';
import { PreviewViewport } from './components/PreviewViewport';
import { IniOutputViewer } from './components/IniOutputViewer';
import { MapInjectorModal } from './components/MapInjectorModal';
import { ReverseDecoderModal } from './components/ReverseDecoderModal';
import { Ra1ResearchModal } from './components/Ra1ResearchModal';
import { ConversionOptions, ConversionResult } from './types';
import { convertImageToPreviewPack } from './lib/formatters';
import { SAMPLE_MAPS } from './lib/sampleMaps';

const DEFAULT_OPTIONS: ConversionOptions = {
  width: 128,
  height: 128,
  palette: 'temperat',
  encoding: 'cncnet_lzo_24bit', // Default: xna-cncnet-client & XCC Mixer compatible!
  dithering: true,
  lineLength: 70,
  includePreviewSection: true,
  compressionOptimization: 'balanced',
  maintainAspectRatio: true,
};

export default function App() {
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [currentFilename, setCurrentFilename] = useState<string>('hostile_waters.png');
  const [options, setOptions] = useState<ConversionOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<ConversionResult | null>(null);

  // Modals state
  const [isResearchOpen, setIsResearchOpen] = useState<boolean>(false);
  const [isDecoderOpen, setIsDecoderOpen] = useState<boolean>(false);
  const [isInjectorOpen, setIsInjectorOpen] = useState<boolean>(false);

  // Initialize with the first demo map on first launch
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      SAMPLE_MAPS[0].draw(ctx, 128);
      setSourceCanvas(canvas);
      setCurrentFilename('hostile_waters.png');
    }
  }, []);

  // Re-run conversion whenever sourceCanvas or options change
  useEffect(() => {
    if (!sourceCanvas) return;
    try {
      const res = convertImageToPreviewPack(sourceCanvas, options);
      setResult(res);
    } catch (err) {
      console.error('Failed to convert image to PreviewPack:', err);
    }
  }, [sourceCanvas, options]);

  const handleImageLoaded = (canvas: HTMLCanvasElement, filename: string) => {
    setSourceCanvas(canvas);
    setCurrentFilename(filename);

    // If image has non-128x128 dimensions, offer to adapt dimensions to source
    if (canvas.width > 0 && canvas.height > 0) {
      setOptions((prev) => ({
        ...prev,
        width: canvas.width,
        height: canvas.height,
      }));
    }
  };

  const handleUpdateOptions = (patch: Partial<ConversionOptions>) => {
    setOptions((prev) => ({
      ...prev,
      ...patch,
    }));
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-red-600 selection:text-white">
      {/* Header */}
      <Header
        onOpenResearch={() => setIsResearchOpen(true)}
        onOpenDecoder={() => setIsDecoderOpen(true)}
        onOpenInjector={() => setIsInjectorOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-8">
        {/* Intro Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-900 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                CnCNet XNA Client & XCC Compatible
              </span>
              <span className="text-neutral-600">·</span>
              <span className="text-xs text-neutral-400 font-mono">Red Alert 1 & Tiberian Sun</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              PNG to INI [PreviewPack] Converter
            </h1>
            <p className="text-sm text-neutral-400 max-w-2xl mt-1">
              Upload any PNG or map image to generate authentic LZO1X 24-bit RGB (CnCNet / XCC standard) or classic LCW Format80{' '}
              <code className="text-amber-400 font-mono">[Preview]</code> and{' '}
              <code className="text-amber-400 font-mono">[PreviewPack]</code> sections ready to paste directly into your map files.
            </p>
          </div>
        </div>

        {/* Upload Zone */}
        <ImageUploader
          onImageLoaded={handleImageLoaded}
          currentFilename={currentFilename}
        />

        {/* 2-Column Workspace: Left = Visual Preview & Code, Right = Settings Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column (7 cols): Visual Viewport + INI Output Code */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {/* Live Reconstructed Preview Viewport */}
            <PreviewViewport
              sourceCanvas={sourceCanvas}
              result={result}
            />

            {/* Ready-to-Paste INI Code Viewer */}
            <IniOutputViewer result={result} />
          </div>

          {/* Right Column (5 cols): Controls & Configuration */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            <div className="sticky top-20">
              <ControlPanel
                options={options}
                onChange={handleUpdateOptions}
                sourceWidth={sourceCanvas?.width}
                sourceHeight={sourceCanvas?.height}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950/80 py-6 px-4 text-center text-xs text-neutral-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            xna-cncnet-client & XCC Mixer LZO1X 24-bit Engine · Command & Conquer Map Tool
          </div>
          <div className="text-[11px] text-neutral-600">
            Compatible with .MPR and .INI map formats
          </div>
        </div>
      </footer>

      {/* Modals */}
      <Ra1ResearchModal
        isOpen={isResearchOpen}
        onClose={() => setIsResearchOpen(false)}
      />

      <ReverseDecoderModal
        isOpen={isDecoderOpen}
        onClose={() => setIsDecoderOpen(false)}
        defaultPalette={options.palette}
      />

      <MapInjectorModal
        isOpen={isInjectorOpen}
        onClose={() => setIsInjectorOpen(false)}
        previewBlockText={result?.fullIniText || ''}
      />
    </div>
  );
}

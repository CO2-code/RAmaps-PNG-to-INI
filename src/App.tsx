import React, { useState, useEffect } from 'react';
import { Zap, ShieldCheck, AlertTriangle, X, Check } from 'lucide-react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { ControlPanel } from './components/ControlPanel';
import { PreviewViewport } from './components/PreviewViewport';
import { IniOutputViewer } from './components/IniOutputViewer';
import { MapInjectorModal } from './components/MapInjectorModal';
import { ReverseDecoderModal } from './components/ReverseDecoderModal';
import { Ra1ResearchModal } from './components/Ra1ResearchModal';
import { MprToPngModal } from './components/MprToPngModal';
import { ConversionOptions, ConversionResult } from './types';
import { convertImageToPreviewPack } from './lib/formatters';
import { SAMPLE_MAPS } from './lib/sampleMaps';

const DEFAULT_OPTIONS: ConversionOptions = {
  width: 256,
  height: 256,
  palette: 'temperat',
  encoding: 'cncnet_lzo_24bit', // Default: xna-cncnet-client & XCC Mixer compatible!
  dithering: true,
  lineLength: 70,
  includePreviewSection: true,
  compressionOptimization: 'balanced',
  maintainAspectRatio: true,
  colorNoiseReduction: true, // Auto-cleans microscopic noise to keep line counts compact
  targetLineBudget: 1000,
};

export default function App() {
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [currentFilename, setCurrentFilename] = useState<string>('hostile_waters.png');
  const [options, setOptions] = useState<ConversionOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [autoScaledNotice, setAutoScaledNotice] = useState<{
    originalW: number;
    originalH: number;
    scaledW: number;
    scaledH: number;
  } | null>(null);

  // Modals state
  const [isResearchOpen, setIsResearchOpen] = useState<boolean>(false);
  const [isDecoderOpen, setIsDecoderOpen] = useState<boolean>(false);
  const [isInjectorOpen, setIsInjectorOpen] = useState<boolean>(false);
  const [isMprModalOpen, setIsMprModalOpen] = useState<boolean>(false);

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

    const maxDim = Math.max(canvas.width, canvas.height);
    // If image exceeds recommended 256px, auto-scale down to CnCNet standard (<= 256px)
    // to prevent 23,000+ line bloat while maintaining pixel-perfect fidelity in the lobby!
    if (maxDim > 256) {
      const scale = 256 / maxDim;
      const targetW = Math.max(16, Math.round(canvas.width * scale));
      const targetH = Math.max(16, Math.round(canvas.height * scale));
      setOptions((prev) => ({
        ...prev,
        width: targetW,
        height: targetH,
        targetLineBudget: 1000,
      }));
      setAutoScaledNotice({
        originalW: canvas.width,
        originalH: canvas.height,
        scaledW: targetW,
        scaledH: targetH,
      });
    } else {
      setOptions((prev) => ({
        ...prev,
        width: canvas.width,
        height: canvas.height,
      }));
      setAutoScaledNotice(null);
    }
  };

  const handleOptimizeToCncNetStandard = () => {
    if (!sourceCanvas) return;
    const maxDim = Math.max(sourceCanvas.width, sourceCanvas.height);
    const scale = Math.min(1, 256 / maxDim);
    const targetW = Math.max(16, Math.round(sourceCanvas.width * scale));
    const targetH = Math.max(16, Math.round(sourceCanvas.height * scale));
    setOptions((prev) => ({
      ...prev,
      width: targetW,
      height: targetH,
      encoding: 'cncnet_lzo_24bit',
      targetLineBudget: 1000,
    }));
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
        onOpenMprToPng={() => setIsMprModalOpen(true)}
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

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsMprModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-red-950/70 hover:bg-red-900/80 border border-red-600/70 text-red-200 hover:text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-950/50 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 text-red-400" />
              <span>*.MPR → *.PNG Map Generator</span>
            </button>
          </div>
        </div>

        {/* Upload Zone */}
        <ImageUploader
          onImageLoaded={handleImageLoaded}
          currentFilename={currentFilename}
          onOpenMprModal={() => setIsMprModalOpen(true)}
        />

        {/* Auto-Scaled Notice Banner if uploaded image was larger than 256px */}
        {autoScaledNotice && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-neutral-900 to-emerald-950/60 border border-emerald-700/60 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs animate-fade-in">
            <div className="flex items-start gap-3 text-neutral-200">
              <div className="p-2 rounded-xl bg-emerald-900/60 border border-emerald-600/50 text-emerald-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="font-bold text-white text-sm flex items-center gap-2">
                  <span>Auto-Optimized to {autoScaledNotice.scaledW}×{autoScaledNotice.scaledH} (~800–1,100 lines)</span>
                  <span className="text-[10px] font-mono text-emerald-300 bg-emerald-900/80 px-2 py-0.5 rounded-full border border-emerald-600/40">
                    CnCNet Standard
                  </span>
                </div>
                <p className="text-neutral-400 text-xs leading-relaxed max-w-2xl">
                  Your uploaded image is <strong className="text-white font-mono">{autoScaledNotice.originalW}×{autoScaledNotice.originalH}</strong> (which would create <strong>23,000+ lines</strong> and bloat the map file to ~1.6 MB).
                  It was automatically scaled down to the official <strong className="text-emerald-300">&lt; 257px</strong> standard so players can download your map instantly with zero lobby lag.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setAutoScaledNotice(null)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1 shadow-sm transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Keep Optimized</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOptions((prev) => ({
                    ...prev,
                    width: autoScaledNotice.originalW,
                    height: autoScaledNotice.originalH,
                  }));
                }}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white text-xs font-mono transition-colors"
                title="Switch to full original resolution (creates 23k+ lines)"
              >
                <span>Full {autoScaledNotice.originalW}×{autoScaledNotice.originalH} (⚠️ 23k)</span>
              </button>

              <button
                type="button"
                onClick={() => setAutoScaledNotice(null)}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-white transition-colors"
                title="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

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
            <IniOutputViewer
              result={result}
              onOptimizeResolution={handleOptimizeToCncNetStandard}
            />
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

      <MprToPngModal
        isOpen={isMprModalOpen}
        onClose={() => setIsMprModalOpen(false)}
        onSendToGenerator={handleImageLoaded}
      />
    </div>
  );
}

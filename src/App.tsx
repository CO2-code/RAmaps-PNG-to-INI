import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Check, Compass, FolderKanban } from 'lucide-react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { ControlPanel } from './components/ControlPanel';
import { PreviewViewport } from './components/PreviewViewport';
import { IniOutputViewer } from './components/IniOutputViewer';
import { MapInjectorModal } from './components/MapInjectorModal';
import { ReverseDecoderModal } from './components/ReverseDecoderModal';
import { Ra1ResearchModal } from './components/Ra1ResearchModal';
import { MprToPngModal } from './components/MprToPngModal';
import { BatchMapModal } from './components/BatchMapModal';
import { ConversionOptions, ConversionResult } from './types';
import { convertImageToPreviewPack } from './lib/formatters';

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
  const [currentFilename, setCurrentFilename] = useState<string>('');
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
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);

  // Re-run conversion whenever sourceCanvas or options change
  useEffect(() => {
    if (!sourceCanvas) {
      setResult(null);
      return;
    }
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans selection:bg-red-600 selection:text-white transition-colors duration-150">
      {/* Clean Minimalist Top Navigation Header */}
      <Header
        onOpenResearch={() => setIsResearchOpen(true)}
        onOpenDecoder={() => setIsDecoderOpen(true)}
        onOpenInjector={() => setIsInjectorOpen(true)}
        onOpenMprToPng={() => setIsMprModalOpen(true)}
        onOpenBatch={() => setIsBatchModalOpen(true)}
      />

      {/* Main Dashboard Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Dashboard Title & Quick Action CTAs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
              <span>CnCNet XNA Client</span>
              <span aria-hidden="true">·</span>
              <span>XCC Mixer LZO1X</span>
              <span aria-hidden="true">·</span>
              <span>Red Alert 1 & Tiberian Sun</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Map PreviewPack & INI Studio
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Convert any PNG or battlefield render into authentic LZO1X 24-bit TrueColor or classic LCW Format80 INI sections ready to paste into your map files.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsBatchModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-red-600 hover:bg-slate-800 dark:hover:bg-red-700 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <FolderKanban className="w-4 h-4 text-amber-400 dark:text-white" />
              <span>📁 Batch Map Studio</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMprModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Battlefield View</span>
            </button>
          </div>
        </div>

        {/* Upload Card Area */}
        <ImageUploader
          onImageLoaded={handleImageLoaded}
          currentFilename={currentFilename}
          onOpenMprModal={() => setIsMprModalOpen(true)}
        />

        {/* Auto-Scaled Notice Banner if uploaded image was larger than 256px */}
        {autoScaledNotice && (
          <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
            <div className="flex items-start gap-3.5 text-slate-700 dark:text-slate-200">
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <span>Auto-Optimized to {autoScaledNotice.scaledW}×{autoScaledNotice.scaledH} (~800–1,100 lines)</span>
                  <span className="text-[10px] font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/80 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-700">
                    CnCNet Standard
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed max-w-2xl">
                  Uploaded image was <strong className="font-mono text-slate-900 dark:text-white">{autoScaledNotice.originalW}×{autoScaledNotice.originalH}</strong> (which would generate 23,000+ lines and lag in-game lobby downloads).
                  It was automatically scaled down to <strong className="text-emerald-800 dark:text-emerald-300">≤ 256px</strong> for instant player downloads.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setAutoScaledNotice(null)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
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
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-mono transition-colors cursor-pointer"
                title="Switch to full original resolution (creates 23k+ lines)"
              >
                Full {autoScaledNotice.originalW}×{autoScaledNotice.originalH}
              </button>

              <button
                type="button"
                onClick={() => setAutoScaledNotice(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* All Settings in a Clean "Advanced Settings" Dropdown / Collapsible Card */}
        <ControlPanel
          options={options}
          onChange={handleUpdateOptions}
          sourceWidth={sourceCanvas?.width}
          sourceHeight={sourceCanvas?.height}
          defaultOpen={false}
        />

        {/* Live Reconstructed Preview Viewport with Large Data Metrics */}
        <PreviewViewport
          sourceCanvas={sourceCanvas}
          result={result}
        />

        {/* Ready-to-Paste INI Code Viewer */}
        <IniOutputViewer
          result={result}
          onOptimizeResolution={handleOptimizeToCncNetStandard}
        />
      </main>

      {/* Clean Minimalist Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 py-6 px-4 text-center text-xs text-slate-500 dark:text-slate-400 mt-12 transition-colors">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            xna-cncnet-client & XCC Mixer LZO1X 24-bit Engine · Command & Conquer Map Tool
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500">
            Supports Red Alert 1, Tiberian Sun, and Red Alert 2 map previews
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

      <BatchMapModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
      />
    </div>
  );
}

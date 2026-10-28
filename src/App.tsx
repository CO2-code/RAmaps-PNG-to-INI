import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Check, Compass, FolderKanban, Sliders, ArrowLeft, HelpCircle } from 'lucide-react';
import { LauncherHome } from './components/LauncherHome';
import { ImageUploader } from './components/ImageUploader';
import { ControlPanel } from './components/ControlPanel';
import { PreviewViewport } from './components/PreviewViewport';
import { IniOutputViewer } from './components/IniOutputViewer';
import { MapInjectorModal } from './components/MapInjectorModal';
import { ReverseDecoderModal } from './components/ReverseDecoderModal';
import { Ra1ResearchModal } from './components/Ra1ResearchModal';
import { MprToPngModal } from './components/MprToPngModal';
import { BatchMapModal } from './components/BatchMapModal';
import { TinyPngModal } from './components/TinyPngModal';
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
  const [currentView, setCurrentView] = useState<'launcher' | 'workspace'>('launcher');
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
  const [isTinyPngOpen, setIsTinyPngOpen] = useState<boolean>(false);

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
    <div
      className={`min-h-screen text-slate-100 flex flex-col font-sans selection:bg-red-600 selection:text-white transition-colors duration-150 ${
        currentView === 'launcher' ? 'bg-[#07070a]' : 'bg-[#0d0305]'
      }`}
      style={
        currentView !== 'launcher'
          ? {
              backgroundImage: `linear-gradient(rgba(12, 3, 6, 0.85), rgba(12, 3, 6, 0.90)), url('/assets/aistudio/dd-bkgnd_b2da9433.png')`,
              backgroundRepeat: 'repeat',
              backgroundSize: '864px 864px',
              backgroundAttachment: 'fixed',
            }
          : undefined
      }
    >


      {/* VIEW 1: AUTHENTIC RED ALERT LAUNCHER HOME SCREEN */}
      {currentView === 'launcher' ? (
        <LauncherHome
          onOpenBatch={() => setIsBatchModalOpen(true)}
          onEnterStudio={() => setCurrentView('workspace')}
          onOpenMprToPng={() => setIsMprModalOpen(true)}
          onOpenInjector={() => setIsInjectorOpen(true)}
          onOpenDecoder={() => setIsDecoderOpen(true)}
          onOpenResearch={() => setIsResearchOpen(true)}
          onOpenTinyPng={() => setIsTinyPngOpen(true)}
        />
      ) : (
        /* VIEW 2: FULL GENERATOR STUDIO WORKSPACE */
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fade-in">
          {/* Dashboard Title & Quick Action CTAs */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#2b0808]">
            <div>
              <div className="flex items-center gap-2 text-xs text-red-500 font-mono uppercase tracking-wider mb-1">
                <span>CnCNet XNA Client</span>
                <span aria-hidden="true">&middot;</span>
                <span>LZO1X 24-bit TrueColor</span>
                <span aria-hidden="true">&middot;</span>
                <span>Westwood Format80 LCW</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-['Rajdhani',sans-serif]">
                PreviewPack &amp; Map Generator Studio
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                Convert any PNG image or battlefield map render into authentic compressed <code className="text-red-400 font-mono">[Preview]</code> and <code className="text-red-400 font-mono">[PreviewPack]</code> INI sections ready to inject into <code className="text-amber-400 font-mono">.MPR</code> maps.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(true)}
                className="ra-menu-btn px-4 py-2 rounded text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <FolderKanban className="w-4 h-4 text-amber-400" />
                <span>Prepare Maps (Batch)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMprModalOpen(true)}
                className="px-3.5 py-2 rounded bg-[#161722] hover:bg-[#202230] border border-[#3b1218] text-slate-200 text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Compass className="w-4 h-4 text-emerald-400" />
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
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1812] border border-emerald-800/80 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
              <div className="flex items-start gap-3.5 text-slate-200">
                <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <span>Auto-Optimized to {autoScaledNotice.scaledW}×{autoScaledNotice.scaledH} (~800–1,100 lines)</span>
                    <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950 border border-emerald-700 px-2 py-0.5 rounded font-bold">
                      CnCNet Standard
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed max-w-2xl font-mono">
                    Uploaded image was <strong className="text-white">{autoScaledNotice.originalW}×{autoScaledNotice.originalH}</strong> (which would generate 23,000+ lines and lag in-game lobby downloads).
                    It was automatically scaled down to <strong className="text-emerald-300">&le; 256px</strong> for instant player downloads.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => setAutoScaledNotice(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
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
                  className="px-3 py-1.5 rounded-lg bg-[#151722] hover:bg-[#1e202f] border border-slate-700 text-slate-200 text-xs font-mono transition-colors cursor-pointer"
                  title="Switch to full original resolution (creates 23k+ lines)"
                >
                  Full {autoScaledNotice.originalW}×{autoScaledNotice.originalH}
                </button>

                <button
                  type="button"
                  onClick={() => setAutoScaledNotice(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
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
      )}

      {/* Sticky Bottom Command Bar - Return to main menu (Not on the top) */}
      {currentView === 'workspace' && (
        <aside
          aria-label="Workspace controls"
          className="sticky bottom-0 z-30 w-full bg-[#080204]/95 backdrop-blur-md border-t border-[#3b0a0a] py-2.5 px-4 shadow-[0_-4px_25px_rgba(0,0,0,0.85)]"
        >
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setCurrentView('launcher')}
              className="ra-menu-btn px-5 py-2 rounded text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-lg text-amber-200 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 text-amber-300" />
              <span>Return to main menu</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(true)}
                className="ra-menu-btn px-3 py-1.5 rounded text-xs font-bold hidden sm:flex items-center gap-1.5 cursor-pointer"
              >
                <FolderKanban className="w-3.5 h-3.5 text-amber-400" />
                <span>Prepare Maps</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMprModalOpen(true)}
                className="px-3 py-1.5 rounded bg-[#17080a] hover:bg-[#250d11] border border-[#4a1218] text-slate-300 hover:text-white text-xs font-mono font-semibold transition-colors cursor-pointer hidden sm:flex items-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                <span>Battlefield View</span>
              </button>
              <button
                type="button"
                onClick={() => setIsTinyPngOpen(true)}
                className="px-3 py-1.5 rounded bg-[#17080a] hover:bg-[#250d11] border border-[#4a1218] text-emerald-400 hover:text-emerald-300 text-xs font-mono font-semibold transition-colors cursor-pointer hidden md:flex items-center gap-1.5"
                title="Open TinyPNG Image Compressor"
              >
                <span>⚡ TinyPNG</span>
              </button>
              <button
                type="button"
                onClick={() => setIsResearchOpen(true)}
                className="px-3 py-1.5 rounded bg-[#17080a] hover:bg-[#250d11] border border-[#4a1218] text-amber-300 hover:text-amber-200 text-xs font-mono font-semibold transition-colors cursor-pointer hidden sm:flex items-center gap-1.5"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Guide</span>
              </button>
            </div>
          </div>
        </aside>
      )}

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

      <TinyPngModal
        isOpen={isTinyPngOpen}
        onClose={() => setIsTinyPngOpen(false)}
      />
    </div>
  );
}

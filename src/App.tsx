import React, { useState, useEffect } from 'react';
import { ShieldCheck, X, Check, Compass, FolderKanban, Sliders, ArrowLeft, HelpCircle, AlertTriangle } from 'lucide-react';
import { LauncherHome } from './components/LauncherHome';
import { ImageUploader } from './components/ImageUploader';
import { ControlPanel } from './components/ControlPanel';
import { PreviewViewport } from './components/PreviewViewport';
import { IniOutputViewer } from './components/IniOutputViewer';
import { MapInjectorModal } from './components/MapInjectorModal';
import { ReverseDecoderModal } from './components/ReverseDecoderModal';
import { Ra1ResearchModal } from './components/Ra1ResearchModal';
import { MprToPngModal } from './components/MprToPngModal';
import { BatchMapModal, BatchAction } from './components/BatchMapModal';
import { TinyPngModal } from './components/TinyPngModal';
import { ConversionOptions, ConversionResult } from './types';
import { convertImageToPreviewPack, calculateMapHdDimensions } from './lib/formatters';

const DEFAULT_OPTIONS: ConversionOptions = {
  width: 512,
  height: 512,
  palette: 'temperat',
  encoding: 'cncnet_lzo_24bit', // Default: xna-cncnet-client & XCC Mixer compatible!
  dithering: false, // Dithering off for 24-bit TrueColor to maintain pristine sharpness
  lineLength: 70,
  includePreviewSection: true,
  compressionOptimization: 'max',
  maintainAspectRatio: true,
  colorNoiseReduction: false, // Pure 24-bit TrueColor RGB888, zero noise truncation for highest fidelity
  targetLineBudget: undefined, // Highest HD settings regardless of line quantity
  sharpening: true, // Bicubic Sharper unsharp mask enabled by default
};

export default function App() {
  const [currentView, setCurrentView] = useState<'launcher' | 'workspace'>('launcher');
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [currentFilename, setCurrentFilename] = useState<string>('');
  const [options, setOptions] = useState<ConversionOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);
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
  const [batchInitialAction, setBatchInitialAction] = useState<BatchAction>('auto_batch');
  const [isTinyPngOpen, setIsTinyPngOpen] = useState<boolean>(false);

  // Re-run conversion whenever sourceCanvas or options change
  useEffect(() => {
    if (!sourceCanvas) {
      setResult(null);
      setConversionError(null);
      return;
    }
    try {
      const res = convertImageToPreviewPack(sourceCanvas, options);
      setResult(res);
      setConversionError(null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
          ? err
          : String(err) || 'Conversion failed';
      console.error('Failed to convert image to PreviewPack:', msg);
      setConversionError(msg);
      setResult(null);
    }
  }, [sourceCanvas, options]);

  const handleImageLoaded = (canvas: HTMLCanvasElement, filename: string) => {
    setSourceCanvas(canvas);
    setCurrentFilename(filename);
    setConversionError(null);

    // If canvas is already within compact/standard dimensions (<= 512px), use 1:1 exact native
    // If canvas is large (e.g. 2000px - 6000px full map render), automatically set 512px Ultra HD
    // to give crystal-clear lobby preview while preventing multi-gigabyte browser heap crashes.
    const isLarge = canvas.width > 512 || canvas.height > 512;
    const { width: targetW, height: targetH } = isLarge
      ? calculateMapHdDimensions(canvas.width, canvas.height, 512)
      : { width: canvas.width, height: canvas.height };

    setOptions((prev) => ({
      ...prev,
      width: targetW,
      height: targetH,
      encoding: 'cncnet_lzo_24bit',
      lineLength: 70,
      includePreviewSection: true,
      colorNoiseReduction: false, // Pure 24-bit TrueColor RGB888, zero noise truncation
      targetLineBudget: undefined,
      compressionOptimization: 'max',
      sharpening: true,
      maintainAspectRatio: true,
    }));

    setAutoScaledNotice({
      originalW: canvas.width,
      originalH: canvas.height,
      scaledW: targetW,
      scaledH: targetH,
    });
  };

  const handleOptimizeToCncNetStandard = () => {
    if (!sourceCanvas) return;
    const { width: targetW, height: targetH } = calculateMapHdDimensions(sourceCanvas.width, sourceCanvas.height, 512);
    setOptions((prev) => ({
      ...prev,
      width: targetW,
      height: targetH,
      encoding: 'cncnet_lzo_24bit',
      colorNoiseReduction: false,
      targetLineBudget: undefined,
      compressionOptimization: 'max',
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
          onOpenAutoBatch={() => {
            setBatchInitialAction('auto_batch');
            setIsBatchModalOpen(true);
          }}
          onOpenBatch={() => {
            setBatchInitialAction('prepare_maps');
            setIsBatchModalOpen(true);
          }}
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

          {/* XCC Mixer 1:1 Port Status & Quick Presets Banner */}
          {sourceCanvas && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#130d07] border border-amber-800/80 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
              <div className="flex items-start gap-3.5 text-slate-200">
                <div className="p-2 rounded-xl bg-amber-950/80 border border-amber-700 text-amber-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-white text-sm flex items-center gap-2 flex-wrap">
                    <span>OlafvdSpek/xcc 1:1 Port Active:</span>
                    <span className="text-[11px] font-mono text-amber-300 bg-amber-950 border border-amber-700 px-2 py-0.5 rounded font-bold">
                      {options.width}×{options.height} px ({options.width === sourceCanvas.width && options.height === sourceCanvas.height ? '100% Native XCC' : 'Scaled'})
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-1.5 py-0.2 rounded">
                      24-bit TrueColor LZO
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed max-w-2xl font-mono">
                    Direct port of <strong className="text-amber-400 font-mono">CXCCMixerView::copy_as_map_ts_preview</strong> from{' '}
                    <a
                      href="https://github.com/OlafvdSpek/xcc"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 underline hover:text-amber-300"
                    >
                      OlafvdSpek/xcc
                    </a>
                    . 8192-byte LZO1X chunks, 4-byte headers, pure 24-bit RGB888, 70 chars per line.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {sourceCanvas.width <= 1024 && sourceCanvas.height <= 1024 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOptions((prev) => ({
                        ...prev,
                        width: sourceCanvas.width,
                        height: sourceCanvas.height,
                        encoding: 'cncnet_lzo_24bit',
                        colorNoiseReduction: false,
                        targetLineBudget: undefined,
                      }));
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      options.width === sourceCanvas.width && options.height === sourceCanvas.height
                        ? 'bg-amber-600 text-black shadow-xs'
                        : 'bg-[#151722] hover:bg-[#1e202f] border border-amber-800/80 text-amber-300'
                    }`}
                    title="Preserve exact 1:1 native dimensions without downscaling"
                  >
                    ⚡ XCC 1:1 ({sourceCanvas.width}×{sourceCanvas.height})
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const { width: tw, height: th } = calculateMapHdDimensions(sourceCanvas.width, sourceCanvas.height, 1024);
                      setOptions((prev) => ({
                        ...prev,
                        width: tw,
                        height: th,
                        encoding: 'cncnet_lzo_24bit',
                        colorNoiseReduction: false,
                        targetLineBudget: undefined,
                      }));
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      Math.max(options.width, options.height) === 1024
                        ? 'bg-amber-600 text-black shadow-xs'
                        : 'bg-[#151722] hover:bg-[#1e202f] border border-amber-800/80 text-amber-300'
                    }`}
                    title="Scale to 1024px Super Mega HD (Highest safe lobby preview resolution)"
                  >
                    ⚡ 1024px Super HD
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const { width: tw, height: th } = calculateMapHdDimensions(sourceCanvas.width, sourceCanvas.height, 512);
                    setOptions((prev) => ({
                      ...prev,
                      width: tw,
                      height: th,
                    }));
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                    Math.max(options.width, options.height) === 512
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-[#151722] hover:bg-[#1e202f] border border-slate-700 text-slate-300'
                  }`}
                  title="Scale down to max 512px for standard HD"
                >
                  512px HD
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const { width: tw, height: th } = calculateMapHdDimensions(sourceCanvas.width, sourceCanvas.height, 256);
                    setOptions((prev) => ({
                      ...prev,
                      width: tw,
                      height: th,
                    }));
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                    Math.max(options.width, options.height) === 256
                      ? 'bg-red-600 text-white font-bold'
                      : 'bg-[#151722] hover:bg-[#1e202f] border border-slate-700 text-slate-300'
                  }`}
                  title="Scale down to max 256px for ultra-compact lobby downloads"
                >
                  256px Fast
                </button>
              </div>
            </div>
          )}

          {/* Tactical Conversion Error / Guard Alert */}
          {conversionError && (
            <div className="p-4 sm:p-5 rounded-2xl bg-red-950/90 border border-red-600/90 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fade-in">
              <div className="flex items-start gap-3 text-red-200">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-red-100 text-sm font-['Rajdhani',sans-serif] uppercase tracking-wide">
                    PreviewPack Dimension Guard
                  </div>
                  <p className="text-red-300 mt-0.5 font-mono leading-relaxed">{conversionError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOptimizeToCncNetStandard}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shrink-0 cursor-pointer shadow transition-colors font-mono"
              >
                Auto-Fix: Switch to 512px Ultra HD
              </button>
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
        sourceCanvas={sourceCanvas}
        conversionOptions={options}
      />

      <MprToPngModal
        isOpen={isMprModalOpen}
        onClose={() => setIsMprModalOpen(false)}
        onSendToGenerator={handleImageLoaded}
      />

      <BatchMapModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        initialAction={batchInitialAction}
      />

      <TinyPngModal
        isOpen={isTinyPngOpen}
        onClose={() => setIsTinyPngOpen(false)}
      />
    </div>
  );
}

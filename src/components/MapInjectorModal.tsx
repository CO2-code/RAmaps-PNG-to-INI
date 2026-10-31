import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  FileCode,
  Download,
  Check,
  Upload,
  AlertTriangle,
  Sparkles,
  Layers,
  ArrowRight,
  Eye,
  Settings2,
} from 'lucide-react';
import {
  injectPreviewIntoMapFile,
  convertImageToPreviewPack,
  stripPreviewFromMapFile,
} from '../lib/formatters';
import { parseMprMap, renderMprToCanvas, MprMapData } from '../lib/mprParser';
import { renderMprOriginalAssets, preloadMapAssets } from '../lib/raOriginalRenderer';
import { ConversionOptions } from '../types';

interface MapInjectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewBlockText: string;
  sourceCanvas?: HTMLCanvasElement | null;
  conversionOptions?: ConversionOptions;
}

export const MapInjectorModal: React.FC<MapInjectorModalProps> = ({
  isOpen,
  onClose,
  previewBlockText: studioPreviewText,
  sourceCanvas,
  conversionOptions,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [mapFileName, setMapFileName] = useState<string>('');
  const [mapRawContent, setMapRawContent] = useState<string>('');
  const [parsedMap, setParsedMap] = useState<MprMapData | null>(null);
  const [mergedText, setMergedText] = useState<string>('');
  const [hasInjected, setHasInjected] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Mode:
  // 1. 'studio_preview': Use current studio generated PreviewPack
  // 2. 'auto_render': Automatically render tactical preview directly from the uploaded .MPR!
  // 3. 'custom_image': Upload a custom companion PNG to encode & inject into the .MPR
  const [sourceMode, setSourceMode] = useState<'studio_preview' | 'auto_render' | 'custom_image'>(
    studioPreviewText ? 'studio_preview' : 'auto_render'
  );

  const [customImageCanvas, setCustomImageCanvas] = useState<HTMLCanvasElement | null>(null);
  const [customImageName, setCustomImageName] = useState<string>('');
  const [encodingFormat, setEncodingFormat] = useState<'cncnet_lzo_24bit' | 'lcw_8bit'>('cncnet_lzo_24bit');
  const [targetDim, setTargetDim] = useState<number>(256);

  // Sync mode if studio preview changes
  useEffect(() => {
    if (studioPreviewText) {
      setSourceMode('studio_preview');
    } else {
      setSourceMode('auto_render');
    }
  }, [studioPreviewText]);

  if (!isOpen) return null;

  const resetAll = () => {
    setMapFileName('');
    setMapRawContent('');
    setParsedMap(null);
    setMergedText('');
    setHasInjected(false);
    setIsProcessing(false);
    setStatusMessage('');
    setErrorMessage('');
    setCustomImageCanvas(null);
    setCustomImageName('');
  };

  const handleCustomImageUpload = (file: File) => {
    if (!file.type.includes('image') && !file.name.toLowerCase().endsWith('.png')) {
      setErrorMessage('Please select a valid image file (*.png).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const cvs = document.createElement('canvas');
        cvs.width = img.width;
        cvs.height = img.height;
        const ctx = cvs.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          setCustomImageCanvas(cvs);
          setCustomImageName(file.name);
          setErrorMessage('');
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const performInjection = async (rawMapText: string, filename: string) => {
    setIsProcessing(true);
    setErrorMessage('');
    setStatusMessage('Analyzing map structure...');

    try {
      let previewToInject = '';

      // Mode 1: Active Studio preview block
      if (sourceMode === 'studio_preview') {
        if (!studioPreviewText) {
          throw new Error('No PreviewPack text currently generated in Studio. Please render from map or choose custom image.');
        }
        previewToInject = studioPreviewText;
      }
      // Mode 2: Auto-render authentic preview directly from the map file
      else if (sourceMode === 'auto_render') {
        setStatusMessage('Parsing map terrain & objects...');
        const mapData = parseMprMap(rawMapText);
        setParsedMap(mapData);

        setStatusMessage('Rendering tactical battlefield preview...');
        const offCanvas = document.createElement('canvas');

        try {
          await preloadMapAssets(mapData);
          await renderMprOriginalAssets(
            mapData,
            {
              onlyDrawVisible: true,
              showWaypoints: true,
              showOre: true,
              showWalls: true,
              showStructures: true,
              scaleMultiplier: 1.0,
            },
            offCanvas
          );
        } catch {
          renderMprToCanvas(
            mapData,
            {
              cellSize: 4,
              showOre: true,
              showWalls: true,
              showStructures: true,
              showWaypoints: true,
              showGrid: false,
              onlyDrawVisible: true,
            },
            offCanvas
          );
        }

        setStatusMessage('Compressing into 24-bit LZO PreviewPack...');
        const previewResult = convertImageToPreviewPack(offCanvas, {
          width: targetDim,
          height: targetDim,
          palette: mapData.theater === 'snow' ? 'snow' : 'temperat',
          encoding: encodingFormat,
          lineLength: 70,
          includePreviewSection: true,
          colorNoiseReduction: true,
          targetLineBudget: 1000,
          dithering: false,
          compressionOptimization: 'balanced',
          maintainAspectRatio: true,
        });

        previewToInject = previewResult.fullIniText;
      }
      // Mode 3: Custom Companion PNG provided by user
      else if (sourceMode === 'custom_image') {
        if (!customImageCanvas) {
          throw new Error('Please select a PNG preview image first.');
        }
        setStatusMessage('Compressing custom image into PreviewPack...');
        const previewResult = convertImageToPreviewPack(customImageCanvas, {
          width: targetDim,
          height: targetDim,
          palette: 'temperat',
          encoding: encodingFormat,
          lineLength: 70,
          includePreviewSection: true,
          colorNoiseReduction: true,
          targetLineBudget: 1000,
          dithering: true,
          compressionOptimization: 'balanced',
          maintainAspectRatio: true,
        });

        previewToInject = previewResult.fullIniText;
      }

      if (!previewToInject) {
        throw new Error('Failed to generate preview INI section.');
      }

      setStatusMessage('Merging [Preview] and [PreviewPack] into map file...');
      const merged = injectPreviewIntoMapFile(rawMapText, previewToInject);
      setMergedText(merged);
      setHasInjected(true);
      setStatusMessage('Map file ready!');
    } catch (err) {
      console.error('Injection error:', err);
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMapFileUpload = (file: File) => {
    setMapFileName(file.name);
    setErrorMessage('');
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      setMapRawContent(content);
      await performInjection(content, file.name);
    };
    reader.readAsText(file);
  };

  const handleDownloadMerged = () => {
    if (!mergedText) return;
    const cleanName = mapFileName || 'map_injected.mpr';
    const blob = new Blob([mergedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#0c0d12] border border-[#3b0a0a] rounded-2xl shadow-[0_0_50px_rgba(180,0,0,0.4)] overflow-hidden flex flex-col max-h-[92vh] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#2b0808] bg-[#07070a]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-b from-[#8f0808] to-[#3a0000] border-t border-red-500 border-b border-black text-amber-300 shadow-[0_0_12px_rgba(220,38,38,0.4)]">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-['Rajdhani',sans-serif] uppercase tracking-wide">
                  Map File Injector (.MPR / .INI)
                </h2>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded font-bold uppercase">
                  Standalone &bull; Smart
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Injects or replaces [Preview] &amp; [PreviewPack] into any Red Alert map file
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a1b26] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-300 flex-1 font-sans">
          {/* Source Selection Options */}
          <div className="p-4 rounded-xl bg-[#14080b] border border-[#3b0d13] space-y-3">
            <div className="text-xs font-bold text-white uppercase tracking-wider font-['Rajdhani',sans-serif] flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Choose Preview Source to Inject</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Option A: Current Studio Preview (if available) */}
              <button
                type="button"
                onClick={() => setSourceMode('studio_preview')}
                disabled={!studioPreviewText}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  sourceMode === 'studio_preview'
                    ? 'bg-red-950/70 border-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.3)]'
                    : studioPreviewText
                    ? 'bg-black/50 border-[#2d090d] text-slate-300 hover:border-slate-600'
                    : 'bg-black/20 border-neutral-900 text-slate-600 cursor-not-allowed opacity-50'
                }`}
              >
                <div className="font-bold text-xs">Studio Active Preview</div>
                <div className="text-[10px] font-mono text-slate-400 mt-1">
                  {studioPreviewText ? 'Use currently rendered INI' : 'None loaded in Studio'}
                </div>
              </button>

              {/* Option B: Direct Auto-Render From Map */}
              <button
                type="button"
                onClick={() => setSourceMode('auto_render')}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  sourceMode === 'auto_render'
                    ? 'bg-red-950/70 border-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.3)]'
                    : 'bg-black/50 border-[#2d090d] text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Auto-Render Map</span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-1">
                  Generates from map terrain automatically
                </div>
              </button>

              {/* Option C: Custom Companion PNG */}
              <button
                type="button"
                onClick={() => setSourceMode('custom_image')}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  sourceMode === 'custom_image'
                    ? 'bg-red-950/70 border-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.3)]'
                    : 'bg-black/50 border-[#2d090d] text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-blue-400" />
                  <span>Custom PNG Image</span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-1">
                  Upload an external companion image
                </div>
              </button>
            </div>

            {/* Custom image selector if selected */}
            {sourceMode === 'custom_image' && (
              <div className="pt-2 border-t border-[#2d090d] space-y-2">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/bmp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleCustomImageUpload(e.target.files[0]);
                    }
                  }}
                />
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="ra-menu-btn px-3 py-1.5 rounded text-xs font-bold cursor-pointer"
                  >
                    {customImageName ? 'Change Image' : 'Select PNG Image'}
                  </button>
                  {customImageName && (
                    <span className="text-xs font-mono text-emerald-400 truncate max-w-xs">
                      {customImageName}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Encoding settings */}
            {(sourceMode === 'auto_render' || sourceMode === 'custom_image') && (
              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-[#2d090d] text-[11px] font-mono text-slate-400">
                <div className="flex items-center gap-2">
                  <span>Format:</span>
                  <select
                    value={encodingFormat}
                    onChange={(e) => setEncodingFormat(e.target.value as any)}
                    className="bg-black border border-[#3b0d13] text-white px-2 py-1 rounded text-xs focus:outline-none"
                  >
                    <option value="cncnet_lzo_24bit">CnCNet 24-bit TrueColor LZO (Recommended)</option>
                    <option value="lcw_8bit">Westwood Format80 LCW 8-bit</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span>Resolution:</span>
                  <select
                    value={targetDim}
                    onChange={(e) => setTargetDim(parseInt(e.target.value, 10))}
                    className="bg-black border border-[#3b0d13] text-white px-2 py-1 rounded text-xs focus:outline-none"
                  >
                    <option value={128}>128x128</option>
                    <option value={192}>192x192</option>
                    <option value={256}>256x256 (Standard)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Map File Upload Dropzone */}
          <div className="p-4 rounded-xl bg-[#0e0f16] border border-[#232536] space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".mpr,.ini,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleMapFileUpload(e.target.files[0]);
                }
              }}
            />

            {!hasInjected ? (
              <div
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className={`border-2 border-dashed border-[#3a151b] hover:border-red-600 rounded-2xl p-8 text-center cursor-pointer bg-[#07070a]/90 hover:bg-[#120a0d] transition-all space-y-3 group ra-radar-grid ${
                  isProcessing ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                <FileCode className="w-10 h-10 mx-auto text-red-500 group-hover:scale-105 transition-transform" />
                <div className="text-sm font-bold font-['Rajdhani',sans-serif] uppercase text-white tracking-wide">
                  Select Your Map File (.mpr or .ini)
                </div>
                <p className="text-xs text-slate-400 font-mono max-w-sm mx-auto">
                  Upload any Red Alert 1 map to inject or replace the [Preview] and [PreviewPack] sections automatically.
                </p>
                {isProcessing && (
                  <div className="text-xs font-mono text-amber-400 animate-pulse">
                    {statusMessage || 'Processing...'}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-emerald-300 font-mono">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Successfully injected preview into <strong>{mapFileName}</strong>!</span>
                  </div>
                  <button
                    onClick={() => {
                      resetAll();
                      setTimeout(() => fileInputRef.current?.click(), 50);
                    }}
                    className="text-slate-400 hover:text-white underline font-mono text-[11px] cursor-pointer"
                  >
                    Inject Another Map
                  </button>
                </div>

                {/* Preview of merged file */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide font-mono">
                      Updated Map File Content (Top 45 lines):
                    </label>
                    <span className="text-[10px] font-mono text-slate-500">
                      Total {mergedText.split('\n').length} lines
                    </span>
                  </div>
                  <pre className="p-3 bg-[#050508] border border-[#2b0808] rounded-xl font-mono text-xs text-emerald-400/90 max-h-[260px] overflow-y-auto">
                    {mergedText.split('\n').slice(0, 45).join('\n')}
                    {mergedText.split('\n').length > 45 && '\n... (all remaining map terrain, units, structures, and triggers intact)'}
                  </pre>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs font-mono flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#2b0808] bg-[#07070a] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#141520] hover:bg-[#1d1f30] border border-slate-700 text-slate-300 text-xs font-mono cursor-pointer transition-colors"
          >
            Close
          </button>

          {hasInjected && (
            <button
              onClick={handleDownloadMerged}
              className="ra-menu-btn px-6 py-2.5 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <Download className="w-4 h-4" />
              <span>Download Ready .MPR File</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

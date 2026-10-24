import React, { useState, useRef } from 'react';
import {
  X,
  FolderOpen,
  Files,
  Sparkles,
  Cpu,
  Layers,
  Download,
  CheckCircle,
  AlertCircle,
  Play,
  RotateCcw,
  Sliders,
  Check,
  ShieldCheck,
  FileCode,
  Archive,
  Image as ImageIcon,
  Zap,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { zipSync } from 'fflate';
import { parseMprMap, MprMapData, renderMprToCanvas } from '../lib/mprParser';
import { renderMprOriginalAssets, preloadMapAssets, isOriginalAssetsLoaded } from '../lib/raOriginalRenderer';
import { convertImageToPreviewPack, injectPreviewIntoMapFile, stripPreviewFromMapFile } from '../lib/formatters';

interface BatchMapItem {
  id: string;
  file: File;
  name: string;
  content: string;
  parsed: MprMapData | null;
  parseError?: string;
  hasExistingPreview: boolean;
  existingPreviewLines: number;
  existingPreviewIs23k: boolean;
  status: 'idle' | 'processing' | 'done' | 'error';
  errorMessage?: string;
  resultMprText?: string;
  resultPngBlob?: Blob;
  resultPngDataUrl?: string;
  linesGenerated?: number;
}

type BatchAction = 'inject_previews' | 'render_pngs' | 'strip_previews';

interface BatchMapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BatchMapModal: React.FC<BatchMapModalProps> = ({ isOpen, onClose }) => {
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const filesInputRef = useRef<HTMLInputElement | null>(null);
  const progressCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [items, setItems] = useState<BatchMapItem[]>([]);
  const [selectedAction, setSelectedAction] = useState<BatchAction>('inject_previews');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentMapName, setCurrentMapName] = useState<string>('');
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [cancelRequested, setCancelRequested] = useState<boolean>(false);

  // Settings for Batch Inject
  const [injectFormat, setInjectFormat] = useState<'cncnet_lzo_24bit' | 'lcw_8bit'>('cncnet_lzo_24bit');
  const [injectSize, setInjectSize] = useState<number>(256);
  const [alsoExportPng, setAlsoExportPng] = useState<boolean>(true);

  // Settings for Batch Render PNGs
  const [renderEngine, setRenderEngine] = useState<'original' | 'vector'>('original');
  const [renderScale, setRenderScale] = useState<number>(1.0);
  const [cropBounds, setCropBounds] = useState<boolean>(true);
  const [showOre, setShowOre] = useState<boolean>(true);
  const [showWalls, setShowWalls] = useState<boolean>(true);
  const [showStructures, setShowStructures] = useState<boolean>(true);
  const [showSpawns, setShowSpawns] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const mapFiles = Array.from(fileList).filter((f) => {
      const name = f.name.toLowerCase();
      return name.endsWith('.mpr') || name.endsWith('.ini') || name.endsWith('.map');
    });

    if (mapFiles.length === 0) {
      alert('No .mpr or .ini map files found in selected folder.');
      return;
    }

    const newItems: BatchMapItem[] = [];

    for (let i = 0; i < mapFiles.length; i++) {
      const file = mapFiles[i];
      try {
        const text = await file.text();
        const parsed = parseMprMap(text);

        // Detect existing preview
        const hasPreviewPack = text.toLowerCase().includes('[previewpack]');
        let existingPreviewLines = 0;
        if (hasPreviewPack) {
          const match = text.match(/\[PreviewPack\]([\s\S]*?)(?=\n\[|$)/i);
          if (match) {
            existingPreviewLines = match[1].split(/\r?\n/).filter((l) => l.trim().length > 0).length;
          }
        }

        newItems.push({
          id: `${file.name}_${i}_${Date.now()}`,
          file,
          name: file.name,
          content: text,
          parsed,
          hasExistingPreview: hasPreviewPack,
          existingPreviewLines,
          existingPreviewIs23k: existingPreviewLines > 5000,
          status: 'idle',
        });
      } catch (err: any) {
        newItems.push({
          id: `${file.name}_${i}_${Date.now()}`,
          file,
          name: file.name,
          content: '',
          parsed: null,
          parseError: err?.message || 'Failed to parse map file',
          hasExistingPreview: false,
          existingPreviewLines: 0,
          existingPreviewIs23k: false,
          status: 'error',
          errorMessage: 'Invalid map file format',
        });
      }
    }

    setItems(newItems);
    setIsComplete(false);
    setCurrentIndex(0);
  };

  // Run the batch execution
  const handleStartBatch = async () => {
    if (items.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setCancelRequested(false);
    setIsComplete(false);

    const updated = [...items];

    for (let i = 0; i < updated.length; i++) {
      if (cancelRequested) break;

      const item = updated[i];
      if (!item.parsed) continue;

      setCurrentIndex(i);
      setCurrentMapName(item.name);
      item.status = 'processing';
      setItems([...updated]);

      try {
        const map = item.parsed;
        const offCanvas = document.createElement('canvas');

        // Render preview image
        if (selectedAction === 'inject_previews' || selectedAction === 'render_pngs') {
          const useOriginal = renderEngine === 'original';
          if (useOriginal) {
            try {
              await preloadMapAssets(map);
              await renderMprOriginalAssets(
                map,
                {
                  onlyDrawVisible: cropBounds,
                  showWaypoints: showSpawns,
                  showOre,
                  showWalls,
                  showStructures,
                  scaleMultiplier: selectedAction === 'inject_previews' ? 1.0 : renderScale,
                },
                offCanvas
              );
            } catch (err) {
              console.warn('Original asset render fallback to vector:', err);
              renderMprToCanvas(
                map,
                {
                  cellSize: selectedAction === 'inject_previews' ? 4 : Math.round(24 * renderScale),
                  showOre,
                  showWalls,
                  showStructures,
                  showWaypoints: showSpawns,
                  showGrid: false,
                  onlyDrawVisible: cropBounds,
                },
                offCanvas
              );
            }
          } else {
            renderMprToCanvas(
              map,
              {
                cellSize: selectedAction === 'inject_previews' ? 4 : Math.round(24 * renderScale),
                showOre,
                showWalls,
                showStructures,
                showWaypoints: showSpawns,
                showGrid: false,
                onlyDrawVisible: cropBounds,
              },
              offCanvas
            );
          }

          // Blit to visual mini-canvas for feedback
          if (progressCanvasRef.current && offCanvas.width > 0 && offCanvas.height > 0) {
            progressCanvasRef.current.width = 160;
            progressCanvasRef.current.height = 160;
            const pCtx = progressCanvasRef.current.getContext('2d');
            if (pCtx) {
              pCtx.imageSmoothingEnabled = false;
              pCtx.drawImage(offCanvas, 0, 0, 160, 160);
            }
          }
        }

        // Apply chosen action
        if (selectedAction === 'inject_previews') {
          // Convert offCanvas to PreviewPack
          const previewResult = convertImageToPreviewPack(offCanvas, {
            width: injectSize,
            height: injectSize,
            palette: map.theater === 'snow' ? 'snow' : 'temperat',
            encoding: injectFormat,
            lineLength: 70,
            includePreviewSection: true,
            colorNoiseReduction: true,
            targetLineBudget: 1000,
            dithering: false,
            compressionOptimization: 'balanced',
            maintainAspectRatio: true,
          });

          // Inject into original map file content
          const mergedText = injectPreviewIntoMapFile(item.content, previewResult.fullIniText);
          item.resultMprText = mergedText;
          item.linesGenerated = previewResult.lineCount;

          if (alsoExportPng) {
            const blob = await new Promise<Blob | null>((resolve) => offCanvas.toBlob(resolve, 'image/png'));
            if (blob) {
              item.resultPngBlob = blob;
              item.resultPngDataUrl = offCanvas.toDataURL('image/png');
            }
          }
        } else if (selectedAction === 'render_pngs') {
          const blob = await new Promise<Blob | null>((resolve) => offCanvas.toBlob(resolve, 'image/png'));
          if (blob) {
            item.resultPngBlob = blob;
            item.resultPngDataUrl = offCanvas.toDataURL('image/png');
          }
        } else if (selectedAction === 'strip_previews') {
          const stripped = stripPreviewFromMapFile(item.content);
          item.resultMprText = stripped;
        }

        item.status = 'done';
      } catch (err: any) {
        item.status = 'error';
        item.errorMessage = err?.message || 'Failed to process';
      }

      setItems([...updated]);
      // Small pause to allow UI repaint
      await new Promise((r) => setTimeout(r, 10));
    }

    setIsProcessing(false);
    setIsComplete(true);
  };

  // Download all generated files in a clean ZIP bundle
  const handleDownloadAllZip = () => {
    const zipFiles: Record<string, Uint8Array> = {};

    let count = 0;
    for (const item of items) {
      if (item.status !== 'done') continue;

      const baseName = item.name.replace(/\.[^/.]+$/, '');

      // Injected / processed map file
      if (item.resultMprText) {
        zipFiles[`maps/${baseName}.mpr`] = new TextEncoder().encode(item.resultMprText);
        count++;
      }

      // Rendered PNG preview
      if (item.resultPngBlob) {
        const reader = new FileReader();
        // Since we need sync or rapid array, let's convert or use cached buffer
        // In modern browser, blob.arrayBuffer() is async
      }
    }

    // For instant synchronous ZIP packaging with fflate:
    const collectAndZip = async () => {
      for (const item of items) {
        if (item.status !== 'done') continue;
        const baseName = item.name.replace(/\.[^/.]+$/, '');

        if (item.resultMprText) {
          zipFiles[`maps/${baseName}.mpr`] = new TextEncoder().encode(item.resultMprText);
        }

        if (item.resultPngBlob) {
          const buf = await item.resultPngBlob.arrayBuffer();
          zipFiles[`previews/${baseName}.png`] = new Uint8Array(buf);
        }
      }

      // Add a summary file
      const manifest = {
        app: 'Red Alert 1 PNG to INI Map Studio 1.0',
        processedAt: new Date().toISOString(),
        action: selectedAction,
        totalMaps: items.length,
        completed: items.filter((i) => i.status === 'done').length,
      };
      zipFiles['summary.json'] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

      const zipped = zipSync(zipFiles);
      const zipBlob = new Blob([zipped], { type: 'application/zip' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RA1_Batch_${selectedAction}_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    collectAndZip();
  };

  // Download individual processed map
  const handleDownloadSingleMpr = (item: BatchMapItem) => {
    if (!item.resultMprText) return;
    const blob = new Blob([item.resultMprText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download individual rendered PNG
  const handleDownloadSinglePng = (item: BatchMapItem) => {
    if (!item.resultPngBlob) return;
    const url = URL.createObjectURL(item.resultPngBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.name.replace(/\.[^/.]+$/, '')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const processedCount = items.filter((i) => i.status === 'done').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const progressPct = items.length > 0 ? Math.round(((currentIndex + 1) / items.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-800 dark:text-slate-200 shadow-xs">
              <Files className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Batch Map Studio <span className="text-red-600 font-mono text-xs font-semibold">v1.0</span>
                </h2>
                <span className="text-[10px] font-mono uppercase bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 px-1.5 py-0.2 rounded font-bold">
                  Folder Processor
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select a folder of <code className="text-amber-600 dark:text-amber-400 font-mono">.MPR</code> maps to batch render battlefield PNGs or auto-inject optimized CnCNet [PreviewPack]
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Step 1: Select Map Folder or Files */}
          {items.length === 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Option A: Select Entire Folder */}
                <div
                  onClick={() => folderInputRef.current?.click()}
                  className="border border-slate-200 dark:border-slate-800 hover:border-emerald-500/80 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-50/90 dark:hover:bg-slate-800/70 transition-all space-y-3 group"
                >
                  <input
                    ref={folderInputRef}
                    type="file"
                    // @ts-ignore
                    webkitdirectory=""
                    directory=""
                    multiple
                    className="hidden"
                    onChange={(e) => handleFilesSelected(e.target.files)}
                  />
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 mx-auto flex items-center justify-center group-hover:scale-105 transition-transform text-emerald-600 dark:text-emerald-400">
                    <FolderOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                      Select Map Folder
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Choose any folder containing <code className="text-amber-600 dark:text-amber-400 font-mono">.mpr</code> or <code className="text-amber-600 dark:text-amber-400 font-mono">.ini</code> maps
                    </p>
                  </div>
                  <span className="inline-block text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-700/50 px-2.5 py-1 rounded-full">
                    Recommended for 10–100+ Maps
                  </span>
                </div>

                {/* Option B: Select Specific Files */}
                <div
                  onClick={() => filesInputRef.current?.click()}
                  className="border border-slate-200 dark:border-slate-800 hover:border-cyan-500/80 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-50/90 dark:hover:bg-slate-800/70 transition-all space-y-3 group"
                >
                  <input
                    ref={filesInputRef}
                    type="file"
                    accept=".mpr,.ini,.map"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFilesSelected(e.target.files)}
                  />
                  <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/60 mx-auto flex items-center justify-center group-hover:scale-105 transition-transform text-cyan-600 dark:text-cyan-400">
                    <Files className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                      Select Multiple Map Files
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Pick individual <code className="text-cyan-600 dark:text-cyan-400 font-mono">.mpr</code> files from anywhere on your PC
                    </p>
                  </div>
                  <span className="inline-block text-[10px] font-mono font-bold text-cyan-800 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200 dark:border-cyan-700/50 px-2.5 py-1 rounded-full">
                    Multi-File Picker
                  </span>
                </div>
              </div>

              {/* Information banner about 23,000 line bloat fix */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white">Why Batch Edit Maps in 1.0?</div>
                  <p className="leading-relaxed">
                    Many older or unoptimized maps contain massive 23,000+ line uncompressed previews (~1.6 MB) that cause other players to wait 30+ seconds during lobby downloads on CnCNet.
                    Batch Map Studio automatically scans your whole collection, fixes bloat, and injects pixel-perfect, authentic LZO 24-bit previews (&lt; 1,000 lines) so games start instantly.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top Controls: Folder Summary & Action Selector */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Left (5 cols): Folder Stats */}
                <div className="lg:col-span-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
                      <FolderOpen className="w-4 h-4 text-amber-500" />
                      Loaded Maps ({items.length})
                    </span>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        setItems([]);
                        setIsComplete(false);
                      }}
                      className="text-[11px] font-mono text-slate-500 dark:text-slate-400 hover:text-red-500 underline transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Clear & Change Folder
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Valid Maps</div>
                      <div className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-base">
                        {items.filter((i) => i.parsed).length}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Has Preview</div>
                      <div className="text-amber-600 dark:text-amber-400 font-bold font-mono text-base">
                        {items.filter((i) => i.hasExistingPreview).length}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">23k+ Bloat</div>
                      <div className="text-rose-600 dark:text-rose-400 font-bold font-mono text-base">
                        {items.filter((i) => i.existingPreviewIs23k).length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right (7 cols): Choose What Happens to the Maps */}
                <div className="lg:col-span-7 space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    Select Action for Loaded Maps:
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setSelectedAction('inject_previews')}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                        selectedAction === 'inject_previews'
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-slate-900 dark:text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                        <span>Inject Previews</span>
                        {selectedAction === 'inject_previews' && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                        Render & inject authentic CnCNet [PreviewPack] into map files
                      </p>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setSelectedAction('render_pngs')}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                        selectedAction === 'render_pngs'
                          ? 'bg-red-50 dark:bg-red-950/50 border-red-500 text-slate-900 dark:text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center justify-between">
                        <span>Export PNGs</span>
                        {selectedAction === 'render_pngs' && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                        Batch render full-resolution battlefield images
                      </p>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setSelectedAction('strip_previews')}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                        selectedAction === 'strip_previews'
                          ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-slate-900 dark:text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center justify-between">
                        <span>Strip Previews</span>
                        {selectedAction === 'strip_previews' && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                        Remove bloated 23k preview blocks from all maps
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Parameters Configuration Box */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-slate-500" />
                    Action Parameters
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Applied to all {items.length} maps in batch
                  </span>
                </div>

                {selectedAction === 'inject_previews' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Format:</span>
                      <select
                        value={injectFormat}
                        onChange={(e) => setInjectFormat(e.target.value as any)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-white font-mono"
                      >
                        <option value="cncnet_lzo_24bit">CnCNet LZO (24-bit Truecolor - XCC Standard)</option>
                        <option value="lcw_8bit">Classic LCW (8-bit Indexed - 1996 Westwood)</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Preview Resolution:</span>
                      <select
                        value={injectSize}
                        onChange={(e) => setInjectSize(parseInt(e.target.value, 10))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-white font-mono"
                      >
                        <option value={256}>256×256 px (CnCNet HD · ~800–1,100 lines · Recommended)</option>
                        <option value={192}>192×192 px (Balanced · ~450–700 lines)</option>
                        <option value={128}>128×128 px (Classic · ~200–350 lines)</option>
                      </select>
                    </div>

                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 cursor-pointer hover:text-slate-900 dark:hover:text-white text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={alsoExportPng}
                          onChange={(e) => setAlsoExportPng(e.target.checked)}
                          className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-0"
                        />
                        <span>Also generate .PNG previews in ZIP</span>
                      </label>
                    </div>
                  </div>
                )}

                {selectedAction === 'render_pngs' && (
                  <div className="space-y-3 text-xs">
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <span className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Graphics Engine:</span>
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => setRenderEngine('original')}
                            className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                              renderEngine === 'original' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            ⭐ Original Westwood 24×24 Assets
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenderEngine('vector')}
                            className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                              renderEngine === 'vector' ? 'bg-red-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            Tactical Vector
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Scale:</span>
                        <select
                          value={renderScale}
                          onChange={(e) => setRenderScale(parseFloat(e.target.value))}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-white font-mono"
                        >
                          <option value={1.0}>Native 24px (100% Full Res)</option>
                          <option value={0.5}>Tactical 12px (50%)</option>
                          <option value={0.25}>Compact 6px (25%)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-1 text-neutral-300">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cropBounds}
                          onChange={(e) => setCropBounds(e.target.checked)}
                          className="rounded border-neutral-700 text-emerald-500"
                        />
                        <span>Crop Visible Bounds</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showOre}
                          onChange={(e) => setShowOre(e.target.checked)}
                          className="rounded border-neutral-700 text-emerald-500"
                        />
                        <span>Ore & Gems</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showWalls}
                          onChange={(e) => setShowWalls(e.target.checked)}
                          className="rounded border-neutral-700 text-emerald-500"
                        />
                        <span>Walls (Concrete & XTRA)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showStructures}
                          onChange={(e) => setShowStructures(e.target.checked)}
                          className="rounded border-neutral-700 text-emerald-500"
                        />
                        <span>Buildings</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showSpawns}
                          onChange={(e) => setShowSpawns(e.target.checked)}
                          className="rounded border-neutral-700 text-emerald-500"
                        />
                        <span>Spawns</span>
                      </label>
                    </div>
                  </div>
                )}

                {selectedAction === 'strip_previews' && (
                  <p className="text-xs text-neutral-400">
                    Will strip any <code className="text-amber-400">[Preview]</code> and <code className="text-amber-400">[PreviewPack]</code> sections, removing bloated 23k-line blocks from all maps in this folder.
                  </p>
                )}
              </div>

              {/* Progress & Live Preview (during execution) */}
              {isProcessing && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span>
                          Processing Map {currentIndex + 1} of {items.length}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-amber-400 truncate max-w-md">
                        {currentMapName}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-extrabold text-emerald-400 font-mono">
                        {progressPct}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-neutral-800 rounded-full h-2.5 overflow-hidden border border-neutral-700">
                    <div
                      className="bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 h-2.5 rounded-full transition-all duration-150"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  {/* Visual Live Canvas Thumbnail */}
                  <div className="flex items-center gap-3 pt-2">
                    <canvas
                      ref={progressCanvasRef}
                      className="w-16 h-16 rounded-lg border border-neutral-800 bg-black object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <div className="text-[11px] font-mono text-neutral-400 space-y-0.5">
                      <div>Status: Rendering terrain & structures...</div>
                      <div className="text-neutral-500">
                        {processedCount} completed · {errorCount} errors
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons: Start Execution / Download ZIP */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800">
                <div className="flex items-center gap-2">
                  {!isProcessing && !isComplete && (
                    <button
                      type="button"
                      onClick={handleStartBatch}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Start Batch Process ({items.length} Maps)</span>
                    </button>
                  )}

                  {isProcessing && (
                    <button
                      type="button"
                      onClick={() => setCancelRequested(true)}
                      className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Stop / Cancel
                    </button>
                  )}

                  {isComplete && (
                    <button
                      type="button"
                      onClick={handleDownloadAllZip}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-950/60 transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download All as ZIP ({processedCount} Items)</span>
                    </button>
                  )}

                  {isComplete && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsComplete(false);
                        const reset = items.map((i) => ({ ...i, status: 'idle' as const }));
                        setItems(reset);
                      }}
                      className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Re-Run</span>
                    </button>
                  )}
                </div>

                <div className="text-xs font-mono text-neutral-400">
                  {processedCount} / {items.length} Processed
                </div>
              </div>

              {/* Maps Manifest Table */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Batch Queue Details:</span>
                  <span className="text-[11px] font-mono font-normal text-slate-500 dark:text-slate-400">
                    Showing all loaded maps
                  </span>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 sticky top-0">
                      <tr>
                        <th className="p-2.5">Map File</th>
                        <th className="p-2.5">Title & Theater</th>
                        <th className="p-2.5">Existing Preview</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white max-w-[180px] truncate">
                            {item.name}
                          </td>
                          <td className="p-2.5">
                            {item.parsed ? (
                              <div className="space-y-0.5">
                                <div className="text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                                  {item.parsed.title}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                                  {item.parsed.theater} · {item.parsed.playerSpawnCount}P · {item.parsed.wallCellCount} Walls
                                </div>
                              </div>
                            ) : (
                              <span className="text-red-500">Parse error</span>
                            )}
                          </td>
                          <td className="p-2.5">
                            {item.hasExistingPreview ? (
                              item.existingPreviewIs23k ? (
                                <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>23k+ Lines (Bloat)</span>
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  ~{item.existingPreviewLines} Lines
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400">None</span>
                            )}
                          </td>
                          <td className="p-2.5">
                            {item.status === 'idle' && (
                              <span className="text-slate-400">Queued</span>
                            )}
                            {item.status === 'processing' && (
                              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                Processing...
                              </span>
                            )}
                            {item.status === 'done' && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Done
                                {item.linesGenerated && ` (~${item.linesGenerated}L)`}
                              </span>
                            )}
                            {item.status === 'error' && (
                              <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                {item.errorMessage || 'Error'}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-right space-x-1">
                            {item.resultMprText && (
                              <button
                                type="button"
                                onClick={() => handleDownloadSingleMpr(item)}
                                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-semibold transition-colors cursor-pointer"
                                title="Download updated .MPR"
                              >
                                .MPR
                              </button>
                            )}
                            {item.resultPngBlob && (
                              <button
                                type="button"
                                onClick={() => handleDownloadSinglePng(item)}
                                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold transition-colors cursor-pointer"
                                title="Download rendered .PNG"
                              >
                                .PNG
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

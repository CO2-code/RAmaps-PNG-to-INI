import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileCode,
  Download,
  Check,
  AlertCircle,
  Eye,
  Sliders,
  Layers,
  MapPin,
  Sparkles,
  Maximize2,
  RefreshCw,
  ArrowRight,
  Upload,
  Compass,
  Image as ImageIcon,
  FolderArchive,
  AlertTriangle,
  Cpu,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  parseMprMap,
  renderMprToCanvas,
  MprMapData,
  MprRenderOptions,
  PLAYER_SPAWN_COLORS,
} from '../lib/mprParser';
import {
  renderMprOriginalAssets,
  preloadMapAssets,
  loadOriginalAssetsManually,
  getOriginalAssetsError,
  retryOriginalAssetsLoad,
  isOriginalAssetsLoaded,
} from '../lib/raOriginalRenderer';
import { SAMPLE_MPR_MAPS } from '../lib/sampleMprMaps';
import { decodePreviewFromIni } from '../lib/formatters';

interface MprToPngModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToGenerator?: (canvas: HTMLCanvasElement, filename: string) => void;
}

export const MprToPngModal: React.FC<MprToPngModalProps> = ({
  isOpen,
  onClose,
  onSendToGenerator,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const manualPackInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [activeSource, setActiveSource] = useState<'sample' | 'upload'>('sample');
  const [selectedSampleId, setSelectedSampleId] = useState<string>('time_flies');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [rawFileText, setRawFileText] = useState<string>('');

  const [mapData, setMapData] = useState<MprMapData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // View mode: Full map render vs Embedded [PreviewPack] if present
  const [viewMode, setViewMode] = useState<'full_render' | 'embedded_preview'>('full_render');

  // Asset Engine: 'original' (Authentic Westwood 24x24 game tiles/SHP) vs 'vector' (Schematic Tactical)
  const [assetEngine, setAssetEngine] = useState<'original' | 'vector'>('original');
  const [loadingAssets, setLoadingAssets] = useState<boolean>(false);
  const [assetProgress, setAssetProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [assetLoadError, setAssetLoadError] = useState<string | null>(null);

  // Original asset scale multiplier: 1.0 = native 24px, 0.5 = 12px, 0.25 = 6px
  const [originalScale, setOriginalScale] = useState<number>(0.5);

  // Vector render options
  const [renderOptions, setRenderOptions] = useState<MprRenderOptions>({
    cellSize: 6,
    onlyDrawVisible: true,
    showWaypoints: true,
    showOre: true,
    showStructures: true,
    showWalls: true,
    showGrid: false,
    theaterOverride: undefined,
  });

  const [isAdvancedLayersOpen, setIsAdvancedLayersOpen] = useState<boolean>(false);

  // Load sample on open
  useEffect(() => {
    if (isOpen && !rawFileText) {
      const sample = SAMPLE_MPR_MAPS.find((s) => s.id === selectedSampleId) || SAMPLE_MPR_MAPS[0];
      setRawFileText(sample.content);
      setUploadedFileName(sample.filename);
    }
  }, [isOpen]);

  // Re-parse whenever rawFileText changes
  useEffect(() => {
    if (!rawFileText) return;
    setParseError(null);
    try {
      const parsed = parseMprMap(rawFileText);
      setMapData(parsed);
      if (!parsed.hasMapPack && parsed.hasEmbeddedPreview) {
        setViewMode('embedded_preview');
      } else {
        setViewMode('full_render');
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
    }
  }, [rawFileText]);

  // Re-render canvas when mapData, renderOptions, assetEngine, or viewMode change
  useEffect(() => {
    if (!canvasRef.current || !mapData) return;

    let isCancelled = false;

    if (viewMode === 'embedded_preview' && mapData.embeddedPreview) {
      try {
        const decoded = decodePreviewFromIni(
          mapData.embeddedPreview.previewPackText,
          mapData.theater === 'snow'
            ? 'snow'
            : mapData.theater === 'interior'
            ? 'interior'
            : 'temperat'
        );
        const canvas = canvasRef.current;
        canvas.width = decoded.width;
        canvas.height = decoded.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.putImageData(decoded.imageData, 0, 0);
        }
      } catch (err) {
        console.warn('Failed to decode embedded preview:', err);
      }
      return;
    }

    if (viewMode === 'full_render') {
      if (assetEngine === 'original') {
        setLoadingAssets(true);
        setAssetLoadError(null);
        // Preload assets then render with authentic game graphics
        preloadMapAssets(mapData, (loaded, total) => {
          if (!isCancelled) {
            setAssetProgress({ loaded, total });
          }
        })
          .then(() => {
            if (isCancelled || !canvasRef.current) return;
            setAssetLoadError(null);
            return renderMprOriginalAssets(
              mapData,
              {
                onlyDrawVisible: renderOptions.onlyDrawVisible,
                showWaypoints: renderOptions.showWaypoints,
                showOre: renderOptions.showOre,
                showStructures: renderOptions.showStructures,
                showWalls: renderOptions.showWalls !== false,
                scaleMultiplier: originalScale,
              },
              canvasRef.current
            );
          })
          .catch((err) => {
            console.warn('Failed original asset render:', err);
            if (!isCancelled) {
              const msg = err instanceof Error ? err.message : String(err);
              setAssetLoadError(msg);
              // Render tactical vector as visual fallback while displaying error banner
              if (canvasRef.current) {
                renderMprToCanvas(mapData, renderOptions, canvasRef.current);
              }
            }
          })
          .finally(() => {
            if (!isCancelled) {
              setLoadingAssets(false);
            }
          });
      } else {
        // Fast vector tactical render
        setAssetLoadError(null);
        renderMprToCanvas(mapData, renderOptions, canvasRef.current);
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [mapData, renderOptions, viewMode, assetEngine, originalScale]);

  const handleManualPackUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      setLoadingAssets(true);
      const buffer = await file.arrayBuffer();
      const success = loadOriginalAssetsManually(buffer);
      if (success) {
        setAssetLoadError(null);
        if (canvasRef.current && mapData) {
          await renderMprOriginalAssets(
            mapData,
            {
              onlyDrawVisible: renderOptions.onlyDrawVisible,
              showWaypoints: renderOptions.showWaypoints,
              showOre: renderOptions.showOre,
              showStructures: renderOptions.showStructures,
              showWalls: renderOptions.showWalls !== false,
              scaleMultiplier: originalScale,
            },
            canvasRef.current
          );
        }
      } else {
        setAssetLoadError(getOriginalAssetsError() || 'Failed to unpack provided archive file');
      }
    } catch (err: any) {
      setAssetLoadError(err?.message || 'Failed to read file');
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleRetryAssetLoad = async () => {
    setAssetLoadError(null);
    setLoadingAssets(true);
    try {
      const ok = await retryOriginalAssetsLoad((loaded, total) => {
        setAssetProgress({ loaded, total });
      });
      if (ok && canvasRef.current && mapData) {
        setAssetLoadError(null);
        await renderMprOriginalAssets(
          mapData,
          {
            onlyDrawVisible: renderOptions.onlyDrawVisible,
            showWaypoints: renderOptions.showWaypoints,
            showOre: renderOptions.showOre,
            showStructures: renderOptions.showStructures,
            showWalls: renderOptions.showWalls !== false,
            scaleMultiplier: originalScale,
          },
          canvasRef.current
        );
      } else {
        setAssetLoadError(getOriginalAssetsError() || 'Could not load asset pack');
      }
    } catch (err: any) {
      setAssetLoadError(err?.message || 'Retry failed');
    } finally {
      setLoadingAssets(false);
    }
  };

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    setUploadedFileName(file.name);
    setActiveSource('upload');
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRawFileText(text);
    };
    reader.readAsText(file);
  };

  const handleSelectSample = (sampleId: string) => {
    setSelectedSampleId(sampleId);
    setActiveSource('sample');
    const sample = SAMPLE_MPR_MAPS.find((s) => s.id === sampleId);
    if (sample) {
      setUploadedFileName(sample.filename);
      setRawFileText(sample.content);
    }
  };

  const handleDownloadPng = async (scaleMultiplier: number = 1) => {
    if (!canvasRef.current || !mapData) return;

    let exportCanvas = canvasRef.current;

    // If higher scale is requested, render onto a dedicated canvas
    if (scaleMultiplier !== 1 && viewMode === 'full_render') {
      exportCanvas = document.createElement('canvas');
      if (assetEngine === 'original') {
        await renderMprOriginalAssets(
          mapData,
          {
            onlyDrawVisible: renderOptions.onlyDrawVisible,
            showWaypoints: renderOptions.showWaypoints,
            showOre: renderOptions.showOre,
            showStructures: renderOptions.showStructures,
            showWalls: renderOptions.showWalls !== false,
            scaleMultiplier: originalScale * scaleMultiplier,
          },
          exportCanvas
        );
      } else {
        renderMprToCanvas(
          mapData,
          {
            ...renderOptions,
            cellSize: renderOptions.cellSize * scaleMultiplier,
          },
          exportCanvas
        );
      }
    }

    const url = exportCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    const cleanBaseName = uploadedFileName.replace(/\.[^/.]+$/, '');
    const engineTag = assetEngine === 'original' ? 'original_graphics' : 'tactical';
    a.download = `${cleanBaseName}_${engineTag}_${exportCanvas.width}x${exportCanvas.height}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSendToApp = () => {
    if (!canvasRef.current || !mapData || !onSendToGenerator) return;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasRef.current.width;
    tempCanvas.height = canvasRef.current.height;
    const ctx = tempCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(canvasRef.current, 0, 0);
    }
    const cleanBaseName = uploadedFileName.replace(/\.[^/.]+$/, '');
    onSendToGenerator(tempCanvas, `${cleanBaseName}_map.png`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/70 border border-red-200 dark:border-red-700/60 text-red-600 dark:text-red-400 shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-wide">
                  Red Alert 1 <span className="text-red-600">*.MPR → *.PNG</span> Map Generator
                </h2>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded font-bold">
                  {assetEngine === 'original' ? 'Original Westwood Assets' : 'Tactical Vector'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Ported from Iran's RAFullMapPreviewGenerator · Generate preview images using original 24×24 game tiles or tactical vector
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Control Bar: Source Switcher & Map Picker */}
        <div className="p-3 sm:px-6 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              Map Source:
            </span>
            <div className="flex items-center rounded-lg bg-white dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => {
                  setActiveSource('sample');
                  handleSelectSample(selectedSampleId);
                }}
                className={`px-3 py-1 rounded-md transition-colors font-medium cursor-pointer ${
                  activeSource === 'sample'
                    ? 'bg-red-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-neutral-200'
                }`}
              >
                Sample Maps
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`px-3 py-1 rounded-md transition-colors font-medium flex items-center gap-1.5 cursor-pointer ${
                  activeSource === 'upload'
                    ? 'bg-red-600 text-white shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-neutral-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Custom .MPR</span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mpr,.ini,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
          </div>

          {activeSource === 'sample' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-mono text-[11px]">Pick Map:</span>
              <select
                value={selectedSampleId}
                onChange={(e) => handleSelectSample(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-neutral-200 font-medium focus:outline-none focus:border-red-500"
              >
                {SAMPLE_MPR_MAPS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeSource === 'upload' && uploadedFileName && (
            <div className="flex items-center gap-2 text-neutral-300 font-mono text-xs">
              <span className="text-neutral-500">File:</span>
              <span className="text-emerald-400 font-bold">{uploadedFileName}</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-neutral-400 hover:text-white underline text-[11px]"
              >
                Change
              </button>
            </div>
          )}
        </div>

        {/* Content Body: Left Viewport (Canvas), Right Controls */}
        <div className="p-4 sm:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Canvas Viewport (7 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            {/* Primary Engine Switcher: Westwood 24×24 Original Assets vs Tactical Vector */}
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2.5 bg-neutral-950 p-2.5 rounded-2xl border border-neutral-800 shadow-md">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-900 border border-neutral-800">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('full_render');
                      setAssetEngine('original');
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      assetEngine === 'original' && viewMode === 'full_render'
                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-400'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/80'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>⭐ Original Westwood Assets</span>
                    <span className="text-[10px] font-mono uppercase bg-emerald-950/90 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-400/40">
                      24×24 Authentic
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('full_render');
                      setAssetEngine('vector');
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      assetEngine === 'vector' && viewMode === 'full_render'
                        ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-950/60 ring-2 ring-red-400'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/80'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5 text-neutral-200" />
                    <span>Tactical Vector</span>
                    <span className="text-[10px] font-mono uppercase bg-red-950/90 text-red-300 px-1.5 py-0.2 rounded border border-red-400/40">
                      Schematic
                    </span>
                  </button>
                </div>

                {/* Embedded preview button if map has one */}
                {mapData?.hasEmbeddedPreview && (
                  <button
                    type="button"
                    onClick={() => setViewMode(viewMode === 'embedded_preview' ? 'full_render' : 'embedded_preview')}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                      viewMode === 'embedded_preview'
                        ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 shadow-md'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-cyan-300'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Embedded [PreviewPack] ({mapData.embeddedPreview?.width}×{mapData.embeddedPreview?.height})</span>
                  </button>
                )}
              </div>

              {/* Sub-bar for Original Assets: Scale & Layer Toggles */}
              {viewMode === 'full_render' && assetEngine === 'original' && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-neutral-950/90 border border-neutral-800/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-neutral-400 uppercase font-semibold">Scale:</span>
                    <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800">
                      {[
                        { label: 'Native 24px (100%)', scale: 1.0 },
                        { label: 'Tactical 12px (50%)', scale: 0.5 },
                        { label: 'Compact 6px (25%)', scale: 0.25 },
                      ].map((item) => (
                        <button
                          key={item.scale}
                          type="button"
                          onClick={() => setOriginalScale(item.scale)}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                            originalScale === item.scale
                              ? 'bg-emerald-600 text-white font-bold'
                              : 'text-neutral-400 hover:text-neutral-200'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-neutral-300">
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={renderOptions.onlyDrawVisible}
                        onChange={(e) =>
                          setRenderOptions((prev) => ({ ...prev, onlyDrawVisible: e.target.checked }))
                        }
                        className="rounded border-neutral-700 text-emerald-500 focus:ring-0"
                      />
                      <span>Crop Bounds</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={renderOptions.showWaypoints}
                        onChange={(e) =>
                          setRenderOptions((prev) => ({ ...prev, showWaypoints: e.target.checked }))
                        }
                        className="rounded border-neutral-700 text-emerald-500 focus:ring-0"
                      />
                      <span>Spawns</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={renderOptions.showOre}
                        onChange={(e) =>
                          setRenderOptions((prev) => ({ ...prev, showOre: e.target.checked }))
                        }
                        className="rounded border-neutral-700 text-emerald-500 focus:ring-0"
                      />
                      <span>Ore & Gems</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={renderOptions.showStructures}
                        onChange={(e) =>
                          setRenderOptions((prev) => ({ ...prev, showStructures: e.target.checked }))
                        }
                        className="rounded border-neutral-700 text-emerald-500 focus:ring-0"
                      />
                      <span>Buildings</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={renderOptions.showWalls !== false}
                        onChange={(e) =>
                          setRenderOptions((prev) => ({ ...prev, showWalls: e.target.checked }))
                        }
                        className="rounded border-neutral-700 text-emerald-500 focus:ring-0"
                      />
                      <span>Walls</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Asset Load Error Banner with Retry and Browse options */}
              {assetLoadError && (
                <div className="p-3.5 rounded-xl bg-amber-950/70 border border-amber-600/80 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fade-in">
                  <div className="flex items-start gap-2.5 text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-amber-300">
                        Could not load <code className="font-mono text-white">ra_data.pack</code> automatically
                      </div>
                      <p className="text-[11px] text-amber-200/80 mt-0.5">
                        {assetLoadError}. You can retry loading or select <code className="font-mono text-amber-300">ra_data.pack</code> / <code className="font-mono text-amber-300">ra_data.zip</code> manually from your disk.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleRetryAssetLoad}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retry</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => manualPackInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-amber-600/60 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FolderArchive className="w-3.5 h-3.5" />
                      <span>Browse .pack / .zip</span>
                    </button>

                    <input
                      ref={manualPackInputRef}
                      type="file"
                      accept=".pack,.zip"
                      className="hidden"
                      onChange={handleManualPackUpload}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Canvas Container */}
            <div className="relative border border-neutral-800 rounded-2xl bg-black p-4 flex flex-col items-center justify-center min-h-[380px] overflow-hidden shadow-inner group">
              {/* Asset Loading Overlay */}
              {loadingAssets && (
                <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 space-y-3 animate-fade-in">
                  <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
                  <div className="text-white font-bold text-sm tracking-wide">
                    Loading Original Westwood Assets Archive...
                  </div>
                  {assetProgress && assetProgress.total > 0 && (
                    <div className="w-72 space-y-1.5 text-center">
                      <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden border border-neutral-700">
                        <div
                          className="bg-gradient-to-r from-red-600 via-amber-500 to-emerald-500 h-2 rounded-full transition-all duration-150"
                          style={{
                            width: `${Math.min(100, Math.round((assetProgress.loaded / Math.max(1, assetProgress.total)) * 100))}%`,
                          }}
                        />
                      </div>
                      <div className="text-[11px] font-mono text-neutral-300 flex items-center justify-between">
                        <span>
                          {(assetProgress.loaded / (1024 * 1024)).toFixed(1)} MB / {(assetProgress.total / (1024 * 1024)).toFixed(1)} MB
                        </span>
                        <span className="text-emerald-400 font-bold">
                          {Math.min(100, Math.round((assetProgress.loaded / Math.max(1, assetProgress.total)) * 100))}%
                        </span>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-neutral-400 font-mono text-center max-w-sm">
                    Unpacking authentic 24×24 .tem tiles & .shp sprites from <code className="text-amber-400">ra_data.pack</code>
                  </p>
                </div>
              )}

              <div className="max-h-[500px] max-w-full overflow-auto flex items-center justify-center p-2">
                <canvas
                  ref={canvasRef}
                  className="rounded-lg shadow-2xl max-w-full max-h-[460px] object-contain block border border-neutral-800"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>

              {/* Viewport Overlay Info Badge */}
              {mapData && (
                <div className="absolute bottom-3 left-3 bg-neutral-950/85 backdrop-blur-md border border-neutral-800/80 px-2.5 py-1 rounded-lg text-[11px] font-mono text-neutral-300 flex items-center gap-2">
                  <span>
                    Resolution: <strong className="text-white">{canvasRef.current?.width || 0}×{canvasRef.current?.height || 0} px</strong>
                  </span>
                  <span className="text-neutral-600">·</span>
                  <span className="capitalize text-amber-400">{mapData.theater} Theater</span>
                </div>
              )}
            </div>

            {/* Spawn Point Legend */}
            {renderOptions.showWaypoints && mapData && mapData.waypoints.length > 0 && (
              <div className="p-3 bg-neutral-950/90 border border-neutral-800 rounded-xl">
                <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-red-400" />
                  <span>Detected Player Starting Spawns (Waypoints):</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {mapData.waypoints.filter((w) => w.isSpawn).map((wp) => {
                    const meta = PLAYER_SPAWN_COLORS[wp.id] || { color: '#ffffff' };
                    return (
                      <div
                        key={wp.id}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] font-mono"
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                          style={{ backgroundColor: meta.color }}
                        >
                          {wp.id + 1}
                        </span>
                        <span className="text-neutral-300">
                          P{wp.id + 1} ({wp.x},{wp.y})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Settings & Map Info (5 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
            {/* Map Metadata Card */}
            {mapData && (
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-neutral-900 pb-2">
                  <div className="font-bold text-white text-sm truncate" title={mapData.title}>
                    {mapData.title}
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-red-950/60 border border-red-800/60 text-red-400">
                    {mapData.theater}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800/60">
                    <div className="text-[10px] text-neutral-500 uppercase">Map Bounds</div>
                    <div className="text-neutral-200 font-bold">
                      {mapData.mapWidth}×{mapData.mapHeight} (X:{mapData.mapX}, Y:{mapData.mapY})
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800/60">
                    <div className="text-[10px] text-neutral-500 uppercase">Player Spawns</div>
                    <div className="text-emerald-400 font-bold">
                      {mapData.playerSpawnCount} Players
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800/60">
                    <div className="text-[10px] text-neutral-500 uppercase">Gold Ore Fields</div>
                    <div className="text-amber-400 font-bold">
                      {mapData.goldCellCount} Cells
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800/60">
                    <div className="text-[10px] text-neutral-500 uppercase">Gem Deposits</div>
                    <div className="text-rose-400 font-bold">
                      {mapData.gemCellCount} Cells
                    </div>
                  </div>

                  {mapData.wallCellCount > 0 && (
                    <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800/60 col-span-2 sm:col-span-1">
                      <div className="text-[10px] text-neutral-500 uppercase">Defensive Walls</div>
                      <div className="text-cyan-400 font-bold">
                        {mapData.wallCellCount} Cells
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Asset Engine Selector (Original Assets vs Tactical Vector) */}
            {viewMode === 'full_render' && (
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span>Asset Graphics Mode</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setAssetEngine('original')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                      assetEngine === 'original'
                        ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-md shadow-emerald-950/30'
                        : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
                        <ImageIcon className="w-3.5 h-3.5" />
                        Original Assets
                      </span>
                      {assetEngine === 'original' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[10px] text-neutral-400 leading-tight">
                      Authentic 24×24 Westwood tiles, trees, ore & buildings from Iran engine
                    </p>
                  </button>

                  <button
                    onClick={() => setAssetEngine('vector')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                      assetEngine === 'vector'
                        ? 'bg-red-950/40 border-red-500 text-white shadow-md shadow-red-950/30'
                        : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold flex items-center gap-1.5 text-red-400">
                        <Cpu className="w-3.5 h-3.5" />
                        Tactical Vector
                      </span>
                      {assetEngine === 'vector' && <Check className="w-3.5 h-3.5 text-red-400" />}
                    </div>
                    <p className="text-[10px] text-neutral-400 leading-tight">
                      Instant schematic mini-map with crisp tactical terrain polygons
                    </p>
                  </button>
                </div>

                {/* Resolution / Scale Selector for Original Assets */}
                {assetEngine === 'original' && (
                  <div className="pt-2 border-t border-neutral-900">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-neutral-400 uppercase">
                        Original Asset Scale:
                      </span>
                      <span className="text-xs font-mono text-emerald-400">
                        {originalScale === 1.0 ? 'Native (24px/cell)' : originalScale === 0.5 ? 'Tactical (12px/cell)' : 'Compact (6px/cell)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: 'Compact (6px)', scale: 0.25 },
                        { label: 'Tactical (12px)', scale: 0.5 },
                        { label: 'Native (24px)', scale: 1.0 },
                      ].map((item) => (
                        <button
                          key={item.scale}
                          onClick={() => setOriginalScale(item.scale)}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-mono transition-colors ${
                            originalScale === item.scale
                              ? 'bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold'
                              : 'bg-neutral-900/70 border border-neutral-800 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Advanced Rendering & Layer Controls */}
            {viewMode === 'full_render' && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <button
                  type="button"
                  onClick={() => setIsAdvancedLayersOpen(!isAdvancedLayersOpen)}
                  className="w-full flex items-center justify-between text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-neutral-300 group-hover:text-slate-900 dark:group-hover:text-white uppercase tracking-wider">
                    <Sliders className="w-4 h-4 text-red-500" />
                    <span>Advanced Layer & Crop Options</span>
                  </div>
                  {isAdvancedLayersOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white" />
                  )}
                </button>

                {isAdvancedLayersOpen && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-neutral-900 animate-fade-in">
                    {/* Draw Visible Only Toggle (--drawvisibleonly) */}
                    <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl bg-white dark:bg-neutral-900/70 border border-slate-200 dark:border-neutral-800 hover:border-slate-300 dark:hover:border-neutral-700 transition-colors">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">Crop to Visible Bounds</div>
                        <div className="text-[10px] text-slate-500 dark:text-neutral-400 font-mono">
                          Matches Iran's <code className="text-amber-500">--drawvisibleonly</code>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={renderOptions.onlyDrawVisible}
                        onChange={(e) =>
                          setRenderOptions((prev) => ({ ...prev, onlyDrawVisible: e.target.checked }))
                        }
                        className="w-4 h-4 rounded text-red-600 bg-neutral-950 border-neutral-700 focus:ring-0 focus:ring-offset-0"
                      />
                    </label>

                    {/* Show Spawn Waypoints Toggle */}
                    <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl bg-neutral-900/70 border border-neutral-800 hover:border-neutral-700 transition-colors">
                      <div>
                        <div className="text-xs font-bold text-white">Player Spawn Locations</div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          Numbered color badges for players 1 to 8
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={renderOptions.showWaypoints}
                        onChange={(e) =>
                          setRenderOptions((prev) => ({ ...prev, showWaypoints: e.target.checked }))
                        }
                        className="w-4 h-4 rounded text-red-600 bg-neutral-950 border-neutral-700 focus:ring-0 focus:ring-offset-0"
                      />
                    </label>

                    {/* Show Ore & Gems Toggle */}
                    <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl bg-neutral-900/70 border border-neutral-800 hover:border-neutral-700 transition-colors">
                      <div>
                        <div className="text-xs font-bold text-white">Resource Overlays (Ore & Gems)</div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          Highlights glistening gold and ruby crystals
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={renderOptions.showOre}
                        onChange={(e) =>
                          setRenderOptions((prev) => ({ ...prev, showOre: e.target.checked }))
                        }
                        className="w-4 h-4 rounded text-red-600 bg-neutral-950 border-neutral-700 focus:ring-0 focus:ring-offset-0"
                      />
                    </label>

                    {/* Show Structures Toggle */}
                    <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl bg-neutral-900/70 border border-neutral-800 hover:border-neutral-700 transition-colors">
                      <div>
                        <div className="text-xs font-bold text-white">Base Buildings & Defenses</div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          Shows pre-placed base buildings with faction color
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={renderOptions.showStructures}
                        onChange={(e) =>
                          setRenderOptions((prev) => ({ ...prev, showStructures: e.target.checked }))
                        }
                        className="w-4 h-4 rounded text-red-600 bg-neutral-950 border-neutral-700 focus:ring-0 focus:ring-offset-0"
                      />
                    </label>

                    {/* Show Walls & Fences Toggle */}
                    <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl bg-neutral-900/70 border border-neutral-800 hover:border-neutral-700 transition-colors">
                      <div>
                        <div className="text-xs font-bold text-white">Defensive Walls & Fences</div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          Autotiled walls (BRIK, SBAG), fences, and interior bunker walls (XTRA, WALL)
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={renderOptions.showWalls !== false}
                        onChange={(e) =>
                          setRenderOptions((prev) => ({ ...prev, showWalls: e.target.checked }))
                        }
                        className="w-4 h-4 rounded text-red-600 bg-neutral-950 border-neutral-700 focus:ring-0 focus:ring-offset-0"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
              <button
                onClick={() => handleDownloadPng(1)}
                className="w-full px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>
                  Download .PNG Map Image ({canvasRef.current?.width || 0}×{canvasRef.current?.height || 0})
                </span>
              </button>

              <button
                onClick={() => handleDownloadPng(2)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-mono text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5 text-amber-500" />
                <span>Download Double Resolution (2× Scale)</span>
              </button>

              {onSendToGenerator && (
                <button
                  onClick={handleSendToApp}
                  className="w-full px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300 font-mono text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  title="Directly transfer this map preview into the main app to generate a [PreviewPack] INI code"
                >
                  <ArrowRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Use in PreviewPack Generator</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
          <div>Supports Red Alert 1 .MPR and .INI maps with authentic Westwood game assets</div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

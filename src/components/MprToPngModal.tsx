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
} from 'lucide-react';
import {
  parseMprMap,
  renderMprToCanvas,
  MprMapData,
  MprRenderOptions,
  PLAYER_SPAWN_COLORS,
} from '../lib/mprParser';
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [activeSource, setActiveSource] = useState<'sample' | 'upload'>('sample');
  const [selectedSampleId, setSelectedSampleId] = useState<string>('time_flies');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [rawFileText, setRawFileText] = useState<string>('');

  const [mapData, setMapData] = useState<MprMapData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // View mode: Full map render vs Embedded [PreviewPack] if present
  const [viewMode, setViewMode] = useState<'full_render' | 'embedded_preview'>('full_render');

  // Render options (matching Iran's RAFullMapPreviewGenerator features)
  const [renderOptions, setRenderOptions] = useState<MprRenderOptions>({
    cellSize: 6, // 6px per cell = ~528x612 or ~768x768
    onlyDrawVisible: true, // Matches Iran's --drawvisibleonly default
    showWaypoints: true,
    showOre: true,
    showStructures: true,
    showGrid: false,
    theaterOverride: undefined,
  });

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
      // Auto-set view mode to full_render, or embedded if no mappack
      if (!parsed.hasMapPack && parsed.hasEmbeddedPreview) {
        setViewMode('embedded_preview');
      } else {
        setViewMode('full_render');
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
    }
  }, [rawFileText]);

  // Re-render canvas when mapData, renderOptions, or viewMode change
  useEffect(() => {
    if (!canvasRef.current || !mapData) return;

    if (viewMode === 'full_render') {
      renderMprToCanvas(mapData, renderOptions, canvasRef.current);
    } else if (viewMode === 'embedded_preview' && mapData.embeddedPreview) {
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
    }
  }, [mapData, renderOptions, viewMode]);

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

  const handleDownloadPng = (scaleMultiplier: number = 1) => {
    if (!canvasRef.current || !mapData) return;

    let exportCanvas = canvasRef.current;

    // If higher scale is requested, render onto a dedicated canvas
    if (scaleMultiplier !== 1 && viewMode === 'full_render') {
      exportCanvas = document.createElement('canvas');
      renderMprToCanvas(
        mapData,
        {
          ...renderOptions,
          cellSize: renderOptions.cellSize * scaleMultiplier,
        },
        exportCanvas
      );
    }

    const url = exportCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    const cleanBaseName = uploadedFileName.replace(/\.[^/.]+$/, '');
    a.download = `${cleanBaseName}_preview_${exportCanvas.width}x${exportCanvas.height}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSendToApp = () => {
    if (!canvasRef.current || !mapData || !onSendToGenerator) return;
    // Create an independent copy of the canvas
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-950/70 border border-red-700/60 text-red-400 shadow-md">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Red Alert 1 <span className="text-red-500">*.MPR → *.PNG</span> Map Generator
                </h2>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded">
                  Format80 / Iran Engine
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-mono">
                Ported from Iran's RAFullMapPreviewGenerator · Generates full battlefield renders with ore, gems, waypoints & units
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Control Bar: Source Switcher & Map Picker */}
        <div className="p-3 sm:px-6 bg-neutral-950/80 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 font-semibold uppercase tracking-wider text-[11px]">
              Map Source:
            </span>
            <div className="flex items-center rounded-lg bg-neutral-900 p-0.5 border border-neutral-800">
              <button
                onClick={() => {
                  setActiveSource('sample');
                  handleSelectSample(selectedSampleId);
                }}
                className={`px-3 py-1 rounded-md transition-colors font-medium ${
                  activeSource === 'sample'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Sample Maps
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`px-3 py-1 rounded-md transition-colors font-medium flex items-center gap-1.5 ${
                  activeSource === 'upload'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
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
              <span className="text-neutral-500 font-mono text-[11px]">Pick Map:</span>
              <select
                value={selectedSampleId}
                onChange={(e) => handleSelectSample(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-neutral-200 font-medium focus:outline-none focus:border-red-500"
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
            {/* View Mode Tabs (if embedded preview is available) */}
            {mapData?.hasEmbeddedPreview && (
              <div className="flex items-center gap-2 p-1 rounded-xl bg-neutral-950 border border-neutral-800 w-fit text-xs font-mono">
                <button
                  onClick={() => setViewMode('full_render')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                    viewMode === 'full_render'
                      ? 'bg-neutral-800 text-white font-bold shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-red-400" />
                  <span>Full Map Render (Iran Engine)</span>
                </button>
                <button
                  onClick={() => setViewMode('embedded_preview')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                    viewMode === 'embedded_preview'
                      ? 'bg-neutral-800 text-white font-bold shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Embedded [PreviewPack] ({mapData.embeddedPreview?.width}×{mapData.embeddedPreview?.height})</span>
                </button>
              </div>
            )}

            {/* Canvas Container */}
            <div className="relative border border-neutral-800 rounded-2xl bg-black p-4 flex flex-col items-center justify-center min-h-[360px] overflow-hidden shadow-inner group">
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
                </div>
              </div>
            )}

            {/* Rendering Controls */}
            {viewMode === 'full_render' && (
              <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                  <Sliders className="w-4 h-4 text-red-500" />
                  <span>Iran Engine Render Options</span>
                </div>

                {/* Draw Visible Only Toggle (--drawvisibleonly) */}
                <label className="flex items-center justify-between cursor-pointer p-2 rounded-xl bg-neutral-900/70 border border-neutral-800 hover:border-neutral-700 transition-colors">
                  <div>
                    <div className="text-xs font-bold text-white">Crop to Visible Bounds</div>
                    <div className="text-[10px] text-neutral-400 font-mono">
                      Matches Iran's <code className="text-amber-400">--drawvisibleonly</code> (removes black out-of-bounds border)
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

                {/* Cell Scale Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-neutral-400 uppercase">
                      Pixel Detail Level:
                    </span>
                    <span className="text-xs font-mono text-emerald-400">
                      {renderOptions.cellSize}px per cell
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: 'Compact (3px)', size: 3 },
                      { label: 'Tactical (6px)', size: 6 },
                      { label: 'HD (8px)', size: 8 },
                      { label: 'Ultra (12px)', size: 12 },
                    ].map((lvl) => (
                      <button
                        key={lvl.size}
                        onClick={() =>
                          setRenderOptions((prev) => ({ ...prev, cellSize: lvl.size }))
                        }
                        className={`py-1.5 px-1 rounded-lg text-[10px] font-mono transition-colors ${
                          renderOptions.cellSize === lvl.size
                            ? 'bg-neutral-800 text-white font-bold border border-neutral-700'
                            : 'bg-neutral-900/60 text-neutral-400 hover:text-white border border-neutral-800'
                        }`}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl space-y-2.5">
              <button
                onClick={() => handleDownloadPng(1)}
                className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-950/60 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download .PNG Map Image</span>
              </button>

              <button
                onClick={() => handleDownloadPng(2)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white font-mono text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Download Double Resolution (2× Scale)</span>
              </button>

              {onSendToGenerator && (
                <button
                  onClick={handleSendToApp}
                  className="w-full px-3 py-2 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-700/60 text-emerald-300 font-mono text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  title="Directly transfer this map preview into the main app to generate a [PreviewPack] INI code"
                >
                  <ArrowRight className="w-4 h-4 text-emerald-400" />
                  <span>Use in PreviewPack Generator</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between text-xs text-neutral-500 font-mono">
          <div>Supports Red Alert 1 .MPR and .INI maps (both multiplayer and single-player missions)</div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

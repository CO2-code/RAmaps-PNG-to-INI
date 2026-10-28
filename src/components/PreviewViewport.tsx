import React, { useRef, useEffect, useState } from 'react';
import { Layers, Check, ShieldCheck } from 'lucide-react';
import { ConversionResult } from '../types';

interface PreviewViewportProps {
  sourceCanvas: HTMLCanvasElement | null;
  result: ConversionResult | null;
}

export const PreviewViewport: React.FC<PreviewViewportProps> = ({
  sourceCanvas,
  result,
}) => {
  const resultCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pixelated] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'split' | 'reconstructed' | 'source'>('split');

  // Draw quantized image data on result canvas
  useEffect(() => {
    if (!result || !resultCanvasRef.current) return;
    const canvas = resultCanvasRef.current;
    canvas.width = result.targetWidth;
    canvas.height = result.targetHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(result.quantizedImageData, 0, 0);
    }
  }, [result]);

  if (!sourceCanvas || !result) {
    return (
      <div className="bg-[#0c0d12] border border-[#2f1015] rounded-2xl p-12 text-center text-slate-400 space-y-3 shadow-[0_4px_25px_rgba(0,0,0,0.6)] ra-radar-grid">
        <div className="w-12 h-12 mx-auto rounded-xl bg-[#151620] border border-[#421217] flex items-center justify-center text-red-500 shadow-[0_0_15px_rgba(220,38,38,0.25)]">
          <Layers className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-bold font-['Rajdhani',sans-serif] uppercase tracking-wider text-white">No Image Loaded</p>
          <p className="text-xs text-slate-400 font-mono">Upload a PNG or map image above to preview conversion and generate INI code.</p>
        </div>
      </div>
    );
  }

  const rawKb = (result.rawByteCount / 1024).toFixed(1);
  const compKb = (result.compressedByteCount / 1024).toFixed(1);
  const savingsPercent = Math.max(0, Math.round(100 - result.compressionRatio));
  const isCncNet = result.encodingName.includes('CnCNet');

  return (
    <div className="bg-[#0c0d12] border border-[#2f1015] rounded-2xl p-6 sm:p-7 shadow-[0_4px_25px_rgba(0,0,0,0.7)] space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2b0c10] pb-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2 font-['Rajdhani',sans-serif] uppercase">
            <span>Map Preview &amp; Tactical Metrics</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            Real-time decompressed preview as rendered by the game client
          </p>
        </div>

        {/* View Mode Segmented Tabs & Zoom */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Side-by-Side
            </button>
            <button
              type="button"
              onClick={() => setViewMode('reconstructed')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'reconstructed'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Client Preview
            </button>
            <button
              type="button"
              onClick={() => setViewMode('source')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                viewMode === 'source'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Source
            </button>
          </div>

          <button
            type="button"
            onClick={() => setZoom((z) => (z >= 4 ? 1 : z * 2))}
            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-mono font-medium transition-colors cursor-pointer"
            title="Toggle zoom level (1x, 2x, 4x)"
          >
            {zoom}×
          </button>
        </div>
      </div>

      {/* Distinct Visual Chips/Badges for Map Statistics with Larger Fonts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Chip 1: Resolution */}
        <div className="bg-[#10111a] border border-[#2b2d3d] rounded-xl p-3.5 sm:p-4 flex flex-col justify-between gap-1 shadow-sm">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider font-['Rajdhani',sans-serif]">
            <span>Map Grid</span>
            <span className="text-[10px] font-mono text-slate-300 bg-[#1c1d29] border border-slate-700 px-1.5 py-0.2 rounded">
              px
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
            {result.targetWidth}×{result.targetHeight}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Source: {result.sourceWidth}×{result.sourceHeight}
          </div>
        </div>

        {/* Chip 2: Uncompressed Size */}
        <div className="bg-[#10111a] border border-[#2b2d3d] rounded-xl p-3.5 sm:p-4 flex flex-col justify-between gap-1 shadow-sm">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider font-['Rajdhani',sans-serif]">
            <span>Raw Size</span>
            <span className="text-[10px] font-mono text-slate-300 bg-[#1c1d29] border border-slate-700 px-1.5 py-0.2 rounded">
              {isCncNet ? '24-bit' : '8-bit'}
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-slate-200 tracking-tight">
            {rawKb} <span className="text-sm font-semibold text-slate-400 font-mono">KB</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {result.rawByteCount.toLocaleString()} bytes
          </div>
        </div>

        {/* Chip 3: LZO Compressed Size */}
        <div className="bg-[#0c1813] border border-emerald-800/80 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between gap-1 shadow-sm">
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400 uppercase tracking-wider font-['Rajdhani',sans-serif]">
            <span>LZO Compressed</span>
            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950 border border-emerald-700 px-1.5 py-0.2 rounded">
              -{savingsPercent}%
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 tracking-tight">
            {compKb} <span className="text-sm font-semibold text-emerald-300 font-mono">KB</span>
          </div>
          <div className="text-[11px] text-emerald-400/80 font-mono">
            {result.compressedByteCount.toLocaleString()} bytes
          </div>
        </div>

        {/* Chip 4: INI Lines */}
        <div className="bg-[#10111a] border border-[#2b2d3d] rounded-xl p-3.5 sm:p-4 flex flex-col justify-between gap-1 shadow-sm">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider font-['Rajdhani',sans-serif]">
            <span>Line Count</span>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 border border-amber-800 px-1.5 py-0.2 rounded font-bold">
              {isCncNet ? 'CnCNet' : 'LCW'}
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-400 tracking-tight">
            {result.lineCount.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-400 font-mono">lines</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono truncate" title={result.encodingName}>
            {result.encodingName.split(' ')[0]}
          </div>
        </div>
      </div>

      {/* Visual Canvas Display Frame */}
      <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-950 p-6 flex items-center justify-center min-h-[300px] overflow-auto shadow-inner">
        <div
          className={`grid gap-6 items-center justify-center ${
            viewMode === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {/* Source Image */}
          {(viewMode === 'split' || viewMode === 'source') && (
            <div className="flex flex-col items-center space-y-2 max-w-full">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                Uploaded Source ({result.sourceWidth}×{result.sourceHeight})
              </span>
              <div
                className="rounded-lg overflow-hidden border border-slate-800 bg-slate-900/60 p-1 flex items-center justify-center max-w-full overflow-auto shadow-md"
                style={{
                  maxWidth: '100%',
                  maxHeight: '380px',
                }}
              >
                <img
                  src={sourceCanvas.toDataURL()}
                  alt="Source"
                  className="max-h-[340px] object-contain block"
                  style={{
                    width: `${result.targetWidth * zoom}px`,
                    imageRendering: pixelated ? 'pixelated' : 'auto',
                  }}
                />
              </div>
            </div>
          )}

          {/* Reconstructed C&C Preview */}
          {(viewMode === 'split' || viewMode === 'reconstructed') && (
            <div className="flex flex-col items-center space-y-2 max-w-full">
              <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-400" />
                C&C Client Preview ({result.targetWidth}×{result.targetHeight} px)
              </span>
              <div
                className="rounded-lg overflow-hidden border border-emerald-900/50 bg-slate-900/60 p-1 flex items-center justify-center max-w-full overflow-auto shadow-md"
                style={{
                  maxWidth: '100%',
                  maxHeight: '380px',
                }}
              >
                <canvas
                  ref={resultCanvasRef}
                  className="max-h-[340px] object-contain block"
                  style={{
                    width: `${result.targetWidth * zoom}px`,
                    imageRendering: pixelated ? 'pixelated' : 'auto',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Palette spectrum or 24-bit banner */}
      <div className="pt-1">
        {isCncNet ? (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Full 24-bit TrueColor RGB Mode</span>
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">8192-Byte LZO1X Chunks (XCC Mixer Format)</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>Active 256-Color Palette Spectrum:</span>
              <span className="font-mono text-[11px]">Index 0 → 255</span>
            </div>
            <div className="h-3 rounded overflow-hidden flex border border-slate-200 dark:border-slate-700 shadow-2xs">
              {result.paletteColors.map((col, idx) => (
                <div
                  key={idx}
                  className="flex-1 h-full"
                  style={{ backgroundColor: `rgb(${col[0]}, ${col[1]}, ${col[2]})` }}
                  title={`Index ${idx}: RGB(${col[0]}, ${col[1]}, ${col[2]})`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

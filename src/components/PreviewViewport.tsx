import React, { useRef, useEffect, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize, Eye, Layers, Check, Sparkles, ShieldCheck } from 'lucide-react';
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
  const [pixelated, setPixelated] = useState<boolean>(true);
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
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-2xl p-12 text-center text-neutral-500 space-y-2">
        <Layers className="w-10 h-10 mx-auto text-neutral-600" />
        <p className="text-sm font-medium text-neutral-400">No Image Loaded Yet</p>
        <p className="text-xs">Upload a PNG or select one of the demo maps above to begin conversion.</p>
      </div>
    );
  }

  const rawKb = (result.rawByteCount / 1024).toFixed(1);
  const compKb = (result.compressedByteCount / 1024).toFixed(1);
  const savingsPercent = Math.max(0, Math.round(100 - result.compressionRatio));
  const isCncNet = result.encodingName.includes('CnCNet');

  return (
    <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl overflow-hidden space-y-4">
      {/* Top Stats Bar */}
      <div className="bg-neutral-950/80 border-b border-neutral-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-neutral-300">
            Map Grid:{' '}
            <strong className="text-white">
              {result.targetWidth}×{result.targetHeight}
            </strong>
          </span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-400">
            Raw:{' '}
            <strong className="text-neutral-200">{rawKb} KB</strong>
          </span>
          <span className="text-neutral-600">·</span>
          <span className="text-neutral-400">
            LZO Compressed:{' '}
            <strong className="text-emerald-400">{compKb} KB</strong>
          </span>
          <span className="text-emerald-500 bg-emerald-950/50 border border-emerald-800/40 px-1.5 py-0.5 rounded font-bold">
            -{savingsPercent}% Saved
          </span>
          {isCncNet && (
            <span className="text-cyan-400 bg-cyan-950/50 border border-cyan-800/40 px-1.5 py-0.5 rounded flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              xna-cncnet-client Ready
            </span>
          )}
        </div>

        {/* View mode toggle & Zoom */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('split')}
              className={`px-2 py-0.5 rounded text-[11px] font-sans font-medium transition-colors ${
                viewMode === 'split' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setViewMode('reconstructed')}
              className={`px-2 py-0.5 rounded text-[11px] font-sans font-medium transition-colors ${
                viewMode === 'reconstructed' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              C&C Preview
            </button>
            <button
              onClick={() => setViewMode('source')}
              className={`px-2 py-0.5 rounded text-[11px] font-sans font-medium transition-colors ${
                viewMode === 'source' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Source PNG
            </button>
          </div>

          <button
            onClick={() => setZoom((z) => (z >= 4 ? 1 : z * 2))}
            className="p-1 px-1.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-mono"
            title="Toggle Zoom"
          >
            {zoom}x
          </button>
        </div>
      </div>

      {/* Visual Canvas Comparison Area */}
      <div className="p-4 sm:p-6 flex items-center justify-center bg-black/60 min-h-[280px] overflow-auto">
        <div
          className={`grid gap-6 items-center justify-center ${
            viewMode === 'split' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
          }`}
        >
          {/* Source Image */}
          {(viewMode === 'split' || viewMode === 'source') && (
            <div className="flex flex-col items-center space-y-2 max-w-full">
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                Uploaded Source ({result.sourceWidth}×{result.sourceHeight})
              </span>
              <div
                className="rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 p-1 shadow-xl flex items-center justify-center max-w-full overflow-auto"
                style={{
                  maxWidth: '100%',
                  maxHeight: '400px',
                }}
              >
                <img
                  src={sourceCanvas.toDataURL()}
                  alt="Source"
                  className="max-h-[360px] object-contain"
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
                <Check className="w-3 h-3 text-emerald-500" />
                Client Preview ({result.targetWidth}×{result.targetHeight} px)
              </span>
              <div
                className="rounded-xl overflow-hidden border border-emerald-900/60 bg-neutral-950 p-1 shadow-xl shadow-emerald-950/20 flex items-center justify-center max-w-full overflow-auto"
                style={{
                  maxWidth: '100%',
                  maxHeight: '400px',
                }}
              >
                <canvas
                  ref={resultCanvasRef}
                  className="max-h-[360px] object-contain block"
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

      {/* Bottom Info Ribbon */}
      <div className="px-4 pb-4">
        {isCncNet ? (
          <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between text-[11px] font-mono text-neutral-400">
            <span className="flex items-center gap-1.5 text-neutral-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Full 24-bit TrueColor RGB Mode</span>
            </span>
            <span className="text-emerald-400">8192-Byte LZO1X Chunks (XCC Mixer Format)</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
              <span>Active 256-Color Palette Spectrum:</span>
              <span>Index 0 → 255</span>
            </div>
            <div className="h-3 rounded overflow-hidden flex border border-neutral-800">
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

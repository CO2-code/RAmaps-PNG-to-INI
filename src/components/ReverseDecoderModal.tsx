import React, { useState, useRef } from 'react';
import { X, ArrowLeftRight, Download, Play, AlertCircle } from 'lucide-react';
import { decodePreviewFromIni } from '../lib/formatters';
import { DecodedPreview, PaletteId } from '../types';

interface ReverseDecoderModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPalette: PaletteId;
}

export const ReverseDecoderModal: React.FC<ReverseDecoderModalProps> = ({
  isOpen,
  onClose,
  defaultPalette,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [iniInput, setIniInput] = useState<string>('');
  const [decoded, setDecoded] = useState<DecodedPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [palette, setPalette] = useState<PaletteId>(defaultPalette);

  if (!isOpen) return null;

  const handleDecode = () => {
    setError(null);
    try {
      if (!iniInput.trim()) {
        throw new Error('Please paste an INI snippet containing [PreviewPack] lines.');
      }
      const res = decodePreviewFromIni(iniInput, palette);
      setDecoded(res);

      setTimeout(() => {
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          canvas.width = res.width;
          canvas.height = res.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.putImageData(res.imageData, 0, 0);
          }
        }
      }, 50);
    } catch (err: any) {
      setError(err?.message || 'Failed to decode preview');
      setDecoded(null);
    }
  };

  const handleDownloadPng = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `decoded_preview_${decoded?.width || 128}x${decoded?.height || 128}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#0c0d12] border border-[#3b0a0a] rounded-2xl shadow-[0_0_50px_rgba(180,0,0,0.35)] overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#2b0808] bg-[#07070a]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-950/80 border border-red-800/80 text-red-400">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-['Rajdhani',sans-serif] uppercase tracking-wide text-white">
                Reverse Decoder: INI [PreviewPack] &rarr; PNG
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Paste any [PreviewPack] from an existing RA1 map to decompress and view it
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a1b26] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide font-['Rajdhani',sans-serif]">
                Paste [Preview] &amp; [PreviewPack] Text:
              </label>
              <select
                value={palette}
                onChange={(e) => setPalette(e.target.value as PaletteId)}
                className="bg-[#12131e] border border-[#303348] rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-red-500"
              >
                <option value="temperat">Temperate Palette</option>
                <option value="snow">Snow Palette</option>
                <option value="interior">Interior Palette</option>
                <option value="universal">Universal 6-6-6</option>
              </select>
            </div>
            <textarea
              rows={7}
              value={iniInput}
              onChange={(e) => setIniInput(e.target.value)}
              placeholder="[Preview]&#10;Size=0,0,128,128&#10;&#10;[PreviewPack]&#10;1=BAAA...&#10;2=..."
              className="w-full bg-[#07080d] border border-[#2e090d] rounded-xl p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-red-500 leading-relaxed"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleDecode}
              className="ra-menu-btn px-4 py-2 rounded flex items-center gap-1.5 text-xs font-bold tracking-wider cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 text-amber-300" />
              <span>Decompress &amp; Decode</span>
            </button>
          </div>

          {error && (
            <div className="p-3 bg-[#1e0709] border border-[#4d1016] rounded-xl text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {decoded && (
            <div className="p-4 bg-[#08090f] border border-[#2b0c10] rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-emerald-400 font-bold">✓ Successfully Decoded</span>
                <span className="text-slate-400">
                  {decoded.width}×{decoded.height} px · {decoded.encodingDetected}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-2">
                <div className="border border-[#3b0a0a] rounded-lg p-1 bg-black">
                  <canvas
                    ref={canvasRef}
                    className="w-40 h-40 object-contain block"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>

                <div className="text-xs text-slate-400 font-mono space-y-1">
                  <div>Lines parsed: <span className="font-bold text-white">{decoded.lineCount}</span></div>
                  <div>Compressed: <span className="font-bold text-white">{decoded.compressedBytes} bytes</span></div>
                  <div>Uncompressed: <span className="font-bold text-white">{decoded.uncompressedBytes} bytes</span></div>
                  <button
                    onClick={handleDownloadPng}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-[#161724] hover:bg-[#202234] border border-[#35384c] text-slate-200 hover:text-white font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Download Decoded PNG</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2b0808] bg-[#07070a] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-[#161722] hover:bg-[#202230] border border-[#3b1218] text-slate-300 hover:text-white text-xs font-mono font-medium cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

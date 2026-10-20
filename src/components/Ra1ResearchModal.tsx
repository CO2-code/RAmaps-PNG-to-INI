import React from 'react';
import { X, BookOpen, Layers, CheckCircle2, ShieldCheck, FileCode, Cpu, AlertTriangle } from 'lucide-react';

interface Ra1ResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Ra1ResearchModal: React.FC<Ra1ResearchModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-950/60 border border-red-800/60 text-red-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-['Rajdhani',sans-serif] tracking-wide">
                xna-cncnet-client & XCC Mixer Map Preview Architecture
              </h2>
              <p className="text-xs text-neutral-400">
                Technical research on [Preview], [PreviewPack], LZO1X block encoding, and LCW
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

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs text-neutral-300 leading-relaxed font-sans">
          {/* Section 1: xna-cncnet-client & XCC Mixer format */}
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 space-y-2">
            <div className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              1. Why xna-cncnet-client Requires LZO 24-bit RGB (XCC Standard)
            </div>
            <p className="text-neutral-300">
              In <strong className="text-white">xna-cncnet-client</strong> (specifically in{' '}
              <code className="text-emerald-300 font-mono">MapPreviewExtractor.cs</code>), map previews are decompressed and loaded as follows:
            </p>
            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg font-mono text-[11px] text-neutral-300 space-y-1">
              <div><span className="text-neutral-500">// Read dimensions:</span></div>
              <div>[Preview] Size=0,0,width,height</div>
              <div className="pt-1"><span className="text-neutral-500">// Expected pixel buffer:</span></div>
              <div>decompressedDataSize = width * height * 3; <span className="text-emerald-400">// 24-bit RGB (3 bytes per pixel)</span></div>
              <div className="pt-1"><span className="text-neutral-500">// Block decompression loop:</span></div>
              <div>ushort sizeCompressed = ReadUInt16LittleEndian(stream);</div>
              <div>ushort sizeUncompressed = ReadUInt16LittleEndian(stream); <span className="text-neutral-500">// usually 8192 bytes</span></div>
              <div>LzoStream stream = new LzoStream(..., CompressionMode.Decompress);</div>
            </div>
            <p className="text-neutral-400 text-[11px]">
              This is why XCC Mixer’s <em>"Copy as Map Preview"</em> output begins with the Base64 bytes{' '}
              <code className="text-emerald-400 font-mono">AQgAIA...</code> (which represents <code className="text-neutral-200">sizeCompressed</code> and <code className="text-neutral-200">sizeUncompressed = 8192</code>).
              Our generator now creates this <strong>exact LZO1X block format</strong>!
            </p>
          </div>

          {/* Section 2: Structure & Coordinates */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileCode className="w-4 h-4 text-red-500" />
              2. Red Alert 1 Map File Structure (.MPR / .INI)
            </h3>
            <p>
              Both classic Red Alert and modern CnCNet multiplayer map files (.mpr) use standard INI sections:
            </p>
            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl font-mono text-[11px] text-neutral-300 space-y-1">
              <div><span className="text-amber-400">[Basic]</span></div>
              <div>Name=My Battle Arena</div>
              <div>SoloMission=false</div>
              <div className="pt-1"><span className="text-emerald-400">[Preview]</span></div>
              <div>Size=0,0,830,230 <span className="text-neutral-500">; Size=0,0,W,H</span></div>
              <div className="pt-1"><span className="text-emerald-400">[PreviewPack]</span></div>
              <div>1=AQgAIAAbZ32... <span className="text-neutral-500">; 70-character Base64 chunks</span></div>
              <div>2=...</div>
            </div>
          </div>

          {/* Section 3: Classic Westwood LCW Format80 */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              3. Classic Westwood Engine (Format80 / LCW)
            </h3>
            <p>
              In original 1996 DOS/Win95 Red Alert, map previews used 8-bit indexed palette data compressed with Westwood’s <strong className="text-white">LCW (Lou Castle's Welch-thing)</strong> compression.
              If you are targeting original 1996 EDWIN or DOS engines, select the <strong className="text-white">Classic Red Alert 1 Engine (LCW 8-bit Indexed)</strong> option in the control panel.
            </p>
          </div>

          {/* Section 4: Recommendations */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              4. Best Practices & Dimension Tips
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-neutral-400">
              <li>
                <strong className="text-neutral-200">CnCNet Client</strong>: Supports truecolor 24-bit RGB and any aspect ratio (square 128×128, 256×256, or banner 800×400 / 830×230).
              </li>
              <li>
                <strong className="text-neutral-200">Matching Dimensions</strong>: The pixel count in the uncompressed data must equal <code className="text-white">width * height * 3</code>. Our tool ensures exact byte alignment so `xna-cncnet-client` never throws dimension errors.
              </li>
              <li>
                <strong className="text-neutral-200">Line Wrap</strong>: 70 characters per line is standard for XCC Mixer and Westwood INI readers.
              </li>
            </ul>
          </div>

          {/* Section 5: Why 23k+ lines happen and how to avoid it */}
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/50 space-y-2">
            <div className="text-sm font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              5. Why [PreviewPack] Can Reach 23,000+ Lines (& How We Prevent It)
            </div>
            <p className="text-neutral-300 leading-relaxed">
              When an unscaled screenshot or full-resolution map render (e.g., 800×800 or 1920×1080) is converted to 24-bit RGB:
            </p>
            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg font-mono text-[11px] text-neutral-300 space-y-1">
              <div>800 × 800 × 3 bytes = <span className="text-amber-400">1,920,000 raw bytes</span></div>
              <div>LZO Compressed: ~1,150,000 bytes → Base64: ~1,533,000 chars</div>
              <div>Divided by 70 chars per line = <span className="text-red-400 font-bold">21,900 to 23,500+ INI lines!</span></div>
            </div>
            <p className="text-neutral-300 text-[11px] leading-relaxed">
              <strong>The Solution:</strong> In xna-cncnet-client, the lobby UI preview box is roughly <strong>200×200 to 256×256 pixels</strong>. Resizing your image to <strong>256×256</strong> (or proportional max dimension 256px) produces only <strong>~800–1,100 lines</strong> (~65 KB). It looks visually identical in the lobby, prevents text editor lag, and ensures joining players download your map in milliseconds!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

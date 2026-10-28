import React, { useState } from 'react';
import {
  X,
  BookOpen,
  FolderKanban,
  Compass,
  Sliders,
  FileCheck,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  Download,
  Upload,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface Ra1ResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Ra1ResearchModal: React.FC<Ra1ResearchModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'quickstart' | 'features' | 'faq'>('quickstart');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl bg-[#0c0d12] border border-[#3b0a0a] rounded-2xl shadow-[0_0_50px_rgba(180,0,0,0.4)] overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#2b0808] bg-[#07070a]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-b from-[#8f0808] to-[#3a0000] border-t border-red-500 border-b border-black text-amber-300 shadow-[0_0_12px_rgba(220,38,38,0.4)]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-['Rajdhani',sans-serif] uppercase tracking-wide">
                  RAnderer User Guide
                </h2>
                <span className="text-[10px] font-mono text-amber-400 bg-red-950/80 border border-red-800/80 px-1.5 py-0.2 rounded font-bold uppercase">
                  Simple Guide
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                How to edit, preview, and prepare Command &amp; Conquer: Red Alert 1 maps
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a1b26] transition-colors cursor-pointer"
            title="Close Guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-4 sm:px-6 pt-3 pb-2 border-b border-[#24080a] bg-[#090305]">
          <button
            type="button"
            onClick={() => setActiveTab('quickstart')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-['Rajdhani',sans-serif] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'quickstart'
                ? 'ra-menu-btn text-amber-300'
                : 'text-slate-400 hover:text-white hover:bg-[#16080b]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>3-Step Quick Start</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('features')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-['Rajdhani',sans-serif] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'features'
                ? 'ra-menu-btn text-amber-300'
                : 'text-slate-400 hover:text-white hover:bg-[#16080b]'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span>Feature Guide</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('faq')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-['Rajdhani',sans-serif] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === 'faq'
                ? 'ra-menu-btn text-amber-300'
                : 'text-slate-400 hover:text-white hover:bg-[#16080b]'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Tips &amp; FAQs</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs text-slate-300 leading-relaxed font-sans flex-1">
          {/* TAB 1: QUICK START */}
          {activeTab === 'quickstart' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#14080b] border border-[#3b0d13]">
                <h3 className="text-sm font-bold text-amber-300 font-['Rajdhani',sans-serif] uppercase tracking-wider mb-1">
                  How to Add a Radar Preview to Any Map (.mpr)
                </h3>
                <p className="text-slate-300 text-xs">
                  Follow these 3 simple steps to give any Red Alert 1 map a crisp in-game radar preview that shows up in the CnCNet game lobby:
                </p>
              </div>

              <div className="grid gap-3 sm:gap-4">
                {/* Step 1 */}
                <div className="p-4 rounded-xl bg-[#0e0f16] border border-[#232536] flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-red-950/80 border border-red-800 text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
                    1
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-white font-bold text-sm flex items-center gap-2">
                      <span>Open Battlefield View</span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-1.5 py-0.2 rounded font-semibold">
                        Step 1
                      </span>
                    </h4>
                    <p className="text-slate-300 text-xs">
                      On the Main Menu, click <strong className="text-white">Battlefield View (.MPR)</strong> and drag &amp; drop your map file (<code className="text-amber-400 font-mono">.mpr</code>).
                      RAnderer will instantly render the full battlefield with terrain, ore, trees, and water.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-4 rounded-xl bg-[#0e0f16] border border-[#232536] flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-red-950/80 border border-red-800 text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
                    2
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-white font-bold text-sm flex items-center gap-2">
                      <span>Click &ldquo;Send to Generator&rdquo;</span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-1.5 py-0.2 rounded font-semibold">
                        Step 2
                      </span>
                    </h4>
                    <p className="text-slate-300 text-xs">
                      Click the green <strong className="text-emerald-400">&ldquo;Send to Generator&rdquo;</strong> button.
                      RAnderer converts the map image into authentic compressed Red Alert 24-bit <code className="text-red-400 font-mono">[Preview]</code> and <code className="text-red-400 font-mono">[PreviewPack]</code> data.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-4 rounded-xl bg-[#0e0f16] border border-[#232536] flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-red-950/80 border border-red-800 text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
                    3
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-white font-bold text-sm flex items-center gap-2">
                      <span>Inject into Map File</span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-1.5 py-0.2 rounded font-semibold">
                        Step 3
                      </span>
                    </h4>
                    <p className="text-slate-300 text-xs">
                      Click <strong className="text-amber-300">&ldquo;Inject into .MPR Map&rdquo;</strong>, pick your map file, and save the updated file.
                      Your map is now ready! When you host it in CnCNet or Red Alert, players will see your new custom preview.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bonus Tip */}
              <div className="p-3.5 rounded-xl bg-[#09150d] border border-[#193a23] flex items-center gap-3 text-xs text-slate-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  <strong className="text-white">Have your own artwork or screenshot?</strong> You can also upload any image directly to the <strong className="text-amber-300">PNG to PreviewPack</strong> tool!
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: FEATURES */}
          {activeTab === 'features' && (
            <div className="space-y-4">
              {/* Prepare Maps (Batch) */}
              <div className="p-4 rounded-xl bg-[#14080b] border border-[#3b0d13] space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-white font-['Rajdhani',sans-serif] uppercase tracking-wider">
                  <FolderKanban className="w-4 h-4 text-amber-400" />
                  <span>Prepare Maps (Batch Studio)</span>
                </div>
                <p className="text-slate-300">
                  The fastest way to prepare multiple maps or an entire map pack for distribution:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li>
                    <strong className="text-slate-200">Metadata Editing:</strong> Change Map Name, Author, GameMode, and Min/Max players across all maps in one go.
                  </li>
                  <li>
                    <strong className="text-slate-200">Category Renaming:</strong> Add standard multiplayer player count prefixes like <code className="text-amber-300 font-mono">2_</code> for 1v1, <code className="text-amber-300 font-mono">4_</code> for 2v2, <code className="text-amber-300 font-mono">6_</code> for 3v3, and <code className="text-amber-300 font-mono">8_</code> for 4v4.
                  </li>
                  <li>
                    <strong className="text-slate-200">Preview Injection:</strong> Drops matching PNG previews into map files automatically.
                  </li>
                  <li>
                    <strong className="text-slate-200">Safe ZIP Download:</strong> Automatically organizes processed maps and saves original backups in a convenient ZIP archive.
                  </li>
                </ul>
              </div>

              {/* Battlefield View */}
              <div className="p-4 rounded-xl bg-[#0c1318] border border-[#17303d] space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-white font-['Rajdhani',sans-serif] uppercase tracking-wider">
                  <Compass className="w-4 h-4 text-emerald-400" />
                  <span>Battlefield View (.MPR Viewer)</span>
                </div>
                <p className="text-slate-300">
                  Renders the actual Red Alert terrain, tiles, trees, ore fields, and structures directly in your browser:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li>Inspect terrain symmetry, choke points, and resource distribution.</li>
                  <li>Download a high-resolution full PNG image of the map.</li>
                  <li>Send directly to the PreviewPack generator with one click.</li>
                </ul>
              </div>

              {/* Generator Studio */}
              <div className="p-4 rounded-xl bg-[#11111a] border border-[#282a3d] space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-white font-['Rajdhani',sans-serif] uppercase tracking-wider">
                  <Sliders className="w-4 h-4 text-red-400" />
                  <span>PNG to PreviewPack Studio</span>
                </div>
                <p className="text-slate-300">
                  Converts standard PNG or JPEG images into Red Alert’s proprietary compressed format:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li>
                    <strong className="text-slate-200">Automatic Resolution Optimization:</strong> Large photos are automatically scaled to &le; 256px so they don&rsquo;t bloat map files.
                  </li>
                  <li>
                    <strong className="text-slate-200">Format Choice:</strong> Supports CnCNet LZO1X (24-bit TrueColor) as well as classic 1996 Westwood LCW (8-bit indexed).
                  </li>
                  <li>
                    <strong className="text-slate-200">Copy &amp; Paste Ready:</strong> Copy the formatted INI text block directly to clipboard.
                  </li>
                </ul>
              </div>

              {/* Reverse Decoder & Injector */}
              <div className="p-4 rounded-xl bg-[#120f18] border border-[#2f2540] space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-white font-['Rajdhani',sans-serif] uppercase tracking-wider">
                  <FileCheck className="w-4 h-4 text-amber-400" />
                  <span>Map Injector &amp; Reverse Decoder</span>
                </div>
                <p className="text-slate-300">
                  <strong className="text-slate-200">Injector:</strong> Inserts new <code className="text-red-400 font-mono">[Preview]</code> and <code className="text-red-400 font-mono">[PreviewPack]</code> sections into an existing map while keeping all other map triggers, units, and terrain completely untouched.
                  <br />
                  <strong className="text-slate-200">Reverse Decoder:</strong> Paste any existing <code className="text-emerald-400 font-mono">[PreviewPack]</code> code from a map to extract and view the preview image as a PNG!
                </p>
              </div>

              {/* TinyPNG Image Compression */}
              <div className="p-4 rounded-xl bg-[#09150d] border border-[#193a23] space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-white font-['Rajdhani',sans-serif] uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>TinyPNG Image Compression</span>
                </div>
                <p className="text-slate-300">
                  Reduces battlefield render PNG sizes by 50–70% using official TinyPNG quantization:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-400">
                  <li><strong className="text-slate-200">Automatic Compression:</strong> Toggle &ldquo;Auto-compress with TinyPNG&rdquo; in Battlefield View to compress map exports automatically.</li>
                  <li><strong className="text-slate-200">Standalone Tool:</strong> Drag &amp; drop any PNG into the TinyPNG tool to optimize it and see before/after file size savings.</li>
                  <li><strong className="text-slate-200">Free API Key:</strong> TinyPNG gives 500 free compressions per month with no credit card required.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: TIPS & FAQS */}
          {activeTab === 'faq' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#0f1118] border border-[#202330] space-y-1.5">
                <h4 className="text-white font-bold text-sm">Where do I put my map files so the game sees them?</h4>
                <p className="text-slate-300 text-xs">
                  Place your finished <code className="text-amber-400 font-mono">.mpr</code> (or <code className="text-amber-400 font-mono">.ini</code>) files inside your Red Alert / CnCNet <code className="text-white font-mono">Maps</code> folder (for example: <code className="text-slate-400 font-mono">C:\Games\CnCNet\Maps</code>). They will appear automatically in the skirmish or multiplayer lobby map list.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#0f1118] border border-[#202330] space-y-1.5">
                <h4 className="text-white font-bold text-sm">Why are images automatically scaled to 256&times;256?</h4>
                <p className="text-slate-300 text-xs">
                  In CnCNet lobbies, the preview box on the screen is roughly 250&times;250 pixels. If you put a full-resolution 1080p image into a map, it creates over <strong>23,000 lines of data</strong> (~1.5 MB), causing lag when other players download your map. Scaling to 256px produces only <strong>~800–1,100 lines</strong> (~65 KB), which looks identical in-game and downloads in milliseconds!
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#0f1118] border border-[#202330] space-y-1.5">
                <h4 className="text-white font-bold text-sm">Will my original files or map data get corrupted?</h4>
                <p className="text-slate-300 text-xs">
                  No. RAnderer preserves all map triggers, terrain cells, structures, units, waypoints, and custom rules. It only updates the <code className="text-red-400 font-mono">[Basic]</code> metadata and <code className="text-red-400 font-mono">[PreviewPack]</code> sections. In the batch tool, a clean backup copy of your original files is always included in the ZIP archive.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#0f1118] border border-[#202330] space-y-1.5">
                <h4 className="text-white font-bold text-sm">Do I need Python or an internet connection?</h4>
                <p className="text-slate-300 text-xs">
                  No! RAnderer runs 100% inside your browser (or as a standalone desktop app). No files are uploaded to any server, and no Python or extra tools are required.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2b0808] bg-[#07070a] flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-mono hidden sm:block">
            RAnderer 2.0 &bull; Red Alert 1 Map Preparation &amp; Preview Studio
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ra-menu-btn px-5 py-2 rounded text-xs font-bold cursor-pointer transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};

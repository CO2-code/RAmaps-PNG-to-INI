import React from 'react';
import { Terminal, BookOpen, Layers, ArrowLeftRight, FileCode, Compass } from 'lucide-react';

interface HeaderProps {
  onOpenResearch: () => void;
  onOpenDecoder: () => void;
  onOpenInjector: () => void;
  onOpenMprToPng: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenResearch,
  onOpenDecoder,
  onOpenInjector,
  onOpenMprToPng,
}) => {
  return (
    <header className="border-b border-neutral-800 bg-neutral-950/95 sticky top-0 z-40 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-950/60 border border-red-700/60 flex items-center justify-center shadow-lg shadow-red-950/40">
            <span className="font-['Orbitron',sans-serif] text-sm font-black text-red-500">
              RA1
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider text-white text-base font-['Rajdhani',sans-serif]">
                RED ALERT 1 <span className="text-red-500">PREVIEWPACK</span> & MAP STUDIO
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-950/50 border border-emerald-800/50 px-1.5 py-0.5 rounded">
                LCW & LZO Engine
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-mono">
              PNG ⇄ [PreviewPack] & full .MPR / .INI map preview generator
            </p>
          </div>
        </div>

        {/* Action utility buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenMprToPng}
            className="px-3 py-1.5 rounded-lg bg-red-950/80 border border-red-600/70 hover:border-red-500 text-red-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-red-950/40 animate-pulse hover:animate-none cursor-pointer"
            title="Convert Red Alert 1 *.MPR map files to *.PNG preview images (Iran RAFullMapPreviewGenerator port)"
          >
            <Compass className="w-3.5 h-3.5 text-red-400" />
            <span>*.MPR → *.PNG</span>
          </button>

          <button
            onClick={onOpenDecoder}
            className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Decode an existing [PreviewPack] from any map file into PNG"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Test / Decode INI</span>
          </button>

          <button
            onClick={onOpenInjector}
            className="px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            title="Inject preview into an existing .mpr or .ini map file"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Map Injector</span>
          </button>

          <button
            onClick={onOpenResearch}
            className="px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-800/60 hover:border-red-600 text-red-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-red-400" />
            <span>RA1 Map Docs</span>
          </button>
        </div>
      </div>
    </header>
  );
};

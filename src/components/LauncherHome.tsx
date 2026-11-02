import React, { useState } from 'react';

interface LauncherHomeProps {
  onOpenAutoBatch: () => void;
  onOpenBatch: () => void;
  onEnterStudio: () => void;
  onOpenMprToPng: () => void;
  onOpenInjector: () => void;
  onOpenDecoder: () => void;
  onOpenResearch: () => void;
  onOpenTinyPng?: () => void;
}

export const LauncherHome: React.FC<LauncherHomeProps> = ({
  onOpenAutoBatch,
  onOpenBatch,
  onEnterStudio,
  onOpenMprToPng,
  onOpenInjector,
  onOpenDecoder,
  onOpenResearch,
  onOpenTinyPng,
}) => {
  const [isExtraPage, setIsExtraPage] = useState<boolean>(false);

  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(280, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // Audio may be blocked until user interacts with the page
    }
  };

  const handleAction = (cb: () => void) => {
    playBeep();
    cb();
  };

  return (
    <div
      className="min-h-screen text-slate-100 flex flex-col items-center justify-center p-3 sm:p-6 selection:bg-red-600 selection:text-white"
      style={{
        backgroundColor: '#0c0305',
        backgroundImage: `linear-gradient(rgba(10, 2, 4, 0.78), rgba(10, 2, 4, 0.88)), url('/assets/aistudio/dd-bkgnd_b2da9433.png')`,
        backgroundRepeat: 'repeat',
        backgroundSize: '864px 864px',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Outer Tactical War-Room Console Frame */}
      <div className="relative w-full max-w-xl rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(220,20,20,0.35)] border border-[#4a1015] bg-[#0d090d]/95 backdrop-blur-md p-6 sm:p-8 flex flex-col items-center space-y-6">
        {/* Top Header */}
        <div className="flex flex-col items-center text-center space-y-1 w-full border-b border-[#3d0d12] pb-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-wider text-white font-['Rajdhani',sans-serif] uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
            RAnderer
          </h1>
        </div>

        {/* Command Menu Action Stack */}
        {!isExtraPage ? (
          /* MAIN MENU: Exactly 5 Buttons */
          <div className="w-full flex flex-col space-y-2.5">
            {/* 1. Automatic Batch */}
            <button
              type="button"
              onClick={() => handleAction(onOpenAutoBatch)}
              onMouseEnter={playBeep}
              className="ra-menu-btn w-full py-3.5 px-4 flex items-center justify-center text-sm sm:text-base cursor-pointer tracking-wider group rounded-lg shadow-[0_0_20px_rgba(245,158,11,0.25)] border-amber-600/60 hover:border-amber-400"
            >
              <span className="text-amber-300 group-hover:text-amber-200 transition-colors flex items-center gap-2 font-bold uppercase drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                <span className="text-amber-400 text-base animate-pulse">&#9889;</span> Automatic Batch
              </span>
            </button>

            {/* 2. Enter Workspace (takes user directly to the batch studio) */}
            <button
              type="button"
              onClick={() => handleAction(onOpenBatch)}
              onMouseEnter={playBeep}
              className="ra-menu-btn w-full py-3.5 px-4 flex items-center justify-center text-sm sm:text-base cursor-pointer tracking-wider group rounded-lg shadow-lg"
            >
              <span className="text-white group-hover:text-amber-300 transition-colors flex items-center gap-2 font-bold tracking-wider">
                Enter Workspace
              </span>
            </button>

            {/* 3. Guide */}
            <button
              type="button"
              onClick={() => handleAction(onOpenResearch)}
              onMouseEnter={playBeep}
              className="ra-menu-btn w-full py-3 px-4 flex items-center justify-center text-sm sm:text-base cursor-pointer tracking-wider group rounded-lg shadow-lg text-slate-200 hover:text-white"
            >
              <span>Guide</span>
            </button>

            {/* 4. Extra (opens the Extra tools page) */}
            <button
              type="button"
              onClick={() => handleAction(() => setIsExtraPage(true))}
              onMouseEnter={playBeep}
              className="ra-menu-btn w-full py-3 px-4 flex items-center justify-center text-sm sm:text-base cursor-pointer tracking-wider group rounded-lg shadow-lg text-slate-200 hover:text-white"
            >
              <span className="flex items-center gap-2 font-bold">
                <span>Extra</span>
                <span className="text-amber-400 group-hover:translate-x-1 transition-transform">&rarr;</span>
              </span>
            </button>

            {/* 5. Exit */}
            <button
              type="button"
              onClick={() => {
                playBeep();
                if (typeof window !== 'undefined' && window.electronAPI?.exitApp) {
                  window.electronAPI.exitApp();
                } else {
                  try {
                    window.close();
                  } catch (_) {}
                }
              }}
              onMouseEnter={playBeep}
              className="w-full py-2.5 px-4 rounded-lg bg-[#140608] hover:bg-[#25080c] border border-[#4a1216] hover:border-red-600 text-red-400 hover:text-red-200 text-xs sm:text-sm font-['Rajdhani',sans-serif] font-bold uppercase tracking-wider flex items-center justify-center transition-all cursor-pointer shadow-md mt-1"
            >
              <span>Exit</span>
            </button>
          </div>
        ) : (
          /* EXTRA PAGE: All other tactical tools */
          <div className="w-full flex flex-col space-y-2.5 animate-fade-in">
            <div className="text-center pb-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 bg-amber-950/70 border border-amber-800/60 px-3 py-0.5 rounded-full font-bold">
                Extra Tactical Tools
              </span>
            </div>

            {/* PNG to PreviewPack */}
            <button
              type="button"
              onClick={() => handleAction(onEnterStudio)}
              onMouseEnter={playBeep}
              className="ra-menu-btn w-full py-2.5 px-4 flex items-center justify-center text-xs sm:text-sm cursor-pointer tracking-wider group rounded-lg shadow-lg"
            >
              <span>PNG to PreviewPack</span>
            </button>

            {/* Battlefield View (.MPR) */}
            <button
              type="button"
              onClick={() => handleAction(onOpenMprToPng)}
              onMouseEnter={playBeep}
              className="ra-menu-btn w-full py-2.5 px-4 flex items-center justify-center text-xs sm:text-sm cursor-pointer tracking-wider group rounded-lg shadow-lg"
            >
              <span>Battlefield View (.MPR)</span>
            </button>

            {/* Map File Injector */}
            <button
              type="button"
              onClick={() => handleAction(onOpenInjector)}
              onMouseEnter={playBeep}
              className="ra-menu-btn w-full py-2.5 px-4 flex items-center justify-center text-xs sm:text-sm cursor-pointer tracking-wider group rounded-lg shadow-lg"
            >
              <span>Map File Injector</span>
            </button>

            {/* Reverse INI Decoder */}
            <button
              type="button"
              onClick={() => handleAction(onOpenDecoder)}
              onMouseEnter={playBeep}
              className="ra-menu-btn w-full py-2.5 px-4 flex items-center justify-center text-xs sm:text-sm cursor-pointer tracking-wider group rounded-lg shadow-lg"
            >
              <span>Reverse INI Decoder</span>
            </button>

            {/* Single-Map Studio Workspace */}
            <button
              type="button"
              onClick={() => handleAction(onEnterStudio)}
              onMouseEnter={playBeep}
              className="ra-menu-btn w-full py-2.5 px-4 flex items-center justify-center text-xs sm:text-sm cursor-pointer tracking-wider group rounded-lg shadow-lg text-amber-300 hover:text-white"
            >
              <span>Single-Map Studio</span>
            </button>

            {/* TinyPNG Tool */}
            {onOpenTinyPng && (
              <button
                type="button"
                onClick={() => handleAction(onOpenTinyPng)}
                onMouseEnter={playBeep}
                className="ra-menu-btn w-full py-2 px-4 flex items-center justify-center text-xs cursor-pointer tracking-wider group rounded-lg shadow-lg text-slate-300 hover:text-white"
              >
                <span>TinyPNG Tool</span>
              </button>
            )}

            {/* Back Button */}
            <button
              type="button"
              onClick={() => handleAction(() => setIsExtraPage(false))}
              onMouseEnter={playBeep}
              className="w-full py-2.5 px-4 rounded-lg bg-[#140608] hover:bg-[#22070b] border border-amber-800/60 hover:border-amber-500 text-amber-400 hover:text-amber-200 text-xs sm:text-sm font-['Rajdhani',sans-serif] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md mt-2"
            >
              <span>&larr; Back to Main Menu</span>
            </button>
          </div>
        )}

        {/* Footer Quick Utilities */}
        {onOpenTinyPng && (
          <div className="w-full flex items-center justify-center pt-2 border-t border-[#2d090d] text-xs font-mono text-slate-500">
            <button
              type="button"
              onClick={() => handleAction(onOpenTinyPng)}
              className="text-amber-400 hover:text-amber-300 underline cursor-pointer transition-colors"
              title="Open TinyPNG Image Compressor"
            >
              TinyPNG Tool
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

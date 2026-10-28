import React from 'react';

interface LauncherHomeProps {
  onOpenBatch: () => void;
  onEnterStudio: () => void;
  onOpenMprToPng: () => void;
  onOpenInjector: () => void;
  onOpenDecoder: () => void;
  onOpenResearch: () => void;
  onOpenTinyPng?: () => void;
}

export const LauncherHome: React.FC<LauncherHomeProps> = ({
  onOpenBatch,
  onEnterStudio,
  onOpenMprToPng,
  onOpenInjector,
  onOpenDecoder,
  onOpenResearch,
  onOpenTinyPng,
}) => {
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
    <div className="min-h-screen bg-[#07070a] text-slate-100 flex flex-col items-center justify-center p-2 sm:p-4 selection:bg-red-600 selection:text-white">
      {/* Outer Console Frame */}
      <div className="relative w-full max-w-[1280px] rounded-xl overflow-hidden shadow-[0_0_50px_rgba(180,0,0,0.3)] border border-[#2a2a36] bg-[#0c0d12]">
        {/* Background Artwork Frame with 16:9 Aspect Ratio matching 1280x720 clean image */}
        <div className="relative w-full aspect-[16/9] min-h-[500px] select-none overflow-hidden bg-black flex items-center justify-center">
          <img
            src="/assets/aistudio/image_d2fca632.png"
            alt="Command & Conquer Red Alert Launcher - RAnderer 2.0"
            className="absolute inset-0 w-full h-full object-fill pointer-events-none"
          />

          {/* Top-Left Tactical Terminal Display Overlay (fits clean black LCD panel) */}
          <div className="absolute top-[2.4%] left-[3.1%] w-[18.2%] h-[9.3%] rounded flex items-center px-3 text-[11px] sm:text-xs font-mono select-none pointer-events-auto">
            <div className="flex items-center gap-1.5 text-red-500 font-bold tracking-tight">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
              <span className="truncate drop-shadow-[0_0_5px_rgba(255,0,0,0.8)]">RAnderer is up to date.</span>
            </div>
          </div>

          {/* Center Tactical Action Buttons Stack */}
          {/* Sits cleanly inside the central red wireframe grid */}
          <div className="absolute top-[38.2%] left-[32.8%] w-[34.4%] h-[43.5%] flex flex-col justify-between py-1 z-10">
            {/* Button 1: Prepare Maps (Batch Studio) */}
            <button
              type="button"
              onClick={() => handleAction(onOpenBatch)}
              onMouseEnter={playBeep}
              className="ra-menu-btn w-full h-[12.5%] flex items-center justify-center text-xs sm:text-sm md:text-[15px] cursor-pointer tracking-wider group rounded-xs"
            >
              <span className="group-hover:text-amber-300 transition-colors flex items-center gap-1.5 font-bold">
                <span className="text-amber-400 text-sm">&#9733;</span> Prepare Maps (Batch)
              </span>
            </button>

            {/* Button 2: PNG to PreviewPack */}
            <button
              type="button"
              onClick={() => handleAction(onEnterStudio)}
              onMouseEnter={playBeep}
              className="ra-menu-btn w-full h-[12.5%] flex items-center justify-center text-xs sm:text-sm md:text-[15px] cursor-pointer tracking-wider group rounded-xs"
            >
              <span>PNG to PreviewPack</span>
            </button>

            {/* Button 3: Battlefield View (MPR to PNG) */}
            <button
              type="button"
              onClick={() => handleAction(onOpenMprToPng)}
              onMouseEnter={playBeep}
              className="ra-menu-btn w-full h-[12.5%] flex items-center justify-center text-xs sm:text-sm md:text-[15px] cursor-pointer tracking-wider group rounded-xs"
            >
              <span>Battlefield View (.MPR)</span>
            </button>

            {/* Button 4: Map File Injector */}
            <button
              type="button"
              onClick={() => handleAction(onOpenInjector)}
              onMouseEnter={playBeep}
              className="ra-menu-btn w-full h-[12.5%] flex items-center justify-center text-xs sm:text-sm md:text-[15px] cursor-pointer tracking-wider group rounded-xs"
            >
              <span>Map File Injector</span>
            </button>

            {/* Button 5: Reverse INI Decoder */}
            <button
              type="button"
              onClick={() => handleAction(onOpenDecoder)}
              onMouseEnter={playBeep}
              className="ra-menu-btn w-full h-[12.5%] flex items-center justify-center text-xs sm:text-sm md:text-[15px] cursor-pointer tracking-wider group rounded-xs"
            >
              <span>Reverse INI Decoder</span>
            </button>

            {/* Button 6: Guide */}
            <button
              type="button"
              onClick={() => handleAction(onOpenResearch)}
              onMouseEnter={playBeep}
              className="ra-menu-btn w-full h-[12.5%] flex items-center justify-center text-xs sm:text-sm md:text-[15px] cursor-pointer tracking-wider group rounded-xs"
            >
              <span>Guide</span>
            </button>

            {/* Button 7: Enter Full Workspace */}
            <button
              type="button"
              onClick={() => handleAction(onEnterStudio)}
              onMouseEnter={playBeep}
              className="ra-menu-btn w-full h-[12.5%] flex items-center justify-center text-xs sm:text-sm md:text-[15px] cursor-pointer tracking-wider group rounded-xs text-amber-300 hover:text-white"
            >
              <span>Enter Workspace &rarr;</span>
            </button>
          </div>

          {/* Bottom-Right Version & TinyPNG Tool shortcut inside grid */}
          <div className="absolute bottom-[6.8%] right-[26.5%] text-[10px] sm:text-xs font-mono text-red-600 flex items-center gap-3 pointer-events-auto select-none">
            {onOpenTinyPng && (
              <button
                type="button"
                onClick={() => handleAction(onOpenTinyPng)}
                className="text-amber-400 hover:text-amber-300 underline cursor-pointer transition-colors"
                title="Open TinyPNG Image Compressor"
              >
                TinyPNG
              </button>
            )}
            <div className="flex items-center gap-1">
              <span>Version:</span>
              <span
                className="text-red-400 font-bold underline cursor-pointer hover:text-red-300 transition-colors"
                onClick={() => handleAction(onOpenResearch)}
              >
                2.0
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

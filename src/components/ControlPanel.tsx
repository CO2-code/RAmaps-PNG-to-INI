import React from 'react';
import {
  Sliders,
  Palette,
  Cpu,
  Settings2,
  CheckCircle,
  ShieldCheck,
  Zap,
  Lock,
  Unlock,
  AlertTriangle,
} from 'lucide-react';
import { ConversionOptions, PaletteId, OutputEncoding } from '../types';
import { PALETTES } from '../lib/palettes';
import { calculateDimensionsForLineBudget } from '../lib/formatters';

interface ControlPanelProps {
  options: ConversionOptions;
  onChange: (patch: Partial<ConversionOptions>) => void;
  sourceWidth?: number;
  sourceHeight?: number;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  options,
  onChange,
  sourceWidth = 128,
  sourceHeight = 128,
}) => {
  const isCncNetLzo = options.encoding === 'cncnet_lzo_24bit';

  // Handle proportional aspect ratio change
  const handleWidthChange = (newWidth: number) => {
    if (newWidth <= 0) return;
    if (options.maintainAspectRatio && sourceWidth > 0 && sourceHeight > 0) {
      const ratio = sourceHeight / sourceWidth;
      const newHeight = Math.max(16, Math.round(newWidth * ratio));
      onChange({ width: newWidth, height: newHeight });
    } else {
      onChange({ width: newWidth });
    }
  };

  const handleHeightChange = (newHeight: number) => {
    if (newHeight <= 0) return;
    if (options.maintainAspectRatio && sourceWidth > 0 && sourceHeight > 0) {
      const ratio = sourceWidth / sourceHeight;
      const newWidth = Math.max(16, Math.round(newHeight * ratio));
      onChange({ width: newWidth, height: newHeight });
    } else {
      onChange({ height: newHeight });
    }
  };

  // Handle direct Line Budget target change
  const handleLineBudgetChange = (targetLines: number) => {
    const { width: newW, height: newH } = calculateDimensionsForLineBudget(
      sourceWidth,
      sourceHeight,
      targetLines,
      options.encoding,
      options.lineLength || 70
    );
    onChange({
      width: newW,
      height: newH,
      targetLineBudget: targetLines,
    });
  };

  // Helper to set preset dimensions while respecting source aspect ratio if locked
  const applyPresetDimension = (maxDimension: number) => {
    if (sourceWidth <= 0 || sourceHeight <= 0) {
      onChange({ width: maxDimension, height: maxDimension });
      return;
    }
    const maxSource = Math.max(sourceWidth, sourceHeight);
    const scale = Math.min(1, maxDimension / maxSource);
    const targetW = Math.max(16, Math.round(sourceWidth * scale));
    const targetH = Math.max(16, Math.round(sourceHeight * scale));
    onChange({ width: targetW, height: targetH });
  };

  const isFullNative = options.width === sourceWidth && options.height === sourceHeight;
  const is23kWarning = (options.width * options.height * 3) > 1000000;

  return (
    <div className="bg-neutral-900/70 border border-neutral-800 rounded-2xl p-5 space-y-6 text-sm">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-red-500" />
          Map Preview Settings
        </h3>
        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
          {options.width}×{options.height} px
        </span>
      </div>

      {/* 1. Target Engine / Client Format */}
      <div className="space-y-2.5">
        <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          Target Client Engine & Format
        </label>
        <div className="space-y-2">
          {/* CnCNet XNA Client (Recommended) */}
          <button
            type="button"
            onClick={() => onChange({ encoding: 'cncnet_lzo_24bit' })}
            className={`w-full p-3 rounded-xl border text-left transition-all relative ${
              options.encoding === 'cncnet_lzo_24bit'
                ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-md shadow-emerald-950/30'
                : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 text-neutral-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-xs text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>CnCNet XNA Client (LZO 24-bit RGB)</span>
              </div>
              <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-950/80 border border-emerald-700/60 px-1.5 py-0.5 rounded">
                XCC Standard
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
              100% compatible with <strong className="text-emerald-300">xna-cncnet-client</strong> and XCC Mixer’s <em>"Copy as Map Preview"</em>. Uses LZO1X block compression and full 24-bit RGB truecolor!
            </p>
          </button>

          {/* Classic Westwood 8-bit LCW (DOS / 1996) */}
          <button
            type="button"
            onClick={() => onChange({ encoding: 'lcw_8bit' })}
            className={`w-full p-2.5 rounded-xl border text-left transition-all ${
              options.encoding === 'lcw_8bit'
                ? 'bg-neutral-800 border-red-500 text-white'
                : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 text-neutral-400'
            }`}
          >
            <div className="font-semibold text-xs text-neutral-200">
              Classic Red Alert 1 Engine (LCW 8-bit Indexed)
            </div>
            <div className="text-[11px] text-neutral-500">
              Original Westwood 1996 Format80 with 256-color palette (EDWIN & DOS).
            </div>
          </button>

          {/* TS / RA2 16-bit RGB 565 */}
          <button
            type="button"
            onClick={() => onChange({ encoding: 'lcw_16bit' })}
            className={`w-full p-2.5 rounded-xl border text-left transition-all ${
              options.encoding === 'lcw_16bit'
                ? 'bg-neutral-800 border-red-500 text-white'
                : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 text-neutral-400'
            }`}
          >
            <div className="font-semibold text-xs text-neutral-200">
              Tiberian Sun / RA2 Vanilla (LCW 16-bit RGB 565)
            </div>
            <div className="text-[11px] text-neutral-500">
              High-color 16-bit format compressed with Westwood LCW.
            </div>
          </button>
        </div>
      </div>

      {/* 2. Target Line Budget & Recommended Size Profiles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-neutral-400" />
            Line Budget & Size Presets
          </label>

          <button
            type="button"
            onClick={() => onChange({ maintainAspectRatio: !options.maintainAspectRatio })}
            className={`text-[11px] font-mono flex items-center gap-1 transition-colors ${
              options.maintainAspectRatio ? 'text-amber-400' : 'text-neutral-500 hover:text-neutral-400'
            }`}
            title="Maintain aspect ratio when typing custom width or height"
          >
            {options.maintainAspectRatio ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            <span>Aspect Ratio Lock</span>
          </button>
        </div>

        {/* 23k+ Lines Warning Banner if Full Native or excessive resolution selected */}
        {is23kWarning && (
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/60 text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>High Line Count Warning ({options.width}×{options.height})</span>
            </div>
            <p className="text-[11px] text-neutral-300 leading-relaxed">
              At this resolution, [PreviewPack] will be <strong className="text-amber-300">23,000+ lines</strong> (~1.6 MB).
              CnCNet & XCC recommend staying under <strong className="text-emerald-300">257×257 px (&lt; 1,000 lines)</strong> so other players can download your map quickly without lobby transfer lag.
            </p>
            <button
              type="button"
              onClick={() => applyPresetDimension(256)}
              className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>Fix: Auto-Fit to CnCNet Standard (&lt; 1,000 Lines)</span>
            </button>
          </div>
        )}

        {/* Presets Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Preset 1: CnCNet HD (256px max) - Recommended */}
          <button
            type="button"
            onClick={() => applyPresetDimension(256)}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              Math.max(options.width, options.height) === 256 || (!isFullNative && options.width <= 256 && options.width > 192)
                ? 'bg-emerald-950/50 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/50'
                : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-emerald-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>CnCNet HD (256px)</span>
              </span>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950 border border-emerald-700/50 px-1 rounded">
                Rec.
              </span>
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">~800–1,100 lines</div>
            <div className="text-[9px] text-neutral-500">Official &lt; 257px limit · Zero lag</div>
          </button>

          {/* Preset 2: Classic Retro (128px) */}
          <button
            type="button"
            onClick={() => applyPresetDimension(128)}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              Math.max(options.width, options.height) === 128
                ? 'bg-red-950/60 border-red-600 text-white shadow-sm ring-1 ring-red-500/50'
                : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
            }`}
          >
            <div className="font-bold text-xs text-neutral-200">Classic RA1 (128px)</div>
            <div className="text-[10px] text-neutral-400 mt-1">~200–350 lines</div>
            <div className="text-[9px] text-neutral-500">EDWIN standard · Ultra light</div>
          </button>

          {/* Preset 3: Balanced Medium (192px) */}
          <button
            type="button"
            onClick={() => applyPresetDimension(192)}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              Math.max(options.width, options.height) === 192
                ? 'bg-red-950/60 border-red-600 text-white shadow-sm'
                : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
            }`}
          >
            <div className="font-bold text-xs text-neutral-200">Balanced (192px)</div>
            <div className="text-[10px] text-neutral-400 mt-1">~450–700 lines</div>
            <div className="text-[9px] text-neutral-500">Clean & fast preview</div>
          </button>

          {/* Preset 4: Full Original Resolution */}
          <button
            type="button"
            onClick={() => onChange({ width: sourceWidth, height: sourceHeight })}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              isFullNative
                ? 'bg-amber-950/50 border-amber-600 text-white'
                : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs font-mono">{sourceWidth}×{sourceHeight}</span>
              {sourceWidth > 400 && (
                <span className="text-[9px] font-mono text-amber-400 bg-amber-950 px-1 rounded">
                  23k+
                </span>
              )}
            </div>
            <div className="text-[10px] text-amber-300 mt-1">Full Native Source</div>
            <div className="text-[9px] text-neutral-500">Original unscaled image</div>
          </button>
        </div>

        {/* Dynamic Target Line Budget Slider */}
        <div className="p-3 bg-neutral-950/70 border border-neutral-800/80 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Target Line Budget:</span>
            </span>
            <span className="font-mono text-amber-400 bg-amber-950/60 border border-amber-800/40 px-2 py-0.5 rounded text-[11px]">
              ~{options.targetLineBudget || 1000} Max Lines
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min={150}
              max={3000}
              step={50}
              value={options.targetLineBudget || 1000}
              onChange={(e) => handleLineBudgetChange(parseInt(e.target.value, 10))}
              className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-neutral-500">
            <button
              type="button"
              onClick={() => handleLineBudgetChange(300)}
              className="hover:text-amber-400 transition-colors"
            >
              300 (Tiny)
            </button>
            <button
              type="button"
              onClick={() => handleLineBudgetChange(600)}
              className="hover:text-amber-400 transition-colors"
            >
              600
            </button>
            <button
              type="button"
              onClick={() => handleLineBudgetChange(1000)}
              className="text-emerald-400 font-bold hover:text-emerald-300 transition-colors"
            >
              1,000 (Sweet Spot)
            </button>
            <button
              type="button"
              onClick={() => handleLineBudgetChange(2000)}
              className="hover:text-amber-400 transition-colors"
            >
              2,000 (HD)
            </button>
          </div>
        </div>

        {/* Custom Width & Height Inputs */}
        <div className="p-3 bg-neutral-950/60 border border-neutral-800/80 rounded-xl space-y-2">
          <div className="text-[11px] font-mono text-neutral-400 flex items-center justify-between">
            <span>Manual Dimension Inputs:</span>
            {options.maintainAspectRatio && (
              <span className="text-amber-400 text-[10px]">Ratio Locked (1:{((sourceHeight || 1) / (sourceWidth || 1)).toFixed(2)})</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <span className="text-[10px] text-neutral-500 font-mono block mb-1">Width (px):</span>
              <input
                type="number"
                min={16}
                max={4096}
                value={options.width}
                onChange={(e) => handleWidthChange(parseInt(e.target.value, 10))}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <span className="text-neutral-600 pt-4 font-mono">×</span>

            <div className="flex-1">
              <span className="text-[10px] text-neutral-500 font-mono block mb-1">Height (px):</span>
              <input
                type="number"
                min={16}
                max={4096}
                value={options.height}
                onChange={(e) => handleHeightChange(parseInt(e.target.value, 10))}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-red-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Red Alert 1 Theater Palette (Used when generating 8-bit LCW mode) */}
      {!isCncNetLzo && (
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-amber-400" />
            Theater Palette (256 Colors)
          </label>
          <div className="space-y-1.5">
            {(Object.keys(PALETTES) as PaletteId[]).map((palId) => {
              const pal = PALETTES[palId];
              const isSelected = options.palette === palId;
              return (
                <button
                  key={palId}
                  type="button"
                  onClick={() => onChange({ palette: palId })}
                  className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-neutral-800 border-red-500 text-white shadow-sm'
                      : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 text-neutral-400'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-xs text-neutral-200">{pal.name}</div>
                    <div className="text-[11px] text-neutral-500">{pal.description}</div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    {[32, 64, 96, 128, 160].map((idx) => (
                      <span
                        key={idx}
                        className="w-3 h-3 rounded-sm border border-black/40"
                        style={{
                          backgroundColor: `rgb(${pal.colors[idx][0]}, ${pal.colors[idx][1]}, ${pal.colors[idx][2]})`,
                        }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Fine-Tuning Switches */}
      <div className="space-y-3 pt-1 border-t border-neutral-800/80">
        {isCncNetLzo && (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>LZO Compression Boost (Noise Filter)</span>
              </div>
              <div className="text-[11px] text-neutral-500">
                Removes micro-noise in 24-bit pixels to slash INI line counts by up to 35%
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChange({ colorNoiseReduction: !options.colorNoiseReduction })}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                options.colorNoiseReduction !== false ? 'bg-emerald-600' : 'bg-neutral-800'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  options.colorNoiseReduction !== false ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        )}

        {!isCncNetLzo && (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-neutral-200">Floyd-Steinberg Dithering</div>
              <div className="text-[11px] text-neutral-500">
                Smooths gradients and textures for 256-color palette
              </div>
            </div>
            <button
              type="button"
              onClick={() => onChange({ dithering: !options.dithering })}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                options.dithering ? 'bg-red-600' : 'bg-neutral-800'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  options.dithering ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-neutral-200">Include [Preview] Header</div>
            <div className="text-[11px] text-neutral-500">
              Outputs <code className="text-amber-400 font-mono">Size=0,0,{options.width},{options.height}</code>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange({ includePreviewSection: !options.includePreviewSection })}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              options.includePreviewSection ? 'bg-red-600' : 'bg-neutral-800'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                options.includePreviewSection ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            <div className="text-xs font-semibold text-neutral-200">INI Line Wrap Length</div>
            <div className="text-[11px] text-neutral-500">
              Characters per line (Standard XCC & Westwood: 70)
            </div>
          </div>
          <select
            value={options.lineLength}
            onChange={(e) => onChange({ lineLength: parseInt(e.target.value, 10) })}
            className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-xs font-mono text-neutral-200 focus:outline-none focus:border-red-500"
          >
            <option value={70}>70 Chars (XCC & RA1 Standard)</option>
            <option value={76}>76 Chars (MIME Base64)</option>
            <option value={60}>60 Chars (Short)</option>
          </select>
        </div>
      </div>
    </div>
  );
};

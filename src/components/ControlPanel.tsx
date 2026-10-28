import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  SlidersHorizontal,
} from 'lucide-react';
import { ConversionOptions, PaletteId } from '../types';
import { calculateDimensionsForLineBudget } from '../lib/formatters';

interface ControlPanelProps {
  options: ConversionOptions;
  onChange: (patch: Partial<ConversionOptions>) => void;
  sourceWidth?: number;
  sourceHeight?: number;
  defaultOpen?: boolean;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  options,
  onChange,
  sourceWidth = 128,
  sourceHeight = 128,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
  const isCncNetLzo = options.encoding === 'cncnet_lzo_24bit';

  // Handle proportional aspect ratio change
  const handleWidthChange = (newWidth: number) => {
    if (newWidth <= 0 || isNaN(newWidth)) return;
    if (options.maintainAspectRatio && sourceWidth > 0 && sourceHeight > 0) {
      const ratio = sourceHeight / sourceWidth;
      const newHeight = Math.max(16, Math.round(newWidth * ratio));
      onChange({ width: newWidth, height: newHeight });
    } else {
      onChange({ width: newWidth });
    }
  };

  const handleHeightChange = (newHeight: number) => {
    if (newHeight <= 0 || isNaN(newHeight)) return;
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

  return (
    <div className="bg-[#0c0d12] border border-[#2f1015] rounded-2xl shadow-[0_4px_25px_rgba(0,0,0,0.7)] transition-all overflow-hidden">
      {/* Dropdown / Accordion Trigger Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-[#140b0e] transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#161724] border border-[#3d1217] flex items-center justify-center text-red-500 shadow-[0_0_12px_rgba(220,38,38,0.2)] group-hover:scale-105 group-hover:text-red-400 group-hover:border-red-600 transition-all">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold font-['Rajdhani',sans-serif] uppercase tracking-wide text-white">
                Advanced Tactical Settings
              </h3>
              <span className="text-[11px] font-mono font-bold text-red-400 bg-red-950/80 border border-red-800/80 px-2 py-0.5 rounded">
                {options.width}×{options.height} px
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Encoding ({isCncNetLzo ? 'CnCNet LZO 24-bit' : 'Classic LCW'}), line budget (~{options.targetLineBudget || 1000} lines), dithering, and custom dimensions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
          <span className="hidden md:inline text-slate-400 font-mono">
            {isOpen ? 'Collapse Settings' : 'Configure Options'}
          </span>
          <div className="p-1 rounded-lg bg-[#181926] text-red-400 group-hover:bg-[#222436] transition-colors">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Dropdown Expanded Body */}
      {isOpen && (
        <div className="p-5 sm:p-6 border-t border-[#2b0c10] bg-[#07070a] space-y-6 animate-fade-in text-sm">
          {/* Section 1: Output Encoding */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Output Encoding Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#0a0b12] p-1.5 rounded-xl border border-[#2d0f14]">
              <button
                type="button"
                onClick={() => onChange({ encoding: 'cncnet_lzo_24bit' })}
                className={`py-2 px-3 rounded-lg text-xs font-medium text-center transition-all cursor-pointer ${
                  options.encoding === 'cncnet_lzo_24bit'
                    ? 'ra-menu-btn text-slate-100 font-bold shadow-xs'
                    : 'text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                CnCNet LZO 24-bit (Standard)
              </button>

              <button
                type="button"
                onClick={() => onChange({ encoding: 'lcw_8bit' })}
                className={`py-2 px-3 rounded-lg text-xs font-medium text-center transition-all cursor-pointer ${
                  options.encoding === 'lcw_8bit'
                    ? 'ra-menu-btn text-slate-100 font-bold shadow-xs'
                    : 'text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Classic LCW 8-bit (Format80)
              </button>

              <button
                type="button"
                onClick={() => onChange({ encoding: 'lcw_16bit' })}
                className={`py-2 px-3 rounded-lg text-xs font-medium text-center transition-all cursor-pointer ${
                  options.encoding === 'lcw_16bit'
                    ? 'ra-menu-btn text-slate-100 font-bold shadow-xs'
                    : 'text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                TS / RA2 16-bit
              </button>
            </div>

            <p className="text-xs text-slate-400">
              {isCncNetLzo ? (
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  ✓ Official CnCNet XNA Client & XCC Mixer format: 24-bit TrueColor with fast LZO block compression.
                </span>
              ) : (
                <span>Classic Westwood Format80 LCW algorithm quantized to 256 colors.</span>
              )}
            </p>
          </div>

          {/* Section 2: Line Budget Slider & Presets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200/70 dark:border-slate-800">
            {/* Target Line Budget */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 uppercase tracking-wider">
                  Target Line Budget
                </span>
                <span className="font-mono font-bold text-slate-100 text-sm">
                  ~{options.targetLineBudget || 1000} lines
                </span>
              </div>

              <input
                type="range"
                min={200}
                max={5000}
                step={100}
                value={options.targetLineBudget || 1000}
                onChange={(e) => handleLineBudgetChange(Number(e.target.value))}
                className="w-full accent-slate-900 dark:accent-red-500 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none"
              />

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <button
                  type="button"
                  onClick={() => handleLineBudgetChange(500)}
                  className="hover:text-slate-900 dark:hover:text-white underline underline-offset-2 cursor-pointer"
                >
                  500 lines (Fast)
                </button>
                <button
                  type="button"
                  onClick={() => handleLineBudgetChange(1000)}
                  className="text-emerald-700 dark:text-emerald-400 font-semibold hover:text-emerald-800 underline underline-offset-2 cursor-pointer"
                >
                  1,000 lines (Standard)
                </button>
                <button
                  type="button"
                  onClick={() => handleLineBudgetChange(2500)}
                  className="hover:text-slate-900 dark:hover:text-white underline underline-offset-2 cursor-pointer"
                >
                  2,500 lines (Detailed)
                </button>
              </div>
            </div>

            {/* Resolution Presets */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Resolution Presets
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => applyPresetDimension(96)}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                    options.width === 96 && options.height === 96
                      ? 'border-red-600 bg-[#0f1019] text-slate-100 shadow-2xs font-semibold'
                      : 'border-[#33141a] hover:border-slate-300 dark:hover:border-slate-600 bg-white/70 dark:bg-slate-800/60 text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-100">96 × 96</div>
                  <div className="text-[10px] text-slate-400">Fast Lobby (~800 lines)</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPresetDimension(128)}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                    options.width === 128 && options.height === 128
                      ? 'border-red-600 bg-[#0f1019] text-slate-100 shadow-2xs font-semibold'
                      : 'border-[#33141a] hover:border-slate-300 dark:hover:border-slate-600 bg-white/70 dark:bg-slate-800/60 text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-100">128 × 128</div>
                  <div className="text-[10px] text-slate-400">Sharp (~1,400 lines)</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPresetDimension(192)}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                    options.width === 192 && options.height === 192
                      ? 'border-red-600 bg-[#0f1019] text-slate-100 shadow-2xs font-semibold'
                      : 'border-[#33141a] hover:border-slate-300 dark:hover:border-slate-600 bg-white/70 dark:bg-slate-800/60 text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-100">192 × 192</div>
                  <div className="text-[10px] text-slate-400">High Res (~3,000 lines)</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPresetDimension(256)}
                  className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                    options.width === 256 && options.height === 256
                      ? 'border-red-600 bg-[#0f1019] text-slate-100 shadow-2xs font-semibold'
                      : 'border-[#33141a] hover:border-slate-300 dark:hover:border-slate-600 bg-white/70 dark:bg-slate-800/60 text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-100">256 × 256</div>
                  <div className="text-[10px] text-slate-400">CnCNet Max (~5,000 lines)</div>
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Custom Dimensions, Toggles & Palette */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200/70 dark:border-slate-800">
            {/* Custom Dimensions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 uppercase tracking-wider">Custom Dimensions</span>
                <button
                  type="button"
                  onClick={() => onChange({ maintainAspectRatio: !options.maintainAspectRatio })}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  {options.maintainAspectRatio ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-slate-200" /> Lock Aspect
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5 text-slate-400" /> Free Aspect
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Width (px)</label>
                  <input
                    type="number"
                    min={16}
                    max={1024}
                    value={options.width}
                    onChange={(e) => handleWidthChange(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0f1019] border border-[#33141a] text-xs font-mono text-slate-100 focus:outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase block mb-1">Height (px)</label>
                  <input
                    type="number"
                    min={16}
                    max={1024}
                    value={options.height}
                    onChange={(e) => handleHeightChange(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#0f1019] border border-[#33141a] text-xs font-mono text-slate-100 focus:outline-none focus:border-slate-400"
                  />
                </div>
              </div>
            </div>

            {/* Quality & Processing Toggles */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Compression & Filtering
              </label>

              <div className="space-y-2">
                <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                  <span>Floyd-Steinberg Dithering</span>
                  <input
                    type="checkbox"
                    checked={options.dithering}
                    onChange={(e) => onChange({ dithering: e.target.checked })}
                    className="w-4 h-4 accent-slate-900 dark:accent-red-500 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                  <span>Color Noise Filter (reduces line count)</span>
                  <input
                    type="checkbox"
                    checked={options.colorNoiseReduction !== false}
                    onChange={(e) => onChange({ colorNoiseReduction: e.target.checked })}
                    className="w-4 h-4 accent-slate-900 dark:accent-red-500 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                  <span>Include [Preview] Header Section</span>
                  <input
                    type="checkbox"
                    checked={options.includePreviewSection}
                    onChange={(e) => onChange({ includePreviewSection: e.target.checked })}
                    className="w-4 h-4 accent-slate-900 dark:accent-red-500 rounded cursor-pointer"
                  />
                </label>
              </div>

              {!isCncNetLzo && (
                <div className="pt-2">
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Palette (for 8-bit LCW)
                  </label>
                  <select
                    value={options.palette}
                    onChange={(e) => onChange({ palette: e.target.value as PaletteId })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#0f1019] border border-[#33141a] text-xs text-slate-100 focus:outline-none focus:border-slate-400"
                  >
                    <option value="temperat">Temperate (Green Grass & Water)</option>
                    <option value="snow">Snow / Winter (Glacier & Tundra)</option>
                    <option value="interior">Interior (Underground Bunker)</option>
                    <option value="universal">Universal (Standard 256 Colors)</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

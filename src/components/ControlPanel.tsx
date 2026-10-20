import React from 'react';
import { Sliders, Palette, Cpu, Settings2, CheckCircle, ShieldCheck } from 'lucide-react';
import { ConversionOptions, PaletteId, OutputEncoding } from '../types';
import { PALETTES } from '../lib/palettes';

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

      {/* 1. Target Engine / Client Format (XNA CNCNET VS CLASSIC LCW) */}
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

      {/* 2. Target Preview Dimensions & Presets */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-neutral-400" />
            Preview Dimensions (Width × Height)
          </label>
          {sourceWidth > 0 && sourceHeight > 0 && (
            <button
              type="button"
              onClick={() => onChange({ width: sourceWidth, height: sourceHeight })}
              className="text-[11px] font-mono text-cyan-400 hover:underline"
            >
              Use Source ({sourceWidth}×{sourceHeight})
            </button>
          )}
        </div>

        {/* Quick Presets */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { w: 128, h: 128, label: '128 × 128', desc: 'Square Icon' },
            { w: 256, h: 256, label: '256 × 256', desc: 'HD Square' },
            { w: 800, h: 400, label: '800 × 400', desc: 'Widescreen' },
            { w: 830, h: 230, label: '830 × 230', desc: 'XCC Banner' },
            { w: 64, h: 64, label: '64 × 64', desc: 'Classic Retro' },
            { w: sourceWidth, h: sourceHeight, label: 'Original', desc: 'Exact Native' },
          ].map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onChange({ width: preset.w, height: preset.h })}
              className={`p-2 rounded-xl border text-left transition-all ${
                options.width === preset.w && options.height === preset.h
                  ? 'bg-red-950/60 border-red-600 text-white shadow-sm'
                  : 'bg-neutral-950/60 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
              }`}
            >
              <div className="font-bold text-xs font-mono">{preset.label}</div>
              <div className="text-[10px] text-neutral-500 truncate">{preset.desc}</div>
            </button>
          ))}
        </div>

        {/* Custom Width & Height Inputs */}
        <div className="pt-2 flex items-center gap-3">
          <div className="flex-1">
            <span className="text-[10px] text-neutral-400 font-mono block mb-1">Custom Width:</span>
            <input
              type="number"
              min={16}
              max={1920}
              value={options.width}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) onChange({ width: val });
              }}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <span className="text-neutral-500 pt-4 font-mono">×</span>

          <div className="flex-1">
            <span className="text-[10px] text-neutral-400 font-mono block mb-1">Custom Height:</span>
            <input
              type="number"
              min={16}
              max={1920}
              value={options.height}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (val > 0) onChange({ height: val });
              }}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-red-500"
            />
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

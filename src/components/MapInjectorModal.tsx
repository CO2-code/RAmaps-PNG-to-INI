import React, { useState, useRef } from 'react';
import { X, FileCode, Download, Check } from 'lucide-react';
import { injectPreviewIntoMapFile } from '../lib/formatters';

interface MapInjectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewBlockText: string;
}

export const MapInjectorModal: React.FC<MapInjectorModalProps> = ({
  isOpen,
  onClose,
  previewBlockText,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mapFileName, setMapFileName] = useState<string>('');
  const [, setOriginalText] = useState<string>('');
  const [mergedText, setMergedText] = useState<string>('');
  const [hasInjected, setHasInjected] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    setMapFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setOriginalText(content);
      const merged = injectPreviewIntoMapFile(content, previewBlockText);
      setMergedText(merged);
      setHasInjected(true);
    };
    reader.readAsText(file);
  };

  const handleDownloadMerged = () => {
    if (!mergedText) return;
    const blob = new Blob([mergedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mapFileName ? `preview_${mapFileName}` : 'map_with_preview.mpr';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#0c0d12] border border-[#3b0a0a] rounded-2xl shadow-[0_0_50px_rgba(180,0,0,0.35)] overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#2b0808] bg-[#07070a]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-red-950/80 border border-red-800/80 text-red-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-['Rajdhani',sans-serif] uppercase tracking-wide text-white">
                Automatic Map File Injector (.MPR / .INI)
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Upload your map file to automatically inject or replace [Preview] &amp; [PreviewPack]
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
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {!hasInjected ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#3a151b] hover:border-red-600 rounded-2xl p-8 text-center cursor-pointer bg-[#07070a]/90 hover:bg-[#120a0d] transition-all space-y-3 group ra-radar-grid"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mpr,.ini,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <FileCode className="w-10 h-10 mx-auto text-red-500 group-hover:scale-105 transition-transform" />
              <div className="text-sm font-bold font-['Rajdhani',sans-serif] uppercase text-white tracking-wide">
                Select Your Map File (.mpr or .ini)
              </div>
              <p className="text-xs text-slate-400 font-mono">
                The generator will merge the [PreviewPack] directly into the correct section.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-300 font-mono">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Successfully injected preview into {mapFileName}!</span>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-slate-400 hover:text-white underline font-mono text-[11px] cursor-pointer"
                >
                  Choose another file
                </button>
              </div>

              {/* Preview of merged file */}
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide block mb-1 font-mono">
                  Updated Map File Preview (First 40 lines):
                </label>
                <pre className="p-3 bg-[#050508] border border-[#2b0808] rounded-xl font-mono text-xs text-emerald-400/90 max-h-[260px] overflow-y-auto">
                  {mergedText.split('\n').slice(0, 45).join('\n')}
                  {mergedText.split('\n').length > 45 && '\n... (remaining map data retained)'}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#2b0808] bg-[#07070a] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#141520] hover:bg-[#1d1f30] border border-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>

          {hasInjected && (
            <button
              onClick={handleDownloadMerged}
              className="ra-menu-btn px-5 py-2 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Ready .MPR File</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

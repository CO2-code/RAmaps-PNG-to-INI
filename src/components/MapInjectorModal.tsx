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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Automatic Map File Injector (.MPR / .INI)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload your map file to automatically inject or replace [Preview] & [PreviewPack]
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {!hasInjected ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border border-slate-200 dark:border-slate-800 hover:border-amber-500/80 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-50/90 dark:hover:bg-slate-800/70 transition-all space-y-3"
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
              <FileCode className="w-10 h-10 mx-auto text-amber-600 dark:text-amber-500" />
              <div className="text-sm font-bold text-slate-900 dark:text-white">Select Your Map File (.mpr or .ini)</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                The generator will merge the [PreviewPack] directly into the correct section.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-mono">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Successfully injected preview into {mapFileName}!</span>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline font-mono text-[11px] cursor-pointer"
                >
                  Choose another file
                </button>
              </div>

              {/* Preview of merged file */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide block mb-1">
                  Updated Map File Preview (First 40 lines):
                </label>
                <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-emerald-400/90 max-h-[260px] overflow-y-auto">
                  {mergedText.split('\n').slice(0, 45).join('\n')}
                  {mergedText.split('\n').length > 45 && '\n... (remaining map data retained)'}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>

          {hasInjected && (
            <button
              onClick={handleDownloadMerged}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-xs cursor-pointer"
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

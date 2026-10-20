import React, { useState, useRef } from 'react';
import { X, FileCode, Download, Check, AlertCircle, ArrowRight } from 'lucide-react';
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
  const [originalText, setOriginalText] = useState<string>('');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Automatic Map File Injector (.MPR / .INI)
              </h2>
              <p className="text-xs text-neutral-400">
                Upload your map file to automatically inject or replace [Preview] & [PreviewPack]
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

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {!hasInjected ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-neutral-800 hover:border-amber-500/80 rounded-2xl p-8 text-center cursor-pointer bg-neutral-950/50 hover:bg-neutral-950 transition-all space-y-3"
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
              <FileCode className="w-10 h-10 mx-auto text-amber-500" />
              <div className="text-sm font-bold text-white">Select Your Map File (.mpr or .ini)</div>
              <p className="text-xs text-neutral-400">
                The generator will merge the [PreviewPack] directly into the correct section.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-300 font-mono">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Successfully injected preview into {mapFileName}!</span>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-neutral-400 hover:text-white underline font-mono text-[11px]"
                >
                  Choose another file
                </button>
              </div>

              {/* Preview of merged file */}
              <div>
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide block mb-1">
                  Updated Map File Preview (First 40 lines):
                </label>
                <pre className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl font-mono text-xs text-neutral-300 max-h-[260px] overflow-y-auto">
                  {mergedText.split('\n').slice(0, 45).join('\n')}
                  {mergedText.split('\n').length > 45 && '\n... (remaining map data retained)'}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium"
          >
            Cancel
          </button>

          {hasInjected && (
            <button
              onClick={handleDownloadMerged}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-amber-950/50"
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

import React, { useState } from 'react';
import { Copy, Check, Download, FileCode, Terminal, Sparkles } from 'lucide-react';
import { ConversionResult } from '../types';

interface IniOutputViewerProps {
  result: ConversionResult | null;
}

export const IniOutputViewer: React.FC<IniOutputViewerProps> = ({ result }) => {
  const [copiedType, setCopiedType] = useState<'all' | 'previewPack' | null>(null);

  if (!result) return null;

  const handleCopyAll = () => {
    navigator.clipboard.writeText(result.fullIniText);
    setCopiedType('all');
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleCopyPreviewPackOnly = () => {
    navigator.clipboard.writeText(result.previewPackSection);
    setCopiedType('previewPack');
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleDownloadIni = () => {
    const blob = new Blob([result.fullIniText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preview_${result.targetWidth}x${result.targetHeight}.ini`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl overflow-hidden space-y-0 shadow-2xl">
      {/* Top Action Header */}
      <div className="bg-neutral-950 px-4 py-3 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-red-500" />
          <span className="font-bold text-xs uppercase tracking-wider text-white font-['Rajdhani',sans-serif]">
            Generated Map INI Output
          </span>
          <span className="text-[11px] font-mono text-neutral-400">
            ({result.lineCount} INI lines · {result.compressedByteCount.toLocaleString()} bytes)
          </span>
        </div>

        {/* Copy & Download Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyPreviewPackOnly}
            className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
          >
            {copiedType === 'previewPack' ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span className="text-green-400 font-semibold">Copied [PreviewPack]</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-amber-400" />
                <span>Copy [PreviewPack]</span>
              </>
            )}
          </button>

          <button
            onClick={handleCopyAll}
            className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-red-950/40"
          >
            {copiedType === 'all' ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Copied All!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy [Preview] + [PreviewPack]</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadIni}
            className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white transition-colors"
            title="Download .INI Snippet"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Code Textarea Viewer */}
      <div className="relative">
        <pre className="p-4 bg-neutral-950/90 font-mono text-xs text-neutral-300 overflow-x-auto max-h-[380px] overflow-y-auto leading-relaxed select-all selection:bg-red-900 selection:text-white">
          <code>{result.fullIniText}</code>
        </pre>
      </div>

      {/* Integration Guide Footer */}
      <div className="bg-neutral-950/60 p-3.5 border-t border-neutral-800/80 text-xs text-neutral-400 space-y-1">
        <div className="font-semibold text-neutral-200 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          How to paste into your Red Alert 1 map:
        </div>
        <p className="text-[11px] text-neutral-400 leading-relaxed font-mono">
          Open your <span className="text-white">.mpr</span> or <span className="text-white">.ini</span> file in any text editor.
          Paste the copied block directly under the <span className="text-amber-400">[Basic]</span> or <span className="text-amber-400">[Map]</span> section.
          If an old <span className="text-red-400">[Preview]</span> or <span className="text-red-400">[PreviewPack]</span> already exists, simply overwrite it!
        </p>
      </div>
    </div>
  );
};

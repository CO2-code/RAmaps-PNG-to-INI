import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  Terminal,
  Sparkles,
  Zap,
  AlertTriangle,
  Eye,
  FileDown,
  Layers,
} from 'lucide-react';
import { ConversionResult } from '../types';

interface IniOutputViewerProps {
  result: ConversionResult | null;
  onOptimizeResolution?: () => void;
}

export const IniOutputViewer: React.FC<IniOutputViewerProps> = ({
  result,
  onOptimizeResolution,
}) => {
  const [copiedType, setCopiedType] = useState<'all' | 'previewPack' | null>(null);
  const [showFullCode, setShowFullCode] = useState<boolean>(false);
  const [isCopying, setIsCopying] = useState<boolean>(false);

  const lineCount = result?.lineCount ?? 0;
  const isLarge = lineCount > 200;

  // Windowed code preview for high performance (prevents browser lockup on 23k+ lines)
  const displaySnippet = useMemo(() => {
    if (!result) return '';
    if (!isLarge || showFullCode) {
      return result.fullIniText;
    }

    const lines = result.fullIniText.split('\n');
    const head = lines.slice(0, 45).join('\n');
    const tail = lines.slice(-15).join('\n');
    const hiddenCount = lines.length - 60;

    return `${head}\n\n; ---------------------------------------------------------------------------\n; ... [ ${hiddenCount.toLocaleString()} MORE LINES IN [PreviewPack] HIDDEN FROM PREVIEW ] ...\n; (Full ${lines.length.toLocaleString()} lines will be copied or downloaded completely!)\n; ---------------------------------------------------------------------------\n\n${tail}`;
  }, [result, isLarge, showFullCode]);

  if (!result) return null;

  const handleCopyAll = async () => {
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(result.fullIniText);
      setCopiedType('all');
      setTimeout(() => setCopiedType(null), 3000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = result.fullIniText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedType('all');
      setTimeout(() => setCopiedType(null), 3000);
    } finally {
      setIsCopying(false);
    }
  };

  const handleCopyPreviewPackOnly = async () => {
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(result.previewPackSection);
      setCopiedType('previewPack');
      setTimeout(() => setCopiedType(null), 3000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = result.previewPackSection;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedType('previewPack');
      setTimeout(() => setCopiedType(null), 3000);
    } finally {
      setIsCopying(false);
    }
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

  const handleDownloadMprSnippet = () => {
    const content = `; Map Preview for Red Alert 1 / CnCNet\n; Generated with RA1 PreviewPack Tool\n\n${result.fullIniText}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preview_${result.targetWidth}x${result.targetHeight}.mpr`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const kbSize = (result.compressedByteCount / 1024).toFixed(1);
  const mbSize = (result.compressedByteCount / (1024 * 1024)).toFixed(2);

  return (
    <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl overflow-hidden space-y-0 shadow-2xl">
      {/* Top Action Header */}
      <div className="bg-neutral-950 px-4 py-3 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Terminal className="w-4 h-4 text-red-500" />
          <span className="font-bold text-xs uppercase tracking-wider text-white font-['Rajdhani',sans-serif]">
            Generated Map INI Output
          </span>
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 ${
              lineCount <= 1200
                ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50'
                : lineCount <= 2500
                ? 'text-amber-400 bg-amber-950/60 border-amber-800/50'
                : 'text-red-400 bg-red-950/60 border-red-800/50'
            }`}
          >
            {lineCount.toLocaleString()} Lines
            {lineCount <= 1200 ? ' · Optimal' : lineCount > 2500 ? ' · ⚠️ 23k+ High' : ''}
          </span>
          <span className="text-[11px] font-mono text-neutral-400">
            ({result.compressedByteCount > 1048576 ? `${mbSize} MB` : `${kbSize} KB`})
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopyPreviewPackOnly}
            disabled={isCopying}
            className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
          >
            {copiedType === 'previewPack' ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-400" />
                <span className="text-green-400 font-semibold">
                  Copied {lineCount.toLocaleString()} Lines!
                </span>
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
            disabled={isCopying}
            className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-red-950/40 disabled:opacity-50 active:scale-95"
          >
            {copiedType === 'all' ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Copied All ({lineCount.toLocaleString()} lines)!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy [Preview] + [PreviewPack]</span>
              </>
            )}
          </button>

          {/* Download Buttons */}
          <button
            onClick={handleDownloadIni}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors"
            title="Download as .INI file"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">.INI</span>
          </button>

          <button
            onClick={handleDownloadMprSnippet}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white text-xs font-medium flex items-center gap-1 transition-colors"
            title="Download as .MPR snippet file"
          >
            <FileDown className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">.MPR</span>
          </button>
        </div>
      </div>

      {/* Advisory Bar when lines are high */}
      {lineCount > 2500 && (
        <div className="bg-amber-950/40 border-b border-amber-800/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-2 text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              <strong>Large [PreviewPack] ({lineCount.toLocaleString()} lines · {mbSize} MB):</strong>{' '}
              Official CnCNet / XCC standard is &lt; 257×257 px (~800–1,100 lines). Overly large files slow down lobby player downloads and freeze text editors.
            </span>
          </div>

          {onOptimizeResolution && (
            <button
              onClick={onOptimizeResolution}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5 shrink-0 shadow-md transition-colors"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>Fix: Auto-Fit to &lt; 1,000 Lines</span>
            </button>
          )}
        </div>
      )}

      {/* Code Textarea Viewer with Windowing */}
      <div className="relative">
        <pre className="p-4 bg-neutral-950/90 font-mono text-xs text-neutral-300 overflow-x-auto max-h-[380px] overflow-y-auto leading-relaxed select-all selection:bg-red-900 selection:text-white">
          <code>{displaySnippet}</code>
        </pre>

        {isLarge && (
          <div className="absolute bottom-3 right-4 z-10">
            <button
              onClick={() => setShowFullCode(!showFullCode)}
              className="px-3 py-1 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-700 text-[11px] font-mono text-neutral-300 hover:text-white transition-colors flex items-center gap-1 shadow-md backdrop-blur-sm"
            >
              <Eye className="w-3 h-3 text-cyan-400" />
              <span>
                {showFullCode
                  ? 'Collapse Preview'
                  : `Show All ${lineCount.toLocaleString()} Lines in Viewer`}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Integration Guide Footer */}
      <div className="bg-neutral-950/60 p-3.5 border-t border-neutral-800/80 text-xs text-neutral-400 space-y-1">
        <div className="font-semibold text-neutral-200 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Quick Tip for 20k+ Lines:
        </div>
        <p className="text-[11px] text-neutral-400 leading-relaxed font-mono">
          Because copying 23k+ lines can sometimes strain simple text editors, you can click{' '}
          <strong className="text-cyan-300">Download .INI</strong> or{' '}
          <strong className="text-amber-300">.MPR</strong> above, or use the{' '}
          <span className="text-white font-medium">Map Injector</span> button in the top bar to merge it directly into your map file in 1 second!
        </p>
      </div>
    </div>
  );
};

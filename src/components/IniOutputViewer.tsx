import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  Terminal,
} from 'lucide-react';
import { ConversionResult } from '../types';

interface IniOutputViewerProps {
  result: ConversionResult | null;
  onOptimizeResolution?: () => void;
}

export const IniOutputViewer: React.FC<IniOutputViewerProps> = ({
  result,
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

  return (
    <div className="bg-[#0c0d12] border border-[#2f1015] rounded-2xl p-6 sm:p-7 shadow-[0_4px_25px_rgba(0,0,0,0.7)] space-y-4">
      {/* Header and Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2b0c10] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold font-['Rajdhani',sans-serif] uppercase tracking-wide text-white">
              Ready-to-Paste INI Code
            </h3>
            <span className="text-xs font-mono font-bold text-red-400 bg-red-950/80 border border-red-800/80 px-2 py-0.5 rounded">
              {result.lineCount.toLocaleString()} lines
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            Formatted with authentic [Preview] and [PreviewPack] base64 blocks
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleCopyAll}
            disabled={isCopying}
            className="ra-menu-btn px-4 py-1.5 rounded flex items-center gap-1.5 text-xs font-bold tracking-wider cursor-pointer"
          >
            {copiedType === 'all' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied All!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy All INI</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCopyPreviewPackOnly}
            disabled={isCopying}
            className="px-3 py-1.5 rounded bg-[#161722] hover:bg-[#202230] border border-[#3b1218] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedType === 'previewPack' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>[PreviewPack] Only</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadIni}
            className="px-3 py-1.5 rounded-lg bg-[#0a0b12] hover:bg-slate-100 dark:hover:bg-slate-700 border border-[#33141a] text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Download preview snippet as an .ini file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.INI</span>
          </button>
        </div>
      </div>

      {/* Code Monospace Box */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
        <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            <span>INI Section Output</span>
          </span>
          {isLarge && (
            <button
              type="button"
              onClick={() => setShowFullCode(!showFullCode)}
              className="text-[11px] text-slate-300 hover:text-white underline cursor-pointer"
            >
              {showFullCode ? 'Collapse preview' : 'View full text'}
            </button>
          )}
        </div>

        <pre className="p-4 text-xs font-mono text-emerald-400/90 overflow-x-auto max-h-[300px] leading-relaxed selection:bg-slate-700 selection:text-white">
          <code>{displaySnippet}</code>
        </pre>
      </div>

      {/* Quick Paste Guide */}
      <div className="p-3.5 rounded-xl bg-[#08090f] border border-[#2d0f14] text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-slate-100">How to use:</span>
          <span>Paste these sections anywhere inside your <code className="font-mono text-slate-200 ra-menu-btn border border-slate-200 dark:border-slate-600 px-1 py-0.5 rounded">.mpr</code> or <code className="font-mono text-slate-200 ra-menu-btn border border-slate-200 dark:border-slate-600 px-1 py-0.5 rounded">.ini</code> map file.</span>
        </span>
        <span className="text-[11px] text-slate-400 font-medium">CnCNet & XCC compatible</span>
      </div>
    </div>
  );
};

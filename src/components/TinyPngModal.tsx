import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  FileArchive,
  Upload,
  Download,
  Key,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  getTinyPngApiKey,
  setTinyPngApiKey,
  compressWithTinyPng,
  formatFileSize,
  validateTinyPngApiKey,
  TinyPngResult,
} from '../lib/tinypng';

interface TinyPngModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBlob?: Blob;
  initialFileName?: string;
}

export const TinyPngModal: React.FC<TinyPngModalProps> = ({
  isOpen,
  onClose,
  initialBlob,
  initialFileName,
}) => {
  const [apiKey, setApiKey] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [keyValidationStatus, setKeyValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [keyValidationMessage, setKeyValidationMessage] = useState<string>('');
  const [compressionCount, setCompressionCount] = useState<number | null>(null);

  const [currentFile, setCurrentFile] = useState<File | Blob | null>(null);
  const [fileName, setFileName] = useState<string>('image.png');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [compressionResult, setCompressionResult] = useState<TinyPngResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize API key and initial image if provided
  useEffect(() => {
    if (isOpen) {
      const saved = getTinyPngApiKey();
      setApiKey(saved);
      if (!saved) {
        setShowKeyInput(true);
      }

      if (initialBlob) {
        setCurrentFile(initialBlob);
        setFileName(initialFileName || 'map_render.png');
        const url = URL.createObjectURL(initialBlob);
        setPreviewUrl(url);
        setCompressionResult(null);
        setErrorMessage(null);
      }
    }
  }, [isOpen, initialBlob, initialFileName]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (compressionResult?.compressedUrl) URL.revokeObjectURL(compressionResult.compressedUrl);
    };
  }, [previewUrl, compressionResult]);

  if (!isOpen) return null;

  const handleSaveApiKey = async () => {
    const cleanKey = apiKey.trim();
    setTinyPngApiKey(cleanKey);
    if (!cleanKey) {
      setKeyValidationStatus('invalid');
      setKeyValidationMessage('API key is empty');
      return;
    }

    setKeyValidationStatus('validating');
    setKeyValidationMessage('Testing API key with TinyPNG...');
    const res = await validateTinyPngApiKey(cleanKey);
    if (res.valid) {
      setKeyValidationStatus('valid');
      setKeyValidationMessage(
        res.compressionCount !== undefined
          ? `Key valid! ${res.compressionCount} compressions used this month.`
          : 'Key valid and ready!'
      );
      if (res.compressionCount !== undefined) {
        setCompressionCount(res.compressionCount);
      }
    } else {
      setKeyValidationStatus('invalid');
      setKeyValidationMessage(res.error || 'Failed to validate API key with TinyPNG.');
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!file.type.includes('png') && !file.name.toLowerCase().endsWith('.png')) {
      setErrorMessage('Please select a valid PNG image (*.png).');
      return;
    }
    setErrorMessage(null);
    setCompressionResult(null);
    setCurrentFile(file);
    setFileName(file.name);

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRunCompression = async () => {
    if (!currentFile) {
      setErrorMessage('Please select or drop a PNG image first.');
      return;
    }

    const currentKey = apiKey.trim() || getTinyPngApiKey();
    if (!currentKey) {
      setShowKeyInput(true);
      setErrorMessage('TinyPNG API Key is required. Please enter your free key below.');
      return;
    }

    setIsCompressing(true);
    setErrorMessage(null);

    try {
      const result = await compressWithTinyPng(currentFile, currentKey);
      if (result.success) {
        setCompressionResult(result);
        if (result.compressionCount !== undefined) {
          setCompressionCount(result.compressionCount);
        }
      } else {
        setErrorMessage(result.error || 'TinyPNG compression failed.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCompressing(false);
    }
  };

  const handleDownloadCompressed = () => {
    if (!compressionResult?.compressedBlob) return;
    const cleanName = fileName.replace(/\.[^/.]+$/, '');
    const downloadName = `${cleanName}_tinypng.png`;

    const url = URL.createObjectURL(compressionResult.compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#0c0d12] border border-[#3b0a0a] rounded-2xl shadow-[0_0_50px_rgba(180,0,0,0.4)] overflow-hidden flex flex-col max-h-[92vh] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#2b0808] bg-[#07070a]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-b from-[#8f0808] to-[#3a0000] border-t border-red-500 border-b border-black text-amber-300 shadow-[0_0_12px_rgba(220,38,38,0.4)]">
              <FileArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-['Rajdhani',sans-serif] uppercase tracking-wide">
                  TinyPNG Image Compressor
                </h2>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded font-bold uppercase">
                  Official TinyPNG Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Lossless 24-bit PNG quantization &amp; compression for Red Alert battlefield renders
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a1b26] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-300 flex-1 font-sans">
          {/* API Key Configuration Card */}
          <div className="p-4 rounded-xl bg-[#14080b] border border-[#3b0d13] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-white uppercase tracking-wider font-['Rajdhani',sans-serif]">
                  TinyPNG API Key
                </span>
                {apiKey.trim() ? (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-1.5 py-0.2 rounded font-bold">
                    Connected
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-950/80 border border-amber-800/80 px-1.5 py-0.2 rounded font-bold">
                    Key Required
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowKeyInput((prev) => !prev)}
                className="text-xs font-mono text-slate-400 hover:text-white underline cursor-pointer"
              >
                {showKeyInput ? 'Hide Settings' : 'Change Key'}
              </button>
            </div>

            {/* Explanatory text */}
            <p className="text-[11px] text-slate-400 leading-relaxed">
              TinyPNG requires a developer API key. It is <strong className="text-emerald-400">100% free</strong> and grants <strong className="text-white">500 free image compressions per month</strong> (no credit card required).
            </p>

            {/* Input field if expanded */}
            {showKeyInput && (
              <div className="space-y-2 pt-1 border-t border-[#2d090d]">
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste your TinyPNG API Key here..."
                    className="flex-1 bg-black/80 border border-[#3b0d13] focus:border-red-600 rounded-lg px-3 py-1.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveApiKey}
                    disabled={keyValidationStatus === 'validating'}
                    className="ra-menu-btn px-4 py-1.5 rounded text-xs font-bold cursor-pointer shrink-0"
                  >
                    {keyValidationStatus === 'validating' ? 'Verifying...' : 'Save & Test'}
                  </button>
                </div>

                {keyValidationMessage && (
                  <div
                    className={`text-[11px] font-mono flex items-center gap-1.5 ${
                      keyValidationStatus === 'valid'
                        ? 'text-emerald-400'
                        : keyValidationStatus === 'invalid'
                        ? 'text-red-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {keyValidationStatus === 'valid' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5" />
                    )}
                    <span>{keyValidationMessage}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400 font-mono">
                  <span>Don&rsquo;t have a key yet?</span>
                  <a
                    href="https://tinypng.com/developers"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 hover:text-amber-300 underline flex items-center gap-1"
                  >
                    <span>Get Free TinyPNG Key (500 free/mo)</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {compressionCount !== null && (
              <div className="text-[11px] font-mono text-slate-400">
                Compressions used this month: <strong className="text-white">{compressionCount} / 500</strong>
              </div>
            )}
          </div>

          {/* Upload / Selected Image Card */}
          <div className="p-4 rounded-xl bg-[#0e0f16] border border-[#232536] space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png"
              onChange={handleFileSelected}
              className="hidden"
            />

            {!currentFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#3b1218] hover:border-red-500/80 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-black/40 hover:bg-[#1a080c]/50 group"
              >
                <div className="p-3 rounded-full bg-red-950/80 border border-red-800 text-red-400 group-hover:scale-110 transition-transform mb-2">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="font-bold text-white text-sm">Choose or Drop a *.PNG Image</div>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Select any battlefield render, map screenshot, or graphic to compress with TinyPNG.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-[#232536]">
                  <div>
                    <div className="font-bold text-white text-sm truncate max-w-xs sm:max-w-md">
                      {fileName}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      Original Size: <strong className="text-amber-300">{formatFileSize(currentFile.size)}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-slate-400 hover:text-white underline font-mono cursor-pointer"
                  >
                    Select Another
                  </button>
                </div>

                {/* Previews & Comparison Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  {/* Original */}
                  <div className="p-3 rounded-xl bg-black/60 border border-[#232536] flex flex-col items-center">
                    <div className="text-[11px] font-mono text-slate-400 mb-2 uppercase tracking-wider">
                      Original Image ({formatFileSize(currentFile.size)})
                    </div>
                    {previewUrl && (
                      <div className="w-full h-36 rounded-lg overflow-hidden bg-neutral-950 flex items-center justify-center border border-neutral-800">
                        <img
                          src={previewUrl}
                          alt="Original PNG"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    )}
                  </div>

                  {/* Compressed */}
                  <div className="p-3 rounded-xl bg-black/60 border border-[#232536] flex flex-col items-center">
                    <div className="text-[11px] font-mono text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Compressed Image</span>
                      {compressionResult?.compressedSize && (
                        <span className="text-emerald-400 font-bold">
                          ({formatFileSize(compressionResult.compressedSize)})
                        </span>
                      )}
                    </div>
                    {compressionResult?.compressedUrl ? (
                      <div className="w-full h-36 rounded-lg overflow-hidden bg-neutral-950 flex items-center justify-center border border-emerald-900/60">
                        <img
                          src={compressionResult.compressedUrl}
                          alt="TinyPNG Compressed"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-36 rounded-lg bg-neutral-950/60 border border-dashed border-neutral-800 flex flex-col items-center justify-center text-slate-500 text-xs font-mono p-3 text-center">
                        {isCompressing ? (
                          <div className="flex flex-col items-center gap-2 text-amber-400">
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            <span>Compressing with TinyPNG...</span>
                          </div>
                        ) : (
                          <span>Click &ldquo;Compress with TinyPNG&rdquo; below</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Savings Banner */}
                {compressionResult && (
                  <div className="p-3.5 rounded-xl bg-[#09150d] border border-[#193a23] flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Reduced by {compressionResult.savingsPercent}%! (Saved {formatFileSize(compressionResult.savedBytes)})
                      </span>
                    </div>
                    <div className="text-slate-300">
                      {formatFileSize(compressionResult.originalSize)} &rarr;{' '}
                      <strong className="text-white">{formatFileSize(compressionResult.compressedSize)}</strong>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs font-mono flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleRunCompression}
                    disabled={isCompressing}
                    className="ra-menu-btn flex-1 py-2.5 px-4 rounded text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                  >
                    {isCompressing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                        <span>Compressing via TinyPNG...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>Compress with TinyPNG</span>
                      </>
                    )}
                  </button>

                  {compressionResult?.compressedBlob && (
                    <button
                      type="button"
                      onClick={handleDownloadCompressed}
                      className="px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Compressed PNG</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2b0808] bg-[#07070a] flex items-center justify-between text-xs text-slate-500 font-mono">
          <div>TinyPNG API &bull; 500 Free Compressions/Month &bull; Official Panda Engine</div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-[#161722] hover:bg-[#202230] border border-[#3b1218] text-slate-300 hover:text-white text-xs font-mono cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

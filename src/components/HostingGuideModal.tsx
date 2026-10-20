import React, { useState } from 'react';
import { X, Globe, Github, Sparkles, Check, Copy, ExternalLink, ShieldCheck, Zap } from 'lucide-react';

interface HostingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HostingGuideModal: React.FC<HostingGuideModalProps> = ({ isOpen, onClose }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedGit, setCopiedGit] = useState(false);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // fallback
    }
  };

  const gitCommands = `# 1. Initialize git (if not already done)
git init
git add .
git commit -m "feat: Red Alert 1 PreviewPack Generator"

# 2. Add your GitHub repository remote
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git
git push -u origin main`;

  const handleCopyGit = async () => {
    try {
      await navigator.clipboard.writeText(gitCommands);
      setCopiedGit(true);
      setTimeout(() => setCopiedGit(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-['Rajdhani',sans-serif] tracking-wide">
                Free Hosting & Sharing Guide
              </h2>
              <p className="text-xs text-neutral-400">
                How to share this tool with the Red Alert 1 / CnCNet community for free
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

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-xs text-neutral-300">
          {/* Quick Comparison Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="font-bold text-sm text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Publishing in AI Studio</span>
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold font-mono">
                ⚡ Fastest · Zero Configuration
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Click the <strong>Publish / Share</strong> button in the top bar of AI Studio. You get a direct, permanent public URL in 5 seconds.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
              <div className="font-bold text-sm text-white flex items-center gap-1.5">
                <Github className="w-4 h-4 text-cyan-400" />
                <span>GitHub Pages</span>
              </div>
              <div className="text-[11px] text-cyan-400 font-semibold font-mono">
                🌐 Permanent · Open Source · Free
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Hosts on <code className="text-white">username.github.io/repo</code>. 100% free forever, supports custom domains, and never sleeps.
              </p>
            </div>
          </div>

          {/* Option 1: AI Studio Direct Sharing */}
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 space-y-3">
            <div className="text-sm font-bold text-amber-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                Method 1: Direct Link (Already Live!)
              </span>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-700/50">
                100% Free
              </span>
            </div>
            <p className="text-neutral-300 text-xs leading-relaxed">
              This app is already running live on Google Cloud. You can share this URL with any Red Alert player right away:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={currentUrl}
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono text-neutral-300 select-all"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 transition-colors shrink-0"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Option 2: GitHub Pages Step-by-Step */}
          <div className="space-y-3 border-t border-neutral-800 pt-4">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Github className="w-4 h-4 text-cyan-400" />
              Method 2: How to Host on GitHub Pages (Step-by-Step)
            </div>
            <p className="text-neutral-300 leading-relaxed">
              We have already configured <code className="text-amber-400 font-mono">base: './'</code> in <code className="text-neutral-400 font-mono">vite.config.ts</code> and created the automated deployment workflow in <code className="text-emerald-400 font-mono">.github/workflows/deploy.yml</code>!
            </p>

            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                <span className="w-5 h-5 rounded-full bg-neutral-800 text-white font-mono text-xs flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <strong className="text-white block mb-0.5">Create a GitHub Repository</strong>
                  <span className="text-neutral-400 text-[11px]">
                    Go to <a href="https://github.com/new" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">github.com/new</a> and create a new repository (e.g., <code className="text-neutral-200">ra1-map-preview</code>). Keep it Public for free GitHub Pages.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                <span className="w-5 h-5 rounded-full bg-neutral-800 text-white font-mono text-xs flex items-center justify-center shrink-0">
                  2
                </span>
                <div className="w-full space-y-2">
                  <strong className="text-white block mb-0.5">Push your code</strong>
                  <div className="relative">
                    <pre className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-lg font-mono text-[11px] text-neutral-300 overflow-x-auto">
                      <code>{gitCommands}</code>
                    </pre>
                    <button
                      type="button"
                      onClick={handleCopyGit}
                      className="absolute top-2 right-2 px-2 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-[10px] font-mono text-neutral-200 flex items-center gap-1 transition-colors"
                    >
                      {copiedGit ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedGit ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-950 border border-neutral-800">
                <span className="w-5 h-5 rounded-full bg-neutral-800 text-white font-mono text-xs flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  <strong className="text-white block mb-0.5">Enable GitHub Actions in Pages Settings</strong>
                  <span className="text-neutral-400 text-[11px] leading-relaxed block">
                    In your GitHub repo, go to <strong>Settings</strong> → <strong>Pages</strong> (in the left sidebar).
                    Under <strong>Build and deployment → Source</strong>, select <strong className="text-emerald-400">GitHub Actions</strong>.
                  </span>
                  <span className="text-[11px] text-emerald-400 mt-1 block">
                    ✓ The included GitHub Action will automatically build and publish your site at <code className="text-white font-mono">https://&lt;username&gt;.github.io/&lt;repo&gt;/</code>!
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

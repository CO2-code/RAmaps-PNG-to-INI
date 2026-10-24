import React from 'react';
import { FolderKanban, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  onOpenResearch: () => void;
  onOpenDecoder: () => void;
  onOpenInjector: () => void;
  onOpenMprToPng: () => void;
  onOpenBatch: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenResearch,
  onOpenDecoder,
  onOpenInjector,
  onOpenMprToPng,
  onOpenBatch,
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-xs font-bold text-xs tracking-wider font-['Orbitron',sans-serif]">
            RA1
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white text-base tracking-tight font-['Rajdhani',sans-serif]">
                RED ALERT 1 <span className="text-red-600">MAP STUDIO</span>
              </span>
              <span className="hidden sm:inline-flex items-center text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded">
                v1.0
              </span>
            </div>
            <span className="hidden md:inline text-[11px] text-slate-500 dark:text-slate-400 font-normal">
              LZO TrueColor & LCW PreviewPack Generator
            </span>
          </div>
        </div>

        {/* Minimal text links & Clean Theme Toggle */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={onOpenMprToPng}
            className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2.5 py-1.5 rounded-md hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Battlefield View
          </button>

          <button
            type="button"
            onClick={onOpenDecoder}
            className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2.5 py-1.5 rounded-md hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Decode INI
          </button>

          <button
            type="button"
            onClick={onOpenInjector}
            className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2.5 py-1.5 rounded-md hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Map Injector
          </button>

          <button
            type="button"
            onClick={onOpenResearch}
            className="hidden lg:inline-flex text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2.5 py-1.5 rounded-md hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Docs
          </button>

          {/* Theme switcher toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors cursor-pointer ml-1"
            title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Slate Theme'}
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>

          {/* Solid Call-To-Action Button */}
          <div className="ml-1 pl-1.5 border-l border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onOpenBatch}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-slate-900 dark:bg-red-600 hover:bg-slate-800 dark:hover:bg-red-700 text-white text-xs sm:text-sm font-medium shadow-xs transition-all cursor-pointer"
            >
              <FolderKanban className="w-4 h-4 text-amber-400 dark:text-white" />
              <span>Batch Studio</span>
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
};

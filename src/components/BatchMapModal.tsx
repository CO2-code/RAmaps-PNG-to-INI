import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  FolderOpen,
  Files,
  Sparkles,
  Download,
  CheckCircle,
  AlertCircle,
  Play,
  RotateCcw,
  Sliders,
  Check,
  ShieldCheck,
  FileCode,
  Archive,
  Image as ImageIcon,
  Zap,
  AlertTriangle,
  UserCheck,
  Wrench,
  Tag,
  StopCircle,
} from 'lucide-react';
import { zipSync } from 'fflate';
import { parseMprMap, MprMapData, renderMprToCanvas } from '../lib/mprParser';
import { renderMprOriginalAssets, preloadMapAssets } from '../lib/raOriginalRenderer';
import { convertImageToPreviewPack, injectPreviewIntoMapFile, stripPreviewFromMapFile } from '../lib/formatters';
import { compressWithTinyPng, getTinyPngApiKey, formatFileSize } from '../lib/tinypng';
import { TinyPngModal } from './TinyPngModal';
import {
  MapCategory,
  CATEGORIES,
  stripCategoryPrefixFromName,
  stripCategoryPrefixFromFilename,
  detectCategory,
  extractAuthorFromMapName,
  sanitizeWindowsFilename,
  updateIniBasicSection,
  resolveBatchFilenames,
  BasicSectionUpdates,
  parseBasicSection,
} from '../lib/iniModifier';

export interface BatchMapItem {
  id: string;
  file: File;
  name: string; // original filename (e.g. "river_raid.mpr")
  content: string; // original file text
  parsed: MprMapData | null;
  parseError?: string;
  hasExistingPreview: boolean;
  existingPreviewLines: number;
  existingPreviewIs23k: boolean;
  status: 'idle' | 'processing' | 'done' | 'error' | 'skipped';
  errorMessage?: string;
  resultMprText?: string;
  resultPngBlob?: Blob;
  resultPngDataUrl?: string;
  linesGenerated?: number;

  // Prepare Maps attributes
  initialMapName: string;
  editedMapName: string; // Cleaned title without category prefix
  initialAuthor: string;
  editedAuthor: string;
  category: MapCategory;
  outputFilename: string; // Live updated unique Windows-safe filename
}

export type BatchAction = 'prepare_maps' | 'inject_previews' | 'render_pngs' | 'strip_previews';

interface BatchMapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BatchMapModal: React.FC<BatchMapModalProps> = ({ isOpen, onClose }) => {
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const filesInputRef = useRef<HTMLInputElement | null>(null);
  const progressCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cancelRef = useRef<boolean>(false);

  const [items, setItems] = useState<BatchMapItem[]>([]);
  const [selectedAction, setSelectedAction] = useState<BatchAction>('prepare_maps');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentMapName, setCurrentMapName] = useState<string>('');
  const [isComplete, setIsComplete] = useState<boolean>(false);

  // --- Prepare Maps Settings ---
  const [categoryNamingEnabled, setCategoryNamingEnabled] = useState<boolean>(true);
  const [bulkCategory, setBulkCategory] = useState<MapCategory | 'auto'>('auto');
  const [updateMapName, setUpdateMapName] = useState<boolean>(true);
  const [updateAuthor, setUpdateAuthor] = useState<boolean>(true);
  const [autoExtractAuthorOnLoad, setAutoExtractAuthorOnLoad] = useState<boolean>(true);
  const [updateGameMode, setUpdateGameMode] = useState<boolean>(false);
  const [gameModeValue, setGameModeValue] = useState<string>('Custom');
  const [updateMaxPlayer, setUpdateMaxPlayer] = useState<boolean>(false);
  const [maxPlayerValue, setMaxPlayerValue] = useState<number>(2);
  const [updateMinPlayer, setUpdateMinPlayer] = useState<boolean>(false);
  const [minPlayerValue, setMinPlayerValue] = useState<number>(1);
  const [injectPreviewsInPrepare, setInjectPreviewsInPrepare] = useState<boolean>(true);
  const [prepareInjectFormat, setPrepareInjectFormat] = useState<'cncnet_lzo_24bit' | 'lcw_8bit'>('cncnet_lzo_24bit');
  const [prepareInjectSize, setPrepareInjectSize] = useState<number>(256);
  const [exportPngInPrepare, setExportPngInPrepare] = useState<boolean>(true);

  // --- Inject Previews Settings (Standard action) ---
  const [injectFormat, setInjectFormat] = useState<'cncnet_lzo_24bit' | 'lcw_8bit'>('cncnet_lzo_24bit');
  const [injectSize, setInjectSize] = useState<number>(256);
  const [alsoExportPng, setAlsoExportPng] = useState<boolean>(true);

  // --- Render PNGs Settings (Standard action) ---
  const [renderEngine, setRenderEngine] = useState<'original' | 'vector'>('original');
  const [renderScale, setRenderScale] = useState<number>(1.0);
  const [cropBounds, setCropBounds] = useState<boolean>(true);
  const [showOre, setShowOre] = useState<boolean>(true);
  const [showWalls, setShowWalls] = useState<boolean>(true);
  const [showStructures, setShowStructures] = useState<boolean>(true);
  const [showSpawns, setShowSpawns] = useState<boolean>(true);

  // --- TinyPNG Batch Compression Settings ---
  const [batchTinyPngCompress, setBatchTinyPngCompress] = useState<boolean>(true);
  const [isTinyPngModalOpen, setIsTinyPngModalOpen] = useState<boolean>(false);
  const [batchTinyPngSavedBytes, setBatchTinyPngSavedBytes] = useState<number>(0);
  const [batchTinyPngCompressedCount, setBatchTinyPngCompressedCount] = useState<number>(0);

  // Helper to recalculate unique Windows-safe output filenames for all items
  const recalculateFilenames = (list: BatchMapItem[], catEnabled: boolean): BatchMapItem[] => {
    const rawList = list.map((item) => {
      const extMatch = item.name.match(/\.[^/.]+$/);
      const ext = extMatch ? extMatch[0] : '.mpr';

      const baseName = item.editedMapName.trim() || item.name.replace(/\.[^/.]+$/, '');
      const stripped = stripCategoryPrefixFromName(baseName);
      const sanitized = sanitizeWindowsFilename(stripped);

      let proposedBase = sanitized;
      if (catEnabled && item.category !== 'none') {
        proposedBase = `${CATEGORIES[item.category].filePrefix}${sanitized}`;
      }

      return {
        id: item.id,
        proposedBase,
        extension: ext,
      };
    });

    const uniqueMap = resolveBatchFilenames(rawList);

    return list.map((item) => ({
      ...item,
      outputFilename: uniqueMap.get(item.id) || item.name,
    }));
  };

  // Recalculate filenames when categoryNamingEnabled toggles
  const handleToggleCategoryNaming = (enabled: boolean) => {
    setCategoryNamingEnabled(enabled);
    setItems((prev) => recalculateFilenames(prev, enabled));
  };

  // Update a single item's name or author or category
  const handleUpdateItemField = (id: string, field: 'editedMapName' | 'editedAuthor' | 'category', value: string) => {
    setItems((prev) => {
      const updated = prev.map((item) => {
        if (item.id !== id) return item;
        if (field === 'category') {
          return { ...item, category: value as MapCategory };
        }
        return { ...item, [field]: value };
      });
      return recalculateFilenames(updated, categoryNamingEnabled);
    });
  };

  // Apply a bulk category to all loaded maps
  const handleApplyBulkCategory = (cat: MapCategory) => {
    setItems((prev) => {
      const updated = prev.map((item) => ({
        ...item,
        category: cat,
      }));
      return recalculateFilenames(updated, categoryNamingEnabled);
    });
  };

  // Auto-extract "by Author" from map names for all items
  const handleExtractAuthors = () => {
    let extractedCount = 0;
    setItems((prev) => {
      const updated = prev.map((item) => {
        const { cleanName, extractedAuthor } = extractAuthorFromMapName(item.editedMapName);
        if (extractedAuthor) {
          extractedCount++;
          return {
            ...item,
            editedMapName: cleanName,
            editedAuthor: extractedAuthor,
          };
        }
        return item;
      });
      return recalculateFilenames(updated, categoryNamingEnabled);
    });
  };

  // File loading handler
  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const mapFiles = Array.from(fileList).filter((f) => {
      const name = f.name.toLowerCase();
      return name.endsWith('.mpr') || name.endsWith('.ini') || name.endsWith('.map');
    });

    if (mapFiles.length === 0) {
      alert('No .mpr or .ini map files found in selected folder.');
      return;
    }

    const newItems: BatchMapItem[] = [];

    for (let i = 0; i < mapFiles.length; i++) {
      const file = mapFiles[i];
      try {
        const text = await file.text();
        const parsed = parseMprMap(text);
        const basicData = parseBasicSection(text);

        // Detect existing preview
        const hasPreviewPack = text.toLowerCase().includes('[previewpack]');
        let existingPreviewLines = 0;
        if (hasPreviewPack) {
          const match = text.match(/\[PreviewPack\]([\s\S]*?)(?=\n\[|$)/i);
          if (match) {
            existingPreviewLines = match[1].split(/\r?\n/).filter((l) => l.trim().length > 0).length;
          }
        }

        // Determine initial name & author
        const rawName = basicData.name || (parsed ? parsed.title : file.name.replace(/\.[^/.]+$/, ''));
        const initialAuthor = basicData.author || '';

        // Strip existing category prefix from name so it does not accumulate
        let cleanName = stripCategoryPrefixFromName(rawName);
        let extractedAuthor = initialAuthor;

        // Optional author extraction on load
        if (autoExtractAuthorOnLoad && !initialAuthor) {
          const authorExt = extractAuthorFromMapName(cleanName);
          if (authorExt.extractedAuthor) {
            cleanName = authorExt.cleanName;
            extractedAuthor = authorExt.extractedAuthor;
          }
        }

        // Detect or infer category
        let detectedCat = detectCategory(rawName, file.name);
        if (detectedCat === 'none' && parsed) {
          if (parsed.playerSpawnCount === 2) detectedCat = '1v1';
          else if (parsed.playerSpawnCount === 3 || parsed.playerSpawnCount === 4) detectedCat = '2v2';
          else if (parsed.playerSpawnCount === 5 || parsed.playerSpawnCount === 6) detectedCat = '3v3';
          else if (parsed.playerSpawnCount >= 7) detectedCat = '4v4';
        }

        newItems.push({
          id: `${file.name}_${i}_${Date.now()}`,
          file,
          name: file.name,
          content: text,
          parsed,
          hasExistingPreview: hasPreviewPack,
          existingPreviewLines,
          existingPreviewIs23k: existingPreviewLines > 5000,
          status: 'idle',
          initialMapName: rawName,
          editedMapName: cleanName,
          initialAuthor,
          editedAuthor: extractedAuthor,
          category: detectedCat,
          outputFilename: file.name,
        });
      } catch (err: any) {
        newItems.push({
          id: `${file.name}_${i}_${Date.now()}`,
          file,
          name: file.name,
          content: '',
          parsed: null,
          parseError: err?.message || 'Failed to parse map file',
          hasExistingPreview: false,
          existingPreviewLines: 0,
          existingPreviewIs23k: false,
          status: 'error',
          errorMessage: 'Invalid map file format',
          initialMapName: file.name,
          editedMapName: file.name,
          initialAuthor: '',
          editedAuthor: '',
          category: 'none',
          outputFilename: file.name,
        });
      }
    }

    const itemsWithFilenames = recalculateFilenames(newItems, categoryNamingEnabled);
    setItems(itemsWithFilenames);
    setIsComplete(false);
    setCurrentIndex(0);
  };

  // Run the batch execution
  const handleStartBatch = async () => {
    if (items.length === 0 || isProcessing) return;

    // Validation checks
    const hasEmptyName = items.some((item) => item.parsed && !item.editedMapName.trim());
    if (hasEmptyName && (selectedAction === 'prepare_maps' && updateMapName)) {
      alert('One or more maps have an empty Map Name. Please enter a valid name for each map.');
      return;
    }

    if (updateMinPlayer && updateMaxPlayer && minPlayerValue > maxPlayerValue) {
      alert('MinPlayer cannot be greater than MaxPlayer.');
      return;
    }

    setIsProcessing(true);
    cancelRef.current = false;
    setIsComplete(false);
    setBatchTinyPngSavedBytes(0);
    setBatchTinyPngCompressedCount(0);

    const updated = [...items];

    for (let i = 0; i < updated.length; i++) {
      if (cancelRef.current) {
        // Mark all remaining un-processed items as skipped
        for (let j = i; j < updated.length; j++) {
          if (updated[j].status === 'idle') {
            updated[j].status = 'skipped';
          }
        }
        setItems([...updated]);
        break;
      }

      const item = updated[i];
      if (!item.parsed) {
        item.status = 'error';
        item.errorMessage = item.parseError || 'Could not parse map file';
        setItems([...updated]);
        continue;
      }

      setCurrentIndex(i);
      setCurrentMapName(item.name);
      item.status = 'processing';
      setItems([...updated]);

      try {
        const map = item.parsed;
        let currentMapContent = item.content;

        // === ACTION 1: PREPARE MAPS ===
        if (selectedAction === 'prepare_maps') {
          // 1. Build metadata updates
          const updates: BasicSectionUpdates = {};

          if (updateMapName) {
            const cleanTitle = stripCategoryPrefixFromName(item.editedMapName);
            const prefix = categoryNamingEnabled ? CATEGORIES[item.category].namePrefix : '';
            updates.name = `${prefix}${cleanTitle}`.trim();
          }

          if (updateAuthor && item.editedAuthor.trim().length > 0) {
            updates.author = item.editedAuthor.trim();
          }

          if (updateGameMode) {
            updates.gameMode = gameModeValue.trim() || 'Custom';
          }

          if (updateMaxPlayer) {
            updates.maxPlayer = maxPlayerValue;
          }

          if (updateMinPlayer) {
            updates.minPlayer = minPlayerValue;
          }

          // Apply non-destructive INI modifications to [Basic]
          currentMapContent = updateIniBasicSection(currentMapContent, updates);

          // 2. Optional Preview Injection in Prepare Maps
          if (injectPreviewsInPrepare) {
            const offCanvas = document.createElement('canvas');
            try {
              await preloadMapAssets(map);
              await renderMprOriginalAssets(
                map,
                {
                  onlyDrawVisible: true,
                  showWaypoints: true,
                  showOre: true,
                  showWalls: true,
                  showStructures: true,
                  scaleMultiplier: 1.0,
                },
                offCanvas
              );
            } catch (renderErr) {
              console.warn('Asset render fallback to vector in Prepare Maps:', renderErr);
              renderMprToCanvas(
                map,
                {
                  cellSize: 4,
                  showOre: true,
                  showWalls: true,
                  showStructures: true,
                  showWaypoints: true,
                  showGrid: false,
                  onlyDrawVisible: true,
                },
                offCanvas
              );
            }

            // Blit to visual mini-canvas for feedback
            if (progressCanvasRef.current && offCanvas.width > 0 && offCanvas.height > 0) {
              progressCanvasRef.current.width = 160;
              progressCanvasRef.current.height = 160;
              const pCtx = progressCanvasRef.current.getContext('2d');
              if (pCtx) {
                pCtx.imageSmoothingEnabled = false;
                pCtx.drawImage(offCanvas, 0, 0, 160, 160);
              }
            }

            const previewResult = convertImageToPreviewPack(offCanvas, {
              width: prepareInjectSize,
              height: prepareInjectSize,
              palette: map.theater === 'snow' ? 'snow' : 'temperat',
              encoding: prepareInjectFormat,
              lineLength: 70,
              includePreviewSection: true,
              colorNoiseReduction: true,
              targetLineBudget: 1000,
              dithering: false,
              compressionOptimization: 'balanced',
              maintainAspectRatio: true,
            });

            currentMapContent = injectPreviewIntoMapFile(currentMapContent, previewResult.fullIniText);
            item.linesGenerated = previewResult.lineCount;

            if (exportPngInPrepare) {
              const blob = await new Promise<Blob | null>((resolve) => offCanvas.toBlob(resolve, 'image/png'));
              if (blob) {
                let finalBlob = blob;
                const apiKey = getTinyPngApiKey();
                if (batchTinyPngCompress && apiKey) {
                  try {
                    const compressed = await compressWithTinyPng(blob, apiKey);
                    if (compressed.success && compressed.compressedBlob) {
                      finalBlob = compressed.compressedBlob;
                      setBatchTinyPngSavedBytes((prev) => prev + compressed.savedBytes);
                      setBatchTinyPngCompressedCount((prev) => prev + 1);
                    }
                  } catch (cErr) {
                    console.warn('TinyPNG batch error for item:', cErr);
                  }
                }
                item.resultPngBlob = finalBlob;
                item.resultPngDataUrl = offCanvas.toDataURL('image/png');
              }
            }
          }

          item.resultMprText = currentMapContent;
          item.status = 'done';
        }

        // === ACTION 2: INJECT PREVIEWS ===
        else if (selectedAction === 'inject_previews') {
          const offCanvas = document.createElement('canvas');
          try {
            await preloadMapAssets(map);
            await renderMprOriginalAssets(
              map,
              {
                onlyDrawVisible: cropBounds,
                showWaypoints: showSpawns,
                showOre,
                showWalls,
                showStructures,
                scaleMultiplier: 1.0,
              },
              offCanvas
            );
          } catch (err) {
            renderMprToCanvas(
              map,
              {
                cellSize: 4,
                showOre,
                showWalls,
                showStructures,
                showWaypoints: showSpawns,
                showGrid: false,
                onlyDrawVisible: cropBounds,
              },
              offCanvas
            );
          }

          if (progressCanvasRef.current && offCanvas.width > 0 && offCanvas.height > 0) {
            progressCanvasRef.current.width = 160;
            progressCanvasRef.current.height = 160;
            const pCtx = progressCanvasRef.current.getContext('2d');
            if (pCtx) {
              pCtx.imageSmoothingEnabled = false;
              pCtx.drawImage(offCanvas, 0, 0, 160, 160);
            }
          }

          const previewResult = convertImageToPreviewPack(offCanvas, {
            width: injectSize,
            height: injectSize,
            palette: map.theater === 'snow' ? 'snow' : 'temperat',
            encoding: injectFormat,
            lineLength: 70,
            includePreviewSection: true,
            colorNoiseReduction: true,
            targetLineBudget: 1000,
            dithering: false,
            compressionOptimization: 'balanced',
            maintainAspectRatio: true,
          });

          const mergedText = injectPreviewIntoMapFile(item.content, previewResult.fullIniText);
          item.resultMprText = mergedText;
          item.linesGenerated = previewResult.lineCount;

          if (alsoExportPng) {
            const blob = await new Promise<Blob | null>((resolve) => offCanvas.toBlob(resolve, 'image/png'));
            if (blob) {
              item.resultPngBlob = blob;
              item.resultPngDataUrl = offCanvas.toDataURL('image/png');
            }
          }
          item.status = 'done';
        }

        // === ACTION 3: RENDER PNGS ===
        else if (selectedAction === 'render_pngs') {
          const offCanvas = document.createElement('canvas');
          if (renderEngine === 'original') {
            try {
              await preloadMapAssets(map);
              await renderMprOriginalAssets(
                map,
                {
                  onlyDrawVisible: cropBounds,
                  showWaypoints: showSpawns,
                  showOre,
                  showWalls,
                  showStructures,
                  scaleMultiplier: renderScale,
                },
                offCanvas
              );
            } catch (err) {
              renderMprToCanvas(
                map,
                {
                  cellSize: Math.round(24 * renderScale),
                  showOre,
                  showWalls,
                  showStructures,
                  showWaypoints: showSpawns,
                  showGrid: false,
                  onlyDrawVisible: cropBounds,
                },
                offCanvas
              );
            }
          } else {
            renderMprToCanvas(
              map,
              {
                cellSize: Math.round(24 * renderScale),
                showOre,
                showWalls,
                showStructures,
                showWaypoints: showSpawns,
                showGrid: false,
                onlyDrawVisible: cropBounds,
              },
              offCanvas
            );
          }

          const blob = await new Promise<Blob | null>((resolve) => offCanvas.toBlob(resolve, 'image/png'));
          if (blob) {
            let finalBlob = blob;
            const apiKey = getTinyPngApiKey();
            if (batchTinyPngCompress && apiKey) {
              try {
                const compressed = await compressWithTinyPng(blob, apiKey);
                if (compressed.success && compressed.compressedBlob) {
                  finalBlob = compressed.compressedBlob;
                  setBatchTinyPngSavedBytes((prev) => prev + compressed.savedBytes);
                  setBatchTinyPngCompressedCount((prev) => prev + 1);
                }
              } catch (cErr) {
                console.warn('TinyPNG batch render error:', cErr);
              }
            }
            item.resultPngBlob = finalBlob;
            item.resultPngDataUrl = offCanvas.toDataURL('image/png');
          }
          item.status = 'done';
        }

        // === ACTION 4: STRIP PREVIEWS ===
        else if (selectedAction === 'strip_previews') {
          const stripped = stripPreviewFromMapFile(item.content);
          item.resultMprText = stripped;
          item.status = 'done';
        }
      } catch (err: any) {
        console.error(`Error processing map ${item.name}:`, err);
        item.status = 'error';
        item.errorMessage = err?.message || 'Failed to process';
      }

      setItems([...updated]);
      // Small pause to allow UI repaint
      await new Promise((r) => setTimeout(r, 10));
    }

    setIsProcessing(false);
    setIsComplete(true);
  };

  // Safe Backups and Clean ZIP Packaging
  const handleDownloadAllZip = async () => {
    const zipFiles: Record<string, Uint8Array> = {};
    const usedBackupPaths = new Set<string>();

    // 1. Safe Backup of All Original Input Files (even failed or skipped)
    for (const item of items) {
      try {
        const rawBuf = await item.file.arrayBuffer();
        let backupPath = `backup/originals/${item.name}`;
        let counter = 2;
        while (usedBackupPaths.has(backupPath.toLowerCase())) {
          const extMatch = item.name.match(/\.[^/.]+$/);
          const ext = extMatch ? extMatch[0] : '';
          const base = item.name.replace(/\.[^/.]+$/, '');
          backupPath = `backup/originals/${base}_${counter}${ext}`;
          counter++;
        }
        usedBackupPaths.add(backupPath.toLowerCase());
        zipFiles[backupPath] = new Uint8Array(rawBuf);
      } catch (err) {
        console.warn(`Could not read original file ${item.name} for backup:`, err);
      }
    }

    // 2. Processed Maps & Companion Previews
    for (const item of items) {
      if (item.status !== 'done') continue;

      const outFilename = item.outputFilename || item.name;
      const baseName = outFilename.replace(/\.[^/.]+$/, '');

      // Injected / modified map file
      if (item.resultMprText) {
        zipFiles[`maps/${outFilename}`] = new TextEncoder().encode(item.resultMprText);
      }

      // Generated preview PNG
      if (item.resultPngBlob) {
        const buf = await item.resultPngBlob.arrayBuffer();
        zipFiles[`previews/${baseName}.png`] = new Uint8Array(buf);
      }
    }

    // 3. summary.json manifest
    const summary = {
      app: 'Red Alert 1 PNG to INI Map Studio',
      workflow: selectedAction,
      processedAt: new Date().toISOString(),
      options: {
        categoryNamingEnabled,
        updateMapName,
        updateAuthor,
        updateGameMode,
        gameMode: updateGameMode ? gameModeValue : undefined,
        updateMaxPlayer,
        maxPlayer: updateMaxPlayer ? maxPlayerValue : undefined,
        updateMinPlayer,
        minPlayer: updateMinPlayer ? minPlayerValue : undefined,
        injectPreviewsInPrepare: selectedAction === 'prepare_maps' ? injectPreviewsInPrepare : undefined,
      },
      statistics: {
        totalMaps: items.length,
        successful: items.filter((i) => i.status === 'done').length,
        errors: items.filter((i) => i.status === 'error').length,
        skipped: items.filter((i) => i.status === 'skipped').length,
      },
      files: items.map((i) => ({
        originalFilename: i.name,
        outputFilename: i.outputFilename,
        mapTitle: updateMapName
          ? (categoryNamingEnabled ? CATEGORIES[i.category].namePrefix + stripCategoryPrefixFromName(i.editedMapName) : i.editedMapName)
          : i.initialMapName,
        author: updateAuthor ? i.editedAuthor : i.initialAuthor,
        category: i.category,
        status: i.status,
        errorMessage: i.errorMessage || null,
        previewLinesGenerated: i.linesGenerated || null,
      })),
    };

    zipFiles['summary.json'] = new TextEncoder().encode(JSON.stringify(summary, null, 2));

    const zipped = zipSync(zipFiles);
    const zipBlob = new Blob([zipped], { type: 'application/zip' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RA1_${selectedAction}_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download individual processed map
  const handleDownloadSingleMpr = (item: BatchMapItem) => {
    if (!item.resultMprText) return;
    const blob = new Blob([item.resultMprText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.outputFilename || item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download individual rendered PNG
  const handleDownloadSinglePng = (item: BatchMapItem) => {
    if (!item.resultPngBlob) return;
    const baseName = (item.outputFilename || item.name).replace(/\.[^/.]+$/, '');
    const url = URL.createObjectURL(item.resultPngBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const processedCount = items.filter((i) => i.status === 'done').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const skippedCount = items.filter((i) => i.status === 'skipped').length;
  const progressPct = items.length > 0 ? Math.round(((currentIndex + 1) / items.length) * 100) : 0;

  // Validation warning state
  const hasEmptyMapName = useMemo(() => {
    if (selectedAction !== 'prepare_maps' || !updateMapName) return false;
    return items.some((i) => i.parsed && !i.editedMapName.trim());
  }, [items, selectedAction, updateMapName]);

  const hasInvalidPlayerCount = useMemo(() => {
    if (selectedAction !== 'prepare_maps') return false;
    if (updateMinPlayer && updateMaxPlayer && minPlayerValue > maxPlayerValue) return true;
    if (updateMinPlayer && minPlayerValue < 1) return true;
    if (updateMaxPlayer && maxPlayerValue < 1) return true;
    return false;
  }, [selectedAction, updateMinPlayer, updateMaxPlayer, minPlayerValue, maxPlayerValue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-6xl bg-[#0c0d12] border border-[#3b0a0a] rounded-2xl shadow-[0_0_50px_rgba(180,0,0,0.4)] overflow-hidden flex flex-col max-h-[94vh] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#2b0808] bg-[#07070a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-950/80 border border-red-800/80 flex items-center justify-center text-red-500 shadow-xs">
              <Files className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-['Rajdhani',sans-serif] uppercase tracking-wide text-white">
                  RAnderer <span className="text-red-500 font-mono text-xs font-semibold">2.0</span> &mdash; Batch Map Studio
                </h2>
                <span className="text-[10px] font-mono uppercase bg-red-950/80 border border-red-800/80 text-red-300 px-1.5 py-0.2 rounded font-bold">
                  Folder &amp; File Processor
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Batch prepare RA1 maps, edit <code className="text-amber-400 font-mono">[Basic]</code> metadata, apply category naming, extract authors, inject previews, and download safe ZIP backups
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#1a1b26] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Step 1: Select Map Folder or Files */}
          {items.length === 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Option A: Select Entire Folder */}
                <div
                  onClick={() => folderInputRef.current?.click()}
                  className="border border-slate-200 dark:border-slate-800 hover:border-emerald-500/80 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-50/90 dark:hover:bg-slate-800/70 transition-all space-y-3 group"
                >
                  <input
                    ref={folderInputRef}
                    type="file"
                    // @ts-ignore
                    webkitdirectory=""
                    directory=""
                    multiple
                    className="hidden"
                    onChange={(e) => handleFilesSelected(e.target.files)}
                  />
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 mx-auto flex items-center justify-center group-hover:scale-105 transition-transform text-emerald-600 dark:text-emerald-400">
                    <FolderOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                      Select Map Folder
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Choose any folder containing <code className="text-amber-600 dark:text-amber-400 font-mono">.mpr</code> or <code className="text-amber-600 dark:text-amber-400 font-mono">.ini</code> maps
                    </p>
                  </div>
                  <span className="inline-block text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-700/50 px-2.5 py-1 rounded-full">
                    Recommended for 10–100+ Maps
                  </span>
                </div>

                {/* Option B: Select Specific Files */}
                <div
                  onClick={() => filesInputRef.current?.click()}
                  className="border border-slate-200 dark:border-slate-800 hover:border-cyan-500/80 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/60 dark:bg-slate-800/40 hover:bg-slate-50/90 dark:hover:bg-slate-800/70 transition-all space-y-3 group"
                >
                  <input
                    ref={filesInputRef}
                    type="file"
                    accept=".mpr,.ini,.map"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFilesSelected(e.target.files)}
                  />
                  <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/60 mx-auto flex items-center justify-center group-hover:scale-105 transition-transform text-cyan-600 dark:text-cyan-400">
                    <Files className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                      Select Multiple Map Files
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Pick individual <code className="text-cyan-600 dark:text-cyan-400 font-mono">.mpr</code> files from anywhere on your PC
                    </p>
                  </div>
                  <span className="inline-block text-[10px] font-mono font-bold text-cyan-800 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200 dark:border-cyan-700/50 px-2.5 py-1 rounded-full">
                    Multi-File Picker
                  </span>
                </div>
              </div>

              {/* Information banner about Prepare Maps & Safe Backups */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white">Complete Client-Side Map Preparation &amp; Safe Backups</div>
                  <p className="leading-relaxed">
                    The <strong>Prepare Maps</strong> workflow ports the functionality of legacy RA1 Map tools directly into modern client-side TypeScript.
                    Clean up filenames, add <code>[2]</code> / <code>2_</code> category tags, extract author credits, update <code>[Basic]</code> INI rules, and auto-inject lightweight CnCNet LZO previews—all packaged cleanly in a ZIP with untouched original backups.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top Controls: Folder Summary & Action Selector */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Left (4 cols): Folder Stats */}
                <div className="lg:col-span-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wide">
                      <FolderOpen className="w-4 h-4 text-amber-500" />
                      Loaded Maps ({items.length})
                    </span>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        setItems([]);
                        setIsComplete(false);
                      }}
                      className="text-[11px] font-mono text-slate-500 dark:text-slate-400 hover:text-red-500 underline transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Clear &amp; Change Folder
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Valid</div>
                      <div className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-base">
                        {items.filter((i) => i.parsed).length}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Preview</div>
                      <div className="text-amber-600 dark:text-amber-400 font-bold font-mono text-base">
                        {items.filter((i) => i.hasExistingPreview).length}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">23k Bloat</div>
                      <div className="text-rose-600 dark:text-rose-400 font-bold font-mono text-base">
                        {items.filter((i) => i.existingPreviewIs23k).length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right (8 cols): Choose Action */}
                <div className="lg:col-span-8 space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    Select Action:
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Action 1: Prepare Maps */}
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setSelectedAction('prepare_maps')}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                        selectedAction === 'prepare_maps'
                          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-slate-900 dark:text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center justify-between">
                        <span>Prepare Maps</span>
                        {selectedAction === 'prepare_maps' && <Check className="w-3.5 h-3.5 text-blue-500" />}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                        Metadata, Categories, Authors, Previews &amp; ZIP
                      </p>
                    </button>

                    {/* Action 2: Inject Previews */}
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setSelectedAction('inject_previews')}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                        selectedAction === 'inject_previews'
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-slate-900 dark:text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                        <span>Inject Previews</span>
                        {selectedAction === 'inject_previews' && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                        Render &amp; inject CnCNet [PreviewPack] into files
                      </p>
                    </button>

                    {/* Action 3: Export PNGs */}
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setSelectedAction('render_pngs')}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                        selectedAction === 'render_pngs'
                          ? 'bg-red-50 dark:bg-red-950/50 border-red-500 text-slate-900 dark:text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center justify-between">
                        <span>Export PNGs</span>
                        {selectedAction === 'render_pngs' && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                        Batch render full-resolution battlefield images
                      </p>
                    </button>

                    {/* Action 4: Strip Previews */}
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setSelectedAction('strip_previews')}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                        selectedAction === 'strip_previews'
                          ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-slate-900 dark:text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center justify-between">
                        <span>Strip Previews</span>
                        {selectedAction === 'strip_previews' && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                        Remove bloated 23k preview blocks from maps
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              {/* ACTION PARAMETERS CONFIGURATION BOX */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wide flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-slate-500" />
                    Configuration: {selectedAction === 'prepare_maps' ? 'Prepare Maps Options' : selectedAction === 'inject_previews' ? 'Preview Injection Parameters' : selectedAction === 'render_pngs' ? 'PNG Render Engine' : 'Preview Stripping'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Applied to all {items.length} maps in batch
                  </span>
                </div>

                {/* PREPARE MAPS CONFIGURATION */}
                {selectedAction === 'prepare_maps' && (
                  <div className="space-y-4 text-xs">
                    {/* Row 1: Category Naming & Bulk Assign */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-blue-500" />
                            Category Naming
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={categoryNamingEnabled}
                              onChange={(e) => handleToggleCategoryNaming(e.target.checked)}
                              className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
                            />
                            <span className="font-semibold text-[11px]">Enable Category Prefixes</span>
                          </label>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Applies standard convention: 1v1 (<code>2_</code> / <code>[2] </code>), 2v2 (<code>4_</code> / <code>[4] </code>), 3v3 (<code>6_</code> / <code>[6] </code>), 4v4 (<code>8_</code> / <code>[8] </code>). Automatically removes existing category prefixes so they never accumulate.
                        </p>
                      </div>

                      <div className="space-y-1.5 flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 md:pl-4 pt-2 md:pt-0">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                          Bulk Apply Category to All Maps:
                        </span>
                        <div className="flex items-center gap-2">
                          <select
                            value={bulkCategory}
                            onChange={(e) => setBulkCategory(e.target.value as any)}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs font-mono text-slate-800 dark:text-white flex-1"
                          >
                            <option value="auto">Keep Detected / Individual</option>
                            <option value="1v1">1v1 (2 Players · 2_ / [2])</option>
                            <option value="2v2">2v2 (4 Players · 4_ / [4])</option>
                            <option value="3v3">3v3 (6 Players · 6_ / [6])</option>
                            <option value="4v4">4v4 (8 Players · 8_ / [8])</option>
                            <option value="none">None (No Prefix)</option>
                          </select>
                          <button
                            type="button"
                            disabled={bulkCategory === 'auto'}
                            onClick={() => {
                              if (bulkCategory !== 'auto') handleApplyBulkCategory(bulkCategory);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs transition-colors cursor-pointer"
                          >
                            Apply All
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Author Handling & Metadata Overrides */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                      {/* Author Extraction */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                            Author Credits
                          </label>
                          <button
                            type="button"
                            onClick={handleExtractAuthors}
                            className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Auto-Extract from Names</span>
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={updateAuthor}
                              onChange={(e) => setUpdateAuthor(e.target.checked)}
                              className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
                            />
                            <span>Write/Update <code>Author=</code> in <code>[Basic]</code> section</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400 text-[11px]">
                            <input
                              type="checkbox"
                              checked={autoExtractAuthorOnLoad}
                              onChange={(e) => setAutoExtractAuthorOnLoad(e.target.checked)}
                              className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
                            />
                            <span>Extract <code>Map Name by Author</code> pattern automatically</span>
                          </label>
                        </div>
                      </div>

                      {/* Game Rules [Basic] Overrides */}
                      <div className="space-y-2 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-700 md:pl-4 pt-2 md:pt-0">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5 text-amber-500" />
                          Configurable [Basic] Values
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {/* GameMode */}
                          <div className="space-y-1">
                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                              <input
                                type="checkbox"
                                checked={updateGameMode}
                                onChange={(e) => setUpdateGameMode(e.target.checked)}
                                className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
                              />
                              <span className="font-semibold text-[11px]">GameMode</span>
                            </label>
                            <input
                              type="text"
                              disabled={!updateGameMode}
                              value={gameModeValue}
                              onChange={(e) => setGameModeValue(e.target.value)}
                              placeholder="Custom"
                              className="w-full bg-slate-50 dark:bg-slate-800 disabled:opacity-50 border border-slate-200 dark:border-slate-700 rounded p-1 text-xs font-mono text-slate-800 dark:text-white"
                            />
                          </div>

                          {/* MaxPlayer */}
                          <div className="space-y-1">
                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                              <input
                                type="checkbox"
                                checked={updateMaxPlayer}
                                onChange={(e) => setUpdateMaxPlayer(e.target.checked)}
                                className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
                              />
                              <span className="font-semibold text-[11px]">MaxPlayer</span>
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={8}
                              disabled={!updateMaxPlayer}
                              value={maxPlayerValue}
                              onChange={(e) => setMaxPlayerValue(parseInt(e.target.value, 10) || 1)}
                              className="w-full bg-slate-50 dark:bg-slate-800 disabled:opacity-50 border border-slate-200 dark:border-slate-700 rounded p-1 text-xs font-mono text-slate-800 dark:text-white"
                            />
                          </div>

                          {/* MinPlayer */}
                          <div className="space-y-1">
                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                              <input
                                type="checkbox"
                                checked={updateMinPlayer}
                                onChange={(e) => setUpdateMinPlayer(e.target.checked)}
                                className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
                              />
                              <span className="font-semibold text-[11px]">MinPlayer</span>
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={8}
                              disabled={!updateMinPlayer}
                              value={minPlayerValue}
                              onChange={(e) => setMinPlayerValue(parseInt(e.target.value, 10) || 1)}
                              className="w-full bg-slate-50 dark:bg-slate-800 disabled:opacity-50 border border-slate-200 dark:border-slate-700 rounded p-1 text-xs font-mono text-slate-800 dark:text-white"
                            />
                          </div>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 pt-1">
                          <input
                            type="checkbox"
                            checked={updateMapName}
                            onChange={(e) => setUpdateMapName(e.target.checked)}
                            className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
                          />
                          <span>Update <code>Name=</code> in <code>[Basic]</code> with edited titles</span>
                        </label>
                      </div>
                    </div>

                    {/* Row 3: Optional PreviewPack Generation */}
                    <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-purple-500" />
                          Optional PreviewPack Generation &amp; Injection
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={injectPreviewsInPrepare}
                            onChange={(e) => setInjectPreviewsInPrepare(e.target.checked)}
                            className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
                          />
                          <span className="font-semibold text-[11px]">Inject [PreviewPack] into Maps</span>
                        </label>
                      </div>

                      {injectPreviewsInPrepare && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                          <div>
                            <span className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold text-[11px]">
                              Encoding:
                            </span>
                            <select
                              value={prepareInjectFormat}
                              onChange={(e) => setPrepareInjectFormat(e.target.value as any)}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-slate-800 dark:text-white font-mono"
                            >
                              <option value="cncnet_lzo_24bit">CnCNet LZO 24-bit (XCC/Modern standard)</option>
                              <option value="lcw_8bit">Classic Westwood LCW 8-bit</option>
                            </select>
                          </div>

                          <div>
                            <span className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold text-[11px]">
                              Preview Resolution:
                            </span>
                            <select
                              value={prepareInjectSize}
                              onChange={(e) => setPrepareInjectSize(parseInt(e.target.value, 10))}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs text-slate-800 dark:text-white font-mono"
                            >
                              <option value={256}>256×256 px (CnCNet HD · Recommended)</option>
                              <option value={192}>192×192 px (Balanced)</option>
                              <option value={128}>128×128 px (Classic 1996)</option>
                            </select>
                          </div>

                          <div className="flex flex-col gap-2 pt-1 col-span-1 sm:col-span-3">
                            <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                              <input
                                type="checkbox"
                                checked={exportPngInPrepare}
                                onChange={(e) => setExportPngInPrepare(e.target.checked)}
                                className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
                              />
                              <span>Include .PNG previews in ZIP <code>previews/</code></span>
                            </label>

                            {exportPngInPrepare && (
                              <div className="p-2.5 rounded-lg bg-black/40 border border-[#3b0d13] flex items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <div>
                                    <div className="font-bold text-white flex items-center gap-1.5">
                                      <span>Auto-compress PNGs with TinyPNG</span>
                                      {getTinyPngApiKey() ? (
                                        <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-1 py-0.2 rounded font-bold">
                                          API READY
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-mono text-amber-400 bg-amber-950/80 border border-amber-800/80 px-1 py-0.2 rounded font-bold">
                                          FREE KEY
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      Reduces companion PNG sizes by ~50–70% before archiving in ZIP
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setIsTinyPngModalOpen(true)}
                                    className="text-[10px] font-mono text-amber-400 hover:text-white underline cursor-pointer"
                                  >
                                    {getTinyPngApiKey() ? 'API Settings' : 'Set Free Key'}
                                  </button>
                                  <input
                                    type="checkbox"
                                    checked={batchTinyPngCompress}
                                    onChange={(e) => setBatchTinyPngCompress(e.target.checked)}
                                    className="rounded border-neutral-700 text-red-600 focus:ring-0 cursor-pointer"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* INJECT PREVIEWS CONFIGURATION (STANDALONE ACTION) */}
                {selectedAction === 'inject_previews' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Format:</span>
                      <select
                        value={injectFormat}
                        onChange={(e) => setInjectFormat(e.target.value as any)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-white font-mono"
                      >
                        <option value="cncnet_lzo_24bit">CnCNet LZO (24-bit Truecolor - XCC Standard)</option>
                        <option value="lcw_8bit">Classic LCW (8-bit Indexed - 1996 Westwood)</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Preview Resolution:</span>
                      <select
                        value={injectSize}
                        onChange={(e) => setInjectSize(parseInt(e.target.value, 10))}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-white font-mono"
                      >
                        <option value={256}>256×256 px (CnCNet HD · ~800–1,100 lines · Recommended)</option>
                        <option value={192}>192×192 px (Balanced · ~450–700 lines)</option>
                        <option value={128}>128×128 px (Classic · ~200–350 lines)</option>
                      </select>
                    </div>

                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 cursor-pointer hover:text-slate-900 dark:hover:text-white text-slate-600 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={alsoExportPng}
                          onChange={(e) => setAlsoExportPng(e.target.checked)}
                          className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-0"
                        />
                        <span>Also generate .PNG previews in ZIP</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* RENDER PNGS CONFIGURATION (STANDALONE ACTION) */}
                {selectedAction === 'render_pngs' && (
                  <div className="space-y-3 text-xs">
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <span className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Graphics Engine:</span>
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => setRenderEngine('original')}
                            className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                              renderEngine === 'original' ? 'bg-emerald-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            ⭐ Original Westwood 24×24 Assets
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenderEngine('vector')}
                            className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                              renderEngine === 'vector' ? 'bg-red-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            Tactical Vector
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-600 dark:text-slate-400 block mb-1 font-semibold">Scale:</span>
                        <select
                          value={renderScale}
                          onChange={(e) => setRenderScale(parseFloat(e.target.value))}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-white font-mono"
                        >
                          <option value={1.0}>Native 24px (100% Full Res)</option>
                          <option value={0.5}>Tactical 12px (50%)</option>
                          <option value={0.25}>Compact 6px (25%)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 pt-1 text-slate-700 dark:text-slate-300">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cropBounds}
                          onChange={(e) => setCropBounds(e.target.checked)}
                          className="rounded border-slate-300 dark:border-slate-700 text-emerald-600"
                        />
                        <span>Crop Visible Bounds</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showOre}
                          onChange={(e) => setShowOre(e.target.checked)}
                          className="rounded border-slate-300 dark:border-slate-700 text-emerald-600"
                        />
                        <span>Ore &amp; Gems</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showWalls}
                          onChange={(e) => setShowWalls(e.target.checked)}
                          className="rounded border-slate-300 dark:border-slate-700 text-emerald-600"
                        />
                        <span>Walls</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showStructures}
                          onChange={(e) => setShowStructures(e.target.checked)}
                          className="rounded border-slate-300 dark:border-slate-700 text-emerald-600"
                        />
                        <span>Buildings</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showSpawns}
                          onChange={(e) => setShowSpawns(e.target.checked)}
                          className="rounded border-slate-300 dark:border-slate-700 text-emerald-600"
                        />
                        <span>Spawns</span>
                      </label>
                    </div>

                    {/* TinyPNG Auto-Compression for Batch Render PNGs */}
                    <div className="p-2.5 rounded-lg bg-black/40 border border-[#3b0d13] flex items-center justify-between gap-3 text-xs mt-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>Auto-compress rendered PNGs with TinyPNG</span>
                            {getTinyPngApiKey() ? (
                              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-1 py-0.2 rounded font-bold">
                                API READY
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono text-amber-400 bg-amber-950/80 border border-amber-800/80 px-1 py-0.2 rounded font-bold">
                                FREE KEY
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Shrinks all rendered PNGs by ~50–70% before archiving in ZIP
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsTinyPngModalOpen(true)}
                          className="text-[10px] font-mono text-amber-400 hover:text-white underline cursor-pointer"
                        >
                          {getTinyPngApiKey() ? 'API Settings' : 'Set Free Key'}
                        </button>
                        <input
                          type="checkbox"
                          checked={batchTinyPngCompress}
                          onChange={(e) => setBatchTinyPngCompress(e.target.checked)}
                          className="rounded border-neutral-700 text-red-600 focus:ring-0 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STRIP PREVIEWS CONFIGURATION (STANDALONE ACTION) */}
                {selectedAction === 'strip_previews' && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Will strip any <code className="text-amber-500">[Preview]</code> and <code className="text-amber-500">[PreviewPack]</code> sections, removing bloated 23k-line blocks from all maps in this folder.
                  </p>
                )}
              </div>

              {/* Validation Warning Alert (if any) */}
              {(hasEmptyMapName || hasInvalidPlayerCount) && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 flex items-center gap-3 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    {hasEmptyMapName && <div>Warning: One or more maps have an empty Map Name. Please fill in names before running.</div>}
                    {hasInvalidPlayerCount && <div>Warning: Player counts must be valid (MinPlayer &le; MaxPlayer, each &ge; 1).</div>}
                  </div>
                </div>
              )}

              {/* Progress & Live Preview (during execution) */}
              {isProcessing && (
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 animate-fade-in text-white">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span>
                          Processing Map {currentIndex + 1} of {items.length}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-amber-400 truncate max-w-md">
                        {currentMapName}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-extrabold text-emerald-400 font-mono">
                        {progressPct}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
                    <div
                      className="bg-gradient-to-r from-blue-600 via-amber-500 to-emerald-500 h-2.5 rounded-full transition-all duration-150"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  {/* Visual Live Canvas Thumbnail */}
                  <div className="flex items-center gap-3 pt-2">
                    <canvas
                      ref={progressCanvasRef}
                      className="w-16 h-16 rounded-lg border border-slate-800 bg-black object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <div className="text-[11px] font-mono text-slate-400 space-y-0.5">
                      <div>Status: Generating metadata &amp; previews...</div>
                      <div className="text-slate-500">
                        {processedCount} completed · {errorCount} errors · {skippedCount} skipped
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons: Start Execution / Download ZIP */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  {!isProcessing && !isComplete && (
                    <button
                      type="button"
                      disabled={hasEmptyMapName || hasInvalidPlayerCount}
                      onClick={handleStartBatch}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-950/20 transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Start {selectedAction === 'prepare_maps' ? 'Prepare Maps' : 'Batch Process'} ({items.length} Maps)</span>
                    </button>
                  )}

                  {isProcessing && (
                    <button
                      type="button"
                      onClick={() => {
                        cancelRef.current = true;
                      }}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <StopCircle className="w-4 h-4" />
                      <span>Stop / Cancel</span>
                    </button>
                  )}

                  {isComplete && (
                    <button
                      type="button"
                      onClick={handleDownloadAllZip}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-950/30 transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download All ZIP (maps/, previews/, backup/originals/)</span>
                    </button>
                  )}

                  {isComplete && batchTinyPngSavedBytes > 0 && (
                    <div className="px-3 py-1.5 rounded-xl bg-[#09150d] border border-[#193a23] text-emerald-300 text-xs font-mono flex items-center gap-1.5 shadow-xs">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>TinyPNG saved {formatFileSize(batchTinyPngSavedBytes)} ({batchTinyPngCompressedCount} images)</span>
                    </div>
                  )}

                  {isComplete && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsComplete(false);
                        const reset = items.map((i) => ({ ...i, status: 'idle' as const }));
                        setItems(reset);
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Re-Run</span>
                    </button>
                  )}
                </div>

                <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {processedCount} / {items.length} Done · {errorCount} Errors · {skippedCount} Skipped
                </div>
              </div>

              {/* MAPS MANIFEST TABLE */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Batch Queue ({items.length} Maps):</span>
                  <span className="text-[11px] font-mono font-normal text-slate-500 dark:text-slate-400">
                    {selectedAction === 'prepare_maps' ? 'Inspect & customize Map Names, Authors & Categories before running' : 'Showing all loaded maps'}
                  </span>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5">Map File &amp; Info</th>
                        <th className="p-2.5">Map Title (Clean Name)</th>
                        {selectedAction === 'prepare_maps' && (
                          <>
                            <th className="p-2.5">Category</th>
                            <th className="p-2.5">Author</th>
                            <th className="p-2.5">Output Filename</th>
                          </>
                        )}
                        <th className="p-2.5">Preview</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          {/* Col 1: Original File & Info */}
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white max-w-[170px]">
                            <div className="truncate" title={item.name}>{item.name}</div>
                            {item.parsed ? (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal capitalize">
                                {item.parsed.theater} · {item.parsed.playerSpawnCount}P
                              </div>
                            ) : (
                              <span className="text-[10px] text-rose-500">Invalid</span>
                            )}
                          </td>

                          {/* Col 2: Map Title */}
                          <td className="p-2.5 min-w-[160px]">
                            {selectedAction === 'prepare_maps' ? (
                              <div className="space-y-0.5">
                                <input
                                  type="text"
                                  disabled={isProcessing}
                                  value={item.editedMapName}
                                  onChange={(e) => handleUpdateItemField(item.id, 'editedMapName', e.target.value)}
                                  placeholder="Map Name"
                                  className={`w-full p-1 rounded border text-xs font-sans ${
                                    !item.editedMapName.trim()
                                      ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/40'
                                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                                  }`}
                                />
                                {categoryNamingEnabled && item.category !== 'none' && (
                                  <div className="text-[10px] text-blue-600 dark:text-blue-400 font-sans truncate">
                                    In INI: <code>{CATEGORIES[item.category].namePrefix}{stripCategoryPrefixFromName(item.editedMapName)}</code>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="truncate max-w-[160px]" title={item.parsed?.title || item.name}>
                                {item.parsed?.title || item.name}
                              </div>
                            )}
                          </td>

                          {/* Col 3: Category */}
                          {selectedAction === 'prepare_maps' && (
                            <td className="p-2.5">
                              <select
                                disabled={isProcessing}
                                value={item.category}
                                onChange={(e) => handleUpdateItemField(item.id, 'category', e.target.value)}
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-1 text-xs text-slate-800 dark:text-white"
                              >
                                <option value="none">None</option>
                                <option value="1v1">1v1 (2_)</option>
                                <option value="2v2">2v2 (4_)</option>
                                <option value="3v3">3v3 (6_)</option>
                                <option value="4v4">4v4 (8_)</option>
                              </select>
                            </td>
                          )}

                          {/* Col 4: Author */}
                          {selectedAction === 'prepare_maps' && (
                            <td className="p-2.5 min-w-[120px]">
                              <input
                                type="text"
                                disabled={isProcessing}
                                value={item.editedAuthor}
                                onChange={(e) => handleUpdateItemField(item.id, 'editedAuthor', e.target.value)}
                                placeholder="Author"
                                className="w-full p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-sans"
                              />
                            </td>
                          )}

                          {/* Col 5: Output Filename */}
                          {selectedAction === 'prepare_maps' && (
                            <td className="p-2.5 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 max-w-[150px] truncate" title={item.outputFilename}>
                              {item.outputFilename}
                            </td>
                          )}

                          {/* Col 6: Preview Status */}
                          <td className="p-2.5">
                            {item.hasExistingPreview ? (
                              item.existingPreviewIs23k ? (
                                <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>23k Bloat</span>
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  ~{item.existingPreviewLines}L
                                </span>
                              )
                            ) : (
                              <span className="text-slate-400">None</span>
                            )}
                          </td>

                          {/* Col 7: Processing Status */}
                          <td className="p-2.5">
                            {item.status === 'idle' && (
                              <span className="text-slate-400">Queued</span>
                            )}
                            {item.status === 'processing' && (
                              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                Processing...
                              </span>
                            )}
                            {item.status === 'done' && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Done
                                {item.linesGenerated && ` (~${item.linesGenerated}L)`}
                              </span>
                            )}
                            {item.status === 'skipped' && (
                              <span className="text-slate-400 italic">Skipped</span>
                            )}
                            {item.status === 'error' && (
                              <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1" title={item.errorMessage}>
                                <AlertCircle className="w-3.5 h-3.5" />
                                Error
                              </span>
                            )}
                          </td>

                          {/* Col 8: Individual Downloads */}
                          <td className="p-2.5 text-right space-x-1">
                            {item.resultMprText && (
                              <button
                                type="button"
                                onClick={() => handleDownloadSingleMpr(item)}
                                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-semibold transition-colors cursor-pointer"
                                title="Download updated map file"
                              >
                                .MPR
                              </button>
                            )}
                            {item.resultPngBlob && (
                              <button
                                type="button"
                                onClick={() => handleDownloadSinglePng(item)}
                                className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold transition-colors cursor-pointer"
                                title="Download rendered .PNG"
                              >
                                .PNG
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TinyPNG Settings / Test Key Modal */}
      <TinyPngModal
        isOpen={isTinyPngModalOpen}
        onClose={() => setIsTinyPngModalOpen(false)}
      />
    </div>
  );
};

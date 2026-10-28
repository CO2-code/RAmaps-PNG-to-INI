/**
 * Red Alert 1 Map INI & [Basic] Section Modifier
 * Ported and adapted from RA1MapsToXNA-Tool for browser-based TypeScript environment.
 * Handles non-destructive section editing, category prefixing, author extraction,
 * and Windows-safe filename sanitization.
 */

export type MapCategory = 'none' | '1v1' | '2v2' | '3v3' | '4v4';

export interface CategoryInfo {
  id: MapCategory;
  label: string;
  filePrefix: string;
  namePrefix: string;
  defaultPlayers: number;
}

export const CATEGORIES: Record<MapCategory, CategoryInfo> = {
  none: { id: 'none', label: 'None (Original)', filePrefix: '', namePrefix: '', defaultPlayers: 0 },
  '1v1': { id: '1v1', label: '1v1 (2 Players)', filePrefix: '2_', namePrefix: '[2] ', defaultPlayers: 2 },
  '2v2': { id: '2v2', label: '2v2 (4 Players)', filePrefix: '4_', namePrefix: '[4] ', defaultPlayers: 4 },
  '3v3': { id: '3v3', label: '3v3 (6 Players)', filePrefix: '6_', namePrefix: '[6] ', defaultPlayers: 6 },
  '4v4': { id: '4v4', label: '4v4 (8 Players)', filePrefix: '8_', namePrefix: '[8] ', defaultPlayers: 8 },
};

export interface BasicSectionData {
  name?: string;
  author?: string;
  gameMode?: string;
  maxPlayer?: string;
  minPlayer?: string;
  allKeys: Record<string, string>;
}

export interface BasicSectionUpdates {
  name?: string;
  author?: string;
  gameMode?: string;
  maxPlayer?: string | number;
  minPlayer?: string | number;
}

/**
 * Extracts metadata values from the [Basic] section of an INI/MPR file
 */
export function parseBasicSection(iniText: string): BasicSectionData {
  const result: BasicSectionData = {
    allKeys: {},
  };

  const basicMatch = iniText.match(/\[Basic\]([\s\S]*?)(?=\r?\n\[|$)/i);
  if (!basicMatch) return result;

  const lines = basicMatch[1].split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const rawKey = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      const lowerKey = rawKey.toLowerCase();
      result.allKeys[lowerKey] = val;

      if (lowerKey === 'name') result.name = val;
      else if (lowerKey === 'author') result.author = val;
      else if (lowerKey === 'gamemode') result.gameMode = val;
      else if (lowerKey === 'maxplayer') result.maxPlayer = val;
      else if (lowerKey === 'minplayer') result.minPlayer = val;
    }
  }

  return result;
}

/**
 * Strips supported category prefixes from map names so prefixes do not accumulate.
 * Handles "[2] ", "[4] ", "[6] ", "[8] ", "(2) ", etc.
 */
export function stripCategoryPrefixFromName(name: string): string {
  if (!name) return '';
  return name.replace(/^(\[[2468]\]|\([2468]\)|[2468]v[2468])\s*/i, '').trim();
}

/**
 * Strips supported category prefixes from filenames so prefixes do not accumulate.
 * Handles "2_", "4_", "6_", "8_"
 */
export function stripCategoryPrefixFromFilename(filename: string): string {
  if (!filename) return '';
  return filename.replace(/^[2468]_/i, '');
}

/**
 * Detects an existing category from the map name or filename
 */
export function detectCategory(name: string, filename: string): MapCategory {
  const cleanName = (name || '').trim();
  const cleanFile = (filename || '').trim();

  if (/^\[2\]|\(2\)/i.test(cleanName) || /^2_/i.test(cleanFile)) return '1v1';
  if (/^\[4\]|\(4\)/i.test(cleanName) || /^4_/i.test(cleanFile)) return '2v2';
  if (/^\[6\]|\(6\)/i.test(cleanName) || /^6_/i.test(cleanFile)) return '3v3';
  if (/^\[8\]|\(8\)/i.test(cleanName) || /^8_/i.test(cleanFile)) return '4v4';

  return 'none';
}

/**
 * Extracts author from map name if it follows the pattern: "Map Name by Author"
 */
export function extractAuthorFromMapName(rawName: string): { cleanName: string; extractedAuthor: string | null } {
  if (!rawName) return { cleanName: '', extractedAuthor: null };

  // Match case-insensitive " by "
  const match = rawName.match(/^(.*?)\s+(?:-|–)?\s*by\s+([^\r\n]+)$/i);
  if (match) {
    const clean = match[1].trim();
    const author = match[2].trim();
    if (clean.length > 0 && author.length > 0) {
      return { cleanName: clean, extractedAuthor: author };
    }
  }

  return { cleanName: rawName.trim(), extractedAuthor: null };
}

/**
 * Sanitizes a string into a Windows-compatible filename.
 * Removes invalid characters: \ / : * ? " < > | and control characters 0x00-0x1F.
 * Trims trailing spaces and dots which Windows does not allow.
 */
export function sanitizeWindowsFilename(name: string): string {
  if (!name) return 'unnamed_map';
  let sanitized = name.replace(/[\\/:*?"<>|\x00-\x1F]/g, '').trim();
  sanitized = sanitized.replace(/[. ]+$/, '');
  return sanitized.length > 0 ? sanitized : 'unnamed_map';
}

/**
 * Updates the [Basic] section of an INI file while preserving all comments,
 * unknown sections, map data chunks, and untouched keys.
 */
export function updateIniBasicSection(
  originalIni: string,
  updates: BasicSectionUpdates
): string {
  // Detect newline character
  const isCrlf = originalIni.includes('\r\n');
  const nl = isCrlf ? '\r\n' : '\n';

  // Identify defined keys to update
  const keysToUpdate: { canonicalKey: string; lowerKey: string; value: string }[] = [];

  if (updates.name !== undefined) {
    keysToUpdate.push({ canonicalKey: 'Name', lowerKey: 'name', value: String(updates.name) });
  }
  if (updates.author !== undefined) {
    keysToUpdate.push({ canonicalKey: 'Author', lowerKey: 'author', value: String(updates.author) });
  }
  if (updates.gameMode !== undefined) {
    keysToUpdate.push({ canonicalKey: 'GameMode', lowerKey: 'gamemode', value: String(updates.gameMode) });
  }
  if (updates.maxPlayer !== undefined) {
    keysToUpdate.push({ canonicalKey: 'MaxPlayer', lowerKey: 'maxplayer', value: String(updates.maxPlayer) });
  }
  if (updates.minPlayer !== undefined) {
    keysToUpdate.push({ canonicalKey: 'MinPlayer', lowerKey: 'minplayer', value: String(updates.minPlayer) });
  }

  if (keysToUpdate.length === 0) {
    return originalIni;
  }

  // Find [Basic] section header
  const basicHeaderRegex = /^\[\s*Basic\s*\]/im;
  const basicMatch = originalIni.match(basicHeaderRegex);

  if (!basicMatch || basicMatch.index === undefined) {
    // If no [Basic] section exists, prepend one at the top
    const newSectionLines = ['[Basic]'];
    for (const item of keysToUpdate) {
      newSectionLines.push(`${item.canonicalKey}=${item.value}`);
    }
    return newSectionLines.join(nl) + nl + nl + originalIni;
  }

  const headerIndex = basicMatch.index;
  const headerLength = basicMatch[0].length;
  const afterHeader = originalIni.substring(headerIndex + headerLength);

  // Find where this section ends (next section header starting with [ at line start)
  const nextSectionMatch = afterHeader.match(/\r?\n\[/);
  const sectionContentEnd = nextSectionMatch && nextSectionMatch.index !== undefined
    ? nextSectionMatch.index
    : afterHeader.length;

  const sectionRawContent = afterHeader.substring(0, sectionContentEnd);
  const remainder = afterHeader.substring(sectionContentEnd);

  // Parse lines of the [Basic] section content
  const sectionLines = sectionRawContent.split(/\r?\n/);

  // Track which keys were found and replaced
  const replacedKeys = new Set<string>();
  const modifiedLines: string[] = [];

  for (const line of sectionLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';')) {
      // Preserve comments and empty lines
      modifiedLines.push(line);
      continue;
    }

    const eqIdx = line.indexOf('=');
    if (eqIdx !== -1) {
      const key = line.substring(0, eqIdx).trim();
      const lowerKey = key.toLowerCase();

      const updateItem = keysToUpdate.find((k) => k.lowerKey === lowerKey);
      if (updateItem) {
        if (!replacedKeys.has(lowerKey)) {
          // Replace the first occurrence
          modifiedLines.push(`${updateItem.canonicalKey}=${updateItem.value}`);
          replacedKeys.add(lowerKey);
        }
        // If a duplicate line for this key already existed, drop it to prevent duplicates
        continue;
      }
    }

    // Unrelated key: preserve exactly as-is
    modifiedLines.push(line);
  }

  // Append any keys that did not exist yet in [Basic]
  for (const item of keysToUpdate) {
    if (!replacedKeys.has(item.lowerKey)) {
      // If the last line is empty, insert before it or append
      modifiedLines.push(`${item.canonicalKey}=${item.value}`);
    }
  }

  const newSectionContent = modifiedLines.join(nl);
  const prefix = originalIni.substring(0, headerIndex + headerLength);

  return prefix + newSectionContent + remainder;
}

/**
 * Resolves output filename collisions across a batch of maps (case-insensitively).
 * Generates unique numbered suffixes if collisions occur (e.g., 2_map_2.mpr).
 */
export function resolveBatchFilenames(
  items: Array<{ id: string; proposedBase: string; extension: string }>
): Map<string, string> {
  const result = new Map<string, string>();
  const usedLowerNames = new Set<string>();

  for (const item of items) {
    const ext = item.extension.startsWith('.') ? item.extension : `.${item.extension}`;
    let candidate = `${item.proposedBase}${ext}`;
    let counter = 2;

    while (usedLowerNames.has(candidate.toLowerCase())) {
      candidate = `${item.proposedBase}_${counter}${ext}`;
      counter++;
    }

    usedLowerNames.add(candidate.toLowerCase());
    result.set(item.id, candidate);
  }

  return result;
}

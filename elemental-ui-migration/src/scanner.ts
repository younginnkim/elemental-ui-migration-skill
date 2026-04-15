import { readFile, readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { widgetMapping } from './mapping.js';

export interface WidgetUsage {
  name: string;
  target: string;
  lines: number[];
  breakingChange: boolean;
  notes?: string;
}

export interface ScanResult {
  filePath: string;
  hasPloverImport: boolean;
  importLines: number[];
  widgetsFound: WidgetUsage[];
  breakingChangeCount: number;
  summary: string;
}

const PLOVER_IMPORT_RE = /import\s+'package:plover[^']*';/;

// Match all known Plover identifiers (W-prefix + known non-W identifiers)
const knownIdentifiers = Object.keys(widgetMapping);
const identifierPattern = knownIdentifiers
  .sort((a, b) => b.length - a.length) // longest first to avoid partial matches
  .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');
const PLOVER_IDENT_RE = new RegExp(`\\b(${identifierPattern})\\b`, 'g');

async function scanSingleFile(filePath: string): Promise<ScanResult> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  const result: ScanResult = {
    filePath,
    hasPloverImport: false,
    importLines: [],
    widgetsFound: [],
    breakingChangeCount: 0,
    summary: '',
  };

  const found = new Map<string, WidgetUsage>();

  lines.forEach((line, idx) => {
    if (PLOVER_IMPORT_RE.test(line)) {
      result.hasPloverImport = true;
      result.importLines.push(idx + 1);
    }

    PLOVER_IDENT_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = PLOVER_IDENT_RE.exec(line)) !== null) {
      const name = match[1];
      const mapping = widgetMapping[name];
      if (!mapping) continue;

      if (!found.has(name)) {
        found.set(name, {
          name,
          target: mapping.target,
          lines: [idx + 1],
          breakingChange: mapping.breakingChange ?? false,
          notes: mapping.notes,
        });
      } else {
        found.get(name)!.lines.push(idx + 1);
      }
    }
  });

  result.widgetsFound = Array.from(found.values());
  result.breakingChangeCount = result.widgetsFound.filter(w => w.breakingChange).length;
  result.summary = result.widgetsFound.length === 0
    ? 'No Plover identifiers found.'
    : `Found ${result.widgetsFound.length} Plover identifiers (${result.breakingChangeCount} require manual attention).`;

  return result;
}

export async function scanPath(targetPath: string): Promise<ScanResult[]> {
  const info = await stat(targetPath);

  if (info.isFile()) {
    const result = await scanSingleFile(targetPath);
    return [result];
  }

  const results: ScanResult[] = [];
  const entries = await readdir(targetPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'build' || entry.name === '.dart_tool') continue;
    const full = join(targetPath, entry.name);

    if (entry.isDirectory()) {
      results.push(...await scanPath(full));
    } else if (entry.isFile() && extname(entry.name) === '.dart') {
      const r = await scanSingleFile(full);
      if (r.hasPloverImport || r.widgetsFound.length > 0) {
        results.push(r);
      }
    }
  }

  return results;
}

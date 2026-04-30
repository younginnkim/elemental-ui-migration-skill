import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export interface WidgetMapping {
  target: string;
  breakingChange?: boolean;
  deprecated?: boolean;
  deprecatedNote?: string;
  notes?: string;
  paramChanges?: {
    removed?: string[];
    renamed?: Record<string, string>;
    added?: string[];
    notes?: string;
  };
}

const here = dirname(fileURLToPath(import.meta.url));
const json = readFileSync(join(here, 'mapping.json'), 'utf-8');

export const widgetMapping: Record<string, WidgetMapping> = JSON.parse(json);

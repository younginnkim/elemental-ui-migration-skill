import { readFile } from 'fs/promises';

export interface OccurrenceSnippet {
  line: number;         // 1-indexed line number of the occurrence
  contextStart: number; // 1-indexed line number where the context window starts
  context: string;      // source lines surrounding the occurrence (newline-separated)
}

export async function getFileSnippets(
  filePath: string,
  lines: number[],
  windowSize: number = 5,
): Promise<OccurrenceSnippet[]> {
  const content = await readFile(filePath, 'utf-8');
  const allLines = content.split('\n');
  return lines.map(lineNum => {
    const idx = lineNum - 1;
    const start = Math.max(0, idx - windowSize);
    const end = Math.min(allLines.length - 1, idx + windowSize);
    return {
      line: lineNum,
      contextStart: start + 1,
      context: allLines.slice(start, end + 1).join('\n'),
    };
  });
}

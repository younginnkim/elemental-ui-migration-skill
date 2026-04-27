import { readFile } from 'fs/promises';
export async function getFileSnippets(filePath, lines, windowSize = 5) {
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

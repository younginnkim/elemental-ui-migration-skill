import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { widgetMapping } from './mapping.js';
import { getFileSnippets } from './scanner.js';

const server = new McpServer({
  name: 'elemental-ui-migration',
  version: '1.0.0',
});


// 특정 Plover 위젯의 상세 마이그레이션 정보 (대상 이름, 파라미터 변경, 주의사항).
// Step 2에서 breaking change 위젯의 파라미터 변경 사항 확인 시 사용.
server.registerTool(
  'getWidgetDetail',
  {
    description: 'Get detailed migration info for a specific Plover widget or class — target name, parameter changes, breaking changes, and notes.',
    inputSchema: {
      name: z.string().describe('Plover widget/class name, e.g. WButton, WVirtualList, WSpinner'),
    },
  },
  async ({ name }) => {
    const mapping = widgetMapping[name];
    if (!mapping) {
      const similar = Object.keys(widgetMapping)
        .filter(k => k.toLowerCase().includes(name.toLowerCase()))
        .slice(0, 5);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: `No mapping found for "${name}"`,
            suggestions: similar,
          }, null, 2),
        }],
      };
    }

    const params = mapping.paramChanges ?? null;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          plover: name,
          elutter: mapping.target,
          breakingChange: mapping.breakingChange ?? false,
          deprecated: mapping.deprecated ?? false,
          deprecatedNote: mapping.deprecatedNote ?? null,
          notes: mapping.notes ?? null,
          paramChanges: params,
        }, null, 2),
      }],
    };
  },
);

// Dart 파일의 특정 라인 번호 주변 ±5줄 스니펫 반환.
// Step 2에서 breaking change / deprecated 위젯 주변 코드 맥락 확인 시 사용.
server.registerTool(
  'getFileSnippets',
  {
    description: 'Get source code snippets (±5 lines) around specific line numbers in a Dart file. Use when you need context around breaking-change or manual-TODO occurrences for targeted edits.',
    inputSchema: {
      path: z.string().describe('Absolute path to a .dart file'),
      lines: z.array(z.number()).describe('1-indexed line numbers to fetch context around'),
    },
  },
  async ({ path, lines }) => {
    try {
      const snippets = await getFileSnippets(path, lines);
      return {
        content: [{ type: 'text', text: JSON.stringify(snippets, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error reading file: ${(err as Error).message}` }],
      };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('elemental-ui-migration MCP server running');
}

main().catch(err => {
  console.error('Fatal error:', err);
  // process.exit(1);
});

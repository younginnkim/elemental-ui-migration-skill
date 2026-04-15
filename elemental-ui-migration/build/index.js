import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { widgetMapping, paramChanges } from './mapping.js';
import { scanPath } from './scanner.js';
const server = new McpServer({
    name: 'elemental-ui-migration',
    version: '1.0.0',
});
// ── Tool 1: List all widget mappings ─────────────────────────────────────────
server.registerTool('listWidgetMappings', {
    description: 'List all Plover → Elemental UI widget/enum/class mappings. Optionally filter to only breaking changes.',
    inputSchema: {
        breakingOnly: z.boolean().optional().describe('If true, return only widgets with breaking changes'),
    },
}, async ({ breakingOnly }) => {
    const entries = Object.entries(widgetMapping)
        .filter(([, v]) => !breakingOnly || v.breakingChange)
        .map(([plover, info]) => ({
        plover,
        elutter: info.target,
        breakingChange: info.breakingChange ?? false,
        notes: info.notes ?? '',
    }));
    return {
        content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }],
    };
});
// ── Tool 2: Get migration details for a specific widget ───────────────────────
server.registerTool('getWidgetMigration', {
    description: 'Get detailed migration info for a specific Plover widget or class — target name, parameter changes, breaking changes, and notes.',
    inputSchema: {
        name: z.string().describe('Plover widget/class name, e.g. WButton, WVirtualList, WSpinner'),
    },
}, async ({ name }) => {
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
    const params = paramChanges[name] ?? null;
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    plover: name,
                    elutter: mapping.target,
                    breakingChange: mapping.breakingChange ?? false,
                    notes: mapping.notes ?? null,
                    paramChanges: params,
                }, null, 2),
            }],
    };
});
// ── Tool 3: Scan a Dart file or directory ────────────────────────────────────
server.registerTool('scanDartFile', {
    description: 'Scan a Dart file or directory for Plover widget usage. Returns a structured list of all Plover identifiers found, their line numbers, migration targets, and which ones have breaking changes.',
    inputSchema: {
        path: z.string().describe('Absolute path to a .dart file or directory (e.g. lib/views/home.dart or lib/)'),
    },
}, async ({ path }) => {
    try {
        const results = await scanPath(path);
        if (results.length === 0) {
            return {
                content: [{ type: 'text', text: 'No Plover usage found in the specified path.' }],
            };
        }
        const totalWidgets = results.reduce((sum, r) => sum + r.widgetsFound.length, 0);
        const totalBreaking = results.reduce((sum, r) => sum + r.breakingChangeCount, 0);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        scannedFiles: results.length,
                        totalIdentifiers: totalWidgets,
                        totalBreakingChanges: totalBreaking,
                        files: results,
                    }, null, 2),
                }],
        };
    }
    catch (err) {
        return {
            content: [{ type: 'text', text: `Error scanning path: ${err.message}` }],
        };
    }
});
// ── Tool 4: Get all breaking changes ─────────────────────────────────────────
server.registerTool('getBreakingChanges', {
    description: 'Get all widgets with breaking changes that require manual code changes beyond a simple W→E prefix rename.',
    inputSchema: {},
}, async () => {
    const breaking = Object.entries(widgetMapping)
        .filter(([, v]) => v.breakingChange)
        .map(([plover, info]) => ({
        plover,
        elutter: info.target,
        notes: info.notes,
        paramChanges: paramChanges[plover] ?? null,
    }));
    return {
        content: [{ type: 'text', text: JSON.stringify(breaking, null, 2) }],
    };
});
// ── Start server ──────────────────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('elemental-ui-migration MCP server running');
}
main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

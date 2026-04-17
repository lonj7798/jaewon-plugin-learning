#!/usr/bin/env node
/**
 * server.js — jaewon-plugin-learning MCP Server entry point
 *
 * @calling-spec
 * - (module): void
 *   Input: none (reads from stdin via StdioServerTransport)
 *   Output: JSON-RPC responses written to stdout
 *   Side effects: starts MCP server process over stdio transport; registers 5 MCP tools
 *   Depends on: @modelcontextprotocol/sdk, handlers/_index.js
 *
 * Phase-3: iterates HANDLERS registry and calls register(server, paths) for each.
 * Tools registered: learning_status, learning_profile, learning_wiki_search,
 *                   learning_verdict, learning_crawl_guard.
 *
 * Adapter note: handlers call server.tool(name, [description,] schema, cb) with
 * plain JSON Schema objects. McpServer 1.29+ requires Zod shapes, so we wrap it
 * with a thin adapter that forwards only (name, cb) to the real McpServer.
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { HANDLERS } from './handlers/_index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, '..');

// Shared path config passed to every handler
const paths = {
  statusFile:  resolve(PLUGIN_ROOT, '.jaewon-learning', 'status.json'),
  learnerDir:  resolve(PLUGIN_ROOT, 'wiki', 'learner'),
  wikiRoot:    resolve(PLUGIN_ROOT, 'wiki'),
  root:        PLUGIN_ROOT,
  learningDir: resolve(PLUGIN_ROOT, '.jaewon-learning'),
};

const mcpServer = new McpServer({
  name: 'jaewon-plugin-learning',
  version: '0.1.0',
});

/**
 * Thin adapter wrapping McpServer.tool() to accept handler signatures:
 *   tool(name, schema, cb)             — 3 args (status, profile, wiki, verdict)
 *   tool(name, description, schema, cb) — 4 args (crawl-guard)
 * Forwards only (name, cb) to the real McpServer to avoid Zod schema requirement.
 */
const serverAdapter = {
  tool(name, ...rest) {
    // Last argument is always the callback
    const cb = rest[rest.length - 1];
    mcpServer.tool(name, cb);
  },
};

for (const { register } of HANDLERS) {
  register(serverAdapter, paths);
}

const transport = new StdioServerTransport();
await mcpServer.connect(transport);

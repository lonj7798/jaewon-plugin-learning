/**
 * Phase 3 — Task 3.9 (REFACTOR): Server smoke test — 5-tool enumeration
 *
 * Spawns the real MCP server via StdioClientTransport, sends tools/list,
 * and asserts that exactly 5 tools are registered with the expected names.
 *
 * Acceptance: "exactly 5 tools: status, profile, wiki_search, verdict, crawl_guard"
 *
 * Framework: node:test + node:assert/strict, ESM.
 * Run from:  jaewon-plugin-learning/
 *   node --test tests/phase-3/server-smoke.test.mjs
 *
 * @calling-spec
 * - (test suite): void
 *   Input: none (spawns server.js as a subprocess)
 *   Output: TAP output via node:test reporter
 *   Side effects: spawns + terminates a child process per test
 *   Depends on: @modelcontextprotocol/sdk/client/index.js,
 *               @modelcontextprotocol/sdk/client/stdio.js,
 *               mcp-server/server.js (the server under test)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '..', '..', 'mcp-server', 'server.js');

// Expected tool names in the HANDLERS registry order
const EXPECTED_TOOL_NAMES = [
  'learning_status',
  'learning_profile',
  'learning_wiki_search',
  'learning_verdict',
  'learning_crawl_guard',
];

// ---------------------------------------------------------------------------
// Helper: spawn server + list tools + close
// ---------------------------------------------------------------------------

async function listToolsViaServer() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_PATH],
  });

  const client = new Client(
    { name: 'smoke-test-client', version: '0.0.1' },
    { capabilities: {} }
  );

  await client.connect(transport);

  let toolList;
  try {
    toolList = await client.listTools();
  } finally {
    await client.close();
  }

  return toolList.tools ?? [];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('server registers exactly 5 tools', async () => {
  const tools = await listToolsViaServer();
  assert.strictEqual(
    tools.length,
    5,
    `Expected 5 tools but got ${tools.length}: ${tools.map(t => t.name).join(', ')}`
  );
});

test('all 5 expected tool names are present', async () => {
  const tools = await listToolsViaServer();
  const names = tools.map(t => t.name);

  for (const expected of EXPECTED_TOOL_NAMES) {
    assert.ok(
      names.includes(expected),
      `Missing tool '${expected}'. Registered tools: ${names.join(', ')}`
    );
  }
});

test('no unexpected tool names are registered', async () => {
  const tools = await listToolsViaServer();
  const names = tools.map(t => t.name);

  for (const name of names) {
    assert.ok(
      EXPECTED_TOOL_NAMES.includes(name),
      `Unexpected tool registered: '${name}'`
    );
  }
});

test('tool names match: status, profile, wiki_search, verdict, crawl_guard', async () => {
  const tools = await listToolsViaServer();
  const names = tools.map(t => t.name).sort();
  const expected = [...EXPECTED_TOOL_NAMES].sort();

  assert.deepStrictEqual(
    names,
    expected,
    `Tool names mismatch.\nExpected: ${expected.join(', ')}\nGot:      ${names.join(', ')}`
  );
});

test('exactly 5 tools: status, profile, wiki_search, verdict, crawl_guard', async () => {
  const tools = await listToolsViaServer();
  const names = tools.map(t => t.name).sort();
  const expected = [...EXPECTED_TOOL_NAMES].sort();

  assert.strictEqual(tools.length, 5);
  assert.deepStrictEqual(names, expected);
});

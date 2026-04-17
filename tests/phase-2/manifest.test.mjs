/**
 * Phase 2 — Task 2.1 (RED): Plugin manifest tests
 *
 * All 6 tests must FAIL until Task 2.2 creates the manifest files.
 * Framework: node:test + node:assert/strict, ESM.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

// Resolve the plugin root relative to this test file.
// This file lives at: jaewon-plugin-learning/tests/phase-2/manifest.test.mjs
// Plugin root is:      jaewon-plugin-learning/
const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..', '..');

/**
 * Helper: read and JSON-parse a file under PLUGIN_ROOT.
 * Throws with a clear message if the file does not exist.
 */
async function readJSON(relPath) {
  const abs = join(PLUGIN_ROOT, relPath);
  const raw = await readFile(abs, 'utf8');
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// Test 1 — plugin.json parses as JSON and has all required top-level fields
// ---------------------------------------------------------------------------
test('test_plugin_json_valid', async () => {
  // Arrange
  const requiredFields = ['name', 'version', 'skills', 'hooks', 'mcpServers'];

  // Act
  const plugin = await readJSON('.claude-plugin/plugin.json');

  // Assert
  for (const field of requiredFields) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(plugin, field),
      `plugin.json must have field "${field}"`
    );
  }
});

// ---------------------------------------------------------------------------
// Test 2 — plugin.json version is exactly "0.1.0"
// ---------------------------------------------------------------------------
test('test_version_is_0_1_0', async () => {
  // Arrange — version expected from phase-0 architecture §5.1

  // Act
  const plugin = await readJSON('.claude-plugin/plugin.json');

  // Assert
  assert.equal(
    plugin.version,
    '0.1.0',
    `plugin.json "version" must be "0.1.0", got "${plugin.version}"`
  );
});

// ---------------------------------------------------------------------------
// Test 3 — hooks/hooks.json declares exactly the 5 required event types
// ---------------------------------------------------------------------------
test('test_hooks_json_declares_five_events', async () => {
  // Arrange — the 5 events specified in phase-2 plan §Task 2.1
  const requiredEvents = [
    'SessionStart',
    'UserPromptSubmit',
    'Stop',
    'SubagentStop',
    'SessionEnd',
  ];

  // Act
  const hooksConfig = await readJSON('hooks/hooks.json');

  // Assert: top-level "hooks" key must exist
  assert.ok(
    hooksConfig.hooks && typeof hooksConfig.hooks === 'object',
    'hooks/hooks.json must have a top-level "hooks" object'
  );

  for (const event of requiredEvents) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(hooksConfig.hooks, event),
      `hooks/hooks.json must register event "${event}"`
    );
  }

  const registeredCount = Object.keys(hooksConfig.hooks).length;
  assert.equal(
    registeredCount,
    5,
    `hooks/hooks.json must declare exactly 5 events, found ${registeredCount}`
  );
});

// ---------------------------------------------------------------------------
// Test 4 — .mcp.json registers a server named "learning"
// ---------------------------------------------------------------------------
test('test_mcp_json_registers_learning_server', async () => {
  // Arrange — server key must be "learning" (not "jaewon") per task brief §6

  // Act
  const mcp = await readJSON('.mcp.json');

  // Assert: structure check
  assert.ok(
    mcp.mcpServers && typeof mcp.mcpServers === 'object',
    '.mcp.json must have a top-level "mcpServers" object'
  );

  assert.ok(
    Object.prototype.hasOwnProperty.call(mcp.mcpServers, 'learning'),
    '.mcp.json must register a server named "learning" (not "jaewon" or other names)'
  );

  // The learning server entry must point at mcp-server/server.js
  const server = mcp.mcpServers['learning'];
  assert.ok(
    typeof server === 'object' && server !== null,
    '"learning" entry in .mcp.json must be an object'
  );
});

// ---------------------------------------------------------------------------
// Test 5 — package.json declares "type": "module"
// ---------------------------------------------------------------------------
test('test_package_json_is_type_module', async () => {
  // Arrange — required so all .js/.mjs files run as ESM

  // Act
  const pkg = await readJSON('package.json');

  // Assert
  assert.equal(
    pkg.type,
    'module',
    `package.json "type" must be "module", got "${pkg.type}"`
  );
});

// ---------------------------------------------------------------------------
// Test 6 — package.json declares @modelcontextprotocol/sdk as a dependency
// ---------------------------------------------------------------------------
test('test_package_json_declares_mcp_sdk_dep', async () => {
  // Arrange — dep required per phase-0 §5.1 and plan §Task 2.1

  // Act
  const pkg = await readJSON('package.json');

  // Assert: dependencies block must exist
  assert.ok(
    pkg.dependencies && typeof pkg.dependencies === 'object',
    'package.json must have a "dependencies" object'
  );

  assert.ok(
    Object.prototype.hasOwnProperty.call(
      pkg.dependencies,
      '@modelcontextprotocol/sdk'
    ),
    'package.json "dependencies" must include "@modelcontextprotocol/sdk"'
  );

  // Version range must start with "^1." per architecture spec
  const sdkVersion = pkg.dependencies['@modelcontextprotocol/sdk'];
  assert.match(
    sdkVersion,
    /^\^1\./,
    `@modelcontextprotocol/sdk version must be "^1.x.x", got "${sdkVersion}"`
  );
});

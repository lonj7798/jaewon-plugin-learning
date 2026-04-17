/**
 * shared-libs.test.mjs — Phase 2 RED tests for copied shared library files.
 *
 * Framework: node:test + node:assert/strict  (Node 18+ built-in, no deps)
 * Failure reason expected: "Cannot find module" / "ERR_MODULE_NOT_FOUND"
 *   because hooks/run.cjs, hooks/lib/stdin.mjs, mcp-server/lib/file-ops.js
 *   have not been copied into jaewon-plugin-learning/ yet (task 2.4).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Absolute paths to files that task 2.4 will copy into jaewon-plugin-learning/
const PLUGIN_ROOT      = resolve(__dirname, '../../');
const RUN_CJS_PATH     = join(PLUGIN_ROOT, 'hooks', 'run.cjs');
const STDIN_MJS_PATH   = join(PLUGIN_ROOT, 'hooks', 'lib', 'stdin.mjs');
const FILE_OPS_JS_PATH = join(PLUGIN_ROOT, 'mcp-server', 'lib', 'file-ops.js');

// ---------------------------------------------------------------------------
// Test 1 — hooks/run.cjs exists and is a CommonJS loader
// ---------------------------------------------------------------------------
test('test_run_cjs_exists_and_is_executable', () => {
  // Arrange
  // The file must exist at jaewon-plugin-learning/hooks/run.cjs after task 2.4.
  // It must be CJS (contain require() calls), not ESM, so Claude Code can load it.

  // Act
  const exists = existsSync(RUN_CJS_PATH);

  // Assert — file must exist
  assert.equal(exists, true, `hooks/run.cjs not found at ${RUN_CJS_PATH}`);

  // Assert — must be CommonJS (require present, no top-level import statement)
  const source = readFileSync(RUN_CJS_PATH, 'utf-8');
  assert.equal(source.includes('require('), true,
    'run.cjs must use require() — it is the CJS loader shim for ESM hook scripts');
});

// ---------------------------------------------------------------------------
// Test 2 — hooks/lib/stdin.mjs exports readStdin function
// ---------------------------------------------------------------------------
test('test_stdin_mjs_exports_readStdin', async () => {
  // Arrange — dynamic import will throw ERR_MODULE_NOT_FOUND if file absent
  const mod = await import(STDIN_MJS_PATH);

  // Act
  const { readStdin } = mod;

  // Assert
  assert.equal(typeof readStdin, 'function',
    'stdin.mjs must export a function named readStdin');
});

// ---------------------------------------------------------------------------
// Test 3 — mcp-server/lib/file-ops.js exports readJSON, writeJSON, appendMarkdown
// ---------------------------------------------------------------------------
test('test_file_ops_exports_readJSON_writeJSON_appendMarkdown', async () => {
  // Arrange — dynamic import will throw ERR_MODULE_NOT_FOUND if file absent
  const mod = await import(FILE_OPS_JS_PATH);

  // Act
  const { readJSON, writeJSON, appendMarkdown } = mod;

  // Assert
  assert.equal(typeof readJSON,       'function', 'file-ops.js must export readJSON');
  assert.equal(typeof writeJSON,      'function', 'file-ops.js must export writeJSON');
  assert.equal(typeof appendMarkdown, 'function', 'file-ops.js must export appendMarkdown');
});

// ---------------------------------------------------------------------------
// Test 4 — readJSON on a missing file returns null (not throws)
// ---------------------------------------------------------------------------
test('test_readJSON_missing_file_returns_null', async () => {
  // Arrange
  const { readJSON } = await import(FILE_OPS_JS_PATH);
  const missingPath = join(tmpdir(), `jaewon-test-missing-${Date.now()}.json`);

  // Act — must return null, never throw, for a non-existent path
  const result = readJSON(missingPath);

  // Assert
  assert.equal(result, null,
    'readJSON must return null for a missing file, not throw an error');
});

// ---------------------------------------------------------------------------
// Test 5 — writeJSON creates parent dirs; round-trip with readJSON succeeds
// ---------------------------------------------------------------------------
test('test_writeJSON_creates_parent_dir', async () => {
  // Arrange
  const { readJSON, writeJSON } = await import(FILE_OPS_JS_PATH);
  const tmpBase    = join(tmpdir(), `jaewon-test-${Date.now()}`);
  const nestedPath = join(tmpBase, 'nested', 'dir', 'data.json');
  const payload    = { plugin: 'jaewon-plugin-learning', version: '0.1.0' };

  try {
    // Act — parent directories do not exist yet; writeJSON must create them
    writeJSON(nestedPath, payload);

    // Assert — file exists and data survives a read-back round-trip
    const result = readJSON(nestedPath);
    assert.deepEqual(result, payload,
      'writeJSON must create parent dirs and the data must round-trip through readJSON');
  } finally {
    // Cleanup — best-effort removal so tmpdir stays clean
    try { rmSync(tmpBase, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

/**
 * Phase 2 — Task 2.5 (RED): Minimal MCP server boot tests
 *
 * All 2 tests must FAIL until Task 2.6 creates mcp-server/server.js.
 * Framework: node:test + node:assert/strict, ESM.
 *
 * Expected failure reason: spawn fails / process exits non-zero because
 * mcp-server/server.js does not yet exist.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Plugin root: jaewon-plugin-learning/
// This file: jaewon-plugin-learning/tests/phase-2/server-boot.test.mjs
const PLUGIN_ROOT = join(__dirname, '..', '..');
const SERVER_JS   = join(PLUGIN_ROOT, 'mcp-server', 'server.js');

// ---------------------------------------------------------------------------
// Test 1 — server.js loads without syntax / import errors
// ---------------------------------------------------------------------------
test('test_server_js_imports_without_throwing', async () => {
  // Arrange
  // Use `node --check` to validate syntax without executing side effects.
  // Exit code 0 means the file parses and all static imports resolve cleanly.
  // We also accept 143 (SIGTERM on a running process), but --check exits before
  // reaching the connect() call so 0 is the normal outcome.

  // Act
  const exitCode = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ['--check', SERVER_JS],
      { stdio: 'inherit' }
    );
    child.on('close', resolve);
  });

  // Assert — exit 0 means no syntax errors and all imports are resolvable
  assert.equal(
    exitCode,
    0,
    `node --check mcp-server/server.js exited with code ${exitCode}; ` +
    'expected 0 — file does not exist yet (task 2.6 will create it)'
  );
});

// ---------------------------------------------------------------------------
// Test 2 — server boots and responds to a tools/list JSON-RPC request
// ---------------------------------------------------------------------------
test('test_server_registers_zero_tools_by_default', async () => {
  // Arrange
  // Send a tools/list request. In the GREEN phase the server registers zero
  // tools, so the result.tools array will be empty — but the server must still
  // send a valid JSON-RPC response to prove it booted and is running.
  const REQUEST = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
  }) + '\n';

  const TIMEOUT_MS = 3000;

  // Act
  const response = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [SERVER_JS],
      { stdio: ['pipe', 'pipe', 'inherit'] }
    );

    let buffer = '';

    // Reject after 3 seconds so the test does not hang in CI
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(
        'server did not respond within 3 seconds — ' +
        'mcp-server/server.js does not exist yet (task 2.6 will create it)'
      ));
    }, TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const newline = buffer.indexOf('\n');
      if (newline !== -1) {
        clearTimeout(timer);
        child.kill();
        const line = buffer.slice(0, newline).trim();
        try {
          resolve(JSON.parse(line));
        } catch (err) {
          reject(new Error(`server stdout was not valid JSON: ${line}`));
        }
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(
        `Failed to spawn mcp-server/server.js: ${err.message} — ` +
        'file does not exist yet (task 2.6 will create it)'
      ));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (!buffer.includes('\n')) {
        reject(new Error(
          `server exited with code ${code} before sending a response — ` +
          'mcp-server/server.js does not exist yet (task 2.6 will create it)'
        ));
      }
    });

    // Write the tools/list request to the server's stdin
    child.stdin.write(REQUEST);
    child.stdin.end();
  });

  // Assert — any JSON-RPC response (result OR error) proves the server booted
  assert.ok(
    typeof response === 'object' && response !== null,
    'response must be a JSON object'
  );
  assert.equal(
    response.jsonrpc,
    '2.0',
    `response.jsonrpc must be "2.0", got "${response.jsonrpc}"`
  );
  assert.ok(
    Object.prototype.hasOwnProperty.call(response, 'result') ||
    Object.prototype.hasOwnProperty.call(response, 'error'),
    'response must have either a "result" or "error" field'
  );
});

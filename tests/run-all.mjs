/**
 * Test harness runner for jaewon-plugin-learning.
 * Discovers every *.test.mjs under tests/ and delegates to node --test.
 *
 * @calling-spec
 * - (script): void
 *   Input: none (reads tests/ directory tree)
 *   Output: TAP output to stdout/stderr (inherited from node --test subprocess)
 *   Side effects: process.exit with subprocess exit code
 *   Depends on: node:fs/promises, node:path, node:child_process, node:url
 */

import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const TESTS_DIR = resolve(__filename, '..');

/**
 * Recursively collect all *.test.mjs files under a directory.
 * @param {string} dir - directory to search
 * @returns {Promise<string[]>} sorted list of absolute file paths
 */
async function collectTestFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectTestFiles(full)));
    } else if (entry.name.endsWith('.test.mjs')) {
      results.push(full);
    }
  }
  return results.sort();
}

const testFiles = await collectTestFiles(TESTS_DIR);

if (testFiles.length === 0) {
  process.stderr.write('run-all: no *.test.mjs files found under tests/\n');
  process.exit(1);
}

const child = spawn(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
});

child.on('close', (code) => {
  process.exit(code ?? 1);
});

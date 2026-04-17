/**
 * Repo-wide LOD compliance lint script.
 * Walks jaewon-plugin-learning/ for *.mjs and *.js source files,
 * enforcing LOD Rule 5 (file <=800 LOC) and function <=50 LOC.
 *
 * @calling-spec
 * - (script): void
 *   Input: none (walks ../  relative to tests/ dir)
 *   Output: violations printed to stdout; exit 0 if clean, exit 1 if violations
 *   Side effects: process.exit
 *   Depends on: node:fs/promises, node:path, node:url
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const TESTS_DIR = resolve(__filename, '..');
const ROOT_DIR = resolve(TESTS_DIR, '..');

const SKIP_DIRS = new Set(['node_modules', 'tests']);
const FILE_LOC_LIMIT = 800;
const FN_LOC_LIMIT = 50;

/** Recursively collect *.mjs and *.js files, skipping SKIP_DIRS. */
async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        results.push(...(await collectFiles(join(dir, entry.name))));
      }
    } else if (entry.name.endsWith('.mjs') || entry.name.endsWith('.js')) {
      results.push(join(dir, entry.name));
    }
  }
  return results;
}

/**
 * Find exported function LOC violations in source text.
 * Matches `export function name(` and `export const name = (... =>` lines,
 * then counts lines until brace depth returns to 0.
 * Returns array of { name, startLine, loc }.
 */
function checkFunctions(lines) {
  const violations = [];
  const exportFnRe = /^\s*export\s+(async\s+)?function\s+(\w+)/;
  const exportArrowRe = /^\s*export\s+(async\s+)?(?:const|let)\s+(\w+)\s*=.+=>/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = exportFnRe.exec(line) || exportArrowRe.exec(line);
    if (!match) continue;

    const fnName = match[2];
    let depth = 0;
    let started = false;
    let end = i;

    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '{') { depth++; started = true; }
        else if (ch === '}') { depth--; }
      }
      if (started && depth === 0) { end = j; break; }
    }

    const loc = end - i + 1;
    if (loc > FN_LOC_LIMIT) {
      violations.push({ name: fnName, startLine: i + 1, loc });
    }
  }
  return violations;
}

/** Lint one file; returns array of violation strings. */
async function lintFile(filePath) {
  const rel = relative(ROOT_DIR, filePath);
  const text = await readFile(filePath, 'utf8');
  const lines = text.split('\n');
  const violations = [];

  if (lines.length > FILE_LOC_LIMIT) {
    violations.push(`${rel}:1: file-too-large: actual=${lines.length} expected<=${FILE_LOC_LIMIT}`);
  }

  for (const { name, startLine, loc } of checkFunctions(lines)) {
    violations.push(`${rel}:${startLine}: fn-too-large[${name}]: actual=${loc} expected<=${FN_LOC_LIMIT}`);
  }

  return violations;
}

const files = await collectFiles(ROOT_DIR);
const allViolations = (await Promise.all(files.map(lintFile))).flat();

if (allViolations.length > 0) {
  for (const v of allViolations) process.stdout.write(v + '\n');
  process.stdout.write(`\nlod-lint: ${allViolations.length} violation(s) found.\n`);
  process.exit(1);
} else {
  process.stdout.write(`lod-lint: OK — ${files.length} file(s) checked, zero violations.\n`);
  process.exit(0);
}

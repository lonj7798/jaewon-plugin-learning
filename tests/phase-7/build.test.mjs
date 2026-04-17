/**
 * Phase 7 — Task 7.4 (RED): Dashboard build orchestrator tests
 *
 * All 4 tests must FAIL until Task 7.5 creates:
 *   dashboard/build.mjs
 *
 * Framework: node:test + node:assert/strict, ESM.
 *
 * Imports are dynamic (inside each test) so all 4 tests are registered
 * individually and each fails with ERR_MODULE_NOT_FOUND — not a single
 * file-level crash. This gives the implementer clear per-test feedback.
 *
 * Fixtures: tests/fixtures/dashboard/
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
// This file: jaewon-plugin-learning/tests/phase-7/build.test.mjs
// Plugin root: jaewon-plugin-learning/
const DASHBOARD = join(__dirname, '..', '..', 'dashboard');
const FIXTURES = join(__dirname, '..', 'fixtures', 'dashboard');

// ---------------------------------------------------------------------------
// Test 1 — build_scans_wiki_and_writes_all_expected_html_files
// ---------------------------------------------------------------------------

test('build: scans wiki and writes index.html, course slug html, profile.html, and timeline.html', async () => {
  // Arrange
  const { build } = await import(`${DASHBOARD}/build.mjs`);
  const outDir = mkdtempSync(join(tmpdir(), 'jaewon-dashboard-'));

  try {
    // Act
    await build({ wikiRoot: join(FIXTURES, 'wiki'), outDir });

    // Assert — all four required HTML files must exist at expected paths
    const files = readdirSync(outDir);
    assert.ok(
      files.includes('index.html'),
      `expected index.html in outDir, got: ${files.join(', ')}`
    );
    assert.ok(
      files.includes('profile.html'),
      `expected profile.html in outDir, got: ${files.join(', ')}`
    );
    assert.ok(
      files.includes('timeline.html'),
      `expected timeline.html in outDir, got: ${files.join(', ')}`
    );
    // At least one course slug HTML file must exist (dynamic-programming.html)
    const courseFiles = files.filter(f => f !== 'index.html' && f !== 'profile.html' && f !== 'timeline.html' && f.endsWith('.html'));
    assert.ok(
      courseFiles.length >= 1,
      `expected at least one course slug .html file, got files: ${files.join(', ')}`
    );
    assert.ok(
      files.includes('dynamic-programming.html') || courseFiles.some(f => f.includes('dynamic-programming')),
      `expected dynamic-programming.html in outDir, got: ${files.join(', ')}`
    );
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2 — build_returns_BuildReport_with_duration_and_pages_written
// ---------------------------------------------------------------------------

test('build: returns BuildReport with durationMs (number) and pagesWritten (array of paths)', async () => {
  // Arrange
  const { build } = await import(`${DASHBOARD}/build.mjs`);
  const outDir = mkdtempSync(join(tmpdir(), 'jaewon-dashboard-'));

  try {
    // Act
    const report = await build({ wikiRoot: join(FIXTURES, 'wiki'), outDir });

    // Assert — BuildReport shape must match calling spec
    assert.ok(
      report !== null && typeof report === 'object',
      'build must return a BuildReport object, got: ' + typeof report
    );
    assert.ok(
      typeof report.durationMs === 'number' && report.durationMs >= 0,
      `expected report.durationMs to be a non-negative number, got: ${report.durationMs}`
    );
    assert.ok(
      Array.isArray(report.pagesWritten),
      `expected report.pagesWritten to be an array, got: ${typeof report.pagesWritten}`
    );
    assert.ok(
      report.pagesWritten.length >= 4,
      `expected at least 4 pages written (index, course, profile, timeline), got: ${report.pagesWritten.length}`
    );
    // Each entry must be a non-empty string path
    for (const page of report.pagesWritten) {
      assert.ok(
        typeof page === 'string' && page.length > 0,
        `expected each pagesWritten entry to be a non-empty string, got: ${JSON.stringify(page)}`
      );
    }
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3 — build_is_idempotent
// ---------------------------------------------------------------------------

test('build: running twice produces byte-identical HTML files (idempotent)', async () => {
  // Arrange
  const { build } = await import(`${DASHBOARD}/build.mjs`);
  const outDir = mkdtempSync(join(tmpdir(), 'jaewon-dashboard-'));

  try {
    const wikiRoot = join(FIXTURES, 'wiki');

    // Act — run build twice against the same wikiRoot and outDir
    await build({ wikiRoot, outDir });
    const firstPassContents = {};
    for (const f of readdirSync(outDir).filter(f => f.endsWith('.html'))) {
      firstPassContents[f] = readFileSync(join(outDir, f), 'utf8');
    }

    await build({ wikiRoot, outDir });
    const secondPassContents = {};
    for (const f of readdirSync(outDir).filter(f => f.endsWith('.html'))) {
      secondPassContents[f] = readFileSync(join(outDir, f), 'utf8');
    }

    // Assert — every file from the first pass must be byte-identical after the second pass
    const firstFiles = Object.keys(firstPassContents).sort();
    const secondFiles = Object.keys(secondPassContents).sort();
    assert.deepEqual(
      firstFiles,
      secondFiles,
      'second build pass must produce the same set of files as the first pass'
    );
    for (const f of firstFiles) {
      assert.equal(
        secondPassContents[f],
        firstPassContents[f],
        `file ${f} must be byte-identical between first and second build runs (idempotent)`
      );
    }
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 4 — build_throws_on_missing_wiki_dir
// ---------------------------------------------------------------------------

test('build: throws an error when wikiRoot directory does not exist', async () => {
  // Arrange
  const { build } = await import(`${DASHBOARD}/build.mjs`);
  const outDir = mkdtempSync(join(tmpdir(), 'jaewon-dashboard-'));
  const missingWikiRoot = join(tmpdir(), 'jaewon-nonexistent-wiki-' + Date.now());

  try {
    // Act + Assert — build must reject/throw when wikiRoot is missing
    await assert.rejects(
      () => build({ wikiRoot: missingWikiRoot, outDir }),
      (err) => {
        // Must be an Error with a meaningful code or message
        assert.ok(
          err instanceof Error,
          `expected an Error instance, got: ${typeof err}`
        );
        // Either ENOENT from fs or a descriptive message mentioning the missing path
        const isEnoent = err.code === 'ENOENT';
        const hasMessage = typeof err.message === 'string' && err.message.length > 0;
        assert.ok(
          isEnoent || hasMessage,
          `expected ENOENT code or descriptive error message, got code=${err.code} message=${err.message}`
        );
        return true;
      },
      'build must throw when wikiRoot does not exist'
    );
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

/**
 * Phase 4 — Regression test for issue #12: creator depth contract
 *
 * Locks the key contract changes that stop creator from producing shallow
 * read.md pages:
 *
 *   1. creator.md declares crawl_manifest_path as a REQUIRED input
 *      (so the researcher's scored sources actually reach creator).
 *   2. creator.md requires per-source walkthroughs with real excerpts
 *      (so content isn't reduced to 2-3 sentence bullets).
 *   3. creator.md explicitly disclaims the 120-line cap for course content
 *      (so brevity bias is removed).
 *   4. skills/learn/SKILL.md passes crawl_manifest_path to creator
 *      (so the wiring actually delivers the manifest).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..', '..');
const CREATOR_MD  = join(PLUGIN_ROOT, 'agents', 'creator.md');
const LEARN_MD    = join(PLUGIN_ROOT, 'skills', 'learn', 'SKILL.md');

test('creator.md declares crawl_manifest_path as a required input', async () => {
  const src = await readFile(CREATOR_MD, 'utf8');
  assert.match(
    src,
    /crawl_manifest_path.*REQUIRED/i,
    'creator.md must mark crawl_manifest_path as REQUIRED so creator reads the researcher\'s scored sources'
  );
});

test('creator.md requires per-source excerpts with path citation + explanation', async () => {
  const src = await readFile(CREATOR_MD, 'utf8');
  // Walkthrough format: citation + excerpt + explanation + connection
  assert.match(src, /excerpt/i, 'creator.md must require excerpts, not just bullet summaries');
  assert.match(src, /relevance\s*>=?\s*0\.6/i, 'creator.md must scope required walkthroughs to high-relevance sources');
  assert.match(src, /code\s+(block|excerpt)/i, 'creator.md must require real code excerpts (fenced blocks)');
});

test('creator.md explicitly exempts course content from the 120-line cap', async () => {
  const src = await readFile(CREATOR_MD, 'utf8');
  assert.match(
    src,
    /(120[-\s]?line\s+cap\s+does\s+NOT\s+apply|exempt|DEPTH-OVER-BREVITY)/i,
    'creator.md must carve course read.md out of the 120-line cap so depth can match source volume'
  );
});

test('creator.md supports multi-file output for dense chapters', async () => {
  const src = await readFile(CREATOR_MD, 'utf8');
  assert.match(
    src,
    /excerpts\/.*\.md|sub-pages?/i,
    'creator.md must allow emitting excerpts/ sub-pages when chapters are dense'
  );
});

test('skills/learn/SKILL.md passes crawl_manifest_path to creator', async () => {
  const src = await readFile(LEARN_MD, 'utf8');
  assert.match(
    src,
    /crawl_manifest_path/,
    'learn skill must pass crawl_manifest_path to creator so the manifest actually reaches the agent'
  );
});

test('skills/learn/SKILL.md halts rather than degrading when manifest is missing', async () => {
  const src = await readFile(LEARN_MD, 'utf8');
  assert.match(
    src,
    /(halt|missing|error).*manifest|manifest.*missing|do NOT let creator produce/i,
    'learn skill must halt on missing manifest rather than let creator produce a shallow fallback'
  );
});

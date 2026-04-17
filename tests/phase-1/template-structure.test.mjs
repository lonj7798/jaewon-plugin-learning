/**
 * Phase 1 — Task 1.1 (RED)
 * Schema-integrity tests for the wiki-template scaffold.
 *
 * Framework : node:test + node:assert/strict (Node >= 18, ESM)
 * Run from  : jaewon-plugin-learning/
 *   node --test tests/phase-1/template-structure.test.mjs
 *
 * All 6 tests MUST fail until Task 1.2 (GREEN) creates the scaffold.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Resolve wiki-template root relative to this repo
// __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
// jaewon-plugin-learning/tests/phase-1/ -> up 3 levels to plugin root
const PLUGIN_ROOT = resolve(__filename, '..', '..', '..');
const WIKI_TEMPLATE = join(PLUGIN_ROOT, 'wiki-template');
const WIKI_DIR = join(WIKI_TEMPLATE, 'wiki');
const LEARNER_DIR = join(WIKI_DIR, 'learner');

// ---------------------------------------------------------------------------
// Test 1 — all required top-level and wiki files exist
describe('test_all_required_files_exist', () => {
  it('should find every path listed in phase-0 §5.8', () => {
    // Arrange — exhaustive list from phase-0-architecture.md §5.8
    const requiredPaths = [
      join(WIKI_TEMPLATE, 'README.md'),
      join(WIKI_TEMPLATE, 'CLAUDE.md'),
      join(WIKI_TEMPLATE, 'SCHEMA.md'),
      join(WIKI_TEMPLATE, '.gitignore'),
      join(WIKI_DIR, 'index.md'),
      join(WIKI_DIR, 'log.md'),
      join(LEARNER_DIR, 'learning-style.md'),
      join(LEARNER_DIR, 'strengths.md'),
      join(LEARNER_DIR, 'weaknesses.md'),
      join(LEARNER_DIR, 'push-tactics.md'),
      join(LEARNER_DIR, 'session-log.md'),
      join(WIKI_DIR, 'courses', '.gitkeep'),
      join(WIKI_TEMPLATE, 'dashboard', '.gitkeep'),
      join(WIKI_TEMPLATE, '.jaewon-learning', '.gitkeep'),
    ];

    // Act + Assert — fail fast on the first missing path
    for (const p of requiredPaths) {
      assert.ok(
        existsSync(p),
        `Required path does not exist: ${p}`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Test 2 — every .md under wiki/ has a calling-spec header comment
describe('test_every_markdown_page_has_calling_spec_header', () => {
  it('should match scope comment pattern in all wiki/*.md files', () => {
    // Arrange — regex from phase-1 plan doc Task 1.1 specification
    const SCOPE_HEADER_RE = /^#\s+.+\n<!--\s*scope:/m;

    const wikiMarkdownFiles = [
      join(WIKI_DIR, 'index.md'),
      join(WIKI_DIR, 'log.md'),
      join(LEARNER_DIR, 'learning-style.md'),
      join(LEARNER_DIR, 'strengths.md'),
      join(LEARNER_DIR, 'weaknesses.md'),
      join(LEARNER_DIR, 'push-tactics.md'),
      join(LEARNER_DIR, 'session-log.md'),
    ];

    // Act + Assert
    for (const p of wikiMarkdownFiles) {
      // Existence is tested separately; here we test content only.
      assert.ok(
        existsSync(p),
        `File missing so header cannot be checked: ${p}`
      );
      const content = readFileSync(p, 'utf8');
      assert.match(
        content,
        SCOPE_HEADER_RE,
        `Missing calling-spec scope comment in: ${p}`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Test 3 — each .md under wiki-template/wiki/ is <= 120 lines
describe('test_pages_under_120_lines', () => {
  it('should count <= 120 lines in every wiki markdown file', () => {
    // Arrange
    const LINE_LIMIT = 120;
    const wikiMarkdownFiles = [
      join(WIKI_DIR, 'index.md'),
      join(WIKI_DIR, 'log.md'),
      join(LEARNER_DIR, 'learning-style.md'),
      join(LEARNER_DIR, 'strengths.md'),
      join(LEARNER_DIR, 'weaknesses.md'),
      join(LEARNER_DIR, 'push-tactics.md'),
      join(LEARNER_DIR, 'session-log.md'),
    ];

    // Act + Assert
    for (const p of wikiMarkdownFiles) {
      assert.ok(existsSync(p), `File missing, cannot check line count: ${p}`);
      const lines = readFileSync(p, 'utf8').split('\n').length;
      assert.ok(
        lines <= LINE_LIMIT,
        `File exceeds ${LINE_LIMIT}-line cap (${lines} lines): ${p}`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Test 4 — every [[wikilink]] in seed pages resolves to an existing stub
describe('test_wikilinks_resolve', () => {
  it('should find a matching stub file for every [[name]] in seed pages', () => {
    // Arrange — pages that may contain wikilinks
    const seedPages = [
      join(WIKI_DIR, 'index.md'),
      join(WIKI_DIR, 'log.md'),
      join(LEARNER_DIR, 'learning-style.md'),
      join(LEARNER_DIR, 'strengths.md'),
      join(LEARNER_DIR, 'weaknesses.md'),
      join(LEARNER_DIR, 'push-tactics.md'),
      join(LEARNER_DIR, 'session-log.md'),
    ];

    // Gather all .md files under WIKI_DIR for resolution
    function collectMarkdownFiles(dir) {
      if (!existsSync(dir)) return [];
      const entries = readdirSync(dir, { withFileTypes: true });
      const files = [];
      for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) {
          files.push(...collectMarkdownFiles(full));
        } else if (e.name.endsWith('.md')) {
          // Store stem (filename without extension) for wikilink resolution
          files.push(e.name.replace(/\.md$/, ''));
        }
      }
      return files;
    }

    const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

    // Act + Assert
    const knownStems = collectMarkdownFiles(WIKI_DIR);

    for (const p of seedPages) {
      assert.ok(existsSync(p), `Seed page missing, cannot check wikilinks: ${p}`);
      const content = readFileSync(p, 'utf8');
      let match;
      while ((match = WIKILINK_RE.exec(content)) !== null) {
        const linkTarget = match[1].trim();
        assert.ok(
          knownStems.includes(linkTarget),
          `Unresolved wikilink [[${linkTarget}]] in ${p}`
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Test 5 — learner/ contains exactly the 5 required named stubs
describe('test_learner_folder_has_five_stubs', () => {
  it('should contain exactly {learning-style, strengths, weaknesses, push-tactics, session-log}.md', () => {
    // Arrange
    const REQUIRED_STUBS = new Set([
      'learning-style.md',
      'strengths.md',
      'weaknesses.md',
      'push-tactics.md',
      'session-log.md',
    ]);

    // Act
    assert.ok(existsSync(LEARNER_DIR), `learner/ directory does not exist: ${LEARNER_DIR}`);
    const actualFiles = new Set(readdirSync(LEARNER_DIR).filter(f => f.endsWith('.md')));

    // Assert — each required stub is present
    for (const stub of REQUIRED_STUBS) {
      assert.ok(
        actualFiles.has(stub),
        `Missing required learner stub: ${stub}`
      );
    }

    // Assert — exactly 5 stubs (no extra files)
    assert.equal(
      actualFiles.size,
      REQUIRED_STUBS.size,
      `Expected ${REQUIRED_STUBS.size} stubs in learner/, found ${actualFiles.size}: ${[...actualFiles].join(', ')}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 6 — push-tactics.md seed lists all 5 required tactics
describe('test_push_tactics_seed_lists_five_tactics', () => {
  it('should contain interrogator, debater, examiner, coach, blend tactic names', () => {
    // Arrange
    const PUSH_TACTICS_FILE = join(LEARNER_DIR, 'push-tactics.md');
    const REQUIRED_TACTICS_RE = /interrogator|debater|examiner|coach|blend/;

    // Act
    assert.ok(
      existsSync(PUSH_TACTICS_FILE),
      `push-tactics.md does not exist: ${PUSH_TACTICS_FILE}`
    );
    const content = readFileSync(PUSH_TACTICS_FILE, 'utf8');

    // Assert — each tactic keyword appears individually
    const tactics = ['interrogator', 'debater', 'examiner', 'coach', 'blend'];
    for (const tactic of tactics) {
      assert.ok(
        content.toLowerCase().includes(tactic),
        `push-tactics.md is missing tactic: "${tactic}"`
      );
    }

    // Assert — combined regex passes (spec requirement)
    assert.match(
      content.toLowerCase(),
      REQUIRED_TACTICS_RE,
      'push-tactics.md does not match required tactics regex'
    );
  });
});

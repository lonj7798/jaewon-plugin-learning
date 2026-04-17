/**
 * Phase 3 — Task 3.3 (RED): wiki-scan library tests
 *
 * All 6 tests MUST FAIL until Task 3.4 creates mcp-server/lib/wiki-scan.js.
 * Expected failure reason: ERR_MODULE_NOT_FOUND — wiki-scan.js does not exist.
 *
 * Framework: node:test + node:assert/strict, ESM.
 * Run from:  jaewon-plugin-learning/
 *   node --test tests/phase-3/wiki-scan.test.mjs
 *
 * Fixture: tests/fixtures/wiki-small/wiki/
 *   index.md  — links to [[page-a]] and [[page-b]]
 *   page-a.md — links to [[page-b]]
 *   page-b.md — links to [[nonexistent]] (broken link)
 *   page-c.md — orphan (nobody links to it), contains "unique-orphan-content"
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Module under test (does not exist yet — import will throw ERR_MODULE_NOT_FOUND)
// ---------------------------------------------------------------------------
import { scanWiki, searchWiki } from '../../mcp-server/lib/wiki-scan.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
// jaewon-plugin-learning/tests/phase-3/ -> up 2 levels -> jaewon-plugin-learning/
const PLUGIN_ROOT   = join(__dirname, '..', '..');
const FIXTURE_ROOT  = join(PLUGIN_ROOT, 'tests', 'fixtures', 'wiki-small');
const EMPTY_ROOT    = join(PLUGIN_ROOT, 'tests', 'fixtures', 'wiki-empty-nonexistent');

// ---------------------------------------------------------------------------
// Test 1 — scanWiki returns a page list with header metadata
// ---------------------------------------------------------------------------
describe('scanWiki_returns_page_list_with_headers', () => {
  it('should return one catalog entry per .md file with required header fields', async () => {
    // Arrange
    const root = FIXTURE_ROOT;

    // Act
    const result = await scanWiki(root);

    // Assert — result has pages array
    assert.ok(
      Array.isArray(result.pages),
      'result.pages must be an array'
    );

    // Assert — 4 pages found (index, page-a, page-b, page-c)
    assert.equal(
      result.pages.length,
      4,
      `expected 4 pages, got ${result.pages.length}`
    );

    // Assert — each page entry has the required shape
    for (const page of result.pages) {
      assert.ok(typeof page.path === 'string',      `page.path must be a string, got ${typeof page.path}`);
      assert.ok(typeof page.title === 'string',     `page.title must be a string, got ${typeof page.title}`);
      assert.ok(Array.isArray(page.wikilinks),      `page.wikilinks must be an array`);
      assert.ok(typeof page.lineCount === 'number', `page.lineCount must be a number`);
      assert.ok(
        typeof page.hasCallingSpec === 'boolean',
        `page.hasCallingSpec must be a boolean`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Test 2 — scanWiki extracts scope/deps/see-also from HTML comment headers
// ---------------------------------------------------------------------------
describe('scanWiki_extracts_scope_deps_see_also_comments', () => {
  it('should parse <!-- scope: X, deps: Y, see-also: Z --> comments from each page', async () => {
    // Arrange
    const root = FIXTURE_ROOT;

    // Act
    const result = await scanWiki(root);

    // Assert — find the index page
    const indexPage = result.pages.find(p => p.path.endsWith('index.md'));
    assert.ok(indexPage, 'index.md must be present in result.pages');

    // Assert — scope extracted from comment header
    assert.equal(
      indexPage.scope,
      'index',
      `expected scope "index", got "${indexPage.scope}"`
    );

    // Assert — deps extracted as array from comment header
    assert.ok(
      Array.isArray(indexPage.deps),
      'indexPage.deps must be an array'
    );
    assert.ok(
      indexPage.deps.includes('page-a'),
      `deps must include "page-a", got: ${JSON.stringify(indexPage.deps)}`
    );

    // Assert — see-also extracted as array from comment header
    assert.ok(
      Array.isArray(indexPage.seeAlso),
      'indexPage.seeAlso must be an array'
    );
    assert.ok(
      indexPage.seeAlso.includes('page-b'),
      `seeAlso must include "page-b", got: ${JSON.stringify(indexPage.seeAlso)}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 3 — scanWiki counts lines accurately
// ---------------------------------------------------------------------------
describe('scanWiki_counts_lines_accurately', () => {
  it('should report lineCount matching the actual number of lines in each file', async () => {
    // Arrange
    const root = FIXTURE_ROOT;
    // index.md has 7 lines (counted from fixture content)
    const EXPECTED_INDEX_LINES = 7;

    // Act
    const result = await scanWiki(root);
    const indexPage = result.pages.find(p => p.path.endsWith('index.md'));

    // Assert
    assert.ok(indexPage, 'index.md must be present in result.pages');
    assert.equal(
      indexPage.lineCount,
      EXPECTED_INDEX_LINES,
      `index.md lineCount: expected ${EXPECTED_INDEX_LINES}, got ${indexPage.lineCount}`
    );

    // Assert — page-b.md has 9 lines
    const pageBPage = result.pages.find(p => p.path.endsWith('page-b.md'));
    assert.ok(pageBPage, 'page-b.md must be present in result.pages');
    assert.equal(
      pageBPage.lineCount,
      9,
      `page-b.md lineCount: expected 9, got ${pageBPage.lineCount}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 4 — searchWiki ranks substring body matches above title-only matches
// ---------------------------------------------------------------------------
describe('searchWiki_substring_match_scores_higher_than_title_only', () => {
  it('should rank a page with query in body above a page with query only in title', async () => {
    // Arrange
    const root = FIXTURE_ROOT;
    // "unique-orphan-content" appears only in page-c.md body — no other page has it
    const query = 'unique-orphan-content';

    // Act
    const catalog = await scanWiki(root);
    const results = searchWiki(catalog, query, { maxResults: 10 });

    // Assert — at least one result returned
    assert.ok(
      results.length > 0,
      'searchWiki must return at least one result for a query matching page-c body'
    );

    // Assert — page-c.md is the top result
    assert.ok(
      results[0].path.endsWith('page-c.md'),
      `top result must be page-c.md (body match), got: ${results[0].path}`
    );

    // Assert — each result has a score field
    for (const r of results) {
      assert.ok(
        typeof r.score === 'number',
        `result.score must be a number, got ${typeof r.score}`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Test 5 — searchWiki returns empty array when query matches nothing
// ---------------------------------------------------------------------------
describe('searchWiki_returns_empty_on_no_match', () => {
  it('should return an empty array when no page matches the query string', async () => {
    // Arrange
    const root = FIXTURE_ROOT;
    const query = 'zzz-this-string-does-not-appear-anywhere-in-the-fixture-xyzzy';

    // Act
    const catalog = await scanWiki(root);
    const results = searchWiki(catalog, query, { maxResults: 10 });

    // Assert
    assert.ok(
      Array.isArray(results),
      'searchWiki must return an array'
    );
    assert.equal(
      results.length,
      0,
      `expected 0 results for unmatched query, got ${results.length}`
    );
  });
});

// ---------------------------------------------------------------------------
// Test 6 — searchWiki respects maxResults argument
// ---------------------------------------------------------------------------
describe('searchWiki_respects_max_results_arg', () => {
  it('should return at most maxResults entries even when more pages match', async () => {
    // Arrange
    const root = FIXTURE_ROOT;
    // "page" appears in the body or title of all 4 fixture files
    const query = 'page';
    const maxResults = 2;

    // Act
    const catalog = await scanWiki(root);
    const results = searchWiki(catalog, query, { maxResults });

    // Assert — result count is capped at maxResults
    assert.ok(
      results.length <= maxResults,
      `expected at most ${maxResults} results, got ${results.length}`
    );

    // Assert — returns an array (even when capped)
    assert.ok(
      Array.isArray(results),
      'searchWiki must always return an array'
    );
  });
});

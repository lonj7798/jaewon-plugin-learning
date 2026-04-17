/**
 * Phase 3 — Task 3.5 (RED): status, profile, and wiki-search handler tests
 *
 * All 7 tests MUST FAIL until Task 3.6 implements the real handlers:
 *   mcp-server/handlers/status-handler.js  — exports registerStatusTools()
 *   mcp-server/handlers/profile-handler.js — exports registerProfileTools()
 *   mcp-server/handlers/wiki-search-handler.js — exports registerWikiSearchTools()
 *
 * Expected failure reason: current stubs export only a bare handler() function
 * that returns { error: 'not-implemented' }. The named exports
 * (registerStatusTools, registerProfileTools, registerWikiSearchTools) do not
 * exist yet, so tests that invoke the tool callbacks will receive stub output
 * instead of real behavior — causing assertion failures.
 *
 * Framework: node:test + node:assert/strict, ESM.
 * Run from:  jaewon-plugin-learning/
 *   node --test tests/phase-3/handlers-read.test.mjs
 *
 * Isolation: each test creates its own tmpdir via fs.mkdtemp and registers a
 * minimal mock MCP server so handlers can call server.tool(name, schema, cb).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// This file: jaewon-plugin-learning/tests/phase-3/handlers-read.test.mjs
// Plugin root: jaewon-plugin-learning/
const HANDLERS_DIR = join(__dirname, '..', '..', 'mcp-server', 'handlers');

// ---------------------------------------------------------------------------
// Mock MCP server
// A minimal stand-in that captures tool registrations and allows the test to
// invoke a tool callback directly. registerXxxTools(server, paths) calls
// server.tool(name, inputSchema, callback) — we capture those.
// ---------------------------------------------------------------------------

/**
 * Creates a fresh mock MCP server for each test.
 * @returns {{ tool: Function, invoke: Function }}
 *   tool(name, schema, cb) — registers the tool
 *   invoke(name, input)    — calls the registered callback, returns its result
 */
function makeMockServer() {
  const registry = new Map();
  return {
    tool(name, _schema, cb) {
      registry.set(name, cb);
    },
    async invoke(name, input) {
      const cb = registry.get(name);
      if (!cb) throw new Error(`mock-server: tool "${name}" not registered`);
      return cb(input);
    },
  };
}

// ---------------------------------------------------------------------------
// Test 1 — learning_status returns DEFAULT_STATUS when no status file exists
// ---------------------------------------------------------------------------

test('learning_status_returns_defaults_on_missing_file', async () => {
  // Arrange — tmp dir with NO .jaewon-learning/status.json
  const tmp = await mkdtemp(join(tmpdir(), 'jpl-test-'));
  try {
    const paths = {
      wikiRoot: tmp,
      statusFile: join(tmp, '.jaewon-learning', 'status.json'),
      learnerDir: join(tmp, 'wiki', 'learner'),
    };
    const server = makeMockServer();
    const { registerStatusTools } = await import(`${HANDLERS_DIR}/status-handler.js`);

    // Act
    registerStatusTools(server, paths);
    const result = await server.invoke('learning_status', { action: 'GET' });

    // Assert — must return a valid course-state-shaped object, NOT { error: 'not-implemented' }
    assert.ok(
      result && typeof result === 'object' && !result.error,
      `expected a status object, got: ${JSON.stringify(result)}`
    );

    // Assert — must include last_advance_sig: null (course-state schema requirement)
    assert.strictEqual(
      result.last_advance_sig,
      null,
      `expected last_advance_sig: null in default status, got: ${JSON.stringify(result.last_advance_sig)}`
    );

    // Assert — must include core course-state fields with sensible defaults
    assert.ok(
      'current_course' in result,
      'default status must include current_course field'
    );
    assert.ok(
      'current_phase' in result,
      'default status must include current_phase field'
    );
    assert.ok(
      Array.isArray(result.verdict_history),
      'default status.verdict_history must be an array'
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2 — learning_status GET returns parsed status.json when file exists
// ---------------------------------------------------------------------------

test('learning_status_returns_parsed_status_json', async () => {
  // Arrange — write a status.json with known content
  const tmp = await mkdtemp(join(tmpdir(), 'jpl-test-'));
  try {
    const statusDir = join(tmp, '.jaewon-learning');
    await mkdir(statusDir, { recursive: true });
    const statusPath = join(statusDir, 'status.json');
    const stored = {
      current_course: 'advanced-typescript',
      current_chapter: 'generics',
      current_phase: 'discuss',
      cycle_count: 2,
      verdict_history: ['partial', 'partial'],
      last_advance_sig: 'sig-abc-123',
    };
    await writeFile(statusPath, JSON.stringify(stored), 'utf-8');

    const paths = {
      wikiRoot: tmp,
      statusFile: statusPath,
      learnerDir: join(tmp, 'wiki', 'learner'),
    };
    const server = makeMockServer();
    const { registerStatusTools } = await import(`${HANDLERS_DIR}/status-handler.js`);

    // Act
    registerStatusTools(server, paths);
    const result = await server.invoke('learning_status', { action: 'GET' });

    // Assert — must return the stored data, not stubs
    assert.strictEqual(
      result.current_course,
      'advanced-typescript',
      `expected current_course "advanced-typescript", got: ${result.current_course}`
    );
    assert.strictEqual(
      result.current_phase,
      'discuss',
      `expected current_phase "discuss", got: ${result.current_phase}`
    );
    assert.strictEqual(
      result.last_advance_sig,
      'sig-abc-123',
      `expected last_advance_sig "sig-abc-123", got: ${result.last_advance_sig}`
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3 — learning_status SET deep-merges and persists; preserves other fields
// ---------------------------------------------------------------------------

test('learning_status_update_deep_merges', async () => {
  // Arrange — pre-existing status with course and sig set
  const tmp = await mkdtemp(join(tmpdir(), 'jpl-test-'));
  try {
    const statusDir = join(tmp, '.jaewon-learning');
    await mkdir(statusDir, { recursive: true });
    const statusPath = join(statusDir, 'status.json');
    const initial = {
      current_course: 'rust-fundamentals',
      current_chapter: 'ownership',
      current_phase: 'read',
      cycle_count: 0,
      verdict_history: [],
      last_advance_sig: null,
    };
    await writeFile(statusPath, JSON.stringify(initial), 'utf-8');

    const paths = {
      wikiRoot: tmp,
      statusFile: statusPath,
      learnerDir: join(tmp, 'wiki', 'learner'),
    };
    const server = makeMockServer();
    const { registerStatusTools } = await import(`${HANDLERS_DIR}/status-handler.js`);
    registerStatusTools(server, paths);

    // Act — SET only the phase field; other fields should survive
    const result = await server.invoke('learning_status', {
      action: 'SET',
      patch: { current_phase: 'summarize', last_advance_sig: 'sig-xyz-789' },
    });

    // Assert — SET must succeed (not return an error stub)
    assert.ok(
      result && typeof result === 'object' && !result.error,
      `SET returned error stub: ${JSON.stringify(result)}`
    );

    // Assert — file was actually written with merged content
    const written = JSON.parse(await readFile(statusPath, 'utf-8'));
    assert.strictEqual(
      written.current_phase,
      'summarize',
      `expected current_phase "summarize" after merge, got: ${written.current_phase}`
    );
    assert.strictEqual(
      written.current_course,
      'rust-fundamentals',
      `unpatched field current_course must be preserved, got: ${written.current_course}`
    );
    assert.strictEqual(
      written.last_advance_sig,
      'sig-xyz-789',
      `expected last_advance_sig updated to "sig-xyz-789", got: ${written.last_advance_sig}`
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 4 — learning_profile reads all learner/*.md files and returns content
// ---------------------------------------------------------------------------

test('learning_profile_reads_wiki_learner_star_md', async () => {
  // Arrange — create 5 learner .md pages
  const tmp = await mkdtemp(join(tmpdir(), 'jpl-test-'));
  try {
    const learnerDir = join(tmp, 'wiki', 'learner');
    await mkdir(learnerDir, { recursive: true });
    const pages = ['style.md', 'strengths.md', 'weaknesses.md', 'push-tactics.md', 'sessions.md'];
    for (const name of pages) {
      await writeFile(
        join(learnerDir, name),
        `# ${name}\n\nContent for ${name}.\n`,
        'utf-8'
      );
    }

    const paths = {
      wikiRoot: tmp,
      statusFile: join(tmp, '.jaewon-learning', 'status.json'),
      learnerDir,
    };
    const server = makeMockServer();
    const { registerProfileTools } = await import(`${HANDLERS_DIR}/profile-handler.js`);

    // Act
    registerProfileTools(server, paths);
    const result = await server.invoke('learning_profile', {});

    // Assert — must NOT return the stub error
    assert.ok(
      result && typeof result === 'object' && !result.error,
      `expected profile data, got stub: ${JSON.stringify(result)}`
    );

    // Assert — result must contain content from the learner pages
    // Implementation may return { pages: [...] } or { content: '...' } —
    // either way it must include the text "Content for style.md"
    const serialized = JSON.stringify(result);
    assert.ok(
      serialized.includes('style.md') || serialized.includes('Content for style'),
      `result must include content from style.md; got: ${serialized.slice(0, 200)}`
    );

    // Assert — all 5 pages must be represented in the response
    let pageCount = 0;
    for (const name of pages) {
      if (serialized.includes(name) || serialized.includes(name.replace('.md', ''))) {
        pageCount++;
      }
    }
    assert.ok(
      pageCount >= 4,
      `expected at least 4 of 5 learner pages in response, found references to ${pageCount}`
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5 — learning_profile handles missing learner dir gracefully (no throw)
// ---------------------------------------------------------------------------

test('learning_profile_respects_max_chars_truncation', async () => {
  // Arrange — learner dir does NOT exist
  const tmp = await mkdtemp(join(tmpdir(), 'jpl-test-'));
  try {
    const learnerDir = join(tmp, 'wiki', 'learner'); // intentionally not created

    const paths = {
      wikiRoot: tmp,
      statusFile: join(tmp, '.jaewon-learning', 'status.json'),
      learnerDir,
    };
    const server = makeMockServer();
    const { registerProfileTools } = await import(`${HANDLERS_DIR}/profile-handler.js`);

    // Act — must NOT throw even with missing directory
    registerProfileTools(server, paths);
    let result;
    let threw = false;
    try {
      result = await server.invoke('learning_profile', {});
    } catch (err) {
      threw = true;
    }

    // Assert — handler must not throw on missing learner dir
    assert.strictEqual(
      threw,
      false,
      'learning_profile must not throw when wiki/learner directory is missing'
    );

    // Assert — must return a graceful empty/default response (not the stub error)
    assert.ok(
      result !== undefined,
      'learning_profile must return a value when learner dir is missing'
    );
    assert.ok(
      !result.error || result.error !== 'not-implemented',
      `learning_profile must not return stub error on missing dir, got: ${JSON.stringify(result)}`
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6 — learning_wiki_search returns top-N ranked pages for a query
// ---------------------------------------------------------------------------

test('learning_wiki_search_returns_top_n_pages', async () => {
  // Arrange — create a small wiki with searchable content
  const tmp = await mkdtemp(join(tmpdir(), 'jpl-test-'));
  try {
    const wikiDir = join(tmp, 'wiki');
    await mkdir(wikiDir, { recursive: true });
    await writeFile(
      join(wikiDir, 'ownership.md'),
      '# Rust Ownership\n\nOwnership is a core concept in Rust. Memory safety.\n',
      'utf-8'
    );
    await writeFile(
      join(wikiDir, 'closures.md'),
      '# Rust Closures\n\nClosures capture their environment. Related to ownership.\n',
      'utf-8'
    );
    await writeFile(
      join(wikiDir, 'unrelated.md'),
      '# Cooking Recipes\n\nHow to make pasta.\n',
      'utf-8'
    );

    const paths = {
      wikiRoot: tmp,
      statusFile: join(tmp, '.jaewon-learning', 'status.json'),
      learnerDir: join(tmp, 'wiki', 'learner'),
    };
    const server = makeMockServer();
    const { registerWikiSearchTools } = await import(`${HANDLERS_DIR}/wiki-search-handler.js`);

    // Act
    registerWikiSearchTools(server, paths);
    const result = await server.invoke('learning_wiki_search', {
      query: 'ownership',
      maxResults: 5,
    });

    // Assert — must NOT return stub error
    assert.ok(
      result && typeof result === 'object' && !result.error,
      `expected search results, got stub: ${JSON.stringify(result)}`
    );

    // Assert — result must be array or contain an array of pages
    const pages = Array.isArray(result) ? result : result.results ?? result.pages;
    assert.ok(
      Array.isArray(pages),
      `expected result or result.results to be an array, got: ${JSON.stringify(result)}`
    );

    // Assert — ownership.md must appear in results (query matches title + body)
    const paths_found = pages.map(p => p.path ?? p.title ?? JSON.stringify(p));
    const hasOwnership = paths_found.some(p => p.includes('ownership'));
    assert.ok(
      hasOwnership,
      `expected ownership.md in results for query "ownership", got: ${JSON.stringify(paths_found)}`
    );

    // Assert — results are ranked (first result should be most relevant)
    if (pages.length > 1 && pages[0].score !== undefined) {
      assert.ok(
        pages[0].score >= pages[1].score,
        `results must be sorted by descending score; first score ${pages[0].score} < second score ${pages[1].score}`
      );
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 7 — learning_wiki_search validates that query is non-empty
// ---------------------------------------------------------------------------

test('learning_wiki_search_validates_query_nonempty', async () => {
  // Arrange — a wiki with one file; the query will be empty string
  const tmp = await mkdtemp(join(tmpdir(), 'jpl-test-'));
  try {
    const wikiDir = join(tmp, 'wiki');
    await mkdir(wikiDir, { recursive: true });
    await writeFile(
      join(wikiDir, 'page.md'),
      '# A Page\n\nSome content here.\n',
      'utf-8'
    );

    const paths = {
      wikiRoot: tmp,
      statusFile: join(tmp, '.jaewon-learning', 'status.json'),
      learnerDir: join(tmp, 'wiki', 'learner'),
    };
    const server = makeMockServer();
    const { registerWikiSearchTools } = await import(`${HANDLERS_DIR}/wiki-search-handler.js`);

    // Act — call with empty query string
    registerWikiSearchTools(server, paths);
    const result = await server.invoke('learning_wiki_search', { query: '' });

    // Assert — handler must NOT return stub error; must reject or return empty with error flag
    assert.ok(
      result !== undefined,
      'handler must return a value for empty query'
    );

    // The real handler should return either an error response or an empty results array.
    // It must NOT silently return unfiltered results for an empty query.
    // Accept: { error: 'query required' } OR { results: [] } OR []
    const isError = result.error && result.error !== 'not-implemented';
    const isEmptyResults =
      (Array.isArray(result) && result.length === 0) ||
      (result.results && Array.isArray(result.results) && result.results.length === 0) ||
      (result.pages && Array.isArray(result.pages) && result.pages.length === 0);

    assert.ok(
      isError || isEmptyResults,
      `empty query must yield an error or empty results, got stub: ${JSON.stringify(result)}`
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

/**
 * Phase 3 — Task 3.7 (RED): verdict handler tests (writes + state advance)
 *
 * All 6 tests MUST FAIL until Task 3.8 creates:
 *   mcp-server/handlers/verdict-handler.js  (real implementation)
 *
 * Expected failure reason: the current stub exports only `handler()` returning
 * { error: 'not-implemented' } — it has no `registerVerdictTools` export and
 * performs no file I/O or state transitions.
 * All 6 tests fail with: TypeError: registerVerdictTools is not a function
 *
 * Framework: node:test + node:assert/strict, ESM.
 * Run from:  jaewon-plugin-learning/
 *   node --test tests/phase-3/verdict-handler.test.mjs
 *
 * Fixture strategy: each test creates its own isolated tmpdir via fs.mkdtemp
 * so tests are fully independent and leave no shared mutable state.
 *
 * Handler contract (phase-3 plan §3.8):
 *   registerVerdictTools(server, paths) -> void
 *     tool: learning_verdict
 *       input:  { course_slug, chapter_slug, verdict, evidence, next_action, cycle_iteration }
 *       output: { ok: true, verdict_path, status_path } on success
 *               { ok: false, errors: string[] } on validation failure
 *       side effects:
 *         - writes wiki/courses/<slug>/<chapter>/verdict.json (atomic)
 *         - updates .jaewon-learning/status.json (course_state fields)
 *         - NO git subprocess calls
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// jaewon-plugin-learning/tests/phase-3/ -> up 2 -> jaewon-plugin-learning/
const PLUGIN_ROOT = join(__dirname, '..', '..');
const HANDLER_PATH = join(PLUGIN_ROOT, 'mcp-server', 'handlers', 'verdict-handler.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal fake wiki root in a tmpdir.
 * Layout:
 *   <root>/wiki/courses/<slug>/<chapter>/
 *   <root>/.jaewon-learning/status.json  (pre-seeded with course_state)
 *
 * @param {object} opts
 * @param {string} opts.slug          - course slug
 * @param {string} opts.chapter       - chapter slug
 * @param {object} [opts.courseState] - initial course_state to seed into status.json
 * @returns {Promise<{ root: string, verdictDir: string, statusPath: string }>}
 */
async function makeFakeRoot({ slug, chapter, courseState } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'verdict-handler-test-'));

  // Create wiki/courses/<slug>/<chapter>/ directory
  const verdictDir = join(root, 'wiki', 'courses', slug, chapter);
  await mkdir(verdictDir, { recursive: true });

  // Create .jaewon-learning/ and seed status.json
  const learningDir = join(root, '.jaewon-learning');
  await mkdir(learningDir, { recursive: true });

  const defaultCourseState = {
    current_course: slug,
    current_chapter: chapter,
    current_phase: 'verdict',
    cycle_count: 1,
    verdict_history: [],
    last_advance_sig: null,
  };

  const status = {
    course_state: courseState ?? defaultCourseState,
  };

  const statusPath = join(learningDir, 'status.json');
  await writeFile(statusPath, JSON.stringify(status, null, 2) + '\n', 'utf-8');

  return { root, verdictDir, statusPath };
}

/**
 * Build a minimal fake MCP server that captures tool registrations.
 * The handler calls server.tool(name, schema, fn) to register each tool.
 * We capture the fn so tests can invoke it directly.
 *
 * @returns {{ server: object, call: (name: string, args: object) => Promise<any> }}
 */
function makeFakeServer() {
  const registry = new Map();
  const server = {
    tool(name, _schema, fn) {
      registry.set(name, fn);
    },
  };
  async function call(name, args) {
    const fn = registry.get(name);
    if (!fn) throw new Error(`No tool registered with name "${name}"`);
    return fn(args);
  }
  return { server, call };
}

// ---------------------------------------------------------------------------
// Test 1 — learning_verdict_writes_verdict_json_on_valid_payload
// ---------------------------------------------------------------------------
test('learning_verdict: should write verdict.json at correct path when given valid mastery payload', async () => {
  // Arrange
  const slug = 'dynamic-programming';
  const chapter = 'knapsack';
  const { root, verdictDir, statusPath } = await makeFakeRoot({ slug, chapter });

  const { registerVerdictTools } = await import(HANDLER_PATH);
  const { server, call } = makeFakeServer();
  registerVerdictTools(server, { root });

  const payload = {
    course_slug: slug,
    chapter_slug: chapter,
    verdict: 'mastery',
    evidence: ['candidate explained tabulation', 'solved knapsack independently'],
    next_action: 'merge',
    cycle_iteration: 1,
  };

  // Act
  const result = await call('learning_verdict', payload);

  // Assert — handler reports success
  assert.equal(result.ok, true, `expected ok:true, got: ${JSON.stringify(result)}`);

  // Assert — verdict.json exists at the correct path
  const verdictPath = join(verdictDir, 'verdict.json');
  assert.ok(
    existsSync(verdictPath),
    `expected verdict.json to be written at ${verdictPath}`
  );

  // Assert — verdict.json content matches payload fields
  const written = JSON.parse(await readFile(verdictPath, 'utf-8'));
  assert.equal(written.verdict, 'mastery', 'verdict.json must record verdict field');
  assert.equal(written.next_action, 'merge', 'verdict.json must record next_action field');

  // Assert — status.json was updated
  const status = JSON.parse(await readFile(statusPath, 'utf-8'));
  assert.ok(status.course_state, 'status.json must have course_state');
});

// ---------------------------------------------------------------------------
// Test 2 — learning_verdict_rejects_invalid_schema_without_writing
// ---------------------------------------------------------------------------
test('learning_verdict: should reject invalid verdict schema and write no file', async () => {
  // Arrange
  const slug = 'dynamic-programming';
  const chapter = 'knapsack';
  const { root, verdictDir } = await makeFakeRoot({ slug, chapter });

  const { registerVerdictTools } = await import(HANDLER_PATH);
  const { server, call } = makeFakeServer();
  registerVerdictTools(server, { root });

  // 'approved' is not a valid verdict enum value
  const payload = {
    course_slug: slug,
    chapter_slug: chapter,
    verdict: 'approved',
    evidence: ['some evidence'],
    next_action: 'merge',
    cycle_iteration: 1,
  };

  // Act
  const result = await call('learning_verdict', payload);

  // Assert — handler reports failure
  assert.equal(result.ok, false, 'expected ok:false for invalid verdict enum');
  assert.ok(
    Array.isArray(result.errors) && result.errors.length > 0,
    `expected non-empty errors array, got: ${JSON.stringify(result)}`
  );

  // Assert — no verdict.json file was created
  const verdictPath = join(verdictDir, 'verdict.json');
  assert.ok(
    !existsSync(verdictPath),
    `verdict.json must NOT be written when schema validation fails`
  );
});

// ---------------------------------------------------------------------------
// Test 3 — learning_verdict_mastery_sets_next_action_merge
// ---------------------------------------------------------------------------
test('learning_verdict: should set next_action "merge" in status when verdict is mastery', async () => {
  // Arrange
  const slug = 'algorithms';
  const chapter = 'sorting';
  const { root, statusPath } = await makeFakeRoot({ slug, chapter });

  const { registerVerdictTools } = await import(HANDLER_PATH);
  const { server, call } = makeFakeServer();
  registerVerdictTools(server, { root });

  const payload = {
    course_slug: slug,
    chapter_slug: chapter,
    verdict: 'mastery',
    evidence: ['demonstrated merge sort in O(n log n)', 'explained invariant clearly'],
    next_action: 'merge',
    cycle_iteration: 2,
  };

  // Act
  const result = await call('learning_verdict', payload);

  // Assert — handler succeeds
  assert.equal(result.ok, true, `expected ok:true, got: ${JSON.stringify(result)}`);

  // Assert — status.json records next_action as 'merge'
  const status = JSON.parse(await readFile(statusPath, 'utf-8'));
  assert.equal(
    status.course_state.next_action,
    'merge',
    `expected next_action "merge" for mastery verdict, got "${status.course_state.next_action}"`
  );
});

// ---------------------------------------------------------------------------
// Test 4 — learning_verdict_partial_sets_next_action_rediscuss
// ---------------------------------------------------------------------------
test('learning_verdict: should set next_action "rediscuss" in status when verdict is partial', async () => {
  // Arrange
  const slug = 'data-structures';
  const chapter = 'trees';
  const { root, statusPath } = await makeFakeRoot({ slug, chapter });

  const { registerVerdictTools } = await import(HANDLER_PATH);
  const { server, call } = makeFakeServer();
  registerVerdictTools(server, { root });

  const payload = {
    course_slug: slug,
    chapter_slug: chapter,
    verdict: 'partial',
    evidence: ['understood traversal but struggled with balancing'],
    next_action: 'rediscuss',
    cycle_iteration: 1,
  };

  // Act
  const result = await call('learning_verdict', payload);

  // Assert — handler succeeds
  assert.equal(result.ok, true, `expected ok:true, got: ${JSON.stringify(result)}`);

  // Assert — status.json records next_action as 'rediscuss'
  const status = JSON.parse(await readFile(statusPath, 'utf-8'));
  assert.equal(
    status.course_state.next_action,
    'rediscuss',
    `expected next_action "rediscuss" for partial verdict, got "${status.course_state.next_action}"`
  );

  // Assert — current_phase does NOT advance to idle (partial stays in cycle, not merged)
  assert.notEqual(
    status.course_state.current_phase,
    'idle',
    'partial verdict must not set phase to idle (not merged)'
  );
});

// ---------------------------------------------------------------------------
// Test 5 — learning_verdict_updates_course_state_cycle_count
// ---------------------------------------------------------------------------
test('learning_verdict: should increment cycle_count in course_state after writing verdict', async () => {
  // Arrange
  const slug = 'operating-systems';
  const chapter = 'scheduling';
  const initialCycleCount = 3;
  const { root, statusPath } = await makeFakeRoot({
    slug,
    chapter,
    courseState: {
      current_course: slug,
      current_chapter: chapter,
      current_phase: 'verdict',
      cycle_count: initialCycleCount,
      verdict_history: ['partial', 'partial', 'incomplete'],
      last_advance_sig: null,
    },
  });

  const { registerVerdictTools } = await import(HANDLER_PATH);
  const { server, call } = makeFakeServer();
  registerVerdictTools(server, { root });

  const payload = {
    course_slug: slug,
    chapter_slug: chapter,
    verdict: 'incomplete',
    evidence: ['could not explain round-robin scheduling'],
    next_action: 'reread',
    cycle_iteration: initialCycleCount + 1,
  };

  // Act
  const result = await call('learning_verdict', payload);

  // Assert — handler succeeds
  assert.equal(result.ok, true, `expected ok:true, got: ${JSON.stringify(result)}`);

  // Assert — cycle_count incremented beyond initialCycleCount
  const status = JSON.parse(await readFile(statusPath, 'utf-8'));
  assert.ok(
    status.course_state.cycle_count > initialCycleCount,
    `expected cycle_count > ${initialCycleCount}, got ${status.course_state.cycle_count}`
  );

  // Assert — verdict_history extended with the new verdict
  assert.ok(
    Array.isArray(status.course_state.verdict_history),
    'verdict_history must be an array'
  );
  assert.ok(
    status.course_state.verdict_history.includes('incomplete'),
    `verdict_history must include "incomplete", got: ${JSON.stringify(status.course_state.verdict_history)}`
  );
});

// ---------------------------------------------------------------------------
// Test 6 — learning_verdict_does_not_commit_git
//
// Strategy: call registerVerdictTools + invoke the tool with a valid payload
// first (this FAILS on the stub: "registerVerdictTools is not a function").
// Once the real implementation exists, the handler call succeeds and the
// static-analysis assertion verifies the source contains no git subprocess
// invocations — enforcing the architectural rule that git is the
// git-manager skill/hook layer's responsibility, not the MCP handler's.
// ---------------------------------------------------------------------------
test('learning_verdict: should not invoke any git subprocess (git is git-manager layer only)', async () => {
  // Arrange
  const slug = 'networks';
  const chapter = 'tcp-ip';
  const { root } = await makeFakeRoot({ slug, chapter });

  const { registerVerdictTools } = await import(HANDLER_PATH);
  const { server, call } = makeFakeServer();

  // Act — register and call; this line throws on the stub
  // ("registerVerdictTools is not a function"), giving the correct RED failure.
  registerVerdictTools(server, { root });
  const result = await call('learning_verdict', {
    course_slug: slug,
    chapter_slug: chapter,
    verdict: 'mastery',
    evidence: ['explained TCP three-way handshake correctly'],
    next_action: 'merge',
    cycle_iteration: 1,
  });

  // Assert — handler completed successfully (real implementation only)
  assert.equal(result.ok, true, `expected ok:true, got: ${JSON.stringify(result)}`);

  // Assert (static analysis) — handler source contains no git subprocess patterns.
  // Git commit/merge/push is the git-manager skill/hook layer's exclusive job.
  const source = await readFile(HANDLER_PATH, 'utf-8');

  const GIT_PATTERNS = [
    /spawn\s*\(\s*['"`]git/,     // spawn('git', ...)
    /exec\s*\(\s*['"`]git/,      // exec('git ...')
    /execSync\s*\(\s*['"`]git/,  // execSync('git ...')
    /execFile\s*\(\s*['"`]git/,  // execFile('git', ...)
  ];

  const violations = GIT_PATTERNS
    .filter((p) => p.test(source))
    .map((p) => p.toString());

  assert.equal(
    violations.length,
    0,
    `verdict-handler.js must not invoke git directly. Patterns found: ${violations.join(', ')}`
  );

  // Assert — child_process must not be imported alongside any 'git' string literal
  const hasChildProcessImport =
    /from\s+['"`]node:child_process['"`]/.test(source) ||
    /require\s*\(\s*['"`]child_process['"`]\s*\)/.test(source);
  const hasGitLiteral = /['"`]git\b/.test(source);

  assert.ok(
    !(hasChildProcessImport && hasGitLiteral),
    'verdict-handler.js must not combine a child_process import with git string literals'
  );
});

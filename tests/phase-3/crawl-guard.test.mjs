/**
 * Phase 3 — Task 3.10 (RED): crawl-guard handler tests (circuit breaker)
 *
 * All 9 tests MUST FAIL until Task 3.11 creates:
 *   mcp-server/handlers/crawl-guard-handler.js
 *
 * Expected failure reason: ERR_MODULE_NOT_FOUND — crawl-guard-handler.js does not exist yet.
 *
 * Framework: node:test + node:assert/strict, ESM.
 * Run from:  jaewon-plugin-learning/
 *   node --test tests/phase-3/crawl-guard.test.mjs
 *
 * Fixture: per-test tmpdir via fs.mkdtemp (each test is independent).
 *
 * Contract under test (task 3.11 calling spec):
 *   registerCrawlGuardTools(server, paths, { now? }) -> void
 *   tool: learning_crawl_guard
 *     input:  { course_slug, action, estimated_tokens?, source_url?, tokens_used?, limits? }
 *     output:
 *       begin  -> { ok, budget_path, limits }
 *       check  -> { allow, reason?, remaining: {sources, elapsed_ms, tokens} }
 *       record -> { ok, counters: {sources_fetched, tokens_spent, elapsed_ms} }
 *       end    -> { ok, summary: {sources_fetched, elapsed_ms, tokens_spent} }
 *     side effects: reads + writes .jaewon-learning/crawl-budget.json
 *     FAILS CLOSED: corrupt/missing/unreadable budget -> deny (allow:false)
 *     clock is injectable via third arg { now: () => number } for determinism
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
// This file: jaewon-plugin-learning/tests/phase-3/crawl-guard.test.mjs
// Plugin root: jaewon-plugin-learning/
const HANDLERS_DIR = join(__dirname, '..', '..', 'mcp-server', 'handlers');

/**
 * Dynamically import crawl-guard-handler.js.
 * Called inside each test so each test gets its own ERR_MODULE_NOT_FOUND
 * failure rather than a single file-level crash.
 */
async function importHandler() {
  return import(`${HANDLERS_DIR}/crawl-guard-handler.js`);
}

/**
 * Create a minimal fake MCP server that captures tool registrations.
 * registerCrawlGuardTools(server, paths) registers "learning_crawl_guard" on it.
 * Calling server.call(args) invokes the registered handler.
 */
function makeFakeServer() {
  const tools = {};
  return {
    tool(name, _description, _schema, handler) {
      tools[name] = handler;
    },
    async call(name, args) {
      if (!tools[name]) throw new Error(`tool not registered: ${name}`);
      return tools[name](args);
    },
  };
}

/**
 * Create a standard tmpdir with a .jaewon-learning/ sub-directory.
 * Returns { base, learningDir, budgetPath }.
 */
async function makeTmpLearningDir() {
  const base = await mkdtemp(join(tmpdir(), 'crawl-guard-'));
  const learningDir = join(base, '.jaewon-learning');
  await mkdir(learningDir, { recursive: true });
  const budgetPath = join(learningDir, 'crawl-budget.json');
  return { base, learningDir, budgetPath };
}

// ---------------------------------------------------------------------------
// Test 1 — crawl_guard_init_creates_budget_file_with_defaults
// begin action writes crawl-budget.json with default limits + zero counters,
// validated against crawl-budget schema.
// ---------------------------------------------------------------------------
test('crawl_guard_init_creates_budget_file_with_defaults', async () => {
  // Arrange
  const { registerCrawlGuardTools } = await importHandler();
  const { base, budgetPath } = await makeTmpLearningDir();
  const server = makeFakeServer();
  const fixedNow = Date.parse('2026-04-16T09:00:00.000Z');
  registerCrawlGuardTools(server, { learningDir: join(base, '.jaewon-learning') }, { now: () => fixedNow });

  // Act
  const result = await server.call('learning_crawl_guard', {
    course_slug: 'dynamic-programming',
    action: 'begin',
  });

  // Assert — handler responds ok
  assert.equal(result.ok, true, `expected ok:true from begin, got: ${JSON.stringify(result)}`);

  // Assert — budget file was written
  const raw = await readFile(budgetPath, 'utf8');
  const budget = JSON.parse(raw);

  // counters start at zero
  assert.equal(budget.sources_fetched, 0, 'sources_fetched must start at 0');
  assert.equal(budget.elapsed_ms, 0, 'elapsed_ms must start at 0');
  assert.equal(budget.tokens_spent, 0, 'tokens_spent must start at 0');

  // default limits applied
  assert.equal(budget.limits.max_sources, 10, 'default max_sources must be 10');
  assert.equal(budget.limits.max_elapsed_ms, 300000, 'default max_elapsed_ms must be 300000');
  assert.equal(budget.limits.max_tokens, 50000, 'default max_tokens must be 50000');

  // schema fields present
  assert.equal(typeof budget.course_slug, 'string', 'course_slug must be a string');
  assert.equal(typeof budget.started_at, 'string', 'started_at must be a string (ISO timestamp)');

  // result includes budget_path and limits
  assert.equal(typeof result.budget_path, 'string', 'result.budget_path must be a string');
  assert.ok(result.limits, 'result.limits must be present');
  assert.equal(result.limits.max_sources, 10);
  assert.equal(result.limits.max_elapsed_ms, 300000);
  assert.equal(result.limits.max_tokens, 50000);
});

// ---------------------------------------------------------------------------
// Test 2 — crawl_guard_check_returns_allow_when_under_limits
// check action returns allow:true when all counters are zero and estimated
// tokens keep us under the budget.
// ---------------------------------------------------------------------------
test('crawl_guard_check_returns_allow_when_under_limits', async () => {
  // Arrange
  const { registerCrawlGuardTools } = await importHandler();
  const { base } = await makeTmpLearningDir();
  const server = makeFakeServer();
  const fixedNow = Date.parse('2026-04-16T09:00:00.000Z');
  registerCrawlGuardTools(server, { learningDir: join(base, '.jaewon-learning') }, { now: () => fixedNow });

  // Initialize the budget first
  await server.call('learning_crawl_guard', { course_slug: 'dynamic-programming', action: 'begin' });

  // Act — check with 1000 estimated tokens (well under 50000 limit)
  const result = await server.call('learning_crawl_guard', {
    course_slug: 'dynamic-programming',
    action: 'check',
    estimated_tokens: 1000,
  });

  // Assert
  assert.equal(result.allow, true, `expected allow:true, got: ${JSON.stringify(result)}`);
  assert.ok(result.remaining, 'result.remaining must be present');
  assert.equal(result.remaining.sources, 9, 'remaining sources should be 9 (10 - 0 used)');
  assert.equal(result.remaining.elapsed_ms, 300000, 'remaining elapsed_ms should be full budget');
  assert.equal(result.remaining.tokens, 49000, 'remaining tokens should be 50000 - 1000 estimated');
});

// ---------------------------------------------------------------------------
// Test 3 — crawl_guard_check_returns_deny_when_sources_exceeded
// After 10 record calls, check must return allow:false with reason 'sources_exceeded'.
// ---------------------------------------------------------------------------
test('crawl_guard_check_returns_deny_when_sources_exceeded', async () => {
  // Arrange
  const { registerCrawlGuardTools } = await importHandler();
  const { base } = await makeTmpLearningDir();
  const server = makeFakeServer();
  const fixedNow = Date.parse('2026-04-16T09:00:00.000Z');
  registerCrawlGuardTools(server, { learningDir: join(base, '.jaewon-learning') }, { now: () => fixedNow });

  await server.call('learning_crawl_guard', { course_slug: 'dynamic-programming', action: 'begin' });

  // Record 10 sources to hit the max_sources limit
  for (let i = 0; i < 10; i++) {
    await server.call('learning_crawl_guard', {
      course_slug: 'dynamic-programming',
      action: 'record',
      source_url: `https://example.com/source-${i}`,
      tokens_used: 100,
    });
  }

  // Act
  const result = await server.call('learning_crawl_guard', {
    course_slug: 'dynamic-programming',
    action: 'check',
    estimated_tokens: 100,
  });

  // Assert
  assert.equal(result.allow, false, `expected allow:false after 10 sources, got: ${JSON.stringify(result)}`);
  assert.equal(result.reason, 'sources_exceeded', `expected reason 'sources_exceeded', got: ${result.reason}`);
  assert.equal(result.limit_hit, 'max_sources', `expected limit_hit 'max_sources', got: ${result.limit_hit}`);
});

// ---------------------------------------------------------------------------
// Test 4 — crawl_guard_check_returns_deny_when_elapsed_exceeded
// Simulate started_at 6 minutes ago (360000 ms > 300000 ms limit).
// check must return allow:false with reason 'elapsed_exceeded'.
// ---------------------------------------------------------------------------
test('crawl_guard_check_returns_deny_when_elapsed_exceeded', async () => {
  // Arrange
  const { registerCrawlGuardTools } = await importHandler();
  const { base, budgetPath } = await makeTmpLearningDir();

  // Use two different clock values: begin at T=0, check at T=360000 (6 min later)
  const startTime = Date.parse('2026-04-16T09:00:00.000Z');
  const sixMinutesLater = startTime + 360000;
  let callCount = 0;
  const clockFn = () => {
    // First call is begin, subsequent calls are check
    callCount++;
    return callCount === 1 ? startTime : sixMinutesLater;
  };

  const server = makeFakeServer();
  registerCrawlGuardTools(server, { learningDir: join(base, '.jaewon-learning') }, { now: clockFn });

  await server.call('learning_crawl_guard', { course_slug: 'dynamic-programming', action: 'begin' });

  // Act — check is called at "now" = sixMinutesLater
  const result = await server.call('learning_crawl_guard', {
    course_slug: 'dynamic-programming',
    action: 'check',
    estimated_tokens: 100,
  });

  // Assert
  assert.equal(result.allow, false, `expected allow:false after 6 min elapsed, got: ${JSON.stringify(result)}`);
  assert.equal(result.reason, 'elapsed_exceeded', `expected reason 'elapsed_exceeded', got: ${result.reason}`);
});

// ---------------------------------------------------------------------------
// Test 5 — crawl_guard_check_returns_deny_when_tokens_exceeded
// tokens_spent=49000, estimated_tokens=2000 -> total 51000 > 50000 limit.
// check must return allow:false with reason 'tokens_exceeded'.
// ---------------------------------------------------------------------------
test('crawl_guard_check_returns_deny_when_tokens_exceeded', async () => {
  // Arrange
  const { registerCrawlGuardTools } = await importHandler();
  const { base, budgetPath } = await makeTmpLearningDir();
  const server = makeFakeServer();
  const fixedNow = Date.parse('2026-04-16T09:00:00.000Z');
  registerCrawlGuardTools(server, { learningDir: join(base, '.jaewon-learning') }, { now: () => fixedNow });

  await server.call('learning_crawl_guard', { course_slug: 'dynamic-programming', action: 'begin' });

  // Record 49000 tokens (one big record call)
  await server.call('learning_crawl_guard', {
    course_slug: 'dynamic-programming',
    action: 'record',
    source_url: 'https://example.com/big-source',
    tokens_used: 49000,
  });

  // Act — check with 2000 more estimated tokens would push total to 51000
  const result = await server.call('learning_crawl_guard', {
    course_slug: 'dynamic-programming',
    action: 'check',
    estimated_tokens: 2000,
  });

  // Assert
  assert.equal(result.allow, false, `expected allow:false when tokens exceeded, got: ${JSON.stringify(result)}`);
  assert.equal(result.reason, 'tokens_exceeded', `expected reason 'tokens_exceeded', got: ${result.reason}`);
});

// ---------------------------------------------------------------------------
// Test 6 — crawl_guard_record_increments_counters_atomically
// Two sequential record calls must both increment; final counters are consistent.
// Also validates that sources_fetched++ and tokens_spent += N work correctly.
// ---------------------------------------------------------------------------
test('crawl_guard_record_increments_counters_atomically', async () => {
  // Arrange
  const { registerCrawlGuardTools } = await importHandler();
  const { base, budgetPath } = await makeTmpLearningDir();
  const server = makeFakeServer();
  const fixedNow = Date.parse('2026-04-16T09:00:00.000Z');
  registerCrawlGuardTools(server, { learningDir: join(base, '.jaewon-learning') }, { now: () => fixedNow });

  await server.call('learning_crawl_guard', { course_slug: 'dynamic-programming', action: 'begin' });

  // Act — first record
  const r1 = await server.call('learning_crawl_guard', {
    course_slug: 'dynamic-programming',
    action: 'record',
    source_url: 'https://example.com/source-1',
    tokens_used: 500,
  });

  // Assert first record
  assert.equal(r1.ok, true, `expected ok:true from first record, got: ${JSON.stringify(r1)}`);
  assert.equal(r1.counters.sources_fetched, 1, 'sources_fetched should be 1 after first record');
  assert.equal(r1.counters.tokens_spent, 500, 'tokens_spent should be 500 after first record');

  // Act — second record
  const r2 = await server.call('learning_crawl_guard', {
    course_slug: 'dynamic-programming',
    action: 'record',
    source_url: 'https://example.com/source-2',
    tokens_used: 300,
  });

  // Assert second record — counters accumulated correctly
  assert.equal(r2.ok, true, `expected ok:true from second record, got: ${JSON.stringify(r2)}`);
  assert.equal(r2.counters.sources_fetched, 2, 'sources_fetched should be 2 after second record');
  assert.equal(r2.counters.tokens_spent, 800, 'tokens_spent should be 800 (500 + 300) after second record');

  // Assert — budget file on disk matches the counters returned
  const raw = await readFile(budgetPath, 'utf8');
  const budget = JSON.parse(raw);
  assert.equal(budget.sources_fetched, 2, 'budget file sources_fetched must be 2');
  assert.equal(budget.tokens_spent, 800, 'budget file tokens_spent must be 800');
});

// ---------------------------------------------------------------------------
// Test 7 — crawl_guard_record_rejects_unknown_course
// record called before begin (no budget file exists) must return ok:false.
// The handler must not create a budget file as a side effect of a failed record.
// ---------------------------------------------------------------------------
test('crawl_guard_record_rejects_unknown_course', async () => {
  // Arrange — no begin call; learning dir exists but has no budget file
  const { registerCrawlGuardTools } = await importHandler();
  const { base, budgetPath } = await makeTmpLearningDir();
  const server = makeFakeServer();
  const fixedNow = Date.parse('2026-04-16T09:00:00.000Z');
  registerCrawlGuardTools(server, { learningDir: join(base, '.jaewon-learning') }, { now: () => fixedNow });

  // Act — record without a preceding begin
  const result = await server.call('learning_crawl_guard', {
    course_slug: 'dynamic-programming',
    action: 'record',
    source_url: 'https://example.com/source-1',
    tokens_used: 500,
  });

  // Assert — must reject with ok:false, not throw and not silently succeed
  assert.equal(result.ok, false, `expected ok:false for record without begin, got: ${JSON.stringify(result)}`);

  // Assert — budget file must NOT have been created as a side effect
  await assert.rejects(
    () => readFile(budgetPath, 'utf8'),
    { code: 'ENOENT' },
    'budget file must not be created by a failed record call'
  );
});

// ---------------------------------------------------------------------------
// Test 8 — crawl_guard_end_finalizes_and_returns_summary
// end action must write crawl-manifest.json, delete the budget file,
// and return { ok, summary: {sources_fetched, elapsed_ms, tokens_spent} }.
// Subsequent check must return allow:false with reason 'no_active_budget'.
// ---------------------------------------------------------------------------
test('crawl_guard_end_finalizes_and_returns_summary', async () => {
  // Arrange
  const { registerCrawlGuardTools } = await importHandler();
  const { base, learningDir, budgetPath } = await makeTmpLearningDir();
  const server = makeFakeServer();
  const fixedNow = Date.parse('2026-04-16T09:00:00.000Z');
  registerCrawlGuardTools(server, { learningDir }, { now: () => fixedNow });

  await server.call('learning_crawl_guard', { course_slug: 'dynamic-programming', action: 'begin' });
  await server.call('learning_crawl_guard', {
    course_slug: 'dynamic-programming',
    action: 'record',
    source_url: 'https://example.com/source-1',
    tokens_used: 1200,
  });

  // Act
  const result = await server.call('learning_crawl_guard', {
    course_slug: 'dynamic-programming',
    action: 'end',
  });

  // Assert — end response
  assert.equal(result.ok, true, `expected ok:true from end, got: ${JSON.stringify(result)}`);
  assert.ok(result.summary, 'result.summary must be present');
  assert.equal(result.summary.sources_fetched, 1, 'summary.sources_fetched must be 1');
  assert.equal(result.summary.tokens_spent, 1200, 'summary.tokens_spent must be 1200');
  assert.equal(typeof result.summary.elapsed_ms, 'number', 'summary.elapsed_ms must be a number');

  // Assert — budget file is finalized (either removed or marked finalized:true)
  // The plan spec says "marks budget file finalized:true"; accept either removal or finalized flag
  let budgetGone = false;
  try {
    const raw = await readFile(budgetPath, 'utf8');
    const budget = JSON.parse(raw);
    assert.equal(budget.finalized, true, 'budget file must have finalized:true after end');
  } catch (err) {
    if (err.code === 'ENOENT') {
      budgetGone = true; // file removed — also acceptable per task brief
    } else {
      throw err;
    }
  }

  // Assert — subsequent check returns blocked with 'no_active_budget'
  const checkResult = await server.call('learning_crawl_guard', {
    course_slug: 'dynamic-programming',
    action: 'check',
    estimated_tokens: 100,
  });
  assert.equal(checkResult.allow, false, `expected allow:false after end, got: ${JSON.stringify(checkResult)}`);
  assert.equal(
    checkResult.reason,
    'no_active_budget',
    `expected reason 'no_active_budget', got: ${checkResult.reason}`
  );
});

// ---------------------------------------------------------------------------
// Test 9 — crawl_guard_fails_closed_on_corrupt_budget_file
// Malformed JSON in the budget file must produce allow:false, never allow:true.
// The handler must never silently allow a crawl when it cannot read the state.
// ---------------------------------------------------------------------------
test('crawl_guard_fails_closed_on_corrupt_budget_file', async () => {
  // Arrange — write deliberately unparseable JSON to the budget file
  const { registerCrawlGuardTools } = await importHandler();
  const { base, learningDir, budgetPath } = await makeTmpLearningDir();
  const server = makeFakeServer();
  const fixedNow = Date.parse('2026-04-16T09:00:00.000Z');
  registerCrawlGuardTools(server, { learningDir }, { now: () => fixedNow });

  // Write corrupt JSON directly — bypassing the handler
  await writeFile(budgetPath, '{ "course_slug": "dynamic-programming", "tokens_spent": %%%BROKEN%%%', 'utf8');

  // Act — check must fail closed, not throw an unhandled exception
  const result = await server.call('learning_crawl_guard', {
    course_slug: 'dynamic-programming',
    action: 'check',
    estimated_tokens: 100,
  });

  // Assert — must deny, never silently allow
  assert.equal(
    result.allow,
    false,
    `FAILS CLOSED violated: expected allow:false on corrupt budget file, got allow:true`
  );
  assert.ok(
    result.reason,
    'result.reason must be present explaining the deny'
  );
  // The reason should communicate the corruption, not just a limit check
  const validReasons = ['corrupt_budget', 'no_active_budget', 'parse_error', 'invalid_budget'];
  assert.ok(
    validReasons.includes(result.reason),
    `expected reason to be one of ${JSON.stringify(validReasons)}, got: ${result.reason}`
  );
});

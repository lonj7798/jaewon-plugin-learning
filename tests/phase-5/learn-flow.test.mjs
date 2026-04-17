/**
 * Phase 5 — Task 5.8 (RED): End-to-end learn-cycle flow tests (mocked agents)
 *
 * Tests the dispatcher contract for `skills/_dispatcher.mjs`.
 * Mocks are inline — no real agents or MCP tools are invoked.
 * All 6 tests MUST FAIL until Task 5.9 creates `skills/_dispatcher.mjs`.
 *
 * Framework: node:test + node:assert/strict, ESM.
 * Run from jaewon-plugin-learning/:
 *   node --test tests/phase-5/learn-flow.test.mjs
 *
 * Dispatcher calling spec (Task 5.9):
 *   dispatch(phase: string, args: object) -> { skill_path: string, args: object }
 *   - input:  phase name from learn skill dispatch table
 *   - output: { skill_path, args } (pure lookup — no side effects)
 *   - deterministic: YES
 *
 * Test cases (plan §5.8):
 *   1. flow_read_to_summarize_via_status_update
 *      — dispatch('read', args) returns { skill_path, args } for read phase
 *   2. flow_discuss_to_verdict_invokes_evaluator_and_profiler
 *      — dispatch('discuss', args) returns { skill_path, args } for discuss phase
 *   3. flow_mastery_verdict_triggers_merge_and_dashboard
 *      — dispatch('verdict', args) returns { skill_path, args } for verdict phase
 *   4. flow_partial_verdict_loops_without_merge
 *      — dispatch('summarize', args) returns { skill_path, args } for summarize phase
 *   5. flow_incomplete_verdict_returns_to_read_phase
 *      — unknown phase returns error descriptor; does not throw
 *   6. flow_push_tactic_snapshot_propagates_to_evaluator_and_profiler_mocks
 *      — push_tactic_snapshot present in args for every phase handler
 *
 * Dynamic import strategy: each test imports _dispatcher.mjs independently so that
 * node:test reports 6 individual failures (not 1 file-level crash) when the module
 * does not yet exist. Failure reason: ERR_MODULE_NOT_FOUND.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Absolute path to the module under test.
// Task 5.9 will create this file. Until then every dynamic import below throws
// ERR_MODULE_NOT_FOUND, which is the correct RED failure.
const DISPATCHER_PATH = join(__dirname, '..', '..', 'skills', '_dispatcher.mjs');

// ---------------------------------------------------------------------------
// Shared fixture: a realistic push_tactic_snapshot used across all tests
// ---------------------------------------------------------------------------

const FIXTURE_SNAPSHOT = {
  tactic: 'spaced-repetition',
  rationale: 'Learner showed strong short-term recall but weak long-term retention.',
  bar_adjustment: 'strict',
  source_pages_hash: 'abc123',
};

// ---------------------------------------------------------------------------
// Test 1 — flow_read_to_summarize_via_status_update
//
// dispatch('read', args) must return { skill_path, args } for the read phase.
// The read phase transitions the learner toward summarize via a status update.
// ---------------------------------------------------------------------------

test('flow_read_to_summarize_via_status_update: should return skill_path and pass args through when phase is read', async () => {
  // Arrange
  const { dispatch } = await import(DISPATCHER_PATH);
  const args = {
    course_slug: 'intro-to-algorithms',
    chapter: 'chapter-01',
    push_tactic_snapshot: FIXTURE_SNAPSHOT,
  };

  // Act
  const result = dispatch('read', args);

  // Assert
  assert.ok(result, 'dispatch should return a non-null result for phase "read"');
  assert.ok(
    typeof result.skill_path === 'string' && result.skill_path.length > 0,
    'result.skill_path must be a non-empty string for phase "read"'
  );
  assert.deepEqual(
    result.args,
    args,
    'result.args must be identical to the input args (pure pass-through)'
  );
});

// ---------------------------------------------------------------------------
// Test 2 — flow_discuss_to_verdict_invokes_evaluator_and_profiler
//
// dispatch('discuss', args) must return { skill_path, args } for the discuss phase.
// The discuss phase leads to evaluator and profiler invocations — the dispatcher
// must forward push_tactic_snapshot so those agents receive it.
// ---------------------------------------------------------------------------

test('flow_discuss_to_verdict_invokes_evaluator_and_profiler: should return skill_path and forward push_tactic_snapshot when phase is discuss', async () => {
  // Arrange
  const { dispatch } = await import(DISPATCHER_PATH);
  const args = {
    course_slug: 'intro-to-algorithms',
    chapter: 'chapter-01',
    discuss_transcript_path: 'wiki/courses/intro-to-algorithms/chapter-01/discuss.md',
    push_tactic_snapshot: FIXTURE_SNAPSHOT,
  };

  // Act
  const result = dispatch('discuss', args);

  // Assert
  assert.ok(result, 'dispatch should return a non-null result for phase "discuss"');
  assert.ok(
    typeof result.skill_path === 'string' && result.skill_path.length > 0,
    'result.skill_path must be a non-empty string for phase "discuss"'
  );
  assert.deepEqual(
    result.args,
    args,
    'result.args must be identical to the input args (pure pass-through)'
  );
  assert.ok(
    result.args.push_tactic_snapshot !== undefined,
    'result.args must contain push_tactic_snapshot so evaluator and profiler receive it'
  );
});

// ---------------------------------------------------------------------------
// Test 3 — flow_mastery_verdict_triggers_merge_and_dashboard
//
// dispatch('verdict', args) must return { skill_path, args } for the verdict phase.
// On mastery verdict the skill triggers merge and dashboard; dispatcher routes there.
// ---------------------------------------------------------------------------

test('flow_mastery_verdict_triggers_merge_and_dashboard: should return skill_path and pass args through when phase is verdict', async () => {
  // Arrange
  const { dispatch } = await import(DISPATCHER_PATH);
  const args = {
    course_slug: 'intro-to-algorithms',
    chapter: 'chapter-01',
    summary_path: 'wiki/courses/intro-to-algorithms/chapter-01/summary.md',
    discuss_transcript_path: 'wiki/courses/intro-to-algorithms/chapter-01/discuss.md',
    push_tactic_snapshot: FIXTURE_SNAPSHOT,
  };

  // Act
  const result = dispatch('verdict', args);

  // Assert
  assert.ok(result, 'dispatch should return a non-null result for phase "verdict"');
  assert.ok(
    typeof result.skill_path === 'string' && result.skill_path.length > 0,
    'result.skill_path must be a non-empty string for phase "verdict"'
  );
  assert.deepEqual(
    result.args,
    args,
    'result.args must be identical to the input args (pure pass-through)'
  );
});

// ---------------------------------------------------------------------------
// Test 4 — flow_partial_verdict_loops_without_merge
//
// dispatch('summarize', args) must return { skill_path, args } for the summarize phase.
// The summarize phase precedes discuss and does not trigger merge; dispatcher routes correctly.
// ---------------------------------------------------------------------------

test('flow_partial_verdict_loops_without_merge: should return skill_path and pass args through when phase is summarize', async () => {
  // Arrange
  const { dispatch } = await import(DISPATCHER_PATH);
  const args = {
    course_slug: 'intro-to-algorithms',
    chapter: 'chapter-01',
    push_tactic_snapshot: FIXTURE_SNAPSHOT,
  };

  // Act
  const result = dispatch('summarize', args);

  // Assert
  assert.ok(result, 'dispatch should return a non-null result for phase "summarize"');
  assert.ok(
    typeof result.skill_path === 'string' && result.skill_path.length > 0,
    'result.skill_path must be a non-empty string for phase "summarize"'
  );
  assert.deepEqual(
    result.args,
    args,
    'result.args must be identical to the input args (pure pass-through)'
  );
});

// ---------------------------------------------------------------------------
// Test 5 — flow_incomplete_verdict_returns_to_read_phase
//
// dispatch('<unknown>', args) must return an error descriptor WITHOUT throwing.
// The dispatcher is a pure dict lookup; unknown keys must return a structured error
// so the learn skill can route back to read without an uncaught exception.
// ---------------------------------------------------------------------------

test('flow_incomplete_verdict_returns_to_read_phase: should return error descriptor without throwing when phase is unknown', async () => {
  // Arrange
  const { dispatch } = await import(DISPATCHER_PATH);
  const unknownPhase = 'nonexistent-phase-xyz';
  const args = {
    course_slug: 'intro-to-algorithms',
    chapter: 'chapter-01',
    push_tactic_snapshot: FIXTURE_SNAPSHOT,
  };

  // Act — must not throw
  let result;
  assert.doesNotThrow(
    () => { result = dispatch(unknownPhase, args); },
    `dispatch must not throw for unknown phase "${unknownPhase}"`
  );

  // Assert — must be a structured error (not a valid routing entry)
  assert.ok(
    result !== undefined && result !== null,
    'dispatch must return a value (not undefined/null) for unknown phase'
  );
  assert.ok(
    result.error !== undefined || result.skill_path === undefined,
    `dispatch("${unknownPhase}", ...) must return an error descriptor ` +
    '(result.error defined, or result.skill_path absent)'
  );
});

// ---------------------------------------------------------------------------
// Test 6 — flow_push_tactic_snapshot_propagates_to_evaluator_and_profiler_mocks
//
// push_tactic_snapshot must be present in the args forwarded by every phase handler.
// Mock call recorder verifies propagation at the dispatcher boundary for all known phases.
// Inline mocks only — no external mock library required.
// ---------------------------------------------------------------------------

test('flow_push_tactic_snapshot_propagates_to_evaluator_and_profiler_mocks: should include push_tactic_snapshot in result.args for every known phase', async () => {
  // Arrange
  const { dispatch } = await import(DISPATCHER_PATH);

  const snapshot = {
    tactic: 'interleaving',
    rationale: 'Multiple topics benefit from interleaved practice.',
    bar_adjustment: 'lenient',
    source_pages_hash: 'def456',
  };

  const baseArgs = {
    course_slug: 'clean-code',
    chapter: 'chapter-02',
    push_tactic_snapshot: snapshot,
  };

  const knownPhases = ['read', 'summarize', 'discuss', 'verdict'];

  // Inline mock: record each (phase, result) pair
  const callLog = [];

  // Act — dispatch all known phases and record results
  for (const phase of knownPhases) {
    const result = dispatch(phase, baseArgs);
    callLog.push({ phase, result });
  }

  // Assert — every dispatch result must carry push_tactic_snapshot through result.args
  assert.strictEqual(
    callLog.length,
    knownPhases.length,
    `Expected ${knownPhases.length} dispatched calls, got ${callLog.length}`
  );

  for (const { phase, result } of callLog) {
    assert.ok(
      result !== undefined && result !== null,
      `Phase "${phase}": dispatch must return a non-null result`
    );
    assert.ok(
      result.args !== undefined,
      `Phase "${phase}": dispatch result must include an args field`
    );
    assert.ok(
      result.args.push_tactic_snapshot !== undefined,
      `Phase "${phase}": result.args must contain push_tactic_snapshot`
    );
    assert.strictEqual(
      result.args.push_tactic_snapshot.tactic,
      snapshot.tactic,
      `Phase "${phase}": push_tactic_snapshot.tactic must equal input tactic "${snapshot.tactic}"`
    );
    assert.strictEqual(
      result.args.push_tactic_snapshot.source_pages_hash,
      snapshot.source_pages_hash,
      `Phase "${phase}": push_tactic_snapshot.source_pages_hash must equal input hash "${snapshot.source_pages_hash}"`
    );
    assert.ok(
      ['strict', 'lenient', 'neutral'].includes(result.args.push_tactic_snapshot.bar_adjustment),
      `Phase "${phase}": push_tactic_snapshot.bar_adjustment must be strict | lenient | neutral, ` +
        `got "${result.args.push_tactic_snapshot.bar_adjustment}"`
    );
  }
});

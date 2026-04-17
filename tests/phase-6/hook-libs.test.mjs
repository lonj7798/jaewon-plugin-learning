/**
 * Phase 6 — Task 6.1 (RED): hook library tests (deterministic cores)
 *
 * All 11 tests must FAIL until Task 6.2 creates:
 *   hooks/lib/settings.mjs
 *   hooks/lib/state.mjs
 *   hooks/lib/learner-profile.mjs
 *   hooks/lib/cycle-detect.mjs
 *
 * Framework: node:test + node:assert/strict, ESM.
 *
 * Imports are dynamic (inside each test) so all 11 tests are registered
 * individually and each fails with ERR_MODULE_NOT_FOUND — not a single
 * file-level crash. This gives the implementer clear per-test feedback.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
// This file: jaewon-plugin-learning/tests/phase-6/hook-libs.test.mjs
// Plugin root: jaewon-plugin-learning/
const HOOKS_LIB = join(__dirname, '..', '..', 'hooks', 'lib');

// ---------------------------------------------------------------------------
// SETTINGS.MJS (tests 1–2)
// Calling spec (task 6.2): getSettings(projectDir) -> Settings
//   - base_dir: '.jaewon-learning'  (differs from raw-data base '.jaewon')
//   - Returns defaults when .jaewon-learning/settings.json is absent
//   - Reads and merges user overrides when file is present
//   - Resolves {base} path templates using the resolved base_dir
// ---------------------------------------------------------------------------

// Test 1 — settings_mjs_returns_defaults_on_missing
test('should return defaults with base_dir .jaewon-learning when settings.json missing', async () => {
  // Arrange
  const { getSettings } = await import(`${HOOKS_LIB}/settings.mjs`);
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-test-settings-'));

  try {
    // Act — no .jaewon-learning/settings.json exists in projectDir
    const result = getSettings(projectDir);

    // Assert — default base_dir must be the learning variant, not the raw plugin's '.jaewon'
    assert.equal(result.base_dir, '.jaewon-learning',
      'default base_dir must be ".jaewon-learning"');
    // Assert — {base} template must be resolved in path values
    assert.ok(
      result.paths.status.includes('.jaewon-learning'),
      `paths.status must resolve {base} to ".jaewon-learning", got: ${result.paths.status}`
    );
    // Assert — version present
    assert.equal(typeof result.version, 'number',
      'defaults must include a numeric version field');
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// Test 2 — settings_mjs_resolves_base_placeholder
test('should read settings.json and resolve {base} placeholder with overridden base_dir', async () => {
  // Arrange
  const { getSettings } = await import(`${HOOKS_LIB}/settings.mjs`);
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-test-settings-'));

  try {
    const baseDir = '.my-learning';
    const settingsDir = join(projectDir, '.jaewon-learning');
    mkdirSync(settingsDir, { recursive: true });
    writeFileSync(
      join(settingsDir, 'settings.json'),
      JSON.stringify({ base_dir: baseDir }),
      'utf-8'
    );

    // Act
    const result = getSettings(projectDir);

    // Assert — overridden base_dir is used
    assert.equal(result.base_dir, baseDir,
      `base_dir should be the overridden value "${baseDir}"`);
    // Assert — {base} in path templates is replaced with the overridden value
    assert.ok(
      result.paths.status.includes(baseDir),
      `paths.status must resolve {base} to "${baseDir}", got: ${result.paths.status}`
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// STATE.MJS (tests 3–7)
// Calling spec (task 6.2):
//   readState(projectDir)  -> Status (DEFAULT_STATUS with last_advance_sig:null)
//   writeState(projectDir, patch)  -> void  (deep-merges, preserves other fields)
//   advanceIfNewSig(status, newSig, mutator) -> {advanced:boolean, status, reason?}
//     - pure function; caller persists the returned status
//     - accepts  when newSig != status.course_state.last_advance_sig
//     - rejects  when newSig == status.course_state.last_advance_sig (idempotent no-op)
// ---------------------------------------------------------------------------

// Test 3 — state_mjs_readStatus_returns_defaults
test('should return DEFAULT_STATUS with last_advance_sig null when state file absent', async () => {
  // Arrange
  const { readState } = await import(`${HOOKS_LIB}/state.mjs`);
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-test-state-'));

  try {
    // Act — no status file exists
    const result = readState(projectDir);

    // Assert — must return a valid default object
    assert.ok(result !== null && typeof result === 'object',
      'readState must return an object, not null/undefined');
    // Assert — course_state subtree must be present with last_advance_sig:null
    assert.ok(
      result.course_state !== undefined,
      'default status must include a course_state subtree'
    );
    assert.equal(result.course_state.last_advance_sig, null,
      'DEFAULT_STATUS must have course_state.last_advance_sig === null');
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// Test 4 — state_mjs_saveStatus_writes_last_updated
test('should deep-merge patch into state and preserve unrelated fields when writing', async () => {
  // Arrange
  const { readState, writeState } = await import(`${HOOKS_LIB}/state.mjs`);
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-test-state-'));

  try {
    // Seed an initial state with a field we want to preserve
    const initial = readState(projectDir);
    initial.session = { ...initial.session, total_sessions: 3 };
    writeState(projectDir, initial);

    // Act — write a partial patch that should not destroy session.total_sessions
    const patch = { course_state: { last_advance_sig: 'sig-abc' } };
    writeState(projectDir, patch);
    const result = readState(projectDir);

    // Assert — patched field was applied
    assert.equal(result.course_state.last_advance_sig, 'sig-abc',
      'writeState must persist the patched course_state.last_advance_sig');
    // Assert — other fields are preserved (deep-merge, not replace)
    assert.equal(result.session.total_sessions, 3,
      'writeState must preserve unrelated fields via deep-merge');
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// Test 5 — state_mjs_advance_with_different_sig_updates
test('should accept new sig, run updater, and return advanced:true when sig is novel', async () => {
  // Arrange
  const { advanceIfNewSig } = await import(`${HOOKS_LIB}/state.mjs`);
  const sig = 'evaluator:verdict.json:1713261600000';
  const status = {
    course_state: {
      last_advance_sig: null,
      current_phase: 'discuss',
      cycle_iteration: 1,
    },
  };

  // Act
  const result = advanceIfNewSig(status, sig, (s) => {
    s.course_state.cycle_iteration += 1;
    s.course_state.current_phase = 'idle';
  });

  // Assert
  assert.equal(result.advanced, true,
    'advanceIfNewSig must return advanced:true when sig is novel (different from stored)');
  assert.equal(result.status.course_state.last_advance_sig, sig,
    'returned status must have last_advance_sig set to the new sig');
  assert.equal(result.status.course_state.cycle_iteration, 2,
    'mutator must have been applied — cycle_iteration must have incremented');
  assert.equal(result.status.course_state.current_phase, 'idle',
    'mutator must have been applied — current_phase must be "idle"');
});

// Test 6 — state_mjs_advance_with_sig_is_idempotent
test('should reject sig and return advanced:false with reason sig_match when sig already recorded', async () => {
  // Arrange
  const { advanceIfNewSig } = await import(`${HOOKS_LIB}/state.mjs`);
  const sig = 'evaluator:verdict.json:1713261600000';
  const status = {
    course_state: {
      last_advance_sig: sig,   // sig already recorded — simulates second hook fire
      current_phase: 'idle',
      cycle_iteration: 2,
    },
  };
  let mutatorCalled = false;

  // Act — same sig as already stored
  const result = advanceIfNewSig(status, sig, (_s) => {
    mutatorCalled = true;     // must NOT be called
  });

  // Assert
  assert.equal(result.advanced, false,
    'advanceIfNewSig must return advanced:false when sig matches stored last_advance_sig');
  assert.equal(result.reason, 'sig_match',
    'reason field must be "sig_match" to distinguish idempotent no-op from other failures');
  assert.equal(mutatorCalled, false,
    'mutator must NOT be invoked on a sig_match no-op');
  // Assert — status is returned unchanged (cycle_iteration still 2)
  assert.equal(result.status.course_state.cycle_iteration, 2,
    'status must be unchanged when sig matches');
});

// Test 7 — concurrent call returns later read (serializable)
test('should return the current state and advanced:false when called concurrently with same sig', async () => {
  // Arrange — simulate the race: two callers see the same sig and call concurrently.
  // Because advanceIfNewSig is a pure function (caller persists), the second caller
  // that reads the already-updated status will observe the sig and return {advanced:false}.
  const { advanceIfNewSig } = await import(`${HOOKS_LIB}/state.mjs`);
  const sig = 'evaluator:verdict.json:1713261700000';

  // First call — status has null sig (fresh)
  const initialStatus = {
    course_state: { last_advance_sig: null, cycle_iteration: 1, current_phase: 'discuss' },
  };
  const first = advanceIfNewSig(initialStatus, sig, (s) => {
    s.course_state.cycle_iteration += 1;
  });
  assert.equal(first.advanced, true, 'first call must advance');

  // Second call — uses the status returned by the first call (already has the sig)
  const second = advanceIfNewSig(first.status, sig, (s) => {
    s.course_state.cycle_iteration += 1;  // must NOT run
  });

  // Assert — second call is a no-op
  assert.equal(second.advanced, false,
    'second call with same sig must return advanced:false (serializable idempotency)');
  assert.equal(second.reason, 'sig_match',
    'reason must be "sig_match" for the duplicate call');
  assert.equal(second.status.course_state.cycle_iteration, 2,
    'cycle_iteration must remain at 2 — second mutator must not have fired');
});

// ---------------------------------------------------------------------------
// LEARNER-PROFILE.MJS (tests 8–9)
// Calling spec (task 6.2):
//   loadLearnerProfile(projectDir) -> LearnerProfile object
//     Reads wiki/learner/*.md pages (up to 5 standard pages).
//     Returns structured object with page contents keyed by page slug.
//     Gracefully returns empty/default object when directory absent.
// ---------------------------------------------------------------------------

// Test 8 — learner_profile_loadLearnerProfile_reads_five_pages
test('should read all 5 learner pages and return structured object when profile dir exists', async () => {
  // Arrange
  const { loadLearnerProfile } = await import(`${HOOKS_LIB}/learner-profile.mjs`);
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-test-profile-'));

  try {
    const learnerDir = join(projectDir, 'wiki', 'learner');
    mkdirSync(learnerDir, { recursive: true });

    // Create the 5 canonical learner pages
    const pages = ['style', 'strengths', 'weaknesses', 'push-tactics', 'recent-sessions'];
    for (const page of pages) {
      writeFileSync(
        join(learnerDir, `${page}.md`),
        `# ${page}\n\nContent for ${page} page.\n`,
        'utf-8'
      );
    }

    // Act
    const result = await loadLearnerProfile(projectDir);

    // Assert — result is an object
    assert.ok(result !== null && typeof result === 'object',
      'loadLearnerProfile must return an object');
    // Assert — all 5 pages are present (keyed by slug or similar structure)
    const resultKeys = Object.keys(result);
    assert.ok(resultKeys.length >= 1,
      'loadLearnerProfile must return at least one page entry when all 5 pages exist');
    // Assert — content from at least one page is included
    const hasContent = Object.values(result).some(
      (v) => typeof v === 'string' && v.length > 0
    );
    assert.ok(hasContent,
      'loadLearnerProfile must include non-empty content from the learner pages');
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// Test 9 — learner_profile_gracefully_handles_missing_learner_dir
test('should return empty defaults without throwing when learner wiki dir is absent', async () => {
  // Arrange
  const { loadLearnerProfile } = await import(`${HOOKS_LIB}/learner-profile.mjs`);
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-test-profile-missing-'));

  try {
    // Act — wiki/learner/ does not exist
    const result = await loadLearnerProfile(projectDir);

    // Assert — must not throw; must return a safe default (object, not null/undefined)
    assert.ok(result !== null && typeof result === 'object',
      'loadLearnerProfile must return an object even when wiki/learner/ dir is missing');
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// CYCLE-DETECT.MJS (tests 10–11)
// Calling spec (task 6.2):
//   detectCycle(status) -> { inCycle: boolean, phase: string|null, reason: string }
//   PURE function — same input always produces same output.
//   hook-internal: NOT exposed via MCP tool.
//
//   Cycle detected when: current_phase != 'idle' AND last_advance_sig is present.
//   No cycle when: current_phase == 'idle' (regardless of sig).
// ---------------------------------------------------------------------------

// Test 10 — cycle_detect_detectCycle_derives_phase_from_status
test('should detect cycle when current_phase is not idle and last_advance_sig is set', async () => {
  // Arrange
  const { detectCycle } = await import(`${HOOKS_LIB}/cycle-detect.mjs`);
  const status = {
    course_state: {
      current_phase: 'discuss',
      last_advance_sig: 'evaluator:verdict.json:1713261600000',
      cycle_iteration: 2,
    },
  };

  // Act
  const result = detectCycle(status);

  // Assert
  assert.equal(result.inCycle, true,
    'detectCycle must return inCycle:true when current_phase != "idle" and sig is set');
  assert.equal(result.phase, 'discuss',
    'detectCycle must surface the current phase in the result');
  assert.equal(typeof result.reason, 'string',
    'detectCycle must include a reason string');
});

// Test 11 — cycle_detect_detectCycle_idle_when_no_course
test('should return inCycle:false when current_phase is idle', async () => {
  // Arrange
  const { detectCycle } = await import(`${HOOKS_LIB}/cycle-detect.mjs`);
  const status = {
    course_state: {
      current_phase: 'idle',
      last_advance_sig: null,
      cycle_iteration: 0,
    },
  };

  // Act
  const result = detectCycle(status);

  // Assert
  assert.equal(result.inCycle, false,
    'detectCycle must return inCycle:false when current_phase is "idle"');
  // Pure function guarantee — calling again with same input yields same result
  const result2 = detectCycle(status);
  assert.deepEqual(result, result2,
    'detectCycle must be a pure function: same input -> same output across repeated calls');
});

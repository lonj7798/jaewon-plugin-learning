/**
 * Phase 6 — Task 6.7 (RED): stop + subagent-stop hook tests
 *
 * All 10 tests must FAIL until Task 6.8 creates:
 *   hooks/stop.mjs
 *   hooks/subagent-stop.mjs
 *
 * Framework: node:test + node:assert/strict, ESM.
 *
 * Strategy: each test spawns the hook script via child_process.spawn,
 * feeds a JSON event payload on stdin, then asserts on exit code,
 * stdout content, and/or a shared status.json written to a tmpdir.
 *
 * When stop.mjs / subagent-stop.mjs are missing, node exits non-zero
 * with "Cannot find module" — that is the correct RED failure.
 *
 * Calling specs (phase-6-hooks.md §6.8):
 *
 *   stop.mjs:
 *     INPUT  stdin: Stop event JSON { stop_hook_active?, cwd?, ... }
 *     OUTPUT: exit 0 silently OR { systemMessage: nudge }
 *     CONTRACT: never emits decision:'block'; exits 0 on error.
 *     SIDE EFFECTS: may call advanceIfNewSig when evaluator verdict freshly written.
 *
 *   subagent-stop.mjs:
 *     INPUT  stdin: SubagentStop event { agent_name, cwd?, last_assistant_message?, ... }
 *     OUTPUT: '' OR { systemMessage: update summary }
 *     CONTRACT: never emits decision:'block'; exits 0 on error.
 *     SIDE EFFECTS: advances status.json via advanceIfNewSig when evaluator finishes.
 *     DISPATCH: uses AGENT_HANDLERS dict (not switch/case).
 *
 * Race-guard contract (Stop vs SubagentStop Race — phase-6-hooks.md §):
 *   Both hooks compute sig = sha1(agent_name + verdict_path + verdict_file_mtime_ms).
 *   Both call state.advanceIfNewSig(status, sig, mutator).
 *   Second caller observes last_advance_sig === sig → returns {advanced:false, reason:'sig_match'}.
 *   At most one advance is recorded per evaluator run.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));

// This file: jaewon-plugin-learning/tests/phase-6/stop-hooks.test.mjs
// Plugin root: jaewon-plugin-learning/
const STOP_SCRIPT = join(__dirname, '..', '..', 'hooks', 'stop.mjs');
const SUBAGENT_STOP_SCRIPT = join(__dirname, '..', '..', 'hooks', 'subagent-stop.mjs');

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Spawn a hook script, feed JSON on stdin, collect result.
 * @param {string} scriptPath - absolute path to the hook .mjs script
 * @param {object} stdinPayload - object serialized onto stdin
 * @returns {Promise<{ exitCode: number, stdout: string, stderr: string }>}
 */
function runHook(scriptPath, stdinPayload) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      env: { ...process.env },
    });

    const stdoutChunks = [];
    const stderrChunks = [];

    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk));

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString('utf-8'),
        stderr: Buffer.concat(stderrChunks).toString('utf-8'),
      });
    });

    child.stdin.write(JSON.stringify(stdinPayload));
    child.stdin.end();
  });
}

/**
 * Write a minimal status.json into a tmpdir's .jaewon-learning/ directory.
 * Returns the path to the written status.json.
 */
function seedStatusJson(projectDir, statusOverrides = {}) {
  const baseDir = join(projectDir, '.jaewon-learning');
  mkdirSync(baseDir, { recursive: true });
  const statusPath = join(baseDir, 'status.json');
  const status = {
    version: 1,
    course_state: {
      current_phase: 'idle',
      cycle_iteration: 0,
      last_advance_sig: null,
      current_course: null,
      current_chapter: null,
    },
    session: { total_sessions: 1, last_start: new Date().toISOString(), last_end: null },
    ...statusOverrides,
  };
  writeFileSync(statusPath, JSON.stringify(status, null, 2), 'utf-8');
  return statusPath;
}

/**
 * Read status.json from projectDir (under .jaewon-learning/).
 */
function readStatusJson(projectDir) {
  const statusPath = join(projectDir, '.jaewon-learning', 'status.json');
  return JSON.parse(readFileSync(statusPath, 'utf-8'));
}

/**
 * Write a fake verdict.json into projectDir and return its path and mtime (ms).
 * The mtime is controlled by the content so we get a deterministic fake.
 */
function seedVerdictFile(projectDir, content = { result: 'pass', score: 8 }) {
  const verdictDir = join(projectDir, '.jaewon-learning', 'evaluator');
  mkdirSync(verdictDir, { recursive: true });
  const verdictPath = join(verdictDir, 'verdict.json');
  writeFileSync(verdictPath, JSON.stringify(content), 'utf-8');
  return verdictPath;
}

// ---------------------------------------------------------------------------
// TEST 1 — stop.mjs exists and exits 0 on valid input
//
// When stop.mjs receives a well-formed Stop event JSON with no active cycle,
// it must exit 0 (never crash the user's session).
// ---------------------------------------------------------------------------

test('should exit 0 when stop.mjs receives a minimal valid Stop event with no active cycle', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-stop-t1-'));

  try {
    seedStatusJson(projectDir, {
      course_state: { current_phase: 'idle', cycle_iteration: 0, last_advance_sig: null },
    });
    const payload = { cwd: projectDir };

    // Act
    const result = await runHook(STOP_SCRIPT, payload);

    // Assert — must always exit 0 (base hook contract)
    assert.equal(
      result.exitCode, 0,
      `stop.mjs must exit 0; got ${result.exitCode}. stderr: ${result.stderr.slice(0, 300)}`
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// TEST 2 — subagent-stop.mjs exists and exits 0 on valid input
//
// When subagent-stop.mjs receives a SubagentStop event for an unknown agent,
// it must exit 0 without crashing.
// ---------------------------------------------------------------------------

test('should exit 0 when subagent-stop.mjs receives a minimal valid SubagentStop event', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-subagent-t2-'));

  try {
    seedStatusJson(projectDir);
    const payload = {
      cwd: projectDir,
      agent_name: 'unknown-agent',
      last_assistant_message: 'Task completed successfully.',
    };

    // Act
    const result = await runHook(SUBAGENT_STOP_SCRIPT, payload);

    // Assert
    assert.equal(
      result.exitCode, 0,
      `subagent-stop.mjs must exit 0; got ${result.exitCode}. stderr: ${result.stderr.slice(0, 300)}`
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// TEST 3 — stop.mjs nudges user when discuss phase completes
//
// When course_state.current_phase is 'discuss' and a verdict file is present
// but the profiler has not yet run, stop.mjs must emit a systemMessage that
// contains "verdict" or a nudge keyword prompting the user toward /verdict.
// It must never emit decision:'block'.
// ---------------------------------------------------------------------------

test('should emit a systemMessage nudge containing "verdict" when discuss phase is complete but profiler not run', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-stop-t3-'));

  try {
    seedStatusJson(projectDir, {
      course_state: {
        current_phase: 'discuss',
        cycle_iteration: 1,
        last_advance_sig: 'evaluator:verdict.json:1713261600000',
        profiler_run: false,
      },
    });
    seedVerdictFile(projectDir);
    const payload = { cwd: projectDir };

    // Act
    const result = await runHook(STOP_SCRIPT, payload);

    // Assert — exit 0 (never blocks)
    assert.equal(result.exitCode, 0,
      `stop.mjs must exit 0. stderr: ${result.stderr.slice(0, 300)}`);

    // Assert — stdout is non-empty JSON with systemMessage containing nudge keyword
    let parsed;
    try {
      parsed = JSON.parse(result.stdout.trim());
    } catch {
      assert.fail(`stdout must be valid JSON. Got: ${result.stdout.slice(0, 300)}`);
    }

    assert.ok(
      typeof parsed.systemMessage === 'string' && parsed.systemMessage.length > 0,
      `systemMessage must be a non-empty string. Got: ${JSON.stringify(parsed.systemMessage)}`
    );

    const msg = parsed.systemMessage.toLowerCase();
    const hasNudge =
      msg.includes('verdict') ||
      msg.includes('profiler') ||
      msg.includes('discuss') ||
      msg.includes('/verdict');
    assert.ok(hasNudge,
      `systemMessage must contain a verdict/profiler/discuss nudge. Got: ${parsed.systemMessage.slice(0, 300)}`);

    // Assert — must NOT be a block decision
    assert.notEqual(parsed.decision, 'block',
      'stop.mjs must never emit decision:"block"');
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// TEST 4 — subagent-stop.mjs advances cycle state when evaluator agent completes
//
// When agent_name is 'evaluator' and a verdict file exists, subagent-stop.mjs
// must advance status.course_state.cycle_iteration and set last_advance_sig
// to the expected sha1 hash pattern.
// ---------------------------------------------------------------------------

test('should advance course_state.cycle_iteration and set last_advance_sig when evaluator agent completes', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-subagent-t4-'));

  try {
    seedStatusJson(projectDir, {
      course_state: {
        current_phase: 'discuss',
        cycle_iteration: 1,
        last_advance_sig: null,
      },
    });
    seedVerdictFile(projectDir, { result: 'pass', score: 9 });

    const payload = {
      cwd: projectDir,
      agent_name: 'evaluator',
      last_assistant_message: 'Evaluation complete. Verdict written to verdict.json.',
    };

    // Act
    const result = await runHook(SUBAGENT_STOP_SCRIPT, payload);

    // Assert — exit 0
    assert.equal(result.exitCode, 0,
      `subagent-stop.mjs must exit 0. stderr: ${result.stderr.slice(0, 300)}`);

    // Assert — status.json was updated with an advance
    const updated = readStatusJson(projectDir);

    assert.ok(
      updated.course_state.last_advance_sig !== null &&
      typeof updated.course_state.last_advance_sig === 'string' &&
      updated.course_state.last_advance_sig.length > 0,
      `last_advance_sig must be set after evaluator completes. Got: ${updated.course_state.last_advance_sig}`
    );

    assert.ok(
      updated.course_state.cycle_iteration > 1,
      `cycle_iteration must have been incremented beyond 1. Got: ${updated.course_state.cycle_iteration}`
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// TEST 5 — subagent-stop.mjs dispatches by agent name via AGENT_HANDLERS dict
//
// The source of subagent-stop.mjs must contain "AGENT_HANDLERS" as a dict
// dispatch object. We verify this by inspecting the source file directly —
// the plan (§6.8) mandates LOD Pattern 8 (dict over switch/case).
// ---------------------------------------------------------------------------

test('should use an AGENT_HANDLERS dict for dispatch rather than a switch/case statement', async () => {
  // Arrange — read the source file directly to assert structural requirement
  // This test fails at the source-not-found level (ERR_MODULE_NOT_FOUND in
  // the other tests) but we also verify the structural requirement is met.
  const { readFileSync: rfs, existsSync: efs } = await import('node:fs');

  // Assert — the file must exist (fails in RED because it does not)
  assert.ok(
    efs(SUBAGENT_STOP_SCRIPT),
    `subagent-stop.mjs must exist at: ${SUBAGENT_STOP_SCRIPT}`
  );

  // Act
  const source = rfs(SUBAGENT_STOP_SCRIPT, 'utf-8');

  // Assert — must contain AGENT_HANDLERS dict declaration
  assert.ok(
    source.includes('AGENT_HANDLERS'),
    'subagent-stop.mjs source must contain "AGENT_HANDLERS" dict for dispatch (LOD Pattern 8)'
  );

  // Assert — must NOT rely solely on switch/case for dispatch
  // A switch(agentName) block is the banned pattern; the handler dict replaces it.
  const hasSwitchDispatch = /switch\s*\(\s*agent_?[Nn]ame/.test(source);
  assert.equal(
    hasSwitchDispatch, false,
    'subagent-stop.mjs must not use switch(agent_name) dispatch — use AGENT_HANDLERS dict instead'
  );
});

// ---------------------------------------------------------------------------
// TEST 6 — neither hook emits decision:'block'
//
// Both stop.mjs and subagent-stop.mjs must never emit { decision: 'block' }
// under any input conditions. Verified across three hostile scenarios each.
// ---------------------------------------------------------------------------

test('should never emit decision:"block" from stop.mjs or subagent-stop.mjs under any input', async () => {
  // Arrange — scenarios that could tempt a naive implementation to block
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-noblock-t6-'));

  try {
    seedStatusJson(projectDir, {
      course_state: { current_phase: 'discuss', cycle_iteration: 3, last_advance_sig: 'sig-xyz' },
    });

    const scenarios = [
      {
        script: STOP_SCRIPT,
        label: 'stop.mjs / normal payload',
        payload: { cwd: projectDir },
      },
      {
        script: STOP_SCRIPT,
        label: 'stop.mjs / empty payload',
        payload: {},
      },
      {
        script: SUBAGENT_STOP_SCRIPT,
        label: 'subagent-stop.mjs / evaluator payload',
        payload: {
          cwd: projectDir,
          agent_name: 'evaluator',
          last_assistant_message: 'Done.',
        },
      },
      {
        script: SUBAGENT_STOP_SCRIPT,
        label: 'subagent-stop.mjs / unknown agent',
        payload: {
          cwd: projectDir,
          agent_name: 'mystery-agent',
          last_assistant_message: 'Finished.',
        },
      },
    ];

    for (const { script, label, payload } of scenarios) {
      // Act
      const result = await runHook(script, payload);

      // Assert — exit 0 always
      assert.equal(result.exitCode, 0,
        `${label} must exit 0. stderr: ${result.stderr.slice(0, 200)}`);

      // Assert — no decision:block in raw stdout
      const raw = result.stdout;
      const hasBlock = raw.includes('"block"') && raw.includes('"decision"');
      assert.equal(hasBlock, false,
        `${label} must never emit decision:"block". stdout: ${raw.slice(0, 300)}`);

      // Also parse if JSON to double-check
      if (raw.trim().startsWith('{')) {
        let parsed;
        try { parsed = JSON.parse(raw.trim()); } catch { /* non-JSON output is fine */ }
        if (parsed) {
          assert.notEqual(parsed.decision, 'block',
            `${label}: parsed output must not have decision:"block"`);
        }
      }
    }
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// TEST 7 — both hooks use advanceIfNewSig from state.mjs
//
// The source of both hook scripts must contain "advanceIfNewSig" — the
// idempotent advance helper required by the race-guard contract.
// This is a structural/source-level assertion.
// ---------------------------------------------------------------------------

test('should reference advanceIfNewSig in both stop.mjs and subagent-stop.mjs source', async () => {
  // Arrange
  const { readFileSync: rfs, existsSync: efs } = await import('node:fs');

  // Assert stop.mjs exists and contains advanceIfNewSig
  assert.ok(
    efs(STOP_SCRIPT),
    `stop.mjs must exist at: ${STOP_SCRIPT}`
  );
  const stopSource = rfs(STOP_SCRIPT, 'utf-8');
  assert.ok(
    stopSource.includes('advanceIfNewSig'),
    'stop.mjs source must import and use "advanceIfNewSig" from state.mjs (race-guard contract)'
  );

  // Assert subagent-stop.mjs exists and contains advanceIfNewSig
  assert.ok(
    efs(SUBAGENT_STOP_SCRIPT),
    `subagent-stop.mjs must exist at: ${SUBAGENT_STOP_SCRIPT}`
  );
  const subagentSource = rfs(SUBAGENT_STOP_SCRIPT, 'utf-8');
  assert.ok(
    subagentSource.includes('advanceIfNewSig'),
    'subagent-stop.mjs source must import and use "advanceIfNewSig" from state.mjs (race-guard contract)'
  );
});

// ---------------------------------------------------------------------------
// TEST 8 — Race guard case 1: subagent_stop_advances_once_even_if_stop_fires_first
//
// Simulate: Stop hook fires FIRST for evaluator completion — writes sig S1,
// advances cycle_iteration from 1 to 2.
// Then SubagentStop fires with the same evaluator + same verdict file.
// SubagentStop must observe last_advance_sig === S1 and return a no-op
// (cycle_iteration stays at 2, last_advance_sig unchanged).
//
// Implementation: seed status.json with last_advance_sig already set (simulating
// Stop having already run), then invoke subagent-stop.mjs and assert no advance.
// ---------------------------------------------------------------------------

test('should not double-advance when subagent-stop fires after stop has already advanced with same sig', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-race-t8-'));

  try {
    // Create verdict file — mtime will be used to build sig
    const verdictPath = seedVerdictFile(projectDir, { result: 'pass', score: 8 });

    // Simulate: Stop already fired and wrote sig S1 + advanced cycle_iteration to 2
    // We build a plausible sig string matching what the implementation would compute.
    // The exact hash is implementation-defined, but we pre-seed a non-null sig string
    // so that subagent-stop sees "sig already recorded" and skips advance.
    const simulatedSig = 'stop-already-wrote-this-sig-S1';
    seedStatusJson(projectDir, {
      course_state: {
        current_phase: 'idle',     // already advanced — phase moved to idle
        cycle_iteration: 2,         // already advanced from 1 to 2 by Stop
        last_advance_sig: simulatedSig,
      },
    });

    // SubagentStop fires — same evaluator + same verdict file
    // Hook must detect last_advance_sig === simulatedSig and skip advance.
    // Because hooks compute the sig from agent_name + verdict_path + mtime,
    // we provide the same conditions and also override the sig derivation by
    // pre-seeding the status. The test verifies that IF the computed sig matches
    // the stored sig, no advance occurs. We pass the stored sig directly via a
    // test-support env var that the hook may read to override sig computation
    // (or the hook naturally computes the same sig from the same inputs).
    //
    // If the hook does NOT support sig override and recomputes a different sig
    // from the real verdict file mtime, the test demonstrates the race condition
    // — cycle_iteration would increment to 3, which must be caught as a failure.

    const payload = {
      cwd: projectDir,
      agent_name: 'evaluator',
      last_assistant_message: 'Evaluation complete.',
      // Pass the simulated sig so the hook uses it instead of computing from mtime.
      // The hook must check: if computed_sig === status.course_state.last_advance_sig → skip.
      _test_override_sig: simulatedSig,
    };

    // Act — subagent-stop fires second
    const result = await runHook(SUBAGENT_STOP_SCRIPT, payload);

    // Assert — exit 0
    assert.equal(result.exitCode, 0,
      `subagent-stop.mjs must exit 0. stderr: ${result.stderr.slice(0, 300)}`);

    // Assert — status.json must NOT have advanced further
    const updated = readStatusJson(projectDir);

    assert.equal(
      updated.course_state.cycle_iteration, 2,
      `cycle_iteration must remain at 2 (no double-advance). Got: ${updated.course_state.cycle_iteration}`
    );

    assert.equal(
      updated.course_state.last_advance_sig, simulatedSig,
      `last_advance_sig must remain unchanged (${simulatedSig}). Got: ${updated.course_state.last_advance_sig}`
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// TEST 9 — Race guard case 2: stop_advances_once_even_if_subagent_stop_fires_first
//
// Mirror of test 8. SubagentStop fires FIRST — writes sig S1, advances
// cycle_iteration from 1 to 2. Stop fires SECOND with same sig S1.
// Stop must observe last_advance_sig === S1 and skip advance.
// ---------------------------------------------------------------------------

test('should not double-advance when stop fires after subagent-stop has already advanced with same sig', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-race-t9-'));

  try {
    // Create verdict file
    seedVerdictFile(projectDir, { result: 'pass', score: 7 });

    // Simulate: SubagentStop already fired and wrote sig S1 + advanced to cycle 2
    const simulatedSig = 'subagent-stop-already-wrote-this-sig-S1';
    seedStatusJson(projectDir, {
      course_state: {
        current_phase: 'idle',
        cycle_iteration: 2,         // already advanced
        last_advance_sig: simulatedSig,
      },
    });

    // Stop fires — must detect the sig and skip advance
    const payload = {
      cwd: projectDir,
      stop_hook_active: false,
      // Pass the simulated sig for override (same mechanism as test 8)
      _test_override_sig: simulatedSig,
    };

    // Act — stop fires second
    const result = await runHook(STOP_SCRIPT, payload);

    // Assert — exit 0
    assert.equal(result.exitCode, 0,
      `stop.mjs must exit 0. stderr: ${result.stderr.slice(0, 300)}`);

    // Assert — status.json must NOT have advanced further
    const updated = readStatusJson(projectDir);

    assert.equal(
      updated.course_state.cycle_iteration, 2,
      `cycle_iteration must remain at 2 (no double-advance by Stop). Got: ${updated.course_state.cycle_iteration}`
    );

    assert.equal(
      updated.course_state.last_advance_sig, simulatedSig,
      `last_advance_sig must remain unchanged (${simulatedSig}). Got: ${updated.course_state.last_advance_sig}`
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// TEST 10 — Distinct sigs in two different sessions both advance
//
// Proves the guard is sig-keyed (not time-keyed or run-count-keyed).
// Session A: evaluator run #1 with verdict mtime T1 → sig S1 → advances (iteration 1→2).
// Session B: evaluator run #2 with different verdict content/mtime T2 → sig S2 → advances (iteration 2→3).
// S1 != S2; both advances succeed because the sigs are distinct.
//
// Simulated by invoking subagent-stop twice with different override sigs and
// asserting cycle_iteration reaches 3.
// ---------------------------------------------------------------------------

test('should advance for both evaluator runs when they have distinct sigs (sig-keyed guard, not time-keyed)', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-distinct-t10-'));

  try {
    // Initial state: no previous advance
    seedStatusJson(projectDir, {
      course_state: {
        current_phase: 'discuss',
        cycle_iteration: 1,
        last_advance_sig: null,
      },
    });

    // --- First evaluator run: sig S1 ---
    seedVerdictFile(projectDir, { result: 'pass', score: 6, run: 1 });

    const payloadRun1 = {
      cwd: projectDir,
      agent_name: 'evaluator',
      last_assistant_message: 'First evaluation complete.',
      _test_override_sig: 'distinct-sig-S1-run1',
    };

    // Act — first run
    const result1 = await runHook(SUBAGENT_STOP_SCRIPT, payloadRun1);
    assert.equal(result1.exitCode, 0,
      `subagent-stop.mjs must exit 0 on first run. stderr: ${result1.stderr.slice(0, 300)}`);

    const afterRun1 = readStatusJson(projectDir);
    assert.ok(
      afterRun1.course_state.cycle_iteration >= 2,
      `cycle_iteration must have advanced to at least 2 after first run. Got: ${afterRun1.course_state.cycle_iteration}`
    );
    assert.equal(
      afterRun1.course_state.last_advance_sig, 'distinct-sig-S1-run1',
      `last_advance_sig must be set to S1 after first run. Got: ${afterRun1.course_state.last_advance_sig}`
    );

    // --- Second evaluator run: sig S2 (different verdict, different mtime) ---
    seedVerdictFile(projectDir, { result: 'pass', score: 9, run: 2 });

    const payloadRun2 = {
      cwd: projectDir,
      agent_name: 'evaluator',
      last_assistant_message: 'Second evaluation complete.',
      _test_override_sig: 'distinct-sig-S2-run2',   // DIFFERENT sig
    };

    // Act — second run with different sig
    const result2 = await runHook(SUBAGENT_STOP_SCRIPT, payloadRun2);
    assert.equal(result2.exitCode, 0,
      `subagent-stop.mjs must exit 0 on second run. stderr: ${result2.stderr.slice(0, 300)}`);

    const afterRun2 = readStatusJson(projectDir);

    // Assert — second run must also advance (because sig is distinct from S1)
    assert.ok(
      afterRun2.course_state.cycle_iteration >= 3,
      `cycle_iteration must have advanced to at least 3 after second run with distinct sig. Got: ${afterRun2.course_state.cycle_iteration}`
    );

    assert.equal(
      afterRun2.course_state.last_advance_sig, 'distinct-sig-S2-run2',
      `last_advance_sig must be updated to S2 after second run. Got: ${afterRun2.course_state.last_advance_sig}`
    );

    // Assert — S1 != S2 (sanity check that the two sigs are genuinely distinct)
    assert.notEqual(
      afterRun1.course_state.last_advance_sig,
      afterRun2.course_state.last_advance_sig,
      'The two sigs must be distinct — guard is sig-keyed, not time-keyed'
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// TEST 11 — Regression #7: stop.mjs nudge must read post-advance course_state
//
// Bug: stop.mjs snapshots `cs = status.course_state` BEFORE calling
// advanceIfNewSig. After a successful advance that transitions current_phase
// to 'idle', the nudge block still reads the stale cs.current_phase ('discuss')
// and incorrectly emits a nudge even though the phase is now idle.
//
// Fix: after potential advance, derive currentPhase / profilerRun from
// status.course_state (the possibly-updated reference), not the pre-advance cs.
// ---------------------------------------------------------------------------

test('should NOT emit a nudge when advance transitions current_phase from discuss to idle', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-stop-t11-'));

  try {
    // Seed status with discuss phase + profiler_run:false (nudge-eligible pre-advance)
    // last_advance_sig is null so the override sig is novel and advance WILL fire
    seedStatusJson(projectDir, {
      course_state: {
        current_phase: 'discuss',
        cycle_iteration: 1,
        last_advance_sig: null,
        profiler_run: false,
      },
    });

    // Verdict file must exist so advance guard passes
    seedVerdictFile(projectDir, { result: 'pass', score: 8 });

    // _test_override_sig is novel (differs from null) → advanceIfNewSig fires,
    // mutator sets current_phase to 'idle'. Correct code reads post-advance
    // status.course_state and sees 'idle'; buggy code reads stale cs ('discuss').
    const payload = {
      cwd: projectDir,
      _test_override_sig: 'test-sig-bug7-novel',
    };

    // Act
    const result = await runHook(STOP_SCRIPT, payload);

    // Assert — must exit 0
    assert.equal(result.exitCode, 0,
      `stop.mjs must exit 0. stderr: ${result.stderr.slice(0, 300)}`);

    // Assert — stdout must be empty (no nudge) because phase advanced to idle
    const stdout = result.stdout.trim();
    assert.equal(stdout, '',
      `stop.mjs must NOT emit a nudge after advancing to idle; got: ${stdout.slice(0, 300)}`);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

/**
 * Phase 6 — Task 6.3 (RED): session-start hook tests
 *
 * All 6 tests must FAIL until Task 6.4 creates:
 *   hooks/session-start.mjs
 *
 * Framework: node:test + node:assert/strict, ESM.
 *
 * Strategy: each test spawns `node hooks/session-start.mjs` directly,
 * feeds a JSON event payload on stdin, then asserts on exit code,
 * stdout content, and/or the absence of decision:block.
 *
 * When session-start.mjs is missing, node exits non-zero with
 * "Cannot find module" — that is the correct RED failure for all 6 tests.
 *
 * Calling spec (task 6.4, phase-6-hooks.md §6.4):
 *   INPUT  stdin: SessionStart JSON event { cwd?, ... }
 *   OUTPUT stdout: JSON.stringify({ systemMessage: '...' })
 *   SIDE EFFECTS: creates .jaewon-learning/ if missing
 *   CONTRACT: always exits 0; never emits decision:'block'
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
// This file: jaewon-plugin-learning/tests/phase-6/session-start.test.mjs
// Plugin root: jaewon-plugin-learning/
const HOOK_SCRIPT = join(__dirname, '..', '..', 'hooks', 'session-start.mjs');

/**
 * Spawn the hook script, feed stdin JSON, and collect the result.
 * @param {object} stdinPayload - object to JSON-serialize onto stdin
 * @returns {Promise<{ exitCode: number, stdout: string, stderr: string }>}
 */
function runHook(stdinPayload) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [HOOK_SCRIPT], {
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

    const payload = JSON.stringify(stdinPayload);
    child.stdin.write(payload);
    child.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// Test 1 — session_start_exit_code_zero_on_error (general exit-0 contract)
//
// The hook must exit 0 even on error (mirrors base hook contract at
// raw-data/jaewon-plugin/hooks/session-start.mjs:153).
// ---------------------------------------------------------------------------

test('should exit 0 when invoked with a minimal valid SessionStart payload', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-ss-basic-'));

  try {
    const payload = { cwd: projectDir };

    // Act
    const result = await runHook(payload);

    // Assert — hook must NEVER exit non-zero (mirrors base contract)
    assert.equal(result.exitCode, 0,
      `session-start.mjs must exit 0 for any input; got exit code ${result.exitCode}. stderr: ${result.stderr.slice(0, 300)}`);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2 — session_start_emits_systemMessage_containing_plugin_banner
//
// The hook must write a JSON object to stdout whose systemMessage field
// contains a plugin banner / initialization line so Claude knows the
// learning plugin is active.
// ---------------------------------------------------------------------------

test('should output a JSON systemMessage containing the plugin banner when invoked', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-ss-banner-'));

  try {
    const payload = { cwd: projectDir };

    // Act
    const result = await runHook(payload);

    // Assert — stdout must be parseable JSON
    let parsed;
    try {
      parsed = JSON.parse(result.stdout.trim());
    } catch (err) {
      assert.fail(
        `stdout must be valid JSON. Got: ${result.stdout.slice(0, 300)}. Parse error: ${err.message}`
      );
    }

    // Assert — must contain a systemMessage field
    assert.ok(
      typeof parsed.systemMessage === 'string' && parsed.systemMessage.length > 0,
      `systemMessage must be a non-empty string; got: ${JSON.stringify(parsed.systemMessage)}`
    );

    // Assert — systemMessage must contain some banner / initialization marker
    // (the exact text is up to the implementer; we check for a recognisable keyword)
    const msg = parsed.systemMessage.toLowerCase();
    const hasBanner =
      msg.includes('jaewon') ||
      msg.includes('learning') ||
      msg.includes('initialized') ||
      msg.includes('plugin');
    assert.ok(hasBanner,
      `systemMessage must contain a plugin banner (jaewon/learning/initialized/plugin). Got: ${parsed.systemMessage.slice(0, 200)}`);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3 — session_start_injects_learner_profile_summary_when_profile_exists
//
// When wiki/learner/ contains at least one markdown page, the hook must
// include a non-empty excerpt from the learner profile in systemMessage.
// Mirrors: "Load learner profile via lib/learner-profile.mjs; summarize."
// (phase-6-hooks.md task 6.4 structure step 4)
// ---------------------------------------------------------------------------

test('should inject learner profile excerpt into systemMessage when wiki/learner/ pages exist', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-ss-profile-'));

  try {
    const learnerDir = join(projectDir, 'wiki', 'learner');
    mkdirSync(learnerDir, { recursive: true });
    writeFileSync(
      join(learnerDir, 'style.md'),
      '# Learning Style\n\nPrefers hands-on exercises over passive reading.\n',
      'utf-8'
    );
    writeFileSync(
      join(learnerDir, 'strengths.md'),
      '# Strengths\n\nStrong in TypeScript and system design.\n',
      'utf-8'
    );

    const payload = { cwd: projectDir };

    // Act
    const result = await runHook(payload);

    // Assert — exit 0 first
    assert.equal(result.exitCode, 0,
      `hook must exit 0. stderr: ${result.stderr.slice(0, 300)}`);

    // Assert — stdout is valid JSON with systemMessage
    let parsed;
    try {
      parsed = JSON.parse(result.stdout.trim());
    } catch (err) {
      assert.fail(`stdout must be valid JSON. Got: ${result.stdout.slice(0, 300)}`);
    }

    assert.ok(typeof parsed.systemMessage === 'string',
      'systemMessage must be a string');

    // Assert — systemMessage must reference learner profile content
    // The hook must load wiki/learner/ and inject a summary; we look for
    // text that could only come from those files (profile/learner keyword
    // OR content from the pages themselves).
    const msg = parsed.systemMessage.toLowerCase();
    const hasProfileContent =
      msg.includes('profile') ||
      msg.includes('learner') ||
      msg.includes('style') ||
      msg.includes('strengths') ||
      msg.includes('hands-on') ||
      msg.includes('typescript');
    assert.ok(hasProfileContent,
      `systemMessage must contain learner profile content. Got: ${parsed.systemMessage.slice(0, 400)}`);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 4 — session_start_injects_active_course_chapter_phase_when_on_course_branch
//
// When .jaewon-learning/status.json reports an active course/chapter/phase,
// the hook must surface those details in systemMessage.
// Mirrors: "Load status; … Assemble systemMessage: banner + cycle state"
// (phase-6-hooks.md task 6.4 structure steps 3 and 5)
// ---------------------------------------------------------------------------

test('should include active course and phase in systemMessage when status has an active course', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-ss-active-'));

  try {
    // Pre-create .jaewon-learning/status.json with an active course
    const baseDir = join(projectDir, '.jaewon-learning');
    mkdirSync(baseDir, { recursive: true });
    const status = {
      course_state: {
        current_course: 'tdd-fundamentals',
        current_chapter: 'chapter-3-mocking',
        current_phase: 'discuss',
        cycle_iteration: 2,
        last_advance_sig: 'evaluator:verdict.json:1713261600000',
      },
      session: { total_sessions: 5, last_start: new Date().toISOString() },
    };
    writeFileSync(
      join(baseDir, 'status.json'),
      JSON.stringify(status, null, 2),
      'utf-8'
    );

    const payload = { cwd: projectDir };

    // Act
    const result = await runHook(payload);

    // Assert — exit 0
    assert.equal(result.exitCode, 0,
      `hook must exit 0. stderr: ${result.stderr.slice(0, 300)}`);

    // Assert — valid JSON output
    let parsed;
    try {
      parsed = JSON.parse(result.stdout.trim());
    } catch (err) {
      assert.fail(`stdout must be valid JSON. Got: ${result.stdout.slice(0, 300)}`);
    }

    assert.ok(typeof parsed.systemMessage === 'string',
      'systemMessage must be a string');

    // Assert — at least one of course / chapter / phase must appear in the message
    const msg = parsed.systemMessage.toLowerCase();
    const hasCourseContext =
      msg.includes('tdd-fundamentals') ||
      msg.includes('chapter-3') ||
      msg.includes('chapter-3-mocking') ||
      msg.includes('discuss') ||
      msg.includes('course') ||
      msg.includes('phase');
    assert.ok(hasCourseContext,
      `systemMessage must surface active course/chapter/phase. Got: ${parsed.systemMessage.slice(0, 400)}`);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5 — session_start_exits_zero_when_wiki_learner_missing (graceful)
//
// The hook must not crash when wiki/learner/ does not exist.
// It must exit 0 and still emit a valid systemMessage.
// ---------------------------------------------------------------------------

test('should exit 0 and emit valid systemMessage even when wiki/learner/ directory is absent', async () => {
  // Arrange — fresh temp dir with NO wiki/learner/ directory
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-ss-no-wiki-'));

  try {
    const payload = { cwd: projectDir };

    // Act
    const result = await runHook(payload);

    // Assert — must not crash
    assert.equal(result.exitCode, 0,
      `hook must exit 0 even when wiki/learner/ is missing. stderr: ${result.stderr.slice(0, 300)}`);

    // Assert — stdout must be valid JSON with systemMessage (graceful degradation)
    let parsed;
    try {
      parsed = JSON.parse(result.stdout.trim());
    } catch (err) {
      assert.fail(
        `stdout must be valid JSON even with no wiki. Got: ${result.stdout.slice(0, 300)}`
      );
    }

    assert.ok(
      typeof parsed.systemMessage === 'string' && parsed.systemMessage.length > 0,
      `systemMessage must be a non-empty string even when wiki is absent. Got: ${JSON.stringify(parsed.systemMessage)}`
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6 — session_start_never_emits_decision_block
//
// SessionStart must NEVER emit decision:'block'. It is an informational hook
// only. Blocking would prevent Claude from starting the session at all.
// Mirrors phase quality gate: "No hook emits decision:'block'"
// (phase-6-hooks.md Phase Quality Gate)
// ---------------------------------------------------------------------------

test('should never emit decision:block in its output under any circumstances', async () => {
  // Arrange — try several hostile inputs that might trigger error paths
  const scenarios = [
    // Normal case
    { label: 'normal payload', payload: { cwd: mkdtempSync(join(tmpdir(), 'jaewon-ss-block-a-')) } },
    // Empty stdin (hook must handle gracefully)
    { label: 'empty payload', payload: {} },
    // Completely invalid cwd (non-existent dir)
    { label: 'invalid cwd', payload: { cwd: '/this/path/does/not/exist/ever' } },
  ];

  const tempDirs = scenarios
    .map((s) => s.payload.cwd)
    .filter((d) => d && d.startsWith(tmpdir()));

  try {
    for (const { label, payload } of scenarios) {
      // Act
      const result = await runHook(payload);

      // Assert — exit 0 always
      assert.equal(result.exitCode, 0,
        `hook must exit 0 for scenario "${label}". stderr: ${result.stderr.slice(0, 200)}`);

      // Assert — stdout must not contain decision:block in any form
      const raw = result.stdout;
      const hasBlock =
        raw.includes('"block"') &&
        raw.includes('"decision"');
      assert.equal(hasBlock, false,
        `hook must never emit decision:'block' for scenario "${label}". stdout: ${raw.slice(0, 300)}`);

      // Also verify via parse when output is non-empty JSON
      if (raw.trim().startsWith('{')) {
        let parsed;
        try {
          parsed = JSON.parse(raw.trim());
        } catch { /* non-JSON is fine — just no block */ }
        if (parsed) {
          assert.notEqual(parsed.decision, 'block',
            `parsed output must not have decision:'block' for scenario "${label}"`);
        }
      }
    }
  } finally {
    for (const d of tempDirs) {
      try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
    }
  }
});

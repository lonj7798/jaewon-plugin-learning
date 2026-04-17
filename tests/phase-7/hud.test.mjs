/**
 * Phase 7 — Task 7.6 (RED): HUD statusline tests
 *
 * All 6 tests must FAIL until Task 7.7 creates:
 *   hud/learning-hud.mjs
 *
 * Framework: node:test + node:assert/strict, ESM.
 *
 * Strategy: each test spawns hud/learning-hud.mjs via child_process.spawn,
 * seeds a tmpdir with .jaewon-learning/status.json where needed, feeds a
 * minimal Claude Code statusline event JSON on stdin, then asserts on exit
 * code and stdout content.
 *
 * When learning-hud.mjs is missing, node exits non-zero with
 * "Cannot find module" — that is the correct RED failure reason.
 *
 * Calling spec (phase-7-dashboard.md §7.7):
 *   stdin: Claude Code statusline event JSON
 *   stdout: single ANSI-colored line
 *   side effects: reads .jaewon-learning/status.json
 *   contract: exits 0 even when status file is missing
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));

// This file: jaewon-plugin-learning/tests/phase-7/hud.test.mjs
// Plugin root: jaewon-plugin-learning/
const HUD_SCRIPT = join(__dirname, '..', '..', 'hud', 'learning-hud.mjs');

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Spawn the HUD script, feed JSON on stdin, collect result.
 * @param {object} stdinPayload  - Claude Code statusline event
 * @param {object} [envOverrides] - extra env vars (e.g. to point at a tmpdir)
 * @returns {Promise<{ exitCode: number, stdout: string, stderr: string }>}
 */
function runHud(stdinPayload, envOverrides = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [HUD_SCRIPT], {
      env: { ...process.env, ...envOverrides },
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
 * Seed .jaewon-learning/status.json in projectDir and return its path.
 */
function seedStatusJson(projectDir, overrides = {}) {
  const baseDir = join(projectDir, '.jaewon-learning');
  mkdirSync(baseDir, { recursive: true });
  const statusPath = join(baseDir, 'status.json');
  const status = {
    version: 1,
    active_course: {
      slug: 'dynamic-programming',
      chapter: 'ch03-memoization',
      phase: 'practice',
    },
    verdict_history: ['mastery', 'partial', 'incomplete'],
    session: { last_start: new Date().toISOString() },
    ...overrides,
  };
  writeFileSync(statusPath, JSON.stringify(status, null, 2), 'utf-8');
  return statusPath;
}

// ---------------------------------------------------------------------------
// TEST 1 — hud_reads_jaewon_learning_status_json
//
// When learning-hud.mjs is invoked with a valid status.json present,
// it must exit 0 and emit output to stdout.
// ---------------------------------------------------------------------------

test('should exit 0 and write output to stdout when status.json is present and valid', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-hud-t1-'));

  try {
    seedStatusJson(projectDir);
    const payload = { cwd: projectDir };

    // Act
    const result = await runHud(payload, { JAEWON_LEARNING_CWD: projectDir });

    // Assert — must always exit 0 (statusline contract: never crash Claude Code)
    assert.equal(
      result.exitCode, 0,
      `learning-hud.mjs must exit 0; got ${result.exitCode}. stderr: ${result.stderr.slice(0, 300)}`
    );

    // Assert — must produce non-empty output
    assert.ok(
      result.stdout.length > 0,
      `learning-hud.mjs must write something to stdout. Got empty output. stderr: ${result.stderr.slice(0, 300)}`
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// TEST 2 — hud_output_under_120_chars
//
// The output must fit in a single terminal statusline (<= 120 visible chars).
// ANSI escape sequences are stripped before measuring length.
// ---------------------------------------------------------------------------

test('should emit output of at most 120 visible characters to fit a single statusline', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-hud-t2-'));

  try {
    seedStatusJson(projectDir, {
      active_course: {
        slug: 'dynamic-programming',
        chapter: 'ch03-memoization',
        phase: 'practice',
      },
      verdict_history: ['mastery', 'partial', 'incomplete', 'mastery', 'mastery'],
    });
    const payload = { cwd: projectDir };

    // Act
    const result = await runHud(payload, { JAEWON_LEARNING_CWD: projectDir });

    assert.equal(result.exitCode, 0,
      `learning-hud.mjs must exit 0. stderr: ${result.stderr.slice(0, 300)}`);

    // Strip ANSI escape sequences, then measure the single output line
    // eslint-disable-next-line no-control-regex
    const ansiPattern = /\x1b\[[0-9;]*m/g;
    const visibleOutput = result.stdout.replace(ansiPattern, '').trimEnd();

    // Assert — must be a single line (no newlines in the middle)
    const lines = visibleOutput.split('\n').filter(l => l.length > 0);
    assert.ok(
      lines.length >= 1,
      `output must contain at least one non-empty line. Got: ${JSON.stringify(visibleOutput)}`
    );

    // Assert — visible length must be <= 120 chars
    const visibleLen = lines[0].length;
    assert.ok(
      visibleLen <= 120,
      `visible output length must be <= 120 chars for statusline use; got ${visibleLen} chars: "${lines[0]}"`
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// TEST 3 — hud_format_shows_course_chapter_phase
//
// When there is an active course, the output must include the course slug,
// chapter identifier, and phase name so the learner knows where they are.
// ---------------------------------------------------------------------------

test('should include course slug, chapter, and phase in output when active course is set', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-hud-t3-'));

  try {
    seedStatusJson(projectDir, {
      active_course: {
        slug: 'system-design',
        chapter: 'ch07-load-balancing',
        phase: 'discuss',
      },
      verdict_history: [],
    });
    const payload = { cwd: projectDir };

    // Act
    const result = await runHud(payload, { JAEWON_LEARNING_CWD: projectDir });

    assert.equal(result.exitCode, 0,
      `learning-hud.mjs must exit 0. stderr: ${result.stderr.slice(0, 300)}`);

    // Strip ANSI codes to check visible content
    // eslint-disable-next-line no-control-regex
    const visible = result.stdout.replace(/\x1b\[[0-9;]*m/g, '');

    // Assert — course slug must appear
    assert.ok(
      visible.includes('system-design'),
      `output must contain the course slug "system-design". Got: "${visible.trim()}"`
    );

    // Assert — chapter must appear
    assert.ok(
      visible.includes('ch07-load-balancing') || visible.includes('ch07'),
      `output must contain the chapter "ch07-load-balancing" or "ch07". Got: "${visible.trim()}"`
    );

    // Assert — phase must appear
    assert.ok(
      visible.includes('discuss'),
      `output must contain the phase "discuss". Got: "${visible.trim()}"`
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// TEST 4 — hud_falls_back_to_default_when_no_active_course
//
// When status.json exists but has no active_course (or active_course is null),
// the output must include the plugin name and an idle indicator rather than
// crashing or emitting empty output.
// ---------------------------------------------------------------------------

test('should show plugin name and idle indicator when no active course is set', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-hud-t4-'));

  try {
    seedStatusJson(projectDir, {
      active_course: null,
      verdict_history: [],
    });
    const payload = { cwd: projectDir };

    // Act
    const result = await runHud(payload, { JAEWON_LEARNING_CWD: projectDir });

    // Assert — must exit 0 even with no active course
    assert.equal(result.exitCode, 0,
      `learning-hud.mjs must exit 0 when no active course. stderr: ${result.stderr.slice(0, 300)}`);

    // Strip ANSI codes
    // eslint-disable-next-line no-control-regex
    const visible = result.stdout.replace(/\x1b\[[0-9;]*m/g, '').trim();

    // Assert — output must be non-empty
    assert.ok(
      visible.length > 0,
      `output must not be empty when no active course. Got empty string.`
    );

    // Assert — must include plugin name or idle keyword
    const hasPluginRef = visible.toLowerCase().includes('jaewon') ||
      visible.toLowerCase().includes('learning');
    const hasIdleRef = visible.toLowerCase().includes('idle') ||
      visible.toLowerCase().includes('no course') ||
      visible.toLowerCase().includes('--');

    assert.ok(
      hasPluginRef || hasIdleRef,
      `output must include plugin name (jaewon/learning) or idle indicator. Got: "${visible}"`
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// TEST 5 — hud_shows_verdict_history_bar_with_color_codes
//
// When verdict_history is present and non-empty, the output must contain at
// least one ANSI escape sequence — mastery=green (\x1b[32m), partial=yellow
// (\x1b[33m), incomplete=red (\x1b[31m). The raw stdout must include \x1b[.
// ---------------------------------------------------------------------------

test('should include ANSI escape codes for verdict badge colors when verdict history is present', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-hud-t5-'));

  try {
    seedStatusJson(projectDir, {
      active_course: {
        slug: 'algorithms',
        chapter: 'ch01-sorting',
        phase: 'practice',
      },
      // History includes all three verdict types to exercise all three color paths
      verdict_history: ['mastery', 'partial', 'incomplete'],
    });
    const payload = { cwd: projectDir };

    // Act
    const result = await runHud(payload, { JAEWON_LEARNING_CWD: projectDir });

    assert.equal(result.exitCode, 0,
      `learning-hud.mjs must exit 0. stderr: ${result.stderr.slice(0, 300)}`);

    // Assert — raw stdout must contain at least one ANSI escape sequence
    const hasAnsi = result.stdout.includes('\x1b[');
    assert.ok(
      hasAnsi,
      `output must contain ANSI escape codes (\\x1b[) for verdict badge colors. Got raw output: ${JSON.stringify(result.stdout.slice(0, 200))}`
    );

    // Assert — green (\x1b[32m) must appear (mastery badge)
    assert.ok(
      result.stdout.includes('\x1b[32m'),
      `output must include green ANSI code \\x1b[32m for mastery verdict. Raw: ${JSON.stringify(result.stdout.slice(0, 200))}`
    );

    // Assert — yellow (\x1b[33m) must appear (partial badge)
    assert.ok(
      result.stdout.includes('\x1b[33m'),
      `output must include yellow ANSI code \\x1b[33m for partial verdict. Raw: ${JSON.stringify(result.stdout.slice(0, 200))}`
    );

    // Assert — red (\x1b[31m) must appear (incomplete badge)
    assert.ok(
      result.stdout.includes('\x1b[31m'),
      `output must include red ANSI code \\x1b[31m for incomplete verdict. Raw: ${JSON.stringify(result.stdout.slice(0, 200))}`
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// TEST 6 — hud_exits_zero_on_missing_status
//
// When the status file does not exist, learning-hud.mjs must still exit 0
// and emit at least a minimal fallback line — it must never crash Claude Code.
// ---------------------------------------------------------------------------

test('should exit 0 and emit fallback output when status.json is missing', async () => {
  // Arrange — point HUD at a tmpdir that has NO .jaewon-learning/ directory
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-hud-t6-'));

  try {
    // Deliberately do NOT create .jaewon-learning/status.json
    const payload = { cwd: projectDir };

    // Act
    const result = await runHud(payload, { JAEWON_LEARNING_CWD: projectDir });

    // Assert — must exit 0 (graceful fallback, never crash the host session)
    assert.equal(
      result.exitCode, 0,
      `learning-hud.mjs must exit 0 even when status.json is missing; got ${result.exitCode}. stderr: ${result.stderr.slice(0, 300)}`
    );

    // Assert — must still emit some output (not silent)
    assert.ok(
      result.stdout.length > 0,
      `learning-hud.mjs must emit fallback output when status.json is missing. Got empty stdout. stderr: ${result.stderr.slice(0, 300)}`
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

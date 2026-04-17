/**
 * Phase 6 — Task 6.9 (RED): session-end hook tests
 *
 * All 4 tests must FAIL until Task 6.10 creates:
 *   hooks/session-end.mjs
 *
 * Framework: node:test + node:assert/strict, ESM.
 *
 * Strategy: each test spawns `node hooks/session-end.mjs` directly,
 * feeds a JSON event payload on stdin, then asserts on exit code,
 * stdout content, and/or the filesystem state in a tmpdir.
 *
 * When session-end.mjs is missing, node exits non-zero with
 * "Cannot find module" — that is the correct RED failure for all 4 tests.
 *
 * Calling spec (task 6.10, phase-6-hooks.md §6.9 / §6.10):
 *   INPUT  stdin: SessionEnd JSON event { cwd?, ... }
 *   OUTPUT stdout: JSON.stringify({ systemMessage: '...' })
 *   SIDE EFFECTS:
 *     - Appends a timestamped entry to wiki/log.md (karpathy-style append-only)
 *     - Updates status.json with session.last_end timestamp
 *     - Emits a systemMessage summarising the session
 *   CONTRACT:
 *     - Always exits 0; never emits decision:'block'
 *     - Graceful when wiki/ directory is absent (no crash)
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
// This file: jaewon-plugin-learning/tests/phase-6/session-end.test.mjs
// Plugin root: jaewon-plugin-learning/
const HOOK_SCRIPT = join(__dirname, '..', '..', 'hooks', 'session-end.mjs');

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Spawn the hook script, feed JSON on stdin, collect the result.
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

    child.stdin.write(JSON.stringify(stdinPayload));
    child.stdin.end();
  });
}

/**
 * Write a minimal status.json into a tmpdir's .jaewon-learning/ directory.
 */
function seedStatusJson(projectDir, statusOverrides = {}) {
  const baseDir = join(projectDir, '.jaewon-learning');
  mkdirSync(baseDir, { recursive: true });
  const status = {
    version: 1,
    course_state: {
      current_course: 'tdd-fundamentals',
      current_chapter: 'chapter-3-mocking',
      current_phase: 'discuss',
      cycle_iteration: 2,
      last_advance_sig: null,
    },
    session: {
      total_sessions: 3,
      last_start: new Date(Date.now() - 60_000).toISOString(),
      last_end: null,
    },
    ...statusOverrides,
  };
  writeFileSync(
    join(baseDir, 'status.json'),
    JSON.stringify(status, null, 2),
    'utf-8'
  );
}

/**
 * Read status.json from a project dir.
 */
function readStatusJson(projectDir) {
  return JSON.parse(
    readFileSync(join(projectDir, '.jaewon-learning', 'status.json'), 'utf-8')
  );
}

// ---------------------------------------------------------------------------
// TEST 1 — session_end_exits_zero_on_valid_input
//
// The hook must exit 0 when given a well-formed SessionEnd payload that
// includes a valid cwd with a .jaewon-learning/ directory present.
// Mirrors the base hook contract: "always exits 0 on any caught error"
// (phase-6-hooks.md Phase Quality Gate).
// ---------------------------------------------------------------------------

test('should exit 0 when invoked with a minimal valid SessionEnd payload', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-se-t1-'));

  try {
    seedStatusJson(projectDir);
    const payload = { cwd: projectDir };

    // Act
    const result = await runHook(payload);

    // Assert — hook must NEVER exit non-zero (base hook contract)
    assert.equal(
      result.exitCode, 0,
      `session-end.mjs must exit 0 for any input; got ${result.exitCode}. stderr: ${result.stderr.slice(0, 300)}`
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// TEST 2 — session_end_appends_wiki_log_entry
//
// When wiki/log.md already exists, the hook must append a timestamped entry
// that includes the active course, phase reached, and session summary.
// Mirrors raw-data/jaewon-plugin/hooks/session-end.mjs:71-77:
//   const logEntry = `\n## [${date}] Session #${sessionNum}\n...`
//   appendFileSync(wikiLogPath, logEntry, 'utf-8')
// ---------------------------------------------------------------------------

test('should append a timestamped session entry to wiki/log.md when the file exists', async () => {
  // Arrange
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-se-t2-'));

  try {
    seedStatusJson(projectDir, {
      course_state: {
        current_course: 'tdd-fundamentals',
        current_chapter: 'chapter-3-mocking',
        current_phase: 'discuss',
        cycle_iteration: 2,
        last_advance_sig: null,
      },
      session: {
        total_sessions: 4,
        last_start: new Date(Date.now() - 120_000).toISOString(),
        last_end: null,
      },
    });

    // Pre-create wiki/log.md with an existing entry
    const wikiDir = join(projectDir, 'wiki');
    mkdirSync(wikiDir, { recursive: true });
    const wikiLogPath = join(wikiDir, 'log.md');
    writeFileSync(
      wikiLogPath,
      '# Session Log\n\n## [2026-04-15] Session #3\nPrevious entry.\n',
      'utf-8'
    );

    const payload = { cwd: projectDir };

    // Act
    const result = await runHook(payload);

    // Assert — exit 0
    assert.equal(
      result.exitCode, 0,
      `session-end.mjs must exit 0. stderr: ${result.stderr.slice(0, 300)}`
    );

    // Assert — wiki/log.md must have grown (entry was appended, not truncated)
    assert.ok(
      existsSync(wikiLogPath),
      'wiki/log.md must still exist after the hook runs'
    );
    const logContents = readFileSync(wikiLogPath, 'utf-8');

    assert.ok(
      logContents.includes('Previous entry.'),
      'wiki/log.md must retain the pre-existing content (append-only)'
    );

    // Assert — a new entry was appended (log grew beyond the seed content)
    const seedLength = '# Session Log\n\n## [2026-04-15] Session #3\nPrevious entry.\n'.length;
    assert.ok(
      logContents.length > seedLength,
      `wiki/log.md must be longer than before the hook ran (new entry appended). Length before: ${seedLength}, after: ${logContents.length}`
    );

    // Assert — new entry contains a date stamp in ISO/YYYY-MM-DD format
    const hasDateStamp = /\d{4}-\d{2}-\d{2}/.test(logContents.slice(seedLength));
    assert.ok(
      hasDateStamp,
      `appended entry must contain a YYYY-MM-DD timestamp. Appended section: ${logContents.slice(seedLength, seedLength + 200)}`
    );

    // Assert — new entry references the session (number, course, or phase)
    const appendedSection = logContents.slice(seedLength).toLowerCase();
    const hasSessionContext =
      appendedSection.includes('session') ||
      appendedSection.includes('tdd-fundamentals') ||
      appendedSection.includes('discuss') ||
      appendedSection.includes('chapter');
    assert.ok(
      hasSessionContext,
      `appended entry must reference session context (session/course/phase). Got: ${logContents.slice(seedLength, seedLength + 300)}`
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// TEST 3 — session_end_graceful_when_wiki_directory_missing
//
// The hook must not crash when wiki/ does not exist. It must exit 0 and still
// emit a valid systemMessage. No wiki/log.md should be created either
// (the hook only appends when the file already exists — it does not create it).
// Mirrors: raw-data/jaewon-plugin/hooks/session-end.mjs:72 — existsSync guard.
// ---------------------------------------------------------------------------

test('should exit 0 and not crash when wiki/ directory is absent', async () => {
  // Arrange — fresh temp dir with NO wiki/ directory at all
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-se-t3-'));

  try {
    seedStatusJson(projectDir);
    // Explicitly confirm wiki/ is absent
    assert.equal(
      existsSync(join(projectDir, 'wiki')),
      false,
      'Precondition: wiki/ must not exist for this test'
    );

    const payload = { cwd: projectDir };

    // Act
    const result = await runHook(payload);

    // Assert — must not crash
    assert.equal(
      result.exitCode, 0,
      `session-end.mjs must exit 0 even when wiki/ is missing. stderr: ${result.stderr.slice(0, 300)}`
    );

    // Assert — stdout must be valid JSON with a systemMessage (graceful degradation)
    let parsed;
    try {
      parsed = JSON.parse(result.stdout.trim());
    } catch (err) {
      assert.fail(
        `stdout must be valid JSON even with no wiki/. Got: ${result.stdout.slice(0, 300)}. Parse error: ${err.message}`
      );
    }

    assert.ok(
      typeof parsed.systemMessage === 'string' && parsed.systemMessage.length > 0,
      `systemMessage must be a non-empty string even when wiki/ is absent. Got: ${JSON.stringify(parsed.systemMessage)}`
    );

    // Assert — wiki/log.md must NOT have been created (hook is append-only, not create)
    assert.equal(
      existsSync(join(projectDir, 'wiki', 'log.md')),
      false,
      'wiki/log.md must not be created when wiki/ directory did not exist beforehand'
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// TEST 4 — session_end_never_emits_decision_block
//
// session-end.mjs must NEVER emit { decision: 'block' } under any input.
// Verified across three scenarios including hostile/empty inputs.
// Mirrors phase quality gate: "No hook emits decision:'block'"
// (phase-6-hooks.md Phase Quality Gate).
// ---------------------------------------------------------------------------

test('should never emit decision:"block" under any input conditions', async () => {
  // Arrange — three scenarios that could trigger error paths
  const normalDir = mkdtempSync(join(tmpdir(), 'jaewon-se-t4a-'));
  const wikiDir = join(normalDir, 'wiki');
  mkdirSync(wikiDir, { recursive: true });
  writeFileSync(join(wikiDir, 'log.md'), '# Log\n', 'utf-8');
  seedStatusJson(normalDir);

  const scenarios = [
    {
      label: 'normal payload with wiki/log.md present',
      payload: { cwd: normalDir },
    },
    {
      label: 'empty payload (no cwd)',
      payload: {},
    },
    {
      label: 'invalid cwd (non-existent directory)',
      payload: { cwd: '/this/path/does/not/exist/ever' },
    },
  ];

  try {
    for (const { label, payload } of scenarios) {
      // Act
      const result = await runHook(payload);

      // Assert — exit 0 always
      assert.equal(
        result.exitCode, 0,
        `session-end.mjs must exit 0 for scenario "${label}". stderr: ${result.stderr.slice(0, 200)}`
      );

      // Assert — raw stdout must not contain decision:block pattern
      const raw = result.stdout;
      const hasBlock = raw.includes('"block"') && raw.includes('"decision"');
      assert.equal(
        hasBlock, false,
        `session-end.mjs must never emit decision:'block' for scenario "${label}". stdout: ${raw.slice(0, 300)}`
      );

      // Also verify via parsed JSON when output looks like JSON
      if (raw.trim().startsWith('{')) {
        let parsed;
        try { parsed = JSON.parse(raw.trim()); } catch { /* non-JSON output is acceptable */ }
        if (parsed) {
          assert.notEqual(
            parsed.decision, 'block',
            `parsed output must not have decision:'block' for scenario "${label}"`
          );
        }
      }
    }
  } finally {
    rmSync(normalDir, { recursive: true, force: true });
  }
});

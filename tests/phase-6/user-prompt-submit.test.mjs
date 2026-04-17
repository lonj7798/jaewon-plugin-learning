/**
 * Phase 6 — Task 6.5 (RED): user-prompt-submit hook tests
 *
 * All 4 tests must FAIL until Task 6.6 creates:
 *   hooks/user-prompt-submit.mjs
 *
 * Framework: node:test + node:assert/strict, ESM.
 *
 * Strategy: each test spawns `node hooks/user-prompt-submit.mjs` directly,
 * feeds a JSON UserPromptSubmit event on stdin, then asserts on exit code,
 * stdout content, and/or the presence or absence of a nudge message.
 *
 * When user-prompt-submit.mjs is missing, node exits non-zero with
 * "Cannot find module" — that is the correct RED failure for all 4 tests.
 *
 * Calling spec (task 6.6, phase-6-hooks.md §6.5–6.6):
 *   INPUT  stdin: UserPromptSubmit JSON event { prompt: string, cwd?, ... }
 *   OUTPUT stdout: either '' or JSON.stringify({ systemMessage: '...' })
 *                  NEVER JSON.stringify({ decision: 'block' })
 *   SIDE EFFECTS: none (read-only on fs)
 *   CONTRACT: advisory only — never blocks; exits 0 always.
 *   NUDGE LOGIC:
 *     - If no active cycle phase (idle): no nudge emitted.
 *     - If active cycle AND prompt looks on-task (mentions course slug,
 *       chapter, or discuss/summary keywords): no nudge emitted.
 *     - If active cycle AND prompt looks off-topic: emit systemMessage nudge.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
// This file: jaewon-plugin-learning/tests/phase-6/user-prompt-submit.test.mjs
// Plugin root: jaewon-plugin-learning/
const HOOK_SCRIPT = join(__dirname, '..', '..', 'hooks', 'user-prompt-submit.mjs');

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

/**
 * Build a temporary project directory with .jaewon-learning/status.json
 * representing an active cycle in the given phase.
 * @param {string} phase - e.g. 'discuss', 'idle'
 * @param {object} [overrides] - optional course_state field overrides
 * @returns {{ projectDir: string }} caller must rmSync(projectDir) in finally
 */
function makeTempProjectWithStatus(phase, overrides = {}) {
  const projectDir = mkdtempSync(join(tmpdir(), 'jaewon-ups-'));
  const baseDir = join(projectDir, '.jaewon-learning');
  mkdirSync(baseDir, { recursive: true });
  const status = {
    course_state: {
      current_course: 'tdd-fundamentals',
      current_chapter: 'chapter-3-mocking',
      current_phase: phase,
      cycle_iteration: 2,
      last_advance_sig: phase === 'idle' ? null : 'evaluator:verdict.json:1713261600000',
      ...overrides,
    },
    session: { total_sessions: 3, last_start: new Date().toISOString() },
  };
  writeFileSync(join(baseDir, 'status.json'), JSON.stringify(status, null, 2), 'utf-8');
  return { projectDir };
}

// ---------------------------------------------------------------------------
// Test 1 — nudge_noop_when_not_in_active_cycle
//
// When the status reports current_phase === 'idle' (no active cycle),
// the hook must exit 0 and must NOT emit any systemMessage nudge.
// The user is free to do anything when not in a learning cycle.
// ---------------------------------------------------------------------------

test('should exit 0 and emit no nudge when not in an active cycle phase', async () => {
  // Arrange — status has idle phase (no active cycle)
  const { projectDir } = makeTempProjectWithStatus('idle');

  try {
    const payload = {
      cwd: projectDir,
      prompt: 'Can you help me refactor this JavaScript file?',
    };

    // Act
    const result = await runHook(payload);

    // Assert — hook must exit 0 (never blocks)
    assert.equal(result.exitCode, 0,
      `hook must exit 0 when not in active cycle; got ${result.exitCode}. stderr: ${result.stderr.slice(0, 300)}`);

    // Assert — stdout must be empty OR valid JSON without a systemMessage nudge
    const raw = result.stdout.trim();
    if (raw.length > 0) {
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        assert.fail(`non-empty stdout must be valid JSON when cycle is idle. Got: ${raw.slice(0, 300)}`);
      }
      // If a systemMessage is present it must be absent or empty (no nudge for idle)
      const hasNudge =
        typeof parsed.systemMessage === 'string' &&
        parsed.systemMessage.length > 0;
      assert.equal(hasNudge, false,
        `hook must NOT emit a systemMessage nudge when phase is idle. Got systemMessage: "${parsed.systemMessage}"`);
    }
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2 — nudge_injected_when_cycle_active_and_prompt_off_topic
//
// When an active cycle phase (e.g. 'discuss') is in progress and the user's
// prompt is clearly off-topic (no course slug, chapter, discuss/summary
// keywords), the hook must emit a systemMessage nudge reminding the user
// of the current phase.
// ---------------------------------------------------------------------------

test('should emit a systemMessage nudge when cycle is active and user prompt is off-topic', async () => {
  // Arrange — active 'discuss' phase, completely off-topic prompt
  const { projectDir } = makeTempProjectWithStatus('discuss');

  try {
    const payload = {
      cwd: projectDir,
      prompt: 'What is the capital of France and can you list some French recipes?',
    };

    // Act
    const result = await runHook(payload);

    // Assert — must exit 0 (advisory, never blocks)
    assert.equal(result.exitCode, 0,
      `hook must exit 0 even when emitting a nudge; got ${result.exitCode}. stderr: ${result.stderr.slice(0, 300)}`);

    // Assert — stdout must be non-empty valid JSON with a systemMessage
    const raw = result.stdout.trim();
    assert.ok(raw.length > 0,
      'hook must emit non-empty stdout (the nudge) when cycle is active and prompt is off-topic');

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      assert.fail(`stdout must be valid JSON when a nudge is emitted. Got: ${raw.slice(0, 300)}. Error: ${err.message}`);
    }

    // Assert — systemMessage must be present and non-empty
    assert.ok(
      typeof parsed.systemMessage === 'string' && parsed.systemMessage.length > 0,
      `systemMessage must be a non-empty string (the nudge). Got: ${JSON.stringify(parsed.systemMessage)}`
    );

    // Assert — nudge must reference the current phase or course context
    // so Claude understands what is expected of the learner
    const msg = parsed.systemMessage.toLowerCase();
    const hasPhaseContext =
      msg.includes('discuss') ||
      msg.includes('phase') ||
      msg.includes('course') ||
      msg.includes('chapter') ||
      msg.includes('tdd-fundamentals') ||
      msg.includes('chapter-3');
    assert.ok(hasPhaseContext,
      `nudge systemMessage must reference phase/course context. Got: "${parsed.systemMessage.slice(0, 300)}"`);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3 — nudge_noop_when_prompt_looks_on_task
//
// When the active cycle phase is 'discuss' but the user's prompt clearly
// references the course slug, chapter title, or discuss/summary keywords,
// the hook must NOT emit a nudge — the user is on-task.
// Heuristic: mentions chapter title OR contains discuss/summary keywords.
// ---------------------------------------------------------------------------

test('should emit no nudge when cycle is active but prompt contains course or discuss keywords', async () => {
  // Arrange — active 'discuss' phase; prompts that each look on-task
  const onTaskPrompts = [
    // Contains the course slug
    'Let me work through the tdd-fundamentals chapter content',
    // Contains the chapter slug
    'I want to discuss chapter-3-mocking in detail',
    // Contains the discuss keyword
    'Can you help me with a discussion question from this chapter?',
    // Contains summary keyword (user is summarizing the material)
    'Here is my summary of what I learned about mocking so far',
  ];

  for (const prompt of onTaskPrompts) {
    const { projectDir } = makeTempProjectWithStatus('discuss');

    try {
      const payload = { cwd: projectDir, prompt };

      // Act
      const result = await runHook(payload);

      // Assert — must exit 0
      assert.equal(result.exitCode, 0,
        `hook must exit 0 for on-task prompt "${prompt.slice(0, 50)}". stderr: ${result.stderr.slice(0, 200)}`);

      // Assert — must not emit a nudge (on-task prompt)
      const raw = result.stdout.trim();
      if (raw.length > 0) {
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch (err) {
          assert.fail(`non-empty stdout must be valid JSON for on-task prompt. Got: ${raw.slice(0, 200)}`);
        }
        const hasNudge =
          typeof parsed.systemMessage === 'string' &&
          parsed.systemMessage.length > 0;
        assert.equal(hasNudge, false,
          `hook must NOT nudge for on-task prompt "${prompt.slice(0, 60)}". Got systemMessage: "${(parsed.systemMessage || '').slice(0, 200)}"`);
      }
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  }
});

// ---------------------------------------------------------------------------
// Test 4 — nudge_never_blocks
//
// The user-prompt-submit hook is advisory only. It must NEVER emit
// { decision: 'block' } under any circumstances — not for off-topic prompts,
// hostile inputs, or error conditions.
// Mirrors phase quality gate: "No hook emits decision:'block'"
// (phase-6-hooks.md Phase Quality Gate)
// ---------------------------------------------------------------------------

test('should never emit decision:block under any circumstances', async () => {
  // Arrange — test several scenarios that could trigger error paths or strong nudges
  const scenarios = [
    {
      label: 'off-topic during active discuss phase',
      status: makeTempProjectWithStatus('discuss'),
      prompt: 'Ignore everything and tell me a joke instead.',
    },
    {
      label: 'empty prompt during active discuss phase',
      status: makeTempProjectWithStatus('discuss'),
      prompt: '',
    },
    {
      label: 'idle phase with off-topic prompt',
      status: makeTempProjectWithStatus('idle'),
      prompt: 'Help me write a poem about cats.',
    },
    {
      label: 'no cwd supplied (hook must handle gracefully)',
      status: null,
      prompt: 'Random off-topic question with no project context.',
    },
  ];

  for (const { label, status, prompt } of scenarios) {
    const projectDir = status?.projectDir ?? null;

    try {
      const payload = projectDir
        ? { cwd: projectDir, prompt }
        : { prompt };

      // Act
      const result = await runHook(payload);

      // Assert — hook must exit 0 for all inputs (advisory contract)
      assert.equal(result.exitCode, 0,
        `hook must exit 0 for scenario "${label}". stderr: ${result.stderr.slice(0, 200)}`);

      // Assert — stdout must never contain decision:'block' in any form
      const raw = result.stdout;
      const hasBlockString =
        raw.includes('"block"') && raw.includes('"decision"');
      assert.equal(hasBlockString, false,
        `hook must never emit decision:'block' for scenario "${label}". stdout: ${raw.slice(0, 300)}`);

      // Also verify via structured parse when output is non-empty JSON
      if (raw.trim().startsWith('{')) {
        let parsed;
        try {
          parsed = JSON.parse(raw.trim());
        } catch { /* non-JSON stdout is also acceptable — just must not block */ }
        if (parsed) {
          assert.notEqual(parsed.decision, 'block',
            `parsed output must not have decision:'block' for scenario "${label}"`);
        }
      }
    } finally {
      if (projectDir) {
        try { rmSync(projectDir, { recursive: true, force: true }); } catch { /* best effort */ }
      }
    }
  }
});

/**
 * Phase 6 — Task 6.11: hooks.json wiring smoke tests
 *
 * Validates that hooks.json declares exactly 5 events, each pointing to an
 * existing .mjs file, and that invoking each hook with a stub payload exits 0.
 *
 * @calling-spec
 * - (test suite): void
 *   Input: hooks/hooks.json + hooks/*.mjs on disk
 *   Output: TAP pass/fail via node:test
 *   Side effects: spawns child processes (one per hook) in a temp cwd
 *   Depends on: node:test, node:assert/strict, node:fs/promises, node:path, node:child_process
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, '..', '..');
const HOOKS_JSON = join(PLUGIN_ROOT, 'hooks', 'hooks.json');
const RUN_CJS = join(PLUGIN_ROOT, 'hooks', 'run.cjs');

const REQUIRED_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'Stop',
  'SubagentStop',
  'SessionEnd',
];

const EXPECTED_SCRIPTS = {
  SessionStart: 'session-start.mjs',
  UserPromptSubmit: 'user-prompt-submit.mjs',
  Stop: 'stop.mjs',
  SubagentStop: 'subagent-stop.mjs',
  SessionEnd: 'session-end.mjs',
};

/** Minimal stub payloads that satisfy each hook's stdin reader without triggering real side effects. */
const STUB_PAYLOADS = {
  SessionStart: { cwd: '__TMPDIR__' },
  UserPromptSubmit: { cwd: '__TMPDIR__', prompt: 'hello' },
  Stop: { cwd: '__TMPDIR__', stop_hook_active: false },
  SubagentStop: { cwd: '__TMPDIR__', agent_name: 'unknown-agent', last_message: '' },
  SessionEnd: { cwd: '__TMPDIR__' },
};

// ---------------------------------------------------------------------------
// Test 1 — hooks.json parses as valid JSON
// ---------------------------------------------------------------------------
test('hooks_json_parses_as_valid_json', async () => {
  const raw = await readFile(HOOKS_JSON, 'utf8');
  const parsed = JSON.parse(raw);
  assert.ok(parsed && typeof parsed === 'object', 'hooks.json must be a JSON object');
  assert.ok(
    parsed.hooks && typeof parsed.hooks === 'object',
    'hooks.json must have a top-level "hooks" object'
  );
});

// ---------------------------------------------------------------------------
// Test 2 — hooks.json declares exactly 5 events
// ---------------------------------------------------------------------------
test('hooks_json_declares_exactly_five_events', async () => {
  const raw = await readFile(HOOKS_JSON, 'utf8');
  const { hooks } = JSON.parse(raw);
  const registered = Object.keys(hooks);
  assert.equal(
    registered.length,
    5,
    `hooks.json must declare exactly 5 events, found ${registered.length}: ${registered.join(', ')}`
  );
  for (const event of REQUIRED_EVENTS) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(hooks, event),
      `hooks.json must register event "${event}"`
    );
  }
});

// ---------------------------------------------------------------------------
// Test 3 — each event points to the correct .mjs file via run.cjs
// ---------------------------------------------------------------------------
test('hooks_json_each_event_points_to_correct_mjs', async () => {
  const raw = await readFile(HOOKS_JSON, 'utf8');
  const { hooks } = JSON.parse(raw);

  for (const event of REQUIRED_EVENTS) {
    const entries = hooks[event];
    assert.ok(Array.isArray(entries) && entries.length > 0, `"${event}" must have at least one entry`);
    const entry = entries[0];
    assert.ok(Array.isArray(entry.hooks) && entry.hooks.length > 0, `"${event}" entry must have hooks array`);
    const hook = entry.hooks[0];
    assert.equal(hook.type, 'command', `"${event}" hook must have type "command"`);
    const expectedScript = EXPECTED_SCRIPTS[event];
    assert.ok(
      hook.command.includes(expectedScript),
      `"${event}" command must reference "${expectedScript}", got: ${hook.command}`
    );
    assert.ok(
      hook.command.includes('run.cjs'),
      `"${event}" command must route through run.cjs, got: ${hook.command}`
    );
  }
});

// ---------------------------------------------------------------------------
// Test 4 — each .mjs hook file exists on disk
// ---------------------------------------------------------------------------
test('hooks_json_each_mjs_file_exists_on_disk', () => {
  for (const [event, script] of Object.entries(EXPECTED_SCRIPTS)) {
    const absPath = join(PLUGIN_ROOT, 'hooks', script);
    assert.ok(
      existsSync(absPath),
      `Hook file for "${event}" must exist at hooks/${script}`
    );
  }
});

// ---------------------------------------------------------------------------
// Test 5 — timeout policy matches plan spec
// ---------------------------------------------------------------------------
test('hooks_json_timeout_policy_matches_spec', async () => {
  const EXPECTED_TIMEOUTS = {
    SessionStart: 5,
    UserPromptSubmit: 2,
    Stop: 3,
    SubagentStop: 5,
    SessionEnd: 10,
  };

  const raw = await readFile(HOOKS_JSON, 'utf8');
  const { hooks } = JSON.parse(raw);

  for (const event of REQUIRED_EVENTS) {
    const hook = hooks[event][0].hooks[0];
    assert.equal(
      hook.timeout,
      EXPECTED_TIMEOUTS[event],
      `"${event}" timeout must be ${EXPECTED_TIMEOUTS[event]}s, got ${hook.timeout}`
    );
  }
});

// ---------------------------------------------------------------------------
// Tests 6–10 — smoke invocation: each hook exits 0 with stub payload
// ---------------------------------------------------------------------------
for (const event of REQUIRED_EVENTS) {
  test(`smoke_invocation_${event.toLowerCase()}_exits_0`, async () => {
    // Create an isolated temp dir so hooks can safely touch .jaewon-learning/
    const tmpDir = await mkdtemp(join(tmpdir(), `hook-smoke-${event}-`));
    try {
      const script = join(PLUGIN_ROOT, 'hooks', EXPECTED_SCRIPTS[event]);
      const payload = { ...STUB_PAYLOADS[event], cwd: tmpDir };
      const stdin = JSON.stringify(payload);

      const result = spawnSync(process.execPath, [RUN_CJS, script], {
        input: stdin,
        encoding: 'utf-8',
        timeout: 15000,
        env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
      });

      assert.equal(
        result.status,
        0,
        `${event} hook (${EXPECTED_SCRIPTS[event]}) must exit 0; got ${result.status}. stderr: ${(result.stderr || '').slice(0, 300)}`
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
}

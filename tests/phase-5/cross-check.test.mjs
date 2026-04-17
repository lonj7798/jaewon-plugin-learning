/**
 * Phase 5 — Task 5.10 (REFACTOR): 5-point cross-check audit
 *
 * Audits that:
 *   1. skills/new-course/SKILL.md contains `push_tactic_snapshot`
 *   2. skills/learn/SKILL.md contains `push_tactic_snapshot`
 *   3. skills/verdict/SKILL.md contains `push_tactic_snapshot`
 *   4. skills/resume/SKILL.md contains `learning_status`
 *   5. skills/resume/SKILL.md has ZERO references to `cycle-detect` or `cycle_detect`
 *
 * @calling-spec
 * - (test suite): void
 *   Input: none (reads skills/ files directly)
 *   Output: TAP assertions via node:test
 *   Side effects: none
 *   Depends on: node:fs/promises, node:url, node:path
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, '..', '..', 'skills');

async function readSkill(skill) {
  return readFile(join(SKILLS_DIR, skill, 'SKILL.md'), 'utf8');
}

// Audit 1 — new-course contains push_tactic_snapshot
test('cross-check: new-course/SKILL.md contains push_tactic_snapshot', async () => {
  const content = await readSkill('new-course');
  assert.ok(
    content.includes('push_tactic_snapshot'),
    'new-course/SKILL.md: missing push_tactic_snapshot (injection set member)'
  );
});

// Audit 2 — learn contains push_tactic_snapshot
test('cross-check: learn/SKILL.md contains push_tactic_snapshot', async () => {
  const content = await readSkill('learn');
  assert.ok(
    content.includes('push_tactic_snapshot'),
    'learn/SKILL.md: missing push_tactic_snapshot (injection set member)'
  );
});

// Audit 3 — verdict contains push_tactic_snapshot
test('cross-check: verdict/SKILL.md contains push_tactic_snapshot', async () => {
  const content = await readSkill('verdict');
  assert.ok(
    content.includes('push_tactic_snapshot'),
    'verdict/SKILL.md: missing push_tactic_snapshot (injection set member)'
  );
});

// Audit 4 — resume references learning_status
test('cross-check: resume/SKILL.md contains learning_status', async () => {
  const content = await readSkill('resume');
  assert.ok(
    content.includes('learning_status'),
    'resume/SKILL.md: missing learning_status (sole MCP state source for resume)'
  );
});

// Audit 5 — resume has zero cycle-detect / cycle_detect references
test('cross-check: resume/SKILL.md has no cycle-detect or cycle_detect references', async () => {
  const content = await readSkill('resume');
  const cycleDetectCount = (content.match(/cycle.detect|cycle_detect/g) ?? []).length;
  assert.strictEqual(
    cycleDetectCount,
    0,
    `resume/SKILL.md: found ${cycleDetectCount} reference(s) to cycle-detect/cycle_detect — must be zero (hook-internal only)`
  );
});

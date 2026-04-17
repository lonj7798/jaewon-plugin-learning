/**
 * Phase 6 — Regression test for issue #10: DEFAULT_STATUS.course_state shape
 *
 * Locks the canonical course_state schema to prevent terminology drift from
 * silently returning. Issue #8 fixed a bug where hook mutators wrote a
 * non-schema `cycle_iteration` field into course_state. Issue #10 cleaned
 * up the terminology residue. This test keeps both closed.
 *
 * Contract:
 *   - DEFAULT_STATUS.course_state.cycle_count must exist and be an integer
 *   - DEFAULT_STATUS.course_state.cycle_iteration must NOT exist
 *     (cycle_iteration is a verdict-payload field, not a course_state field)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STATUS } from '../../hooks/lib/state.mjs';

test('DEFAULT_STATUS.course_state exposes cycle_count (canonical field)', () => {
  const cs = DEFAULT_STATUS.course_state;
  assert.ok(cs, 'DEFAULT_STATUS must have a course_state object');
  assert.ok(
    Object.prototype.hasOwnProperty.call(cs, 'cycle_count'),
    'course_state must have cycle_count key'
  );
  assert.ok(
    Number.isInteger(cs.cycle_count),
    `course_state.cycle_count must be an integer; got ${typeof cs.cycle_count}`
  );
  assert.ok(
    cs.cycle_count >= 0,
    `course_state.cycle_count must be >= 0; got ${cs.cycle_count}`
  );
});

test('DEFAULT_STATUS.course_state does NOT contain stray cycle_iteration', () => {
  const cs = DEFAULT_STATUS.course_state;
  assert.equal(
    Object.prototype.hasOwnProperty.call(cs, 'cycle_iteration'),
    false,
    'course_state must not carry cycle_iteration; that name belongs to verdict payload (schemas/verdict.mjs), not course_state'
  );
});

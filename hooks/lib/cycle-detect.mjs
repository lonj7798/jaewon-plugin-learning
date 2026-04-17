/**
 * cycle-detect.mjs — Pure cycle-detection helper for hook scripts
 *
 * NOTE: hook-internal only. Not exposed via MCP tool; call from hooks only.
 *
 * @calling-spec
 * - detectCycle(status): { inCycle: boolean, phase: string|null, reason: string }
 *   Input: status object with course_state subtree
 *   Output: plain object indicating whether a learning cycle is active
 *   Side effects: none
 *   Depends on: nothing
 *
 *   Cycle detected when:
 *     status.course_state.current_phase !== 'idle'
 *   No cycle when:
 *     current_phase === 'idle' (regardless of sig)
 */

/**
 * Detect whether a learning cycle is currently active.
 * Pure function — same input always produces same output.
 *
 * @param {object} status - status object from state.mjs
 * @returns {{ inCycle: boolean, phase: string|null, reason: string }}
 */
export function detectCycle(status) {
  const courseState = status?.course_state;

  if (!courseState) {
    return { inCycle: false, phase: null, reason: 'no_course_state' };
  }

  const phase = courseState.current_phase ?? 'idle';

  if (phase === 'idle') {
    return { inCycle: false, phase: null, reason: 'phase_idle' };
  }

  return { inCycle: true, phase, reason: 'active_cycle' };
}

/**
 * verdict.mjs — Schema validator for learning verdict objects
 *
 * @calling-spec
 * - check(data): { ok: boolean, errors: string[], value?: object }
 *   Input: any value to validate as a verdict object
 *   Output: { ok: true, value: data } or { ok: false, errors: string[] }
 *   Side effects: none
 *   Depends on: nothing
 *
 * Shape:
 *   { verdict: 'incomplete'|'partial'|'mastery',
 *     evidence: string[],
 *     next_action: 'reread'|'rediscuss'|'merge',
 *     cycle_iteration: integer >= 1 }
 */

const VERDICT_ENUM = ['incomplete', 'partial', 'mastery'];
const NEXT_ACTION_ENUM = ['reread', 'rediscuss', 'merge'];

/**
 * check(data) — validate a verdict object
 * @param {unknown} data
 * @returns {{ ok: boolean, errors: string[], value?: object }}
 */
export function check(data) {
  const errors = [];

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['verdict: expected an object'] };
  }

  // verdict field
  if (!Object.prototype.hasOwnProperty.call(data, 'verdict')) {
    errors.push('verdict: field "verdict" is required');
  } else if (!VERDICT_ENUM.includes(data.verdict)) {
    errors.push(
      `verdict: field "verdict" must be one of ${VERDICT_ENUM.join('|')}, got "${data.verdict}"`
    );
  }

  // evidence field
  if (!Object.prototype.hasOwnProperty.call(data, 'evidence')) {
    errors.push('verdict: field "evidence" is required');
  } else if (!Array.isArray(data.evidence)) {
    errors.push('verdict: field "evidence" must be an array');
  } else {
    for (let i = 0; i < data.evidence.length; i++) {
      if (typeof data.evidence[i] !== 'string') {
        errors.push(`verdict: evidence[${i}] must be a string`);
      }
    }
  }

  // next_action field
  if (!Object.prototype.hasOwnProperty.call(data, 'next_action')) {
    errors.push('verdict: field "next_action" is required');
  } else if (!NEXT_ACTION_ENUM.includes(data.next_action)) {
    errors.push(
      `verdict: field "next_action" must be one of ${NEXT_ACTION_ENUM.join('|')}, got "${data.next_action}"`
    );
  }

  // cycle_iteration field
  if (!Object.prototype.hasOwnProperty.call(data, 'cycle_iteration')) {
    errors.push('verdict: field "cycle_iteration" is required');
  } else if (!Number.isInteger(data.cycle_iteration) || data.cycle_iteration < 1) {
    errors.push('verdict: field "cycle_iteration" must be an integer >= 1');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, errors: [], value: data };
}

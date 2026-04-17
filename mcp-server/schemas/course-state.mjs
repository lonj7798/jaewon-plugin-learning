/**
 * course-state.mjs — Schema validator for course state objects
 *
 * @calling-spec
 * - check(data): { ok: boolean, errors: string[], value?: object }
 *   Input: any value to validate as a course state object
 *   Output: { ok: true, value: data } or { ok: false, errors: string[] }
 *   Side effects: none
 *   Depends on: nothing
 *
 * Shape:
 *   { current_course: string,
 *     current_chapter: string,
 *     current_phase: 'read'|'summarize'|'discuss'|'verdict'|'idle',
 *     cycle_count: integer >= 0,
 *     verdict_history: string[],
 *     last_advance_sig: string | null }
 */

const PHASE_ENUM = ['read', 'summarize', 'discuss', 'verdict', 'idle'];
const NS = 'course-state';

function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }

function checkStringField(data, key, errors) {
  if (!has(data, key)) {
    errors.push(`${NS}: field "${key}" is required`);
  } else if (typeof data[key] !== 'string') {
    errors.push(`${NS}: field "${key}" must be a string`);
  }
}

function checkPhase(data, errors) {
  if (!has(data, 'current_phase')) {
    errors.push(`${NS}: field "current_phase" is required`);
  } else if (!PHASE_ENUM.includes(data.current_phase)) {
    errors.push(`${NS}: field "current_phase" must be one of ${PHASE_ENUM.join('|')}, got "${data.current_phase}"`);
  }
}

function checkVerdictHistory(data, errors) {
  if (!has(data, 'verdict_history')) {
    errors.push(`${NS}: field "verdict_history" is required`);
  } else if (!Array.isArray(data.verdict_history)) {
    errors.push(`${NS}: field "verdict_history" must be an array`);
  } else {
    data.verdict_history.forEach((v, i) => {
      if (typeof v !== 'string') errors.push(`${NS}: verdict_history[${i}] must be a string`);
    });
  }
}

/**
 * check(data) — validate a course state object
 * @param {unknown} data
 * @returns {{ ok: boolean, errors: string[], value?: object }}
 */
export function check(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: [`${NS}: expected an object`] };
  }

  const errors = [];
  checkStringField(data, 'current_course', errors);
  checkStringField(data, 'current_chapter', errors);
  checkPhase(data, errors);

  if (!has(data, 'cycle_count')) {
    errors.push(`${NS}: field "cycle_count" is required`);
  } else if (!Number.isInteger(data.cycle_count) || data.cycle_count < 0) {
    errors.push(`${NS}: field "cycle_count" must be an integer >= 0`);
  }

  checkVerdictHistory(data, errors);

  if (!has(data, 'last_advance_sig')) {
    errors.push(`${NS}: field "last_advance_sig" is required`);
  } else if (data.last_advance_sig !== null && typeof data.last_advance_sig !== 'string') {
    errors.push(`${NS}: field "last_advance_sig" must be a string or null`);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [], value: data };
}

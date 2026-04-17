/**
 * profile.mjs — Schema validator for learner profile delta objects
 *
 * @calling-spec
 * - check(data): { ok: boolean, errors: string[], value?: object }
 *   Input: any value to validate as a five-section learner profile
 *   Output: { ok: true, value: data } or { ok: false, errors: string[] }
 *   Side effects: none
 *   Depends on: nothing
 *
 * Shape (five required sections):
 *   { style: string,
 *     strengths: string[],
 *     weaknesses: string[],
 *     push_tactics: Array<{ id: string, description: string }>,
 *     recent_sessions: Array<{ date: string, summary: string }> }
 */

const NS = 'profile';
function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }

function checkStringArray(data, key, errors) {
  if (!has(data, key)) {
    errors.push(`${NS}: field "${key}" is required`);
  } else if (!Array.isArray(data[key])) {
    errors.push(`${NS}: field "${key}" must be an array`);
  } else {
    data[key].forEach((v, i) => {
      if (typeof v !== 'string') errors.push(`${NS}: ${key}[${i}] must be a string`);
    });
  }
}

function checkPushTactics(data, errors) {
  if (!has(data, 'push_tactics')) {
    errors.push(`${NS}: field "push_tactics" is required`);
  } else if (!Array.isArray(data.push_tactics)) {
    errors.push(`${NS}: field "push_tactics" must be an array`);
  } else {
    data.push_tactics.forEach((t, i) => {
      if (t === null || typeof t !== 'object' || Array.isArray(t)) {
        errors.push(`${NS}: push_tactics[${i}] must be an object`);
      } else {
        if (typeof t.id !== 'string') errors.push(`${NS}: push_tactics[${i}].id must be a string`);
        if (typeof t.description !== 'string') errors.push(`${NS}: push_tactics[${i}].description must be a string`);
      }
    });
  }
}

function checkRecentSessions(data, errors) {
  if (!has(data, 'recent_sessions')) {
    errors.push(`${NS}: field "recent_sessions" is required`);
  } else if (!Array.isArray(data.recent_sessions)) {
    errors.push(`${NS}: field "recent_sessions" must be an array`);
  } else {
    data.recent_sessions.forEach((s, i) => {
      if (s === null || typeof s !== 'object' || Array.isArray(s)) {
        errors.push(`${NS}: recent_sessions[${i}] must be an object`);
      } else {
        if (typeof s.date !== 'string') errors.push(`${NS}: recent_sessions[${i}].date must be a string`);
        if (typeof s.summary !== 'string') errors.push(`${NS}: recent_sessions[${i}].summary must be a string`);
      }
    });
  }
}

/**
 * check(data) — validate a learner profile object
 * @param {unknown} data
 * @returns {{ ok: boolean, errors: string[], value?: object }}
 */
export function check(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: [`${NS}: expected an object`] };
  }

  const errors = [];

  if (!has(data, 'style')) {
    errors.push(`${NS}: field "style" is required`);
  } else if (typeof data.style !== 'string') {
    errors.push(`${NS}: field "style" must be a string`);
  }

  checkStringArray(data, 'strengths', errors);
  checkStringArray(data, 'weaknesses', errors);
  checkPushTactics(data, errors);
  checkRecentSessions(data, errors);

  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [], value: data };
}

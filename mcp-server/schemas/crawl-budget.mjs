/**
 * crawl-budget.mjs — Schema validator for crawl budget objects
 *
 * @calling-spec
 * - check(data): { ok: boolean, errors: string[], value?: object }
 *   Input: any value to validate as a crawl budget object
 *   Output: { ok: true, value: data } or { ok: false, errors: string[] }
 *   Side effects: none
 *   Depends on: nothing
 *
 * Shape:
 *   { course_slug: string,
 *     started_at: string (ISO timestamp),
 *     sources_fetched: integer >= 0,
 *     elapsed_ms: integer >= 0,
 *     tokens_spent: integer >= 0,
 *     limits: {
 *       max_sources: integer >= 0,
 *       max_elapsed_ms: integer >= 0,
 *       max_tokens: integer >= 0
 *     } }
 */

const NS = 'crawl-budget';
function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }

function checkNonNegativeInt(val, fieldName, errors) {
  if (!Number.isInteger(val) || val < 0) {
    errors.push(`${NS}: field "${fieldName}" must be an integer >= 0, got ${val}`);
  }
}

function checkNonEmptyString(data, key, label, errors) {
  if (!has(data, key)) {
    errors.push(`${NS}: field "${key}" is required`);
  } else if (typeof data[key] !== 'string' || data[key].length === 0) {
    errors.push(`${NS}: field "${key}" must be a non-empty string${label ? ` (${label})` : ''}`);
  }
}

function checkIntField(data, key, errors) {
  if (!has(data, key)) {
    errors.push(`${NS}: field "${key}" is required`);
  } else {
    checkNonNegativeInt(data[key], key, errors);
  }
}

function checkLimits(data, errors) {
  if (!has(data, 'limits')) {
    errors.push(`${NS}: field "limits" is required`);
  } else if (data.limits === null || typeof data.limits !== 'object' || Array.isArray(data.limits)) {
    errors.push(`${NS}: field "limits" must be an object`);
  } else {
    for (const key of ['max_sources', 'max_elapsed_ms', 'max_tokens']) {
      if (!has(data.limits, key)) {
        errors.push(`${NS}: limits.${key} is required`);
      } else {
        checkNonNegativeInt(data.limits[key], `limits.${key}`, errors);
      }
    }
  }
}

/**
 * check(data) — validate a crawl budget object
 * @param {unknown} data
 * @returns {{ ok: boolean, errors: string[], value?: object }}
 */
export function check(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: [`${NS}: expected an object`] };
  }

  const errors = [];
  checkNonEmptyString(data, 'course_slug', null, errors);
  checkNonEmptyString(data, 'started_at', 'ISO timestamp', errors);
  checkIntField(data, 'sources_fetched', errors);
  checkIntField(data, 'elapsed_ms', errors);
  checkIntField(data, 'tokens_spent', errors);
  checkLimits(data, errors);

  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [], value: data };
}

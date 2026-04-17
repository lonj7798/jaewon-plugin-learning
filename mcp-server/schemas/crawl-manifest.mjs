/**
 * crawl-manifest.mjs — Schema validator for crawl manifest objects
 *
 * @calling-spec
 * - check(data): { ok: boolean, errors: string[], value?: object }
 *   Input: any value to validate as a crawl manifest object
 *   Output: { ok: true, value: data } or { ok: false, errors: string[] }
 *   Side effects: none
 *   Depends on: nothing
 *
 * Shape:
 *   { sources: Array<{
 *       kind: string,
 *       url: string,
 *       hash: string,
 *       summary: string,
 *       relevance: number (0.0 to 1.0 inclusive)
 *     }> }
 */

const NS = 'crawl-manifest';

function checkSource(src, i, errors) {
  if (src === null || typeof src !== 'object' || Array.isArray(src)) {
    errors.push(`${NS}: sources[${i}] must be an object`);
    return;
  }
  if (typeof src.kind !== 'string' || src.kind.length === 0) {
    errors.push(`${NS}: sources[${i}].kind must be a non-empty string`);
  }
  if (typeof src.url !== 'string' || src.url.length === 0) {
    errors.push(`${NS}: sources[${i}].url must be a non-empty string`);
  }
  if (typeof src.hash !== 'string' || src.hash.length === 0) {
    errors.push(`${NS}: sources[${i}].hash must be a non-empty string`);
  }
  if (typeof src.summary !== 'string') {
    errors.push(`${NS}: sources[${i}].summary must be a string`);
  }
  if (typeof src.relevance !== 'number') {
    errors.push(`${NS}: sources[${i}].relevance must be a number`);
  } else if (src.relevance < 0.0 || src.relevance > 1.0) {
    errors.push(`${NS}: sources[${i}].relevance must be between 0.0 and 1.0, got ${src.relevance}`);
  }
}

/**
 * check(data) — validate a crawl manifest object
 * @param {unknown} data
 * @returns {{ ok: boolean, errors: string[], value?: object }}
 */
export function check(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: [`${NS}: expected an object`] };
  }

  const errors = [];

  if (!Object.prototype.hasOwnProperty.call(data, 'sources')) {
    return { ok: false, errors: [`${NS}: field "sources" is required`] };
  }
  if (!Array.isArray(data.sources)) {
    return { ok: false, errors: [`${NS}: field "sources" must be an array`] };
  }

  data.sources.forEach((src, i) => checkSource(src, i, errors));

  return errors.length > 0 ? { ok: false, errors } : { ok: true, errors: [], value: data };
}

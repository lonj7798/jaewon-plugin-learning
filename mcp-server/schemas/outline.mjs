/**
 * outline.mjs — Schema validator for course outline objects (draft + review variants)
 *
 * @calling-spec
 * - check(data): { ok: boolean, errors: string[], value?: object }
 *   Input: any value to validate as an outline object
 *   Output: { ok: true, value: data } or { ok: false, errors: string[] }
 *   Side effects: none
 *   Depends on: outline-cycle.mjs
 *
 * Discriminated union on data.kind:
 *   draft:  { kind:'draft', course_slug:string, source:string,
 *              chapters:[{slug,title,concepts:string[],deps:string[]}] }
 *   review: { kind:'review', course_slug:string,
 *              verdict:'APPROVE'|'REVISE', objections:[] }
 */

import { hasCircularDeps } from './outline-cycle.mjs';

const KIND_ENUM = ['draft', 'review'];
const REVIEW_VERDICT_ENUM = ['APPROVE', 'REVISE'];

/** validateChapter(ch, i, errors) — check one chapter entry */
function validateChapter(ch, i, errors) {
  if (ch === null || typeof ch !== 'object' || Array.isArray(ch)) {
    errors.push(`outline: chapters[${i}] must be an object`);
    return false;
  }
  if (typeof ch.slug !== 'string') errors.push(`outline: chapters[${i}].slug must be a string`);
  if (typeof ch.title !== 'string') errors.push(`outline: chapters[${i}].title must be a string`);
  if (!Array.isArray(ch.concepts)) errors.push(`outline: chapters[${i}].concepts must be an array`);
  if (!Array.isArray(ch.deps)) errors.push(`outline: chapters[${i}].deps must be an array`);
  return true;
}

/** checkDraft(data, errors) — validate draft-specific fields */
function checkDraft(data, errors) {
  if (typeof data.course_slug !== 'string' || data.course_slug.length === 0) {
    errors.push('outline: field "course_slug" is required and must be a non-empty string');
  }
  if (typeof data.source !== 'string' || data.source.length === 0) {
    errors.push('outline: field "source" is required and must be a non-empty string');
  }
  if (!Object.prototype.hasOwnProperty.call(data, 'chapters')) {
    errors.push('outline: field "chapters" is required for kind "draft"');
    return;
  }
  if (!Array.isArray(data.chapters)) {
    errors.push('outline: field "chapters" must be an array');
    return;
  }
  for (let i = 0; i < data.chapters.length; i++) {
    validateChapter(data.chapters[i], i, errors);
  }
  if (errors.length === 0) {
    const graph = new Map(
      data.chapters.map((ch) => [ch.slug, Array.isArray(ch.deps) ? ch.deps : []])
    );
    if (hasCircularDeps(graph)) errors.push('outline: circular chapter dependencies detected');
  }
}

/** checkReview(data, errors) — validate review-specific fields */
function checkReview(data, errors) {
  if (typeof data.course_slug !== 'string' || data.course_slug.length === 0) {
    errors.push('outline: field "course_slug" is required and must be a non-empty string');
  }
  if (!Object.prototype.hasOwnProperty.call(data, 'verdict')) {
    errors.push('outline: field "verdict" is required for kind "review"');
  } else if (!REVIEW_VERDICT_ENUM.includes(data.verdict)) {
    errors.push(`outline: field "verdict" must be one of ${REVIEW_VERDICT_ENUM.join('|')}, got "${data.verdict}"`);
  }
  if (!Object.prototype.hasOwnProperty.call(data, 'objections')) {
    errors.push('outline: field "objections" is required for kind "review"');
  } else if (!Array.isArray(data.objections)) {
    errors.push('outline: field "objections" must be an array');
  } else if (data.verdict === 'REVISE' && data.objections.length === 0) {
    errors.push('outline: verdict "REVISE" requires at least one objection');
  }
}

/** Dispatch map: kind -> branch checker (LOD Pattern 8 Dict Dispatch) */
const BRANCH_CHECKERS = { draft: checkDraft, review: checkReview };

/**
 * check(data) — validate an outline object (discriminated by kind)
 * @param {unknown} data
 * @returns {{ ok: boolean, errors: string[], value?: object }}
 */
export function check(data) {
  const errors = [];
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['outline: expected an object'] };
  }
  if (!Object.prototype.hasOwnProperty.call(data, 'kind') || !KIND_ENUM.includes(data.kind)) {
    return { ok: false, errors: [`outline: field "kind" must be one of ${KIND_ENUM.join('|')}, got "${data.kind}"`] };
  }
  BRANCH_CHECKERS[data.kind](data, errors);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, errors: [], value: data };
}

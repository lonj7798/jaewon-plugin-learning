/**
 * read-header.mjs — Schema validator for chapter read.md markdown documents
 *
 * @calling-spec
 * - check(data): { ok: boolean, errors: string[], value?: object }
 *   Input: string (markdown document content)
 *   Output: { ok: true, value: { frontmatter, sections } } or { ok: false, errors: string[] }
 *   Side effects: none
 *   Depends on: nothing
 *
 * Validates:
 *   1. Document starts with a YAML frontmatter block (---...---)
 *   2. Frontmatter contains required keys: chapter, course, phase
 *   3. Required section headers present: ## Overview, ## Key Concepts, ## Questions
 */

const REQUIRED_FRONTMATTER_KEYS = ['chapter', 'course', 'phase'];
const REQUIRED_SECTIONS = ['## Overview', '## Key Concepts', '## Questions'];

/**
 * parseFrontmatter(doc) — extract YAML frontmatter from a markdown string
 * Returns null if no valid frontmatter block found.
 * @param {string} doc
 * @returns {{ raw: string, rest: string } | null}
 */
function parseFrontmatter(doc) {
  const trimmed = doc.trimStart();
  if (!trimmed.startsWith('---')) return null;

  const afterOpen = trimmed.slice(3);
  // must have a newline after opening ---
  const newlineAfterOpen = afterOpen.indexOf('\n');
  if (newlineAfterOpen === -1) return null;

  // find closing ---
  const closeIndex = afterOpen.indexOf('\n---');
  if (closeIndex === -1) return null;

  const raw = afterOpen.slice(0, closeIndex);
  const rest = afterOpen.slice(closeIndex + 4); // skip \n---
  return { raw, rest };
}

/**
 * parseSimpleYaml(raw) — parse simple key: value YAML (no nesting)
 * @param {string} raw
 * @returns {Record<string, string>}
 */
function parseSimpleYaml(raw) {
  const result = {};
  for (const line of raw.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

/**
 * check(data) — validate a read.md document string
 * @param {unknown} data
 * @returns {{ ok: boolean, errors: string[], value?: object }}
 */
export function check(data) {
  const errors = [];

  if (typeof data !== 'string') {
    return { ok: false, errors: ['read-header: expected a string (markdown document)'] };
  }

  // 1. Frontmatter presence
  const fm = parseFrontmatter(data);
  if (fm === null) {
    return {
      ok: false,
      errors: ['read-header: document must begin with a YAML frontmatter block (---...---)'],
    };
  }

  // 2. Required frontmatter keys
  const frontmatter = parseSimpleYaml(fm.raw);
  for (const key of REQUIRED_FRONTMATTER_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(frontmatter, key) || frontmatter[key] === '') {
      errors.push(`read-header: frontmatter missing required field "${key}"`);
    }
  }

  // 3. Required section headers in the body
  for (const section of REQUIRED_SECTIONS) {
    // match the header as a standalone line (at line start)
    const pattern = new RegExp(`(^|\\n)${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
    if (!pattern.test(data)) {
      // Extract the section name without ##
      const name = section.replace(/^##\s*/, '');
      errors.push(`read-header: required section "${name}" is missing`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, errors: [], value: { frontmatter, sections: REQUIRED_SECTIONS } };
}

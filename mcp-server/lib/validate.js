/**
 * validate.js — Central schema dispatcher for jaewon-plugin-learning
 *
 * @calling-spec
 * - validate(schemaName, data): { ok: boolean, errors?: string[], value?: object }
 *   Input: schemaName (string) — one of the registered schema names;
 *          data (any) — the value to validate
 *   Output: { ok: true, value } on success
 *           { ok: false, errors: string[] } on failure
 *   Side effects: none
 *   Depends on: schemas/verdict.mjs, schemas/profile.mjs, schemas/outline.mjs,
 *               schemas/course-state.mjs, schemas/crawl-manifest.mjs,
 *               schemas/read-header.mjs, schemas/crawl-budget.mjs
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = join(__dirname, '..', 'schemas');

/**
 * Lazily loaded schema modules, keyed by schema name.
 * @type {Map<string, { check: function }>}
 */
const schemaCache = new Map();

/**
 * SCHEMA_MAP — maps public schema names to their .mjs file basenames
 * Uses LOD Pattern 8 (Dict Dispatch): no switch/case, flat lookup table.
 */
const SCHEMA_MAP = {
  verdict: 'verdict.mjs',
  profile: 'profile.mjs',
  outline: 'outline.mjs',
  'course-state': 'course-state.mjs',
  'crawl-manifest': 'crawl-manifest.mjs',
  'read-header': 'read-header.mjs',
  'crawl-budget': 'crawl-budget.mjs',
};

/**
 * loadSchema(schemaName) — dynamically import a schema module on first use
 * @param {string} schemaName
 * @returns {Promise<{ check: function }>}
 */
async function loadSchema(schemaName) {
  if (schemaCache.has(schemaName)) {
    return schemaCache.get(schemaName);
  }

  const filename = SCHEMA_MAP[schemaName];
  if (!filename) {
    throw new Error(`validate: unknown schema "${schemaName}"`);
  }

  const modulePath = join(SCHEMAS_DIR, filename);
  const mod = await import(modulePath);
  schemaCache.set(schemaName, mod);
  return mod;
}

/**
 * validate(schemaName, data) — validate data against the named schema
 * @param {string} schemaName
 * @param {unknown} data
 * @returns {Promise<{ ok: boolean, errors?: string[], value?: unknown }>}
 */
export async function validate(schemaName, data) {
  if (!Object.prototype.hasOwnProperty.call(SCHEMA_MAP, schemaName)) {
    return { ok: false, errors: [`validate: unknown schema "${schemaName}"`] };
  }

  const mod = await loadSchema(schemaName);
  return mod.check(data);
}

/**
 * crawl-guard-handler.js — MCP tool handler for learning_crawl_guard (R3 circuit breaker)
 *
 * @calling-spec
 * - registerCrawlGuardTools(server, paths, clock): void
 *   Input:  server — MCP server with .tool(name, description, schema, cb) method
 *           paths  — { learningDir: string } path to .jaewon-learning/ directory
 *           clock  — { now: () => number } injectable clock (defaults to Date.now)
 *   Output: void (registers 'learning_crawl_guard' tool on server)
 *   Side effects: reads + writes .jaewon-learning/crawl-budget.json
 *   Depends on: lib/file-ops.js, lib/validate.js
 *
 * Tool: learning_crawl_guard
 *   action='begin'  -> { ok, budget_path, limits }
 *   action='check'  -> { allow, reason?, remaining?, limit_hit? }
 *   action='record' -> { ok, counters } | { ok: false, error }
 *   action='end'    -> { ok, summary }
 *   FAILS CLOSED: corrupt/missing budget on check -> { allow: false, reason: 'no_active_budget'|'corrupt_budget' }
 */

import { join } from 'node:path';
import { readJSON, writeJSON } from '../lib/file-ops.js';
import { validate } from '../lib/validate.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LIMITS = {
  max_sources: 10,
  max_elapsed_ms: 300000,
  max_tokens: 50000,
};

const CRAWL_GUARD_SCHEMA = {
  type: 'object',
  properties: {
    course_slug:       { type: 'string' },
    action:            { type: 'string', enum: ['begin', 'check', 'record', 'end'] },
    estimated_tokens:  { type: 'number' },
    source_url:        { type: 'string' },
    tokens_used:       { type: 'number' },
    limits:            { type: 'object' },
  },
  required: ['course_slug', 'action'],
};

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

/**
 * handleBegin — initialize a crawl budget and write to disk
 * @param {string} budgetPath
 * @param {string} courseSlug
 * @param {object|undefined} limitsOverride
 * @param {{ now: () => number }} clock
 * @returns {Promise<object>}
 */
async function handleBegin(budgetPath, courseSlug, limitsOverride, clock) {
  const limits = { ...DEFAULT_LIMITS, ...(limitsOverride ?? {}) };
  const startedAt = new Date(clock.now()).toISOString();

  const state = {
    course_slug: courseSlug,
    started_at: startedAt,
    sources_fetched: 0,
    elapsed_ms: 0,
    tokens_spent: 0,
    limits,
  };

  const validation = await validate('crawl-budget', state);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  writeJSON(budgetPath, state);
  return { ok: true, budget_path: budgetPath, limits };
}

/**
 * handleCheck — evaluate current budget and decide allow/deny
 * @param {string} budgetPath
 * @param {number} estimatedTokens
 * @param {{ now: () => number }} clock
 * @returns {object}
 */
function handleCheck(budgetPath, estimatedTokens, clock) {
  const budget = readJSON(budgetPath);

  if (!budget) {
    return { allow: false, reason: 'no_active_budget' };
  }

  // Fails closed on finalized budget
  if (budget.finalized === true) {
    return { allow: false, reason: 'no_active_budget' };
  }

  // Validate budget shape — fails closed on corrupt data
  if (
    typeof budget.sources_fetched !== 'number' ||
    typeof budget.tokens_spent !== 'number' ||
    typeof budget.started_at !== 'string' ||
    !budget.limits
  ) {
    return { allow: false, reason: 'corrupt_budget' };
  }

  const { sources_fetched, tokens_spent, started_at, limits } = budget;
  const { max_sources, max_elapsed_ms, max_tokens } = limits;

  const startedAtMs = new Date(started_at).getTime();
  const elapsedMs = clock.now() - startedAtMs;

  if (sources_fetched >= max_sources) {
    return { allow: false, reason: 'sources_exceeded', limit_hit: 'max_sources' };
  }

  if (elapsedMs > max_elapsed_ms) {
    return { allow: false, reason: 'elapsed_exceeded' };
  }

  const projectedTokens = tokens_spent + (estimatedTokens ?? 0);
  if (projectedTokens > max_tokens) {
    return { allow: false, reason: 'tokens_exceeded' };
  }

  return {
    allow: true,
    remaining: {
      sources: max_sources - sources_fetched - 1,
      elapsed_ms: max_elapsed_ms - elapsedMs,
      tokens: max_tokens - projectedTokens,
    },
  };
}

/**
 * handleRecord — increment counters atomically (read-modify-write)
 * @param {string} budgetPath
 * @param {number} tokensUsed
 * @param {{ now: () => number }} clock
 * @returns {Promise<object>}
 */
async function handleRecord(budgetPath, tokensUsed, clock) {
  const budget = readJSON(budgetPath);

  if (!budget) {
    return { ok: false, error: 'no active budget; call begin first' };
  }

  const elapsedMs = clock.now() - new Date(budget.started_at).getTime();

  const updated = {
    ...budget,
    sources_fetched: budget.sources_fetched + 1,
    tokens_spent: budget.tokens_spent + (tokensUsed ?? 0),
    elapsed_ms: elapsedMs,
  };

  const validation = await validate('crawl-budget', updated);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  writeJSON(budgetPath, updated);

  return {
    ok: true,
    counters: {
      sources_fetched: updated.sources_fetched,
      tokens_spent: updated.tokens_spent,
      elapsed_ms: updated.elapsed_ms,
    },
  };
}

/**
 * handleEnd — finalize budget, write crawl-manifest summary, mark finalized
 * @param {string} budgetPath
 * @param {string} learningDir
 * @param {{ now: () => number }} clock
 * @returns {object}
 */
function handleEnd(budgetPath, learningDir, clock) {
  const budget = readJSON(budgetPath);

  if (!budget) {
    return { ok: false, error: 'no active budget; call begin first' };
  }

  const elapsedMs = clock.now() - new Date(budget.started_at).getTime();

  const summary = {
    sources_fetched: budget.sources_fetched,
    elapsed_ms: elapsedMs,
    tokens_spent: budget.tokens_spent,
  };

  // Write crawl-manifest.json (sources summary shape)
  const manifestPath = join(learningDir, 'crawl-manifest.json');
  writeJSON(manifestPath, { sources: [], summary });

  // Mark budget finalized
  writeJSON(budgetPath, { ...budget, elapsed_ms: elapsedMs, finalized: true });

  return { ok: true, summary };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * registerCrawlGuardTools(server, paths, clock) — register learning_crawl_guard on server
 * @param {{ tool: Function }} server
 * @param {{ learningDir: string }} paths
 * @param {{ now?: () => number }} [clock]
 */
export function registerCrawlGuardTools(server, paths, clock) {
  const clockFn = { now: (clock && typeof clock.now === 'function') ? clock.now : Date.now };
  const budgetPath = join(paths.learningDir, 'crawl-budget.json');

  server.tool(
    'learning_crawl_guard',
    'Circuit breaker for web crawl budgets',
    CRAWL_GUARD_SCHEMA,
    async (input) => {
      const { course_slug, action, estimated_tokens, tokens_used, limits } = input ?? {};

      if (action === 'begin') {
        return handleBegin(budgetPath, course_slug, limits, clockFn);
      }

      if (action === 'check') {
        return handleCheck(budgetPath, estimated_tokens ?? 0, clockFn);
      }

      if (action === 'record') {
        return handleRecord(budgetPath, tokens_used ?? 0, clockFn);
      }

      if (action === 'end') {
        return handleEnd(budgetPath, paths.learningDir, clockFn);
      }

      return { error: 'unknown-action', action };
    }
  );
}

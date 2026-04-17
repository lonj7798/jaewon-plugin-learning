/**
 * Phase 3 — Task 3.1 (RED): Schema boundary tests (Zero-Hallucination Contracts)
 *
 * All 18 tests must FAIL until Task 3.2 creates:
 *   mcp-server/lib/validate.js
 *   mcp-server/schemas/verdict.mjs
 *   mcp-server/schemas/profile.mjs
 *   mcp-server/schemas/outline.mjs
 *   mcp-server/schemas/course-state.mjs
 *   mcp-server/schemas/crawl-manifest.mjs
 *   mcp-server/schemas/read-header.mjs
 *   mcp-server/schemas/crawl-budget.mjs
 *
 * Framework: node:test + node:assert/strict, ESM.
 *
 * Imports are dynamic (inside each test) so all 18 tests are registered
 * individually and each fails with ERR_MODULE_NOT_FOUND — not a single
 * file-level crash. This gives the implementer clear per-test feedback.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// This file: jaewon-plugin-learning/tests/phase-3/schemas.test.mjs
// Plugin root: jaewon-plugin-learning/
const MCP_LIB = join(__dirname, '..', '..', 'mcp-server', 'lib');
const MCP_SCHEMAS = join(__dirname, '..', '..', 'mcp-server', 'schemas');

/** Dynamically import validate.js and call validate(schemaName, obj). */
async function callValidate(schemaName, obj) {
  const { validate } = await import(`${MCP_LIB}/validate.js`);
  return validate(schemaName, obj);
}

// ---------------------------------------------------------------------------
// VERDICT (tests 1-2)
// Schema: { verdict: 'incomplete'|'partial'|'mastery', evidence: string[],
//           next_action: 'reread'|'rediscuss'|'merge', cycle_iteration: int >= 1 }
// ---------------------------------------------------------------------------

// Test 1 — verdict_valid
test('verdict: valid mastery verdict passes', async () => {
  // Arrange
  // Also import the schema module itself to confirm the file must exist
  await import(`${MCP_SCHEMAS}/verdict.mjs`);
  const v = {
    verdict: 'mastery',
    evidence: ['candidate explained recursion clearly', 'solved problem independently'],
    next_action: 'merge',
    cycle_iteration: 1,
  };

  // Act
  const result = await callValidate('verdict', v);

  // Assert
  assert.equal(result.ok, true, `expected ok:true, got ok:false with errors: ${JSON.stringify(result.errors)}`);
});

// Test 2 — verdict_rejects_unknown_enum
test('verdict: unknown verdict enum value is rejected', async () => {
  // Arrange
  await import(`${MCP_SCHEMAS}/verdict.mjs`);
  const v = {
    verdict: 'approved',
    evidence: ['some evidence'],
    next_action: 'merge',
    cycle_iteration: 1,
  };

  // Act
  const result = await callValidate('verdict', v);

  // Assert
  assert.equal(result.ok, false, 'expected ok:false for unknown enum value "approved"');
  assert.ok(
    result.errors.some((e) => /verdict/i.test(e)),
    `expected an error mentioning "verdict", got: ${JSON.stringify(result.errors)}`
  );
});

// ---------------------------------------------------------------------------
// PROFILE (tests 3-4)
// Schema: five-section learner profile delta object with push_tactics required
// ---------------------------------------------------------------------------

// Test 3 — profile_valid
test('profile: valid full five-section profile passes', async () => {
  // Arrange
  await import(`${MCP_SCHEMAS}/profile.mjs`);
  const p = {
    style: 'visual learner who benefits from worked examples',
    strengths: ['pattern recognition', 'persistence'],
    weaknesses: ['rushing through proofs', 'skipping base cases'],
    push_tactics: [
      { id: 'slow-down', description: 'Ask "what is the base case?" before any recursion' },
    ],
    recent_sessions: [
      { date: '2026-04-16', summary: 'Completed chapter on dynamic programming' },
    ],
  };

  // Act
  const result = await callValidate('profile', p);

  // Assert
  assert.equal(result.ok, true, `expected ok:true, got: ${JSON.stringify(result.errors)}`);
});

// Test 4 — profile_rejects_missing_push_tactics
test('profile: missing push_tactics field is rejected', async () => {
  // Arrange — push_tactics is required per calling spec §5.2
  await import(`${MCP_SCHEMAS}/profile.mjs`);
  const p = {
    style: 'visual learner',
    strengths: ['pattern recognition'],
    weaknesses: ['rushing'],
    recent_sessions: [],
    // push_tactics intentionally omitted
  };

  // Act
  const result = await callValidate('profile', p);

  // Assert
  assert.equal(result.ok, false, 'expected ok:false when push_tactics is missing');
  assert.ok(
    result.errors.some((e) => /push_tactics/i.test(e)),
    `expected error mentioning "push_tactics", got: ${JSON.stringify(result.errors)}`
  );
});

// ---------------------------------------------------------------------------
// OUTLINE (tests 5-9)
// Schema discriminated by kind: 'draft' | 'review'
//   draft:  { kind:'draft', course_slug, source, chapters:[{slug,title,concepts,deps}] }
//   review: { kind:'review', course_slug, verdict:'APPROVE'|'REVISE', objections:[] }
// ---------------------------------------------------------------------------

// Test 5 — outline_draft_valid
test('outline: valid draft outline passes', async () => {
  // Arrange
  await import(`${MCP_SCHEMAS}/outline.mjs`);
  const o = {
    kind: 'draft',
    course_slug: 'dynamic-programming',
    source: 'https://github.com/example/dp-course',
    chapters: [
      { slug: 'intro', title: 'Introduction to DP', concepts: ['memoization', 'overlapping subproblems'], deps: [] },
      { slug: 'knapsack', title: 'Knapsack Problem', concepts: ['tabulation'], deps: ['intro'] },
    ],
  };

  // Act
  const result = await callValidate('outline', o);

  // Assert
  assert.equal(result.ok, true, `expected ok:true, got: ${JSON.stringify(result.errors)}`);
});

// Test 6 — outline_rejects_circular_deps
test('outline: circular chapter dependencies are rejected', async () => {
  // Arrange — chapter A deps on B, chapter B deps on A
  await import(`${MCP_SCHEMAS}/outline.mjs`);
  const o = {
    kind: 'draft',
    course_slug: 'circular-course',
    source: 'https://github.com/example/circular',
    chapters: [
      { slug: 'chapter-a', title: 'Chapter A', concepts: [], deps: ['chapter-b'] },
      { slug: 'chapter-b', title: 'Chapter B', concepts: [], deps: ['chapter-a'] },
    ],
  };

  // Act
  const result = await callValidate('outline', o);

  // Assert
  assert.equal(result.ok, false, 'expected ok:false for circular chapter dependencies');
});

// Test 7 — outline_review_valid
test('outline: valid review outline with APPROVE verdict passes', async () => {
  // Arrange
  await import(`${MCP_SCHEMAS}/outline.mjs`);
  const o = {
    kind: 'review',
    course_slug: 'dynamic-programming',
    verdict: 'APPROVE',
    objections: [],
  };

  // Act
  const result = await callValidate('outline', o);

  // Assert
  assert.equal(result.ok, true, `expected ok:true, got: ${JSON.stringify(result.errors)}`);
});

// Test 8 — outline_review_revise_requires_objections
test('outline: review with REVISE verdict and empty objections is rejected', async () => {
  // Arrange — REVISE must include at least one objection
  await import(`${MCP_SCHEMAS}/outline.mjs`);
  const o = {
    kind: 'review',
    course_slug: 'dynamic-programming',
    verdict: 'REVISE',
    objections: [],
  };

  // Act
  const result = await callValidate('outline', o);

  // Assert
  assert.equal(result.ok, false, 'expected ok:false when REVISE has no objections');
});

// Test 9 — outline_review_rejects_unknown_kind
test('outline: unknown kind value is rejected by enum guard', async () => {
  // Arrange — 'approved' is not a valid kind
  await import(`${MCP_SCHEMAS}/outline.mjs`);
  const o = {
    kind: 'approved',
    course_slug: 'some-course',
  };

  // Act
  const result = await callValidate('outline', o);

  // Assert
  assert.equal(result.ok, false, 'expected ok:false for unknown kind "approved"');
  assert.ok(
    result.errors.some((e) => /kind/i.test(e)),
    `expected error mentioning "kind", got: ${JSON.stringify(result.errors)}`
  );
});

// ---------------------------------------------------------------------------
// COURSE-STATE (tests 10-11)
// Schema: { current_course, current_chapter, current_phase, cycle_count,
//           verdict_history, last_advance_sig: string|null }
// phase enum: 'read'|'summarize'|'discuss'|'verdict'|'idle'
// ---------------------------------------------------------------------------

// Test 10 — course_state_valid
test('course-state: valid course state with last_advance_sig passes', async () => {
  // Arrange
  await import(`${MCP_SCHEMAS}/course-state.mjs`);
  const cs = {
    current_course: 'dynamic-programming',
    current_chapter: 'knapsack',
    current_phase: 'discuss',
    cycle_count: 2,
    verdict_history: ['partial', 'mastery'],
    last_advance_sig: 'subagent-stop:evaluator:2026-04-16T10:00:00Z',
  };

  // Act
  const result = await callValidate('course-state', cs);

  // Assert
  assert.equal(result.ok, true, `expected ok:true, got: ${JSON.stringify(result.errors)}`);
});

// Test 11 — course_state_phase_enum_guard
test('course-state: invalid phase value "playing" is rejected', async () => {
  // Arrange — 'playing' is not in the phase enum
  await import(`${MCP_SCHEMAS}/course-state.mjs`);
  const cs = {
    current_course: 'dynamic-programming',
    current_chapter: 'intro',
    current_phase: 'playing',
    cycle_count: 1,
    verdict_history: [],
    last_advance_sig: null,
  };

  // Act
  const result = await callValidate('course-state', cs);

  // Assert
  assert.equal(result.ok, false, 'expected ok:false for phase "playing"');
  assert.ok(
    result.errors.some((e) => /phase/i.test(e)),
    `expected error mentioning "phase", got: ${JSON.stringify(result.errors)}`
  );
});

// ---------------------------------------------------------------------------
// CRAWL-MANIFEST (tests 12-13)
// Schema: { sources: [{kind, url, hash, summary, relevance}] }
// relevance: float 0.0..1.0
// ---------------------------------------------------------------------------

// Test 12 — crawl_manifest_valid
test('crawl-manifest: valid crawl manifest passes', async () => {
  // Arrange
  await import(`${MCP_SCHEMAS}/crawl-manifest.mjs`);
  const cm = {
    sources: [
      {
        kind: 'github',
        url: 'https://github.com/example/dp-course',
        hash: 'abc123def456',
        summary: 'Comprehensive course on dynamic programming with worked examples',
        relevance: 0.95,
      },
      {
        kind: 'webpage',
        url: 'https://example.com/dp-tutorial',
        hash: 'def789abc012',
        summary: 'Short tutorial covering memoization basics',
        relevance: 0.7,
      },
    ],
  };

  // Act
  const result = await callValidate('crawl-manifest', cm);

  // Assert
  assert.equal(result.ok, true, `expected ok:true, got: ${JSON.stringify(result.errors)}`);
});

// Test 13 — crawl_manifest_rejects_bad_relevance
test('crawl-manifest: relevance score greater than 1.0 is rejected', async () => {
  // Arrange — relevance must be in [0.0, 1.0]
  await import(`${MCP_SCHEMAS}/crawl-manifest.mjs`);
  const cm = {
    sources: [
      {
        kind: 'github',
        url: 'https://github.com/example/dp-course',
        hash: 'abc123def456',
        summary: 'Some content',
        relevance: 1.5,
      },
    ],
  };

  // Act
  const result = await callValidate('crawl-manifest', cm);

  // Assert
  assert.equal(result.ok, false, 'expected ok:false for relevance > 1.0');
  assert.ok(
    result.errors.some((e) => /relevance/i.test(e)),
    `expected error mentioning "relevance", got: ${JSON.stringify(result.errors)}`
  );
});

// ---------------------------------------------------------------------------
// READ-HEADER (tests 14-16)
// Schema: YAML frontmatter with chapter, course, phase:'read'
//         + required section headers: ## Overview, ## Key Concepts, ## Questions
// ---------------------------------------------------------------------------

// Test 14 — read_header_valid
test('read-header: valid frontmatter with all required sections passes', async () => {
  // Arrange — markdown string with valid YAML frontmatter and all required sections
  await import(`${MCP_SCHEMAS}/read-header.mjs`);
  const doc = [
    '---',
    'chapter: knapsack',
    'course: dynamic-programming',
    'phase: read',
    '---',
    '',
    '## Overview',
    'This chapter covers the knapsack problem.',
    '',
    '## Key Concepts',
    '- Tabulation',
    '- Optimal substructure',
    '',
    '## Questions',
    '1. What is the time complexity of the bottom-up knapsack solution?',
  ].join('\n');

  // Act
  const result = await callValidate('read-header', doc);

  // Assert
  assert.equal(result.ok, true, `expected ok:true, got: ${JSON.stringify(result.errors)}`);
});

// Test 15 — read_header_rejects_missing_section
test('read-header: missing ## Questions section is rejected', async () => {
  // Arrange — frontmatter valid but ## Questions header absent
  await import(`${MCP_SCHEMAS}/read-header.mjs`);
  const doc = [
    '---',
    'chapter: knapsack',
    'course: dynamic-programming',
    'phase: read',
    '---',
    '',
    '## Overview',
    'This chapter covers the knapsack problem.',
    '',
    '## Key Concepts',
    '- Tabulation',
    // ## Questions deliberately omitted
  ].join('\n');

  // Act
  const result = await callValidate('read-header', doc);

  // Assert
  assert.equal(result.ok, false, 'expected ok:false when ## Questions section is missing');
  assert.ok(
    result.errors.some((e) => /questions/i.test(e)),
    `expected error citing missing "Questions" header, got: ${JSON.stringify(result.errors)}`
  );
});

// Test 16 — read_header_rejects_missing_frontmatter
test('read-header: document with no YAML frontmatter block is rejected', async () => {
  // Arrange — plain markdown, no ---...--- block
  await import(`${MCP_SCHEMAS}/read-header.mjs`);
  const doc = [
    '## Overview',
    'No frontmatter at all.',
    '',
    '## Key Concepts',
    '- Something',
    '',
    '## Questions',
    '1. Why no frontmatter?',
  ].join('\n');

  // Act
  const result = await callValidate('read-header', doc);

  // Assert
  assert.equal(result.ok, false, 'expected ok:false when YAML frontmatter is absent');
});

// ---------------------------------------------------------------------------
// CRAWL-BUDGET (tests 17-18)
// Schema: { course_slug, started_at, sources_fetched, elapsed_ms, tokens_spent,
//           limits: { max_sources, max_elapsed_ms, max_tokens } }
// ---------------------------------------------------------------------------

// Test 17 — crawl_budget_valid
test('crawl-budget: valid crawl budget with zero counters passes', async () => {
  // Arrange
  await import(`${MCP_SCHEMAS}/crawl-budget.mjs`);
  const cb = {
    course_slug: 'dynamic-programming',
    started_at: '2026-04-16T09:00:00.000Z',
    sources_fetched: 0,
    elapsed_ms: 0,
    tokens_spent: 0,
    limits: {
      max_sources: 10,
      max_elapsed_ms: 300000,
      max_tokens: 50000,
    },
  };

  // Act
  const result = await callValidate('crawl-budget', cb);

  // Assert
  assert.equal(result.ok, true, `expected ok:true, got: ${JSON.stringify(result.errors)}`);
});

// Test 18 — crawl_budget_rejects_negative_counters
test('crawl-budget: negative sources_fetched counter is rejected', async () => {
  // Arrange — counters must be >= 0
  await import(`${MCP_SCHEMAS}/crawl-budget.mjs`);
  const cb = {
    course_slug: 'dynamic-programming',
    started_at: '2026-04-16T09:00:00.000Z',
    sources_fetched: -1,
    elapsed_ms: 0,
    tokens_spent: 0,
    limits: {
      max_sources: 10,
      max_elapsed_ms: 300000,
      max_tokens: 50000,
    },
  };

  // Act
  const result = await callValidate('crawl-budget', cb);

  // Assert
  assert.equal(result.ok, false, 'expected ok:false for negative sources_fetched');
  assert.ok(
    result.errors.some((e) => /sources_fetched/i.test(e)),
    `expected error mentioning "sources_fetched", got: ${JSON.stringify(result.errors)}`
  );
});

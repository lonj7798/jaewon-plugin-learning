/**
 * mock-agents.mjs — Deterministic fake agent responses for the e2e smoke test.
 *
 * @calling-spec
 * - mockAgentResult(agentName: string, inputs: object):
 *     { stdout: string, writes: Array<{path: string, content: string}>, result: unknown }
 *   Input:  agentName — researcher|planner|critic|creator|evaluator|profiler|
 *                        dashboard-builder|git-manager
 *           inputs    — context object: { course_slug?, chapter_slug?, op? }
 *   Output: stdout (log string), writes (relative paths + content), result (parsed value)
 *   Side effects: none (pure, deterministic)
 *   Depends on: nothing
 */

// ---------------------------------------------------------------------------
// Individual mock handlers
// ---------------------------------------------------------------------------

function researcher({ course_slug: slug = 'tiny-transformer' } = {}) {
  return {
    stdout: `researcher: crawled 3 sources for ${slug}`,
    writes: [],
    result: {
      course_slug: slug,
      sources: [
        { url: 'https://example.com/transformer-intro',   title: 'Transformer Introduction',  relevance: 0.95 },
        { url: 'https://example.com/attention-mechanism', title: 'Attention Is All You Need',  relevance: 0.92 },
        { url: 'https://example.com/positional-encoding', title: 'Positional Encoding',        relevance: 0.88 },
      ],
    },
  };
}

function planner({ course_slug: slug = 'tiny-transformer' } = {}) {
  const outline = {
    kind: 'draft',
    course_slug: slug,
    source: 'https://example.com/transformer-intro',
    chapters: [
      { slug: 'intro',     title: 'Introduction to Transformers', concepts: ['self-attention', 'encoder-decoder', 'positional-encoding'], deps: [] },
      { slug: 'attention', title: 'Attention Mechanism',          concepts: ['query-key-value', 'multi-head-attention', 'scaled-dot-product'], deps: ['intro'] },
    ],
  };
  return { stdout: `planner: 2-chapter outline for ${slug}`, writes: [], result: outline };
}

function critic({ course_slug: slug = 'tiny-transformer' } = {}) {
  return {
    stdout: `critic: APPROVE for ${slug}`,
    writes: [],
    result: { kind: 'review', course_slug: slug, verdict: 'APPROVE', objections: [] },
  };
}

function creator({ course_slug: course = 'tiny-transformer', chapter_slug: chapter = 'intro' } = {}) {
  const content = `---\nchapter: ${chapter}\ncourse: ${course}\nphase: read\n---\n\n# ${chapter}\n\n## Overview\n\nTransformers are built around the attention mechanism.\n\n## Key Concepts\n\n- Self-attention: each token attends to all others.\n- Positional encoding: injects order information.\n- Encoder-decoder: encoder reads; decoder generates.\n\n## Questions\n\n1. What problem does self-attention solve vs RNNs?\n2. Why is positional encoding necessary?\n3. How does multi-head attention differ from single-head?\n`;
  return {
    stdout: `creator: wrote read.md for ${course}/${chapter}`,
    writes: [{ path: `wiki/courses/${course}/${chapter}/read.md`, content }],
    result: content,
  };
}

function evaluator({ course_slug: course = 'tiny-transformer', chapter_slug: chapter = 'intro' } = {}) {
  const verdict = {
    verdict: 'mastery',
    evidence: ['demonstrated self-attention understanding', 'explained positional encoding', 'described encoder-decoder'],
    next_action: 'merge',
    cycle_iteration: 1,
  };
  return {
    stdout: `evaluator: mastery for ${course}/${chapter}`,
    writes: [{ path: `wiki/courses/${course}/${chapter}/verdict.json`, content: JSON.stringify(verdict, null, 2) }],
    result: verdict,
  };
}

function profiler({ course_slug: course = 'tiny-transformer', chapter_slug: chapter = 'intro' } = {}) {
  const tag = `${course}/${chapter}`;
  return {
    stdout: `profiler: updated 5 learner files after ${tag}`,
    writes: [
      { path: 'wiki/learner/learning-style.md',
        content: `# Learning Style\n\nPrefers worked examples and visual diagrams.\n\n## Update after ${tag}\n\nConfirmed preference for bottom-up explanations.\n` },
      { path: 'wiki/learner/strengths.md',
        content: `# Strengths\n\nStrong intuition for mathematical abstractions.\n\n## Update after ${tag}\n\nSolid grasp of attention mechanism.\n` },
      { path: 'wiki/learner/weaknesses.md',
        content: `# Weaknesses\n\nTends to skip implementation details.\n\n## Update after ${tag}\n\nUncertain about scaled dot-product derivation.\n` },
      { path: 'wiki/learner/push-tactics.md',
        content: `# Push Tactics\n\nAsk learner to re-derive formulas without notes.\n\n## Update after ${tag}\n\nSocratic questioning was effective.\n` },
      { path: 'wiki/learner/session-log.md',
        content: `# Session Log\n\n## 2026-04-17\n- course: ${course}\n- chapter: ${chapter}\n- phase: discuss\n- verdict: mastery\n- notes: Learner answered all questions confidently.\n` },
    ],
    result: { sections_updated: 5 },
  };
}

function dashboardBuilder(_inputs = {}) {
  return { stdout: 'dashboard-builder: no-op (runner calls build.mjs directly)', writes: [], result: {} };
}

function gitManager({ op = 'unknown' } = {}) {
  return { stdout: `git-manager: recorded op "${op}" (mock)`, writes: [], result: { logged: op } };
}

// ---------------------------------------------------------------------------
// Dispatch table (Dict Dispatch, LOD pattern)
// ---------------------------------------------------------------------------
const AGENT_HANDLERS = {
  researcher:          researcher,
  planner:             planner,
  critic:              critic,
  creator:             creator,
  evaluator:           evaluator,
  profiler:            profiler,
  'dashboard-builder': dashboardBuilder,
  'git-manager':       gitManager,
};

/**
 * mockAgentResult(agentName, inputs) — dispatch to the named mock handler.
 * @param {string} agentName
 * @param {object} [inputs]
 * @returns {{ stdout: string, writes: Array<{path: string, content: string}>, result: unknown }}
 */
export function mockAgentResult(agentName, inputs = {}) {
  const handler = AGENT_HANDLERS[agentName];
  if (!handler) {
    return { stdout: `mock: unknown agent "${agentName}"`, writes: [], result: null };
  }
  return handler(inputs);
}

/** mockAgents — named map for direct per-agent invocation. */
export const mockAgents = AGENT_HANDLERS;

/**
 * verdict-handler.js — MCP tool handler for learning_verdict
 *
 * @calling-spec
 * - registerVerdictTools(server, paths): void
 *   Input:  server — MCP server with .tool(name, schema, fn) method
 *           paths  — { root: string } filesystem root for wiki and .jaewon-learning
 *   Output: void (registers 'learning_verdict' tool on server)
 *   Side effects:
 *     - writes wiki/courses/<slug>/<chapter>/verdict.json (atomic via writeJSON)
 *     - updates .jaewon-learning/status.json (cycle_count, verdict_history, next_action)
 *     - NO git subprocess calls
 *   Depends on: ../lib/file-ops.js, ../lib/validate.js, node:path
 *
 * Tool: learning_verdict
 *   input:  { course_slug, chapter_slug, verdict, evidence, next_action, cycle_iteration }
 *   output: { ok: true, verdict_path, status_path } on success
 *           { ok: false, errors: string[] } on validation failure
 */

import { join } from 'node:path';
import { readJSON, writeJSON } from '../lib/file-ops.js';
import { validate } from '../lib/validate.js';

// ---------------------------------------------------------------------------
// next_action mapping: verdict value → status next_action
// ---------------------------------------------------------------------------

const VERDICT_TO_NEXT_ACTION = {
  mastery:    'merge',
  partial:    'rediscuss',
  incomplete: 'reread',
};

// ---------------------------------------------------------------------------
// Tool input schema
// ---------------------------------------------------------------------------

const VERDICT_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    course_slug:     { type: 'string' },
    chapter_slug:    { type: 'string' },
    verdict:         { type: 'string', enum: ['incomplete', 'partial', 'mastery'] },
    evidence:        { type: 'array', items: { type: 'string' } },
    next_action:     { type: 'string', enum: ['reread', 'rediscuss', 'merge'] },
    cycle_iteration: { type: 'integer', minimum: 1 },
  },
  required: ['course_slug', 'chapter_slug', 'verdict', 'evidence', 'next_action', 'cycle_iteration'],
};

// ---------------------------------------------------------------------------
// Handler logic
// ---------------------------------------------------------------------------

/**
 * handleVerdict(root, input) — validate, write verdict.json, update status.json
 * @param {string} root - filesystem root (wiki root)
 * @param {object} input - tool input payload
 * @returns {Promise<object>}
 */
async function handleVerdict(root, input) {
  const { course_slug, chapter_slug, verdict, evidence, next_action, cycle_iteration } = input ?? {};

  // Validate verdict shape (only the verdict-schema fields)
  const verdictData = { verdict, evidence, next_action, cycle_iteration };
  const validation = await validate('verdict', verdictData);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  // Build file paths
  const verdictPath = join(root, 'wiki', 'courses', course_slug, chapter_slug, 'verdict.json');
  const statusPath  = join(root, '.jaewon-learning', 'status.json');

  // Write verdict.json
  const verdictRecord = {
    course_slug,
    chapter_slug,
    verdict,
    evidence,
    next_action,
    cycle_iteration,
    recorded_at: new Date().toISOString(),
  };
  writeJSON(verdictPath, verdictRecord);

  // Update status.json
  const status = readJSON(statusPath) ?? {};
  const courseState = status.course_state ?? {};

  const updatedCourseState = {
    ...courseState,
    cycle_count:     (courseState.cycle_count ?? 0) + 1,
    verdict_history: [...(courseState.verdict_history ?? []), verdict],
    next_action:     VERDICT_TO_NEXT_ACTION[verdict] ?? next_action,
  };

  writeJSON(statusPath, { ...status, course_state: updatedCourseState });

  return { ok: true, verdict_path: verdictPath, status_path: statusPath };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * registerVerdictTools(server, paths) — register learning_verdict on server
 * @param {{ tool: Function }} server
 * @param {{ root: string }} paths
 */
export function registerVerdictTools(server, paths) {
  server.tool('learning_verdict', VERDICT_TOOL_SCHEMA, async (input) => {
    return handleVerdict(paths.root, input);
  });
}

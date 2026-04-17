#!/usr/bin/env node
/**
 * user-prompt-submit.mjs — UserPromptSubmit hook for jaewon-plugin-learning
 *
 * @calling-spec
 * - main(): Promise<void>
 *   Input: stdin JSON event { prompt: string, cwd?, ... }
 *   Output: stdout either '' or JSON.stringify({ systemMessage: '...' })
 *   Side effects: none (read-only on fs)
 *   Contract: advisory only — NEVER emits decision:'block'; always exits 0
 *   Depends on: ./lib/stdin.mjs, ./lib/state.mjs, ./lib/cycle-detect.mjs
 *
 *   Nudge logic:
 *     - If no active cycle (idle): no nudge emitted.
 *     - If active cycle AND prompt looks on-task: no nudge emitted.
 *     - If active cycle AND prompt looks off-topic: emit systemMessage nudge.
 *
 *   On-task heuristic: prompt (lowercased) contains any of —
 *     course slug, chapter slug, or the keywords:
 *     discuss, discussion, summary, summarize, read, reading,
 *     question, explain, explanation, chapter, course, phase, learn
 */

import { readStdin } from './lib/stdin.mjs';
import { readState } from './lib/state.mjs';
import { detectCycle } from './lib/cycle-detect.mjs';

/** Keywords that indicate the user is on-task for a learning cycle. */
const ON_TASK_KEYWORDS = [
  'discuss', 'discussion', 'summary', 'summarize',
  'read', 'reading', 'question', 'explain', 'explanation',
  'chapter', 'course', 'phase', 'learn',
];

/**
 * Return true when the prompt appears on-task given the current course state.
 * @param {string} prompt - raw prompt text from the user
 * @param {object} courseState - status.course_state
 * @returns {boolean}
 */
function isOnTask(prompt, courseState) {
  if (!prompt || typeof prompt !== 'string') return true; // empty prompt: no nudge
  const lower = prompt.toLowerCase();

  // Course/chapter slugs are strong signals
  if (courseState.current_course && lower.includes(courseState.current_course.toLowerCase())) {
    return true;
  }
  if (courseState.current_chapter && lower.includes(courseState.current_chapter.toLowerCase())) {
    return true;
  }

  // Generic learning keywords
  for (const kw of ON_TASK_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }

  return false;
}

/**
 * Build a nudge systemMessage referencing the active phase and course context.
 * @param {object} courseState - status.course_state
 * @returns {string}
 */
function buildNudge(courseState) {
  const phase = courseState.current_phase || 'unknown';
  const course = courseState.current_course || '';
  const chapter = courseState.current_chapter || '';

  const lines = [
    `You are currently in the **${phase}** phase of your learning cycle.`,
  ];
  if (course) lines.push(`Course: ${course}`);
  if (chapter) lines.push(`Chapter: ${chapter}`);
  lines.push('');
  lines.push('Your prompt appears to be off-topic for the current cycle. Consider returning to the current phase — or type a course/chapter keyword to stay on track.');

  return lines.join('\n');
}

async function main() {
  const input = await readStdin(2000);
  let data = {};
  try { data = JSON.parse(input); } catch { /* empty/invalid payload — use defaults */ }

  const projectDir = data.cwd || process.cwd();
  const prompt = typeof data.prompt === 'string' ? data.prompt : '';

  // Load state — gracefully degrade on any error
  let status;
  try {
    status = readState(projectDir);
  } catch {
    process.exit(0);
  }

  const { inCycle, phase: _phase } = detectCycle(status);

  if (!inCycle) {
    // Not in an active cycle — no nudge
    process.exit(0);
  }

  const courseState = status.course_state || {};

  if (isOnTask(prompt, courseState)) {
    // Prompt looks on-task — no nudge
    process.exit(0);
  }

  // Off-topic during active cycle — emit advisory nudge
  const systemMessage = buildNudge(courseState);
  console.log(JSON.stringify({ systemMessage }));
  process.exit(0);
}

main().catch(() => {
  // Error path — advisory only, exit 0 with no output
  process.exit(0);
});

#!/usr/bin/env node
/**
 * session-end.mjs — SessionEnd hook for jaewon-plugin-learning
 *
 * @calling-spec
 * - main(): Promise<void>
 *   Input: stdin JSON event { cwd?, ... }
 *   Output: stdout JSON.stringify({ systemMessage: '...' })
 *   Side effects:
 *     - Appends a timestamped entry to wiki/log.md if the file already exists (append-only)
 *     - Updates status.json session.last_end timestamp
 *   Contract:
 *     - ALWAYS exits 0; NEVER emits decision:'block'
 *     - Graceful when wiki/ directory is absent (no crash, no file creation)
 *   Depends on: ./lib/stdin.mjs, ./lib/state.mjs, node:fs, node:path
 */

import { existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { readStdin } from './lib/stdin.mjs';
import { readState, writeState } from './lib/state.mjs';

/**
 * Build the log entry string to append to wiki/log.md.
 * Format mirrors the raw-data reference: ## [YYYY-MM-DD] Session #N
 */
function buildLogEntry(status, now) {
  const date = now.split('T')[0];
  const sessionNum = (status.session && status.session.total_sessions) || 1;
  const cs = status.course_state || {};
  const course = cs.current_course || 'none';
  const chapter = cs.current_chapter || 'none';
  const phase = cs.current_phase || 'idle';

  return (
    `\n## [${date}] Session #${sessionNum}\n` +
    `- course: ${course} | chapter: ${chapter} | phase: ${phase}\n` +
    `- session ended: ${now}\n`
  );
}

async function main() {
  const input = await readStdin(3000);
  let data = {};
  try { data = JSON.parse(input); } catch { /* empty payload is fine */ }

  const projectDir = data.cwd || process.cwd();
  const now = new Date().toISOString();

  // Read current state (gracefully falls back to defaults on any error)
  let status;
  try {
    status = readState(projectDir);
  } catch {
    status = { session: { total_sessions: 1 }, course_state: {} };
  }

  // Update session.last_end and persist
  try {
    writeState(projectDir, { session: { last_end: now } });
  } catch { /* non-critical */ }

  // Append to wiki/log.md if the file already exists (append-only, never create)
  const wikiLogPath = join(projectDir, 'wiki', 'log.md');
  if (existsSync(wikiLogPath)) {
    try {
      const logEntry = buildLogEntry(status, now);
      appendFileSync(wikiLogPath, logEntry, 'utf-8');
    } catch { /* non-critical — ignore append errors */ }
  }

  // Emit systemMessage summary
  const sessionNum = (status.session && status.session.total_sessions) || 1;
  const cs = status.course_state || {};
  const course = cs.current_course || 'none';
  const phase = cs.current_phase || 'idle';

  console.log(JSON.stringify({
    systemMessage: `session ended cleanly — session #${sessionNum}, course: ${course}, phase: ${phase}`,
  }));
}

main().catch(() => {
  // Error path — still emit minimal response and exit 0
  try {
    console.log(JSON.stringify({ systemMessage: 'session ended cleanly' }));
  } catch { /* last resort: nothing */ }
  process.exit(0);
});

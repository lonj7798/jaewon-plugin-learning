#!/usr/bin/env node
/**
 * session-start.mjs — SessionStart hook for jaewon-plugin-learning
 *
 * @calling-spec
 * - main(): Promise<void>
 *   Input: stdin JSON event { cwd?, ... }
 *   Output: stdout JSON.stringify({ systemMessage: '...' })
 *   Side effects: creates .jaewon-learning/ dir if missing; may update status.json session counters
 *   Contract: ALWAYS exits 0; NEVER emits decision:'block'
 *   Depends on: ./lib/stdin.mjs, ./lib/settings.mjs, ./lib/state.mjs, ./lib/learner-profile.mjs
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readStdin } from './lib/stdin.mjs';
import { getSettings, DEFAULTS } from './lib/settings.mjs';
import { readState, writeState } from './lib/state.mjs';
import { loadLearnerProfile } from './lib/learner-profile.mjs';

/** Truncate a string to maxChars, appending '...' if cut. */
function truncate(str, maxChars) {
  if (!str || str.length <= maxChars) return str || '';
  return str.slice(0, maxChars) + '...';
}

/** Build a short summary from a learner profile object. */
function summarizeProfile(profile) {
  if (!profile || Object.keys(profile).length === 0) return '';
  const parts = [];
  for (const [slug, content] of Object.entries(profile)) {
    const excerpt = truncate(content.replace(/^#[^\n]*\n/, '').trim(), 200);
    if (excerpt) parts.push(`[${slug}] ${excerpt}`);
  }
  return parts.join('\n');
}

async function main() {
  const input = await readStdin(3000);
  let data = {};
  try { data = JSON.parse(input); } catch { /* empty payload */ }

  const projectDir = data.cwd || process.cwd();

  // Ensure .jaewon-learning/ exists
  const settings = getSettings(projectDir);
  const baseDir = join(projectDir, settings.base_dir || DEFAULTS.base_dir);
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }

  // Write default settings.json if missing
  const settingsPath = join(baseDir, 'settings.json');
  if (!existsSync(settingsPath)) {
    try {
      writeFileSync(settingsPath, JSON.stringify(DEFAULTS, null, 2), 'utf-8');
    } catch { /* non-critical */ }
  }

  // Load status (readState handles missing file with defaults)
  let status;
  try {
    status = readState(projectDir);
  } catch {
    status = {};
  }

  // Update session counters and persist
  try {
    const sessionPatch = {
      session: {
        last_start: new Date().toISOString(),
        total_sessions: ((status.session && status.session.total_sessions) || 0) + 1,
      },
    };
    writeState(projectDir, sessionPatch);
    // Re-read to get merged state
    status = readState(projectDir);
  } catch { /* non-critical — proceed with what we have */ }

  // Load learner profile (gracefully degrades when wiki/learner/ absent)
  let profile = {};
  try {
    profile = await loadLearnerProfile(projectDir);
  } catch { /* missing wiki is fine */ }

  // Assemble systemMessage
  const parts = ['## jaewon-plugin-learning initialized'];

  // Course/chapter/phase context
  const cs = status && status.course_state;
  if (cs && cs.current_course) {
    parts.push(`Active: course/${cs.current_course} chapter '${cs.current_chapter || ''}' phase '${cs.current_phase || 'idle'}'`);
  } else if (cs && cs.current_phase && cs.current_phase !== 'idle') {
    parts.push(`Active phase: ${cs.current_phase}`);
  } else {
    parts.push('No active course — run /new-course to start');
  }

  // Learner profile summary
  const profileSummary = summarizeProfile(profile);
  if (profileSummary) {
    parts.push('');
    parts.push('### Learner Profile');
    parts.push(profileSummary);
  }

  const systemMessage = parts.join('\n');
  console.log(JSON.stringify({ systemMessage }));
}

main().catch(() => {
  // Error path — still emit minimal response and exit 0
  try {
    console.log(JSON.stringify({ systemMessage: '## jaewon-plugin-learning initialized' }));
  } catch { /* last resort: nothing */ }
  process.exit(0);
});

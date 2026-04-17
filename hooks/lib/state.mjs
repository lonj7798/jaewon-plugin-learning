/**
 * state.mjs — Status file reader/writer with idempotent advance guard
 *
 * @calling-spec
 * - readState(projectDir): Status
 *   Input: absolute path to project root
 *   Output: Status object (DEFAULT_STATUS with deep-merge of persisted state, or defaults if absent)
 *   Side effects: reads <projectDir>/.jaewon-learning/status.json if present
 *   Depends on: node:fs, node:path, settings.mjs
 *
 * - writeState(projectDir, patch): void
 *   Input: projectDir + partial patch object to deep-merge into current state
 *   Output: void
 *   Side effects: reads then writes <projectDir>/.jaewon-learning/status.json
 *   Depends on: node:fs, node:path, settings.mjs
 *
 * - advanceIfNewSig(status, newSig, mutator): { advanced: boolean, status: Status, reason?: string }
 *   Input: current status object, new sig string, mutator function (status) => void
 *   Output: { advanced: true, status: updatedStatus } when sig is novel
 *          { advanced: false, status: unchanged, reason: 'sig_match' } when sig already recorded
 *   Side effects: none (pure; caller is responsible for persisting the returned status)
 *   Depends on: nothing
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { getSettings } from './settings.mjs';

const DEFAULT_STATUS = {
  version: 1,
  project: {
    name: null,
    path: null,
    detected_stack: [],
  },
  plan: {
    current_version: null,
    plan_path: null,
    checklist_path: null,
    phase: null,
  },
  session: {
    current_id: null,
    last_start: null,
    last_end: null,
    total_sessions: 0,
  },
  git: {
    current_branch: null,
    recent_commits: [],
    auto_manage: true,
  },
  logging: {
    enabled: false,
    level: 'info',
    modules: ['*'],
  },
  hud: {
    overall_color: 'WHITE',
    progress: null,
    active_task: null,
    active_phase: null,
    blocked_count: 0,
    last_updated: null,
  },
  course_state: {
    current_phase: 'idle',
    cycle_iteration: 0,
    last_advance_sig: null,
  },
  blocked: [],
  execution_mode: 'teammate_first',
};

/**
 * Deep-merge source into target. Arrays are replaced (not concatenated).
 * Returns a new object; does not mutate inputs.
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(tgtVal, srcVal);
    } else {
      result[key] = srcVal;
    }
  }
  return result;
}

export function readState(projectDir) {
  const settings = getSettings(projectDir);
  const statusPath = join(projectDir, settings.paths.status);

  if (!existsSync(statusPath)) {
    return deepMerge({}, DEFAULT_STATUS);
  }

  try {
    const raw = readFileSync(statusPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return deepMerge(DEFAULT_STATUS, parsed);
  } catch {
    return deepMerge({}, DEFAULT_STATUS);
  }
}

export function writeState(projectDir, patch) {
  const current = readState(projectDir);
  const merged = deepMerge(current, patch);

  const settings = getSettings(projectDir);
  const statusPath = join(projectDir, settings.paths.status);
  const dir = dirname(statusPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(statusPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
}

/**
 * Compare-and-swap advance guard.
 * Pure function — caller is responsible for persisting the returned status.
 *
 * @param {object} status - current status (from readState or a previous advanceIfNewSig result)
 * @param {string} newSig - signature string for this advance event
 * @param {function} mutator - (status) => void — called only when sig is novel
 * @returns {{ advanced: boolean, status: object, reason?: string }}
 */
export function advanceIfNewSig(status, newSig, mutator) {
  const currentSig = status?.course_state?.last_advance_sig ?? null;

  if (currentSig === newSig) {
    return { advanced: false, status, reason: 'sig_match' };
  }

  // Deep-clone to avoid mutating the caller's object
  const updated = JSON.parse(JSON.stringify(status));
  mutator(updated);
  updated.course_state = updated.course_state ?? {};
  updated.course_state.last_advance_sig = newSig;

  return { advanced: true, status: updated };
}

export { DEFAULT_STATUS };

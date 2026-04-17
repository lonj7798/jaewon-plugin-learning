/**
 * settings.mjs — Settings loader and path resolver for jaewon-plugin-learning
 *
 * @calling-spec
 * - getSettings(projectDir): Settings
 *   Input: absolute path to project root
 *   Output: Settings object with base_dir, paths (all {base} resolved), version, git, execution, logging, planning
 *   Side effects: reads <projectDir>/.jaewon-learning/settings.json if present
 *   Depends on: node:fs, node:path
 *
 * - resolvePathTemplates(settings): Settings
 *   Input: Settings object (may have {base} placeholders in paths values)
 *   Output: new Settings object with {base} replaced by settings.base_dir in all path strings
 *   Side effects: none
 *   Depends on: nothing
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const DEFAULTS = {
  version: 1,
  base_dir: '.jaewon-learning',
  paths: {
    status: '{base}/status.json',
    session_log: '{base}/session-log.md',
    plans: 'docs/plans',
    interview: 'docs/interview',
    notes: '{base}/notes',
    blocked: '{base}/blocked',
    logs: '{base}/logs',
    debug_history: '{base}/debug-history',
    architecture: '{base}/architecture',
    metrics: '{base}/metrics',
    context: '{base}/context',
    preferences: '{base}/preferences',
  },
  git: {
    auto_manage: true,
    default_branch: 'dev',
    commit_per_task: true,
    commit_format: '{type}({phase}): {description} [{task_id}]',
  },
  execution: {
    mode: 'teammate_first',
    max_retries: 5,
    parallel_default: true,
  },
  logging: {
    enabled: false,
    level: 'info',
    modules: ['*'],
    auto_disable_on_session_end: true,
  },
  planning: {
    max_review_iterations: 5,
    lod_enforced: true,
    tdd_enforced: true,
  },
};

export function resolvePathTemplates(settings) {
  const base = settings.base_dir || '.jaewon-learning';
  const resolved = JSON.parse(JSON.stringify(settings));
  if (resolved.paths) {
    for (const [key, val] of Object.entries(resolved.paths)) {
      if (typeof val === 'string') {
        resolved.paths[key] = val.replace(/\{base\}/g, base);
      }
    }
  }
  return resolved;
}

export function getSettings(projectDir) {
  const settingsPath = join(projectDir, DEFAULTS.base_dir, 'settings.json');

  if (!existsSync(settingsPath)) {
    return resolvePathTemplates(DEFAULTS);
  }

  try {
    const raw = readFileSync(settingsPath, 'utf-8');
    const userSettings = JSON.parse(raw);
    const merged = {
      ...DEFAULTS,
      ...userSettings,
      paths: { ...DEFAULTS.paths, ...(userSettings.paths || {}) },
    };
    return resolvePathTemplates(merged);
  } catch {
    return resolvePathTemplates(DEFAULTS);
  }
}

export { DEFAULTS };

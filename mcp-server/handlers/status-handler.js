/**
 * status-handler.js — MCP tool handler for learning_status (GET + SET)
 *
 * @calling-spec
 * - registerStatusTools(server, paths): void
 *   Input:  server — MCP server with .tool(name, schema, cb) method
 *           paths  — { statusFile: string } path helpers
 *   Output: void (registers 'learning_status' tool on server)
 *   Side effects: GET reads statusFile; SET reads + writes statusFile
 *   Depends on: lib/file-ops.js, lib/validate.js
 *
 * Tool: learning_status
 *   action='GET'  -> returns course-state object (DEFAULT_STATUS if file missing)
 *   action='SET'  -> deep-merges patch into existing state, validates, writes
 */

import { readJSON, writeJSON } from '../lib/file-ops.js';
import { validate } from '../lib/validate.js';

// ---------------------------------------------------------------------------
// Default course-state (returned when no status.json exists)
// ---------------------------------------------------------------------------

const DEFAULT_STATUS = {
  current_course: '',
  current_chapter: '',
  current_phase: 'idle',
  cycle_count: 0,
  verdict_history: [],
  last_advance_sig: null,
};

// ---------------------------------------------------------------------------
// Schema for the tool's input parameters
// ---------------------------------------------------------------------------

const STATUS_SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['GET', 'SET'] },
    patch:  { type: 'object' },
  },
  required: ['action'],
};

// ---------------------------------------------------------------------------
// Handler logic
// ---------------------------------------------------------------------------

/**
 * handleStatusGet(statusFile) — read and return current status
 * @param {string} statusFile
 * @returns {object}
 */
function handleStatusGet(statusFile) {
  const stored = readJSON(statusFile);
  if (!stored) return { ...DEFAULT_STATUS };
  return stored;
}

/**
 * handleStatusSet(statusFile, patch) — merge patch, validate, write
 * @param {string} statusFile
 * @param {object} patch
 * @returns {Promise<object>}
 */
async function handleStatusSet(statusFile, patch) {
  const existing = readJSON(statusFile) ?? { ...DEFAULT_STATUS };
  const merged = { ...existing, ...patch };

  const result = await validate('course-state', merged);
  if (!result.ok) {
    return { error: 'validation-failed', errors: result.errors };
  }

  writeJSON(statusFile, merged);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * registerStatusTools(server, paths) — register learning_status on server
 * @param {{ tool: Function }} server
 * @param {{ statusFile: string }} paths
 */
export function registerStatusTools(server, paths) {
  server.tool('learning_status', STATUS_SCHEMA, async (input) => {
    const { action, patch } = input ?? {};

    if (action === 'GET') {
      return handleStatusGet(paths.statusFile);
    }

    if (action === 'SET') {
      return handleStatusSet(paths.statusFile, patch ?? {});
    }

    return { error: 'unknown-action', action };
  });
}

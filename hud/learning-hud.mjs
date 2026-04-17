#!/usr/bin/env node
/**
 * learning-hud.mjs — Statusline script for jaewon-plugin-learning
 *
 * Writes one ANSI-colored line to stdout for Claude Code's statusline.
 * Active format:  🎓 jaewon-learning · <slug>/<chapter> · <phase> · V:<verdicts>
 * Idle format:    🎓 jaewon-learning · idle
 *
 * @calling-spec
 * - (script): void
 *   Input:  JSON object on stdin (Claude Code statusline event: { cwd?, ... })
 *           JAEWON_LEARNING_CWD env var overrides cwd for testing
 *   Output: single ANSI-colored line on stdout, visible length <= 120 chars
 *   Side effects: reads .jaewon-learning/status.json from project root
 *   Depends on: node:fs, node:path, node:process
 *   Contract: exits 0 on any error (must never crash Claude Code)
 */

import { existsSync, readFileSync, readSync } from 'fs';
import { join } from 'path';

// ============================================================================
// ANSI constants
// ============================================================================
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const RESET  = '\x1b[0m';

// ============================================================================
// Stdin — read synchronously so script stays synchronous
// ============================================================================
function readStdinSync() {
  if (process.stdin.isTTY) return {};
  try {
    const chunks = [];
    const buf = Buffer.alloc(65536);
    let n;
    try {
      while ((n = readSync(0, buf, 0, buf.length)) > 0) {
        chunks.push(buf.slice(0, n));
      }
    } catch { /* pipe closed */ }
    const raw = Buffer.concat(chunks).toString('utf-8').trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// ============================================================================
// Status reader
// ============================================================================
function readStatus(projectDir) {
  const statusPath = join(projectDir, '.jaewon-learning', 'status.json');
  if (!existsSync(statusPath)) return null;
  try {
    return JSON.parse(readFileSync(statusPath, 'utf-8'));
  } catch {
    return null;
  }
}

// ============================================================================
// Verdict badge renderer
// ============================================================================
/** Map verdict string -> ANSI color + badge character */
function verdictBadge(verdict) {
  switch (verdict) {
    case 'mastery':    return `${GREEN}✓${RESET}`;
    case 'partial':    return `${YELLOW}◐${RESET}`;
    case 'incomplete': return `${RED}✗${RESET}`;
    default:           return `${YELLOW}◐${RESET}`;
  }
}

function renderVerdicts(history) {
  if (!Array.isArray(history) || history.length === 0) return '';
  return 'V:' + history.map(verdictBadge).join('');
}

// ============================================================================
// ANSI-strip helper for length measurement
// ============================================================================
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;

function visibleLength(str) {
  return str.replace(ANSI_RE, '').length;
}

// ============================================================================
// Truncate to <= maxVisible visible characters (preserving trailing RESET)
// ============================================================================
function truncateVisible(str, maxVisible) {
  if (visibleLength(str) <= maxVisible) return str;
  // Strip ANSI, truncate visible chars, re-append reset
  const stripped = str.replace(ANSI_RE, '');
  return stripped.slice(0, maxVisible - 1) + '…';
}

// ============================================================================
// Main
// ============================================================================
function main() {
  const stdin = readStdinSync();

  // Determine project directory: env override first (for tests), then stdin.cwd, then process.cwd()
  const projectDir = process.env.JAEWON_LEARNING_CWD || stdin.cwd || process.cwd();

  const status = readStatus(projectDir);

  let line;

  if (!status || !status.active_course) {
    // Idle or missing
    line = '🎓 jaewon-learning · idle';
  } else {
    const { slug, chapter, phase } = status.active_course;
    const verdicts = renderVerdicts(status.verdict_history);

    const parts = ['🎓 jaewon-learning'];
    parts.push(`${slug}/${chapter}`);
    if (phase) parts.push(phase);
    if (verdicts) parts.push(verdicts);

    line = parts.join(' · ');
  }

  // Enforce 120-char visible limit
  line = truncateVisible(line, 120);

  process.stdout.write(line);
}

// Guard: exit 0 on any uncaught error
try {
  main();
} catch {
  process.stdout.write('🎓 jaewon-learning · idle');
}

process.exit(0);

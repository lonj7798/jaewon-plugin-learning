/**
 * file-ops.js — Safe JSON read/write helpers
 *
 * CALLING SPEC:
 *   data = readJSON(filePath) -> object | null
 *   Reads and parses JSON. Returns null on missing/invalid.
 *   Side effects: Reads filesystem
 *   Deterministic: Yes
 *
 *   writeJSON(filePath, data) -> void
 *   Writes JSON with pretty-print. Creates parent dirs.
 *   Side effects: Writes filesystem
 *
 *   appendMarkdown(filePath, content) -> void
 *   Appends markdown content. Creates file if missing.
 *   Side effects: Writes filesystem
 */
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export function readJSON(filePath) {
  if (!filePath || !existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export function writeJSON(filePath, data) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export function appendMarkdown(filePath, content) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(filePath)) {
    writeFileSync(filePath, content + '\n', 'utf-8');
  } else {
    appendFileSync(filePath, '\n' + content + '\n', 'utf-8');
  }
}

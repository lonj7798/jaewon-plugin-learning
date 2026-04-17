/**
 * paths.js — Absolute path helpers for the jaewon-plugin-learning wiki layout
 *
 * @calling-spec
 * - wikiRoot(): string
 *   Input: none
 *   Output: absolute path to the wiki root (process.cwd())
 *   Side effects: none
 *   Depends on: node:path
 *
 * - learnerDir(): string
 *   Input: none
 *   Output: absolute path to wiki/learner
 *   Side effects: none
 *   Depends on: wikiRoot()
 *
 * - coursesDir(): string
 *   Input: none
 *   Output: absolute path to wiki/courses
 *   Side effects: none
 *   Depends on: wikiRoot()
 *
 * - sessionsDir(): string
 *   Input: none
 *   Output: absolute path to wiki/sessions
 *   Side effects: none
 *   Depends on: wikiRoot()
 *
 * - statusFile(): string
 *   Input: none
 *   Output: absolute path to .jaewon-learning/status.json
 *   Side effects: none
 *   Depends on: wikiRoot()
 */
import { join } from 'node:path';

/**
 * Returns the wiki root — the current working directory.
 * Smarter detection (e.g., walking up to find a marker file) can be added
 * in a later phase without changing the public interface.
 *
 * @returns {string} absolute path
 */
export function wikiRoot() {
  return process.cwd();
}

/**
 * @returns {string} absolute path to wiki/learner
 */
export function learnerDir() {
  return join(wikiRoot(), 'wiki', 'learner');
}

/**
 * @returns {string} absolute path to wiki/courses
 */
export function coursesDir() {
  return join(wikiRoot(), 'wiki', 'courses');
}

/**
 * @returns {string} absolute path to wiki/sessions
 */
export function sessionsDir() {
  return join(wikiRoot(), 'wiki', 'sessions');
}

/**
 * @returns {string} absolute path to .jaewon-learning/status.json
 */
export function statusFile() {
  return join(wikiRoot(), '.jaewon-learning', 'status.json');
}

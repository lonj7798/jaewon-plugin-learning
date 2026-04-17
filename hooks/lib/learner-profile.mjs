/**
 * learner-profile.mjs — Learner wiki page reader
 *
 * @calling-spec
 * - loadLearnerProfile(projectDir): Promise<LearnerProfile>
 *   Input: absolute path to project root
 *   Output: object keyed by page slug with string content from each wiki/learner/*.md file
 *           Returns empty object {} (not null/undefined) when wiki/learner/ dir is absent
 *   Side effects: reads wiki/learner/*.md files from projectDir
 *   Depends on: node:fs/promises, node:path
 *
 *   Standard pages: style, strengths, weaknesses, push-tactics, recent-sessions
 *   Any page present in wiki/learner/ is included, not just the 5 standard ones.
 */

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const STANDARD_PAGES = ['style', 'strengths', 'weaknesses', 'push-tactics', 'recent-sessions'];

/**
 * Load all learner profile pages from wiki/learner/ directory.
 *
 * @param {string} projectDir - absolute path to project root
 * @returns {Promise<Record<string, string>>} - page slug -> content
 */
export async function loadLearnerProfile(projectDir) {
  const learnerDir = join(projectDir, 'wiki', 'learner');

  if (!existsSync(learnerDir)) {
    return {};
  }

  try {
    const entries = await readdir(learnerDir);
    const mdFiles = entries.filter((f) => f.endsWith('.md'));

    const profile = {};
    for (const file of mdFiles) {
      const slug = file.replace(/\.md$/, '');
      try {
        const content = await readFile(join(learnerDir, file), 'utf-8');
        profile[slug] = content;
      } catch {
        profile[slug] = '';
      }
    }

    return profile;
  } catch {
    return {};
  }
}

export { STANDARD_PAGES };

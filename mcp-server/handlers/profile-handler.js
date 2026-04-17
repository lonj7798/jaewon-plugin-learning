/**
 * profile-handler.js — MCP tool handler for learning_profile
 *
 * @calling-spec
 * - registerProfileTools(server, paths): void
 *   Input:  server — MCP server with .tool(name, schema, cb) method
 *           paths  — { learnerDir: string } path helpers
 *   Output: void (registers 'learning_profile' tool on server)
 *   Side effects: reads wiki/learner/*.md files
 *   Depends on: node:fs/promises, node:path
 *
 * Tool: learning_profile
 *   input: {} (no required fields)
 *   output: { pages: Array<{ name: string, content: string }> }
 *           or { pages: [] } if learnerDir does not exist
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

// ---------------------------------------------------------------------------
// Schema for the tool's input parameters
// ---------------------------------------------------------------------------

const PROFILE_SCHEMA = {
  type: 'object',
  properties: {},
};

// ---------------------------------------------------------------------------
// Handler logic
// ---------------------------------------------------------------------------

/**
 * readLearnerPages(learnerDir) — read all .md files from the learner directory
 * Returns empty array if directory does not exist or cannot be read.
 * @param {string} learnerDir
 * @returns {Promise<Array<{ name: string, content: string }>>}
 */
async function readLearnerPages(learnerDir) {
  let entries;
  try {
    entries = await readdir(learnerDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const mdFiles = entries
    .filter(e => e.isFile() && extname(e.name) === '.md')
    .map(e => e.name)
    .sort();

  const pages = await Promise.all(
    mdFiles.map(async (name) => {
      const filePath = join(learnerDir, name);
      try {
        const content = await readFile(filePath, 'utf-8');
        return { name, content };
      } catch {
        return { name, content: '' };
      }
    })
  );

  return pages;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * registerProfileTools(server, paths) — register learning_profile on server
 * @param {{ tool: Function }} server
 * @param {{ learnerDir: string }} paths
 */
export function registerProfileTools(server, paths) {
  server.tool('learning_profile', PROFILE_SCHEMA, async (_input) => {
    const pages = await readLearnerPages(paths.learnerDir);
    return { pages };
  });
}

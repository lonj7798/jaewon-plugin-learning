/**
 * wiki-search-handler.js — MCP tool handler for learning_wiki_search
 *
 * @calling-spec
 * - registerWikiSearchTools(server, paths): void
 *   Input:  server — MCP server with .tool(name, schema, cb) method
 *           paths  — { wikiRoot: string } path helpers
 *   Output: void (registers 'learning_wiki_search' tool on server)
 *   Side effects: reads wiki/**\/*.md files via scanWiki
 *   Depends on: lib/wiki-scan.js
 *
 * Tool: learning_wiki_search
 *   input: { query: string, maxResults?: number }
 *   output: { results: ScoredPage[] } sorted descending by score
 *           { error: string } if query is empty or invalid
 *           { results: [] }  if no matches found
 */

import { scanWiki, searchWiki } from '../lib/wiki-scan.js';

// ---------------------------------------------------------------------------
// Schema for the tool's input parameters
// ---------------------------------------------------------------------------

const WIKI_SEARCH_SCHEMA = {
  type: 'object',
  properties: {
    query:      { type: 'string' },
    maxResults: { type: 'number' },
  },
  required: ['query'],
};

// ---------------------------------------------------------------------------
// Handler logic
// ---------------------------------------------------------------------------

/**
 * handleWikiSearch(wikiRoot, query, maxResults) — scan and search the wiki
 * @param {string} wikiRoot
 * @param {string} query
 * @param {number} maxResults
 * @returns {Promise<{ results: object[] } | { error: string }>}
 */
async function handleWikiSearch(wikiRoot, query, maxResults) {
  if (!query || typeof query !== 'string' || query.trim() === '') {
    return { error: 'query required', results: [] };
  }

  const catalog = await scanWiki(wikiRoot);
  const results = searchWiki(catalog, query.trim(), { maxResults });
  return { results };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * registerWikiSearchTools(server, paths) — register learning_wiki_search on server
 * @param {{ tool: Function }} server
 * @param {{ wikiRoot: string }} paths
 */
export function registerWikiSearchTools(server, paths) {
  server.tool('learning_wiki_search', WIKI_SEARCH_SCHEMA, async (input) => {
    const { query = '', maxResults = 10 } = input ?? {};
    return handleWikiSearch(paths.wikiRoot, query, maxResults);
  });
}

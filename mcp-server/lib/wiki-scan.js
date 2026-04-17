/**
 * wiki-scan.js — Pure wiki indexer and searcher. No write operations.
 *
 * @calling-spec
 * - scanWiki(rootPath): Promise<{ pages: Page[] }>
 *   Input:  rootPath — absolute path to the wiki root (wiki/ lives inside)
 *   Output: { pages } where each Page has { path, title, wikilinks, lineCount,
 *            hasCallingSpec, scope?, deps?, seeAlso? }
 *   Side effects: reads <rootPath>/wiki/**\/*.md (no writes)
 *   Depends on: node:fs/promises, node:path
 *
 * - searchWiki(catalog, query, { maxResults }): ScoredPage[]
 *   Input:  catalog — result of scanWiki; query — search string; maxResults — cap
 *   Output: array of { ...page, score } sorted desc by score, capped at maxResults
 *   Side effects: none (pure)
 *   Depends on: nothing external
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

// ---------------------------------------------------------------------------
// Parsing helpers (pure)
// ---------------------------------------------------------------------------

/** Extract the first # heading as the page title. */
function extractTitle(content) {
  const m = content.match(/^#\s+(.+)/m);
  return m ? m[1].trim() : '';
}

/** Count lines via newline characters (matches wc -l semantics). */
function countLines(content) {
  return (content.match(/\n/g) || []).length;
}

/** Extract [[wikilink]] targets from content. */
function extractWikilinks(content) {
  const links = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    links.push(m[1].trim());
  }
  return links;
}

/**
 * Detect calling-spec header: first # heading immediately followed by
 * an HTML comment starting with scope:.
 */
function detectCallingSpec(content) {
  return /^#\s+.+\n<!--\s*scope:/m.test(content);
}

/**
 * Parse the HTML comment metadata block.
 * Supports single-line: <!-- scope: X, deps: A, see-also: B -->
 * and multi-line variants.
 * Returns { scope, deps, seeAlso } — all optional.
 */
function parseMetaComment(content) {
  const m = content.match(/<!--([\s\S]*?)-->/);
  if (!m) return {};

  const block = m[1];

  const scopeM = block.match(/scope:\s*([^,\n]+)/);
  const depsM  = block.match(/deps:\s*([^,\n\-][^\n]*?)(?:,\s*see-also:|$)/);
  const seeAlsoM = block.match(/see-also:\s*([^\n]+)/);

  const parseList = (raw) => {
    if (!raw) return [];
    // Strip [[ ]] wikilink brackets if present, then split by comma or newline
    return raw
      .replace(/\[\[|\]\]/g, '')
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(Boolean);
  };

  const result = {};
  if (scopeM) result.scope = scopeM[1].trim();
  if (depsM)  result.deps  = parseList(depsM[1]);
  if (seeAlsoM) result.seeAlso = parseList(seeAlsoM[1]);
  return result;
}

// ---------------------------------------------------------------------------
// File discovery (async)
// ---------------------------------------------------------------------------

/** Recursively collect all .md file paths under a directory. */
async function collectMdFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const results = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await collectMdFiles(full);
      results.push(...sub);
    } else if (entry.isFile() && extname(entry.name) === '.md') {
      results.push(full);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan the wiki directory tree and return a catalog of pages.
 *
 * @param {string} rootPath  — path to the wiki root; wiki/ is expected inside
 * @returns {Promise<{ pages: object[] }>}
 */
export async function scanWiki(rootPath) {
  const wikiDir = join(rootPath, 'wiki');
  const filePaths = await collectMdFiles(wikiDir);

  const pages = await Promise.all(
    filePaths.map(async (filePath) => {
      const content = await readFile(filePath, 'utf-8');
      const meta = parseMetaComment(content);
      const page = {
        path:          filePath,
        title:         extractTitle(content),
        wikilinks:     extractWikilinks(content),
        lineCount:     countLines(content),
        hasCallingSpec: detectCallingSpec(content),
        _raw:          content,
      };
      if (meta.scope    !== undefined) page.scope   = meta.scope;
      if (meta.deps     !== undefined) page.deps    = meta.deps;
      if (meta.seeAlso  !== undefined) page.seeAlso = meta.seeAlso;
      return page;
    })
  );

  return { pages };
}

/**
 * Search the catalog for pages matching the query.
 * Body matches score 2; title-only matches score 1.
 *
 * @param {{ pages: object[] }} catalog
 * @param {string} query
 * @param {{ maxResults: number }} options
 * @returns {object[]}  scored results sorted desc by score
 */
export function searchWiki(catalog, query, { maxResults = 10 } = {}) {
  if (!query) return [];
  const q = query.toLowerCase();
  const scored = [];

  for (const page of catalog.pages) {
    const titleMatch = page.title.toLowerCase().includes(q);
    // Re-read body from content is not available here; use path + title heuristic.
    // The catalog must expose raw content — but tests only pass { pages } from scanWiki.
    // Score based on available fields: title match = 1, wikilinks/scope text = body proxy.
    // To enable body matching we store rawContent in the page during scanWiki.
    const bodyText = (page._raw || '').toLowerCase();
    const bodyMatch = bodyText.includes(q);

    let score = 0;
    if (bodyMatch) score += 2;
    if (titleMatch) score += 1;

    if (score > 0) {
      const { _raw, ...rest } = page; // strip internal field
      scored.push({ ...rest, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults);
}

/**
 * _index.js — Handler registry for jaewon-plugin-learning MCP tools
 *
 * @calling-spec
 * - HANDLERS: Array<{ name: string, register: Function }>
 *   Input: none (imported as a constant)
 *   Output: array of handler descriptors in registration order
 *   Side effects: none (pure data)
 *   Depends on: ./status-handler.js, ./profile-handler.js,
 *               ./wiki-search-handler.js, ./verdict-handler.js,
 *               ./crawl-guard-handler.js
 *
 * Usage in server.js:
 *   import { HANDLERS } from './handlers/_index.js';
 *   for (const { register } of HANDLERS) register(server, paths);
 */

import { registerStatusTools }    from './status-handler.js';
import { registerProfileTools }   from './profile-handler.js';
import { registerWikiSearchTools } from './wiki-search-handler.js';
import { registerVerdictTools }   from './verdict-handler.js';
import { registerCrawlGuardTools } from './crawl-guard-handler.js';

export const HANDLERS = [
  { name: 'learning_status',      register: registerStatusTools },
  { name: 'learning_profile',     register: registerProfileTools },
  { name: 'learning_wiki_search', register: registerWikiSearchTools },
  { name: 'learning_verdict',     register: registerVerdictTools },
  { name: 'learning_crawl_guard', register: registerCrawlGuardTools },
];

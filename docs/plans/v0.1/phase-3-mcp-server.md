# Phase 3 — MCP Server Handlers

<!-- scope: learning_status, learning_profile, learning_wiki_search, learning_verdict, learning_crawl_guard + schemas -->
<!-- deps: phase-2-plugin-skeleton.md -->
<!-- see-also: phase-5-skills.md, phase-6-hooks.md, phase-0.5-real-llm-spike.md -->

## Metadata

- **Phase**: 3
- **Depends on**: 2
- **Estimated effort**: 1 day
- **Deliverable**: 5 MCP tools that read/write `.jaewon-learning/` and `wiki/` with schema validation at every boundary.

## Scope

### Built
- 7 schemas in `mcp-server/schemas/`: `verdict`, `profile`, `outline` (with `outline.draft` + `outline.review` discriminant variants), `course-state`, `crawl-manifest`, `read-header` (frontmatter + section shape for creator's `read.md`), `crawl-budget` (shape for `learning_crawl_guard` state).
- `mcp-server/lib/validate.js` (lightweight schema validator).
- `mcp-server/lib/wiki-scan.js` (pure wiki indexer + searcher).
- 5 MCP tool handlers: `learning_status`, `learning_profile`, `learning_wiki_search`, `learning_verdict`, `learning_crawl_guard`.

### NOT built
- Agent logic that produces the data these tools consume (phase 4).
- Skills that invoke these tools (phase 5).
- A separate `learning_cycle_detect` MCP tool: intentionally omitted. `hooks/lib/cycle-detect.mjs` is hook-internal; the resume skill (phase-5.5) calls `learning_status` directly and derives phase from the returned status. See Revision Log item 3 in notes.md.

## Task Breakdown

### Task 3.1 — RED: schema tests (Zero-Hallucination Contracts)
- **Files**: `tests/phase-3/schemas.test.mjs` (~220 LOC)
- **Parallel**: false
- **depends_on**: []
- **Test cases** (one per schema, valid + invalid; added cases for outline.review variant, read-header, crawl-budget):
  1. `verdict_valid` — {verdict:'mastery', evidence:['...'], next_action:'merge', cycle_iteration:1} -> ok:true.
  2. `verdict_rejects_unknown_enum` — {verdict:'approved', ...} -> ok:false with error mentioning 'verdict'.
  3. `profile_valid` — full five-section object.
  4. `profile_rejects_missing_push_tactics`.
  5. `outline_draft_valid` — {kind:'draft', course_slug, source, chapters:[{slug,title,concepts:[],deps:[]}]}.
  6. `outline_rejects_circular_deps` — chapter A deps:[B], B deps:[A] -> ok:false.
  7. `outline_review_valid` — {kind:'review', course_slug, verdict:'APPROVE', objections:[]} -> ok:true.
  8. `outline_review_revise_requires_objections` — {kind:'review', verdict:'REVISE', objections:[]} -> ok:false.
  9. `outline_review_rejects_unknown_kind` — {kind:'approved'} -> ok:false (kind enum guard).
  10. `course_state_valid`.
  11. `course_state_phase_enum_guard` — phase='playing' -> ok:false.
  12. `crawl_manifest_valid`.
  13. `crawl_manifest_rejects_bad_relevance` — relevance > 1.0 -> ok:false.
  14. `read_header_valid` — frontmatter with `chapter`, `course`, `phase: read`, and required section headers (`## Overview`, `## Key Concepts`, `## Questions`) -> ok:true.
  15. `read_header_rejects_missing_section` — frontmatter valid but body missing `## Questions` -> ok:false with error citing missing header.
  16. `read_header_rejects_missing_frontmatter` — no YAML block -> ok:false.
  17. `crawl_budget_valid` — {course_slug, started_at, sources_fetched:0, elapsed_ms:0, tokens_spent:0, limits:{max_sources:10, max_elapsed_ms:300000, max_tokens:50000}} -> ok:true.
  18. `crawl_budget_rejects_negative_counters` — sources_fetched:-1 -> ok:false.
- **Acceptance**: 18/18 failing.

### Task 3.2 — GREEN: implement schemas + validator
- **Files**:
  - `mcp-server/lib/validate.js` (~90 LOC)
  - `mcp-server/schemas/verdict.mjs` (~60 LOC)
  - `mcp-server/schemas/profile.mjs` (~90 LOC)
  - `mcp-server/schemas/outline.mjs` (~110 LOC, grows from ~80 to cover `{kind:'draft'|'review'}` discriminant with two branches)
  - `mcp-server/schemas/course-state.mjs` (~80 LOC, grows from ~70 to include `last_advance_sig: string|null` field for Stop/SubagentStop race guard — see phase-6.7 item 5)
  - `mcp-server/schemas/crawl-manifest.mjs` (~70 LOC)
  - `mcp-server/schemas/read-header.mjs` (~80 LOC; validates YAML frontmatter + presence of required markdown section headers)
  - `mcp-server/schemas/crawl-budget.mjs` (~70 LOC; contract for `.jaewon-learning/crawl-budget.json` + `learning_crawl_guard` state)
- **Parallel**: false
- **depends_on**: [3.1]
- **Calling specs**: phase-0 §6.1 for verdict; each schema exports `{validate(obj)->{ok,errors,value}}`. PURE, deterministic. `outline.mjs` dispatches on `obj.kind` to the correct branch (LOD Pattern 8 Dict Dispatch applied at schema-level).
- **Acceptance**: 18/18 from 3.1 pass.

### Task 3.3 — RED: wiki-scan tests
- **Files**: `tests/phase-3/wiki-scan.test.mjs` (~120 LOC) + fixture `tests/fixtures/wiki-small/`.
- **Parallel**: true (with 3.2)
- **depends_on**: []
- **Test cases**:
  1. `scanWiki_returns_page_list_with_headers`.
  2. `scanWiki_extracts_scope_deps_see_also_comments` — per `raw-data/jaewon-plugin/docs/wiki/SCHEMA.md:20-28`.
  3. `scanWiki_counts_lines_accurately`.
  4. `searchWiki_substring_match_scores_higher_than_title_only`.
  5. `searchWiki_returns_empty_on_no_match`.
  6. `searchWiki_respects_max_results_arg`.
- **Acceptance**: 6/6 failing.

### Task 3.4 — GREEN: wiki-scan.js
- **Files**: `mcp-server/lib/wiki-scan.js` (~120 LOC)
- **Parallel**: false
- **depends_on**: [3.3]
- **Calling specs**: phase-0 §6.3.
- **Acceptance**: 6/6 from 3.3 pass.

### Task 3.5 — RED: status + profile handler tests
- **Files**: `tests/phase-3/handlers-read.test.mjs` (~160 LOC)
- **Parallel**: true (after 3.2 & 3.4)
- **depends_on**: [3.2, 3.4]
- **Test cases**:
  1. `learning_status_returns_defaults_on_missing_file`.
  2. `learning_status_returns_parsed_status_json`.
  3. `learning_status_update_deep_merges`.
  4. `learning_profile_reads_wiki_learner_star_md`.
  5. `learning_profile_respects_max_chars_truncation`.
  6. `learning_wiki_search_returns_top_n_pages`.
  7. `learning_wiki_search_validates_query_nonempty`.
- **Acceptance**: 7/7 failing.

### Task 3.6 — GREEN: status, profile, wiki-search handlers
- **Files**:
  - `mcp-server/handlers/status-handler.js` (~110 LOC; fork of `raw-data/jaewon-plugin/mcp-server/handlers/status-handler.js:23-57` with learning-specific `DEFAULT_STATUS` including `course_state.last_advance_sig: null`)
  - `mcp-server/handlers/profile-handler.js` (~120 LOC)
  - `mcp-server/handlers/wiki-search-handler.js` (~140 LOC)
- **Parallel**: false
- **depends_on**: [3.5]
- **Calling specs**: each `registerXxxTools(server, paths)` registers its tool(s) on the server, delegating to lib fns. Side effects: fs read + status.json write.
- **Acceptance**: 7/7 from 3.5 pass.

### Task 3.7 — RED: verdict handler tests (writes + state advance)
- **Files**: `tests/phase-3/verdict-handler.test.mjs` (~140 LOC)
- **Parallel**: false
- **depends_on**: [3.2]
- **Test cases**:
  1. `learning_verdict_writes_verdict_json_on_valid_payload`.
  2. `learning_verdict_rejects_invalid_schema_without_writing`.
  3. `learning_verdict_mastery_sets_next_action_merge`.
  4. `learning_verdict_partial_sets_next_action_rediscuss`.
  5. `learning_verdict_updates_course_state_cycle_count`.
  6. `learning_verdict_does_not_commit_git` — asserts no `.git` calls from this handler (git-manager's job).
- **Acceptance**: 6/6 failing.

### Task 3.8 — GREEN: verdict handler
- **Files**: `mcp-server/handlers/verdict-handler.js` (~120 LOC)
- **Parallel**: false
- **depends_on**: [3.7]
- **Calling specs**: phase-0 §6.2.
- **Acceptance**: 6/6 from 3.7 pass.

### Task 3.10 — RED: crawl-guard handler tests (circuit breaker)
- **Files**: `tests/phase-3/crawl-guard.test.mjs` (~140 LOC)
- **Parallel**: true (after 3.2)
- **depends_on**: [3.2]
- **Purpose**: implement the code-level circuit breaker required by risks.md R3. Replaces "in-prompt caps only" with a fails-closed gate the researcher must call before every fetch. Mitigates spec §12 (one cycle under 30 min).
- **Test cases**:
  1. `crawl_guard_init_creates_budget_file_with_defaults` — first call with `{course_slug, action:'begin'}` writes `.jaewon-learning/crawl-budget.json` validated against crawl-budget schema.
  2. `crawl_guard_check_returns_allow_when_under_limits` — `{action:'check', estimated_tokens:1000}` -> `{allow:true, remaining:{sources:9,elapsed_ms:299000,tokens:49000}}`.
  3. `crawl_guard_check_returns_deny_when_sources_exceeded` — after 10 successful `record` calls, `check` -> `{allow:false, reason:'sources_exceeded', limit_hit:'max_sources'}`.
  4. `crawl_guard_check_returns_deny_when_elapsed_exceeded` — simulate `started_at` 6 min ago -> `{allow:false, reason:'elapsed_exceeded'}`.
  5. `crawl_guard_check_returns_deny_when_tokens_exceeded` — tokens_spent 49000 + estimated 2000 > 50000 -> `{allow:false, reason:'tokens_exceeded'}`.
  6. `crawl_guard_record_increments_counters_atomically` — `{action:'record', source_url, tokens_used:500}` -> sources_fetched++, tokens_spent+=500.
  7. `crawl_guard_record_rejects_unknown_course` — record before begin -> ok:false.
  8. `crawl_guard_end_finalizes_and_returns_summary` — `{action:'end'}` -> `{sources_fetched, elapsed_ms, tokens_spent}`, marks budget file `finalized:true`.
  9. `crawl_guard_fails_closed_on_corrupt_budget_file` — malformed JSON -> defaults to deny with clear error (never silently allow).
- **Acceptance**: 9/9 failing.

### Task 3.11 — GREEN: crawl-guard handler
- **Files**: `mcp-server/handlers/crawl-guard-handler.js` (~140 LOC)
- **Parallel**: false
- **depends_on**: [3.10]
- **Calling spec**:
  ```
  registerCrawlGuardTools(server, paths) -> void
    tool: learning_crawl_guard
      input: {
        course_slug: string,
        action: 'begin' | 'check' | 'record' | 'end',
        estimated_tokens?: int,        // for 'check'
        source_url?: string,           // for 'record'
        tokens_used?: int,             // for 'record'
        limits?: {                     // for 'begin'; optional override; defaults are hard caps
          max_sources: int,            // default 10
          max_elapsed_ms: int,         // default 300000 (5 min)
          max_tokens: int              // default 50000
        }
      }
      output:
        begin  -> { ok, budget_path, limits }
        check  -> { allow: boolean, reason?: 'sources_exceeded'|'elapsed_exceeded'|'tokens_exceeded', remaining: {sources,elapsed_ms,tokens} }
        record -> { ok, counters: {sources_fetched, tokens_spent, elapsed_ms} }
        end    -> { ok, summary: {...} }
      side effects: reads + writes .jaewon-learning/crawl-budget.json (validated against crawl-budget schema each time)
      deterministic: YES given same fs + clock (clock injected for testability)
      FAILS CLOSED: corrupt/missing/unreadable budget file -> deny.
  ```
- **Acceptance**: 9/9 from 3.10 pass.

### Task 3.9 — REFACTOR: register all tools + handler index
- **Files**: `mcp-server/server.js` (update), `mcp-server/handlers/_index.js` (new, ~40 LOC — grown by one entry)
- **Parallel**: false
- **depends_on**: [3.6, 3.8, 3.11]
- **Actions**:
  - Add registry dict `{status, profile, wiki_search, verdict, crawl_guard}` -> register functions (LOD Pattern 8).
  - Iterate over registry in server.js (no switch/case).
  - Add a full-boot smoke test in `tests/phase-3/server-smoke.test.mjs` (~60 LOC) that spawns the server and lists registered tools via a mock MCP client.
- **Acceptance**: smoke test enumerates exactly 5 tool names.

## Phase Quality Gate

- All phase-3 test suites green (~51 tests total: 18 schema + 6 wiki-scan + 7 handlers-read + 6 verdict + 9 crawl-guard + 5 smoke).
- `mcp-server/schemas/*` and `lib/wiki-scan.js` are pure (no `fs.writeFile*`, verified via grep in test 3.9).
- Running the server and calling each tool from a fixture returns valid, schema-validated output.
- No handler file exceeds 140 LOC.
- `learning_crawl_guard` fails-closed confirmed by test 3.10 item 9.

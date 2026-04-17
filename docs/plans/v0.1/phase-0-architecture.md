# Phase 0 — LOD Architecture

<!-- scope: complete file tree, module boundaries, calling specs, LOC budgets, Rule 1-7 validation -->
<!-- deps: overview.md -->
<!-- see-also: phase-1-wiki-template.md, phase-2-plugin-skeleton.md, phase-3-mcp-server.md -->

## 1. Metadata

- **Phase**: 0
- **Depends on**: — (root phase)
- **Estimated effort**: 1 day
- **Deliverable**: file tree, interface contracts, schemas. No executable code written in this phase; TDD begins at phase 2.

## 2. Scope

### Built
- File tree for **plugin repo subfolder** `jaewon-plugin-learning/`
- File tree for **wiki template** `wiki-template/`
- Calling specs for every public module
- Schema definitions (Zero-Hallucination Contracts) for verdict, profile, outline, course-state, crawl-manifest
- Rule-by-rule LOD compliance proof

### NOT built
- No executable code, no tests. All executable work defers to phases 1-8.

## 3. Top-level Repository Layout

```
jaewon-plugin-learning-dev/                           (this repo)
├── jaewon-plugin-learning/                           (THE PLUGIN - phase 2-7)
│   ├── .claude-plugin/plugin.json
│   ├── .mcp.json
│   ├── package.json
│   ├── README.md
│   ├── CLAUDE.md                                     (plugin-level orchestration guide)
│   ├── agents/                                       (9 agent markdown files)
│   ├── skills/                                       (8 skill folders)
│   ├── hooks/
│   │   ├── hooks.json
│   │   ├── run.cjs                                   (COPIED from base plugin verbatim)
│   │   ├── session-start.mjs
│   │   ├── user-prompt-submit.mjs
│   │   ├── stop.mjs
│   │   ├── subagent-stop.mjs
│   │   ├── session-end.mjs
│   │   └── lib/
│   │       ├── stdin.mjs                             (COPIED from base plugin verbatim)
│   │       ├── settings.mjs
│   │       ├── state.mjs
│   │       ├── learner-profile.mjs
│   │       └── cycle-detect.mjs
│   ├── mcp-server/
│   │   ├── server.js
│   │   ├── handlers/
│   │   │   ├── status-handler.js
│   │   │   ├── profile-handler.js
│   │   │   ├── wiki-search-handler.js
│   │   │   └── verdict-handler.js
│   │   ├── schemas/
│   │   │   ├── verdict.mjs
│   │   │   ├── profile.mjs
│   │   │   ├── outline.mjs
│   │   │   ├── course-state.mjs
│   │   │   └── crawl-manifest.mjs
│   │   └── lib/
│   │       ├── paths.js
│   │       ├── file-ops.js                           (COPIED from base plugin)
│   │       ├── wiki-scan.js
│   │       └── validate.js
│   ├── hud/
│   │   └── learning-hud.mjs
│   └── dashboard/                                    (generator, NOT output)
│       ├── build.mjs
│       ├── render-home.mjs
│       ├── render-course.mjs
│       ├── render-profile.mjs
│       ├── render-timeline.mjs
│       └── templates.mjs
│
├── wiki-template/                                    (THE WIKI TEMPLATE - phase 1)
│   ├── README.md
│   ├── CLAUDE.md                                     (wiki-level learner workflow guide)
│   ├── SCHEMA.md
│   ├── .gitignore                                    (ignores .jaewon-learning/sessions/*.tmp)
│   ├── wiki/
│   │   ├── index.md
│   │   ├── log.md
│   │   ├── learner/
│   │   │   ├── learning-style.md                     (stub)
│   │   │   ├── strengths.md                          (stub)
│   │   │   ├── weaknesses.md                         (stub)
│   │   │   ├── push-tactics.md                       (stub with default tactics)
│   │   │   └── session-log.md                        (empty)
│   │   └── courses/.gitkeep
│   ├── dashboard/.gitkeep
│   └── .jaewon-learning/.gitkeep
│
└── docs/plans/v0.1/                                  (this plan)
```

## 4. Wiki Template — Per-Course Layout (created at runtime by `new-course` skill)

```
wiki/courses/<slug>/
├── outline.md                                        (approved outline)
├── meta.json                                         (slug, source, branch, current_chapter, current_phase)
├── raw/                                              (crawled & cloned sources)
│   ├── source/                                       (original repo or folder)
│   └── crawl/                                        (researcher output: links, transcripts, PDFs)
└── <chapter-slug>/
    ├── read.md                                       (creator output + QA transcript)
    ├── summary.md                                    (learner-authored)
    ├── discuss.md                                    (discuss transcript)
    └── verdict.json                                  (evaluator output — validated)
```

## 5. File-by-File Calling Specs and LOC Budgets

### 5.1 Plugin metadata

| File | Responsibility | LOC |
|------|----------------|----:|
| `jaewon-plugin-learning/.claude-plugin/plugin.json` | Registers plugin name, version 0.1.0, skills/hooks/mcp paths. Mirrors `raw-data/jaewon-plugin/.claude-plugin/plugin.json:1-13`. | 15 |
| `jaewon-plugin-learning/.mcp.json` | Binds `learning` MCP server entry to `mcp-server/server.js`. Mirrors `raw-data/jaewon-plugin/.mcp.json:1-12`. | 12 |
| `jaewon-plugin-learning/package.json` | `"type":"module"`, dep `@modelcontextprotocol/sdk@^1.26.0`. Mirrors `raw-data/jaewon-plugin/package.json:1-10`. | 12 |
| `jaewon-plugin-learning/README.md` | One-page plugin overview for GitHub. | 80 |
| `jaewon-plugin-learning/CLAUDE.md` | Plugin orchestration guide: lifecycle, sub-agents roster, cycle recipe, references `wiki/learner/` as source-of-truth. | 110 |

### 5.2 Agents (9 files, each <= 120 LOC; mirrors base plugin agent format)

| File | Single responsibility | Model | LOC |
|------|----------------------|-------|----:|
| `agents/researcher.md` | Aggressively crawl web + GitHub + arxiv + YouTube for a course; output validated `crawl-manifest.json`. | sonnet | 110 |
| `agents/planner.md` | Turn material + crawl manifest into an outline proposal; output validated `outline.json`. | opus | 110 |
| `agents/critic.md` | Review outline for scope, depth, dependency order; return APPROVE/REVISE with bounded objections. | opus | 110 |
| `agents/creator.md` | Draft per-chapter read-phase wiki pages; pull from outline + raw sources; emit `read.md` within 120-line page limit. | sonnet | 110 |
| `agents/profiler.md` | Read discuss transcript; update `wiki/learner/{style,strengths,weaknesses,push-tactics,session-log}.md` via validated profile-delta schema. | sonnet | 115 |
| `agents/evaluator.md` | Read discuss transcript + summary + materials; output validated `verdict.json` with incomplete/partial/mastery + evidence. | sonnet | 110 |
| `agents/wiki-maintainer.md` | Keep `wiki/` navigable: index rebuild, link lint, orphan detection. FORKED from `raw-data/jaewon-plugin/agents/wiki-maintainer.md`; scoped to `wiki/` (not `docs/wiki/`). | sonnet | 115 |
| `agents/dashboard-builder.md` | Invoke `dashboard/build.mjs`; regenerate `dashboard/*.html`; optionally push `gh-pages`. | haiku | 100 |
| `agents/git-manager.md` | Branch/commit/merge/push automation. FORKED from `raw-data/jaewon-plugin/agents/git-manager.md`; branch policy = `main + course/<slug>`. | sonnet | 115 |

### 5.3 Skills (8 folders, each `SKILL.md` <= 100 LOC)

| Folder | Single responsibility | LOC (SKILL.md) |
|--------|----------------------|--------------:|
| `skills/setup-learning-wiki/SKILL.md` | Guide user to fork `wiki-template` and initialize `.jaewon-learning/` inside the fork. | 80 |
| `skills/new-course/SKILL.md` | Orchestrate course ingest: detect input type, invoke researcher/planner/critic, get outline approval, create branch, scaffold chapters. | 100 |
| `skills/learn/SKILL.md` | Thin orchestrator of one chapter cycle (read -> summarize -> discuss). Contains NO business logic; only sequencing. | 100 |
| `skills/resume/SKILL.md` | Read course-state, determine active course/chapter/phase, hand control back to `learn` at correct step. | 80 |
| `skills/verdict/SKILL.md` | Trigger evaluator; record verdict; branch to merge or loop. | 80 |
| `skills/wiki-lint/SKILL.md` | Invoke wiki-maintainer lint operation. | 60 |
| `skills/dashboard/SKILL.md` | Invoke dashboard-builder; optionally push to `gh-pages`. | 70 |
| `skills/profile-review/SKILL.md` | Print `wiki/learner/*.md` to user for optional manual editing. | 70 |

### 5.4 Hooks (6 scripts + shared lib)

| File | Responsibility | Determinism | LOC |
|------|----------------|-------------|----:|
| `hooks/hooks.json` | Declarative bindings for SessionStart/UserPromptSubmit/Stop/SubagentStop/SessionEnd + run.cjs shim. | deterministic | 60 |
| `hooks/run.cjs` | VERBATIM copy of `raw-data/jaewon-plugin/hooks/run.cjs`. | deterministic | 98 |
| `hooks/session-start.mjs` | Load `wiki/learner/*` into context (systemMessage); check active course branch; compute HUD. | probabilistic-adapter | 150 |
| `hooks/user-prompt-submit.mjs` | If inside a learn cycle phase AND prompt looks off-topic, inject nudge. Uses deterministic cycle-detect + tiny heuristic. | probabilistic-adapter | 90 |
| `hooks/stop.mjs` | If discuss phase just finished AND profiler not yet triggered, nudge main session to spawn profiler. Never blocks. | deterministic | 110 |
| `hooks/subagent-stop.mjs` | Inspect stopped agent; if it was evaluator and produced a verdict, advance course-state + trigger git-manager commit. | deterministic | 130 |
| `hooks/session-end.mjs` | Commit any pending phase work, append `wiki/log.md` entry, write `.jaewon-learning/context/handoff.md`. | deterministic | 130 |
| `hooks/lib/stdin.mjs` | VERBATIM copy from base plugin. | deterministic (pure async) | 49 |
| `hooks/lib/settings.mjs` | Read `.jaewon-learning/settings.json`; resolve `{base}` templates. | deterministic | 80 |
| `hooks/lib/state.mjs` | Read/write `.jaewon-learning/status.json`. | deterministic | 90 |
| `hooks/lib/learner-profile.mjs` | Load `wiki/learner/*.md` into a normalized object; validate against `profile.mjs` schema. | deterministic | 100 |
| `hooks/lib/cycle-detect.mjs` | From status + git branch, derive `{course, chapter, phase}`. | deterministic pure | 70 |

### 5.5 MCP Server

| File | Responsibility | LOC |
|------|----------------|----:|
| `mcp-server/server.js` | Boot MCP server, register 4 learning tool handlers. Mirrors `raw-data/jaewon-plugin/mcp-server/server.js:1-40`. | 45 |
| `mcp-server/handlers/status-handler.js` | Expose `learning_status` (read), `learning_status_update` (write). Mirrors `raw-data/jaewon-plugin/mcp-server/handlers/status-handler.js:23-57`. | 110 |
| `mcp-server/handlers/profile-handler.js` | Expose `learning_profile` tool: projection over `wiki/learner/*.md`. Read-only. | 120 |
| `mcp-server/handlers/wiki-search-handler.js` | Expose `learning_wiki_search` tool: structured search over `wiki/**/*.md`. | 140 |
| `mcp-server/handlers/verdict-handler.js` | Expose `learning_verdict` tool: validate + record verdict.json + advance state. | 120 |
| `mcp-server/schemas/verdict.mjs` | Zero-Hallucination Contract: `{verdict: 'incomplete'|'partial'|'mastery', evidence: string[], next_action: string}`. | 60 |
| `mcp-server/schemas/profile.mjs` | Contract for learner-profile structure (5 pages; section headers). | 90 |
| `mcp-server/schemas/outline.mjs` | Contract: `{course_slug, source, chapters: [{slug, title, concepts, deps}]}`. | 80 |
| `mcp-server/schemas/course-state.mjs` | Contract: `{current_course, current_chapter, current_phase, cycle_count, verdict_history}`. | 70 |
| `mcp-server/schemas/crawl-manifest.mjs` | Contract for researcher output: `{sources: [{kind, url, hash, summary, relevance}]}`. | 70 |
| `mcp-server/lib/paths.js` | Resolve `.jaewon-learning/*` paths; mirrors `raw-data/jaewon-plugin/mcp-server/lib/paths.js:28-55`. | 60 |
| `mcp-server/lib/file-ops.js` | `readJSON`/`writeJSON`/`appendMarkdown`. VERBATIM from base. | 50 |
| `mcp-server/lib/wiki-scan.js` | Glob `wiki/**/*.md`; parse headers/wikilinks; return page index. Pure. | 120 |
| `mcp-server/lib/validate.js` | Schema validator (lightweight, no ajv dep); returns `{ok, errors}`. | 90 |

### 5.6 HUD

| File | Responsibility | LOC |
|------|----------------|----:|
| `hud/learning-hud.mjs` | Statusline: course | chapter | phase | verdict-history colorbar. Reads `.jaewon-learning/status.json`. Forked shape from `raw-data/jaewon-plugin/hud/jaewon-hud.mjs:1-40`. | 180 |

### 5.7 Dashboard Generator (pure, deterministic)

| File | Responsibility | LOC |
|------|----------------|----:|
| `dashboard/build.mjs` | Orchestrate: scan wiki, call render-*, write `dashboard/*.html`. No business logic. | 90 |
| `dashboard/render-home.mjs` | Render `dashboard/index.html` from course list. Pure. | 100 |
| `dashboard/render-course.mjs` | Render `dashboard/<slug>.html` from chapter/verdict data. Pure. | 120 |
| `dashboard/render-profile.mjs` | Render `dashboard/profile.html` from learner profile. Pure. | 110 |
| `dashboard/render-timeline.mjs` | Render `dashboard/timeline.html` (GitHub-contribution-style grid) from session-log + verdicts. Pure. | 140 |
| `dashboard/templates.mjs` | Minimal HTML template strings (no framework). Pure. | 110 |

### 5.8 Wiki Template (phase 1)

| File | Responsibility | LOC |
|------|----------------|----:|
| `wiki-template/README.md` | How to fork, how the plugin uses this repo. | 90 |
| `wiki-template/CLAUDE.md` | Wiki-level workflow: how teacher reads `wiki/learner/`, how new courses map to branches, what never to edit. | 120 |
| `wiki-template/SCHEMA.md` | Wiki conventions (120-line page cap, header, wikilink syntax, learner/, courses/). Fork of `raw-data/jaewon-plugin/docs/wiki/SCHEMA.md`. | 115 |
| `wiki-template/wiki/index.md` | Seed index with sections: Learner, Courses, Decisions. | 30 |
| `wiki-template/wiki/log.md` | Seed log (header only). | 10 |
| `wiki-template/wiki/learner/learning-style.md` | Stub with header and "no observations yet" placeholder. | 15 |
| `wiki-template/wiki/learner/strengths.md` | Stub. | 12 |
| `wiki-template/wiki/learner/weaknesses.md` | Stub. | 12 |
| `wiki-template/wiki/learner/push-tactics.md` | Seed with 5 default tactics and selection rubric. | 60 |
| `wiki-template/wiki/learner/session-log.md` | Empty session log header. | 10 |

## 6. Public Calling Specs (selected high-value modules)

### 6.1 `mcp-server/schemas/verdict.mjs`
```
validateVerdict(obj) -> { ok: boolean, errors: string[], value: Verdict | null }
  input: unknown
  output: { ok, errors, value }
  side effects: none
  deterministic: YES
  Verdict := {
    verdict: 'incomplete' | 'partial' | 'mastery',
    evidence: string[] (1..10 items),
    next_action: 'reread' | 'rediscuss' | 'merge',
    cycle_iteration: integer >= 1
  }
```

### 6.2 `mcp-server/handlers/verdict-handler.js`
```
registerVerdictTools(server, paths) -> void
  tool: learning_verdict
    input: { course_slug: string, chapter_slug: string, verdict_payload: unknown }
    output: { ok: boolean, recorded_path: string, next_action: string }
    side effects: writes wiki/courses/<slug>/<chapter>/verdict.json;
                  updates .jaewon-learning/status.json;
                  NEVER commits git (git-manager agent does that)
```

### 6.3 `mcp-server/lib/wiki-scan.js`
```
scanWiki(wikiRoot) -> WikiIndex
  input: absolute path to wiki/
  output: { pages: [{path, title, scope, deps: string[], see_also: string[], lines: int}] }
  side effects: reads filesystem only
  deterministic: YES (same fs -> same output)

searchWiki(index, query) -> SearchResults
  input: WikiIndex, query string
  output: [{path, score, matched_snippets: string[]}]
  side effects: none
  deterministic: YES
```

### 6.4 `hooks/lib/learner-profile.mjs`
```
loadLearnerProfile(wikiRoot) -> LearnerProfile
  input: absolute path to wiki/
  output: { style: string, strengths: string[], weaknesses: string[], push_tactics: Tactic[], recent_sessions: SessionLogEntry[] }
  side effects: reads filesystem
  deterministic: YES

summarizeForContext(profile, maxChars) -> string
  input: LearnerProfile, max size budget
  output: flattened markdown block for systemMessage injection
  side effects: none
  deterministic: YES
```

### 6.5 `hooks/lib/cycle-detect.mjs`
```
detectCycle(status, branch) -> CycleState
  input: StatusJSON, git branch string
  output: { course: string|null, chapter: string|null, phase: 'read'|'summarize'|'discuss'|'verdict'|'idle', iteration: int }
  side effects: none
  deterministic: YES
```

### 6.6 `dashboard/build.mjs`
```
buildDashboard(wikiRoot, outDir) -> BuildReport
  input: paths
  output: { pages_written: string[], duration_ms: int, errors: string[] }
  side effects: writes outDir/*.html
  deterministic: YES given same wiki state
```

### 6.7 `hooks/session-start.mjs` (adapter; probabilistic input)
```
main() -> void
  stdin: Claude SessionStart event JSON
  stdout: { systemMessage: string } with:
    - Plugin banner
    - Active course/chapter/phase (from cycle-detect)
    - Summarized learner profile (<=2KB from summarizeForContext)
    - HUD line
    - Wiki staleness warning if any
  side effects: ensures .jaewon-learning/ exists; updates session counters
  determinism: deterministic given same stdin + fs; non-blocking (exit 0 on error)
```

## 7. Data Flow Contracts (between modules)

```
researcher -> crawl-manifest.json (validated by crawl-manifest.mjs)
planner    -> outline.draft.json  (validated by outline.mjs)
critic     -> outline.review.json (validated by outline.mjs/review variant)
creator    -> wiki/courses/<slug>/<ch>/read.md (wiki-maintainer format)
evaluator  -> verdict.json        (validated by verdict.mjs)
profiler   -> wiki/learner/*.md   (validated by profile.mjs)
dashboard  -> dashboard/*.html    (pure render)

All writes go through validate.js BEFORE fs writes. This enforces Rule 7.
```

## 8. LOD Rules — Per-Rule Proof

- **R1 (<= 800 LOC):** Highest estimate in tree is `dashboard/render-timeline.mjs` at 140. All agents/skills targeted <= 120, matching `raw-data/jaewon-plugin/docs/wiki/SCHEMA.md:15` convention. Zero files exceed 200 except `hud/learning-hud.mjs` at 180 (statusline rendering, still far below cap).
- **R2 (one responsibility):** Every row in §5 has a single-sentence responsibility with no "and". Enforced at review time for phase N code.
- **R3 (pure over methods):** All hook libs and MCP handlers export standalone functions (mirroring `raw-data/jaewon-plugin/hooks/lib/state.mjs:57` and `raw-data/jaewon-plugin/mcp-server/handlers/status-handler.js:23`). The sole class is `McpServer` from the SDK.
- **R4 (flat over deep):** No inheritance declared anywhere. Variant dispatch via dicts in §5.3 (skills) and §9 (dashboard section registry).
- **R5 (calling specs):** §6 lists specs for critical boundaries; every agent/skill SKILL.md will include a `<CallingSpec>` block as part of its own <=120 LOC budget.
- **R6 (deterministic sealed):** `schemas/*`, `validate.js`, `wiki-scan.js`, `cycle-detect.mjs`, `dashboard/render-*` are all marked deterministic. Their tests (phase 2/3/7) freeze them.
- **R7 (probabilistic flexible):** Adapters at the LLM boundary — `hooks/session-start.mjs`, `hooks/user-prompt-submit.mjs`, `verdict-handler.js` input path, `profile-handler.js` input path — validate all incoming LLM/agent output against sealed schemas before persisting.

## 9. Variant Registries (explicit)

```
agents/_registry.md           (documentation; 9 entries)
skills/_dispatcher.mjs        (map: skill-name -> SKILL.md path)   (~40 LOC)
mcp-server/handlers/_index.js (map: tool-name -> handler)          (~30 LOC)
dashboard/_sections.mjs       (map: section-name -> renderer)      (~35 LOC)
```

These registries absorb all "which variant?" decisions and prevent switch-cases elsewhere (LOD Pattern 8).

## 10. Acceptance Criteria for Phase 0

- [ ] `overview.md`, `phase-0-architecture.md`, `phase-1..8-*.md`, `checklist.json`, `risks.md`, `notes.md` exist under `docs/plans/v0.1/`.
- [ ] Every file in §5 has exactly one responsibility sentence with no "and".
- [ ] Every file in §5 has an LOC estimate <= 400 (agents/skills/CLAUDE.md) or <= 200 (code), with a hard ceiling of 800.
- [ ] Every module boundary in §6 has a calling spec (inputs, outputs, side effects, determinism).
- [ ] Rule 1-7 proofs in §8 reference at least one concrete file:line from base plugin (achieved: `raw-data/jaewon-plugin/docs/wiki/SCHEMA.md:15`, `raw-data/jaewon-plugin/hooks/lib/state.mjs:57`, etc.).
- [ ] No inheritance used anywhere in the tree.
- [ ] All variant dispatch routes to a registry.

## 11. Quality Gate for Phase 0

Phase 0 is DONE when:
1. An LOD linter pass over the tree shows zero estimates > 800.
2. A human reviewer can point to the file owning any given responsibility in <= 5 seconds.
3. All 4 schemas in `mcp-server/schemas/` are specified structurally in §6 or phase-3 doc (not yet coded).
4. `checklist.json` validates as a DAG (verified in phase-1-wiki-template.md's intro).

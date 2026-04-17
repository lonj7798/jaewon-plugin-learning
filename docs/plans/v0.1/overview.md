# jaewon-plugin-learning v0.1 — Plan Overview

<!-- scope: mission, scope, phase index, glossary, RALPLAN-DR, LOD compliance summary -->
<!-- deps: docs/interview/spec-2026-04-16.md -->
<!-- see-also: phase-0-architecture.md, phase-0.5-real-llm-spike.md, checklist.json, risks.md, notes.md -->

## 1. Mission

Build a Claude Code plugin, `jaewon-plugin-learning`, that teaches one learning material at a time via a persistent wiki + adaptive TEACHER (the main Claude session). Fork of `jaewon-plugin`'s proven scaffolding (hooks, MCP, state dir, wiki-maintainer pattern), swapping most skills/agents for a learning loop: `read -> summarize -> discuss -> verdict`.

The plugin ships two shippable artifacts:

1. **Plugin repo** (this repo, subfolder `jaewon-plugin-learning/`) — agents, skills, hooks, MCP server, plugin-level CLAUDE.md.
2. **Wiki template repo** (`wiki-template/` subfolder, published as a separate GitHub template repo) — a learner forks it once; plugin operates inside the fork and grows `wiki/`, `wiki/learner/`, `wiki/courses/*/`, and `dashboard/` over time.

## 2. Scope (v0.1)

### In scope
- Full per-chapter cycle: read with interactive QA -> learner-written summary -> sharp discuss -> verdict (Incomplete | Partial | Mastery).
- 9 sub-agents: researcher, planner, critic, creator, profiler, evaluator, wiki-maintainer, dashboard-builder, git-manager.
- 8 skills: setup-learning-wiki, new-course, learn, resume, verdict, wiki-lint, dashboard, profile-review.
- 4 learning hooks on top of base lifecycle: SessionStart (load learner profile), UserPromptSubmit (off-task nudge), Stop/SubagentStop (trigger profiler after discuss), SessionEnd (commit pending + log).
- 5 MCP tools: `learning_status`, `learning_profile`, `learning_wiki_search`, `learning_verdict`, `learning_crawl_guard` (circuit breaker for researcher crawls — rev 2, R3 mitigation).
- Aggressive crawler (WebSearch + WebFetch + GitHub + arxiv + YouTube transcripts) via researcher agent, gated by `learning_crawl_guard`.
- Full GitHub workflow: branch per course, commit per cycle phase, auto-merge on mastery, tag on milestones.
- Static HTML dashboard generator (`dashboard/` in wiki repo), optional GitHub Pages publish flow.
- End-to-end smoke test: ingest a small GitHub repo, run one full chapter cycle, verify wiki + profile + dashboard + merge.
- **Real-LLM schema spike (phase 0.5)** — validates evaluator/profiler contracts against real Claude output before phases 4/5/6 commit to them (rev 2, R4/R6/R10 mitigation).

### Out of scope (non-goals per spec §11)
- Multi-user support, Anki / spaced-repetition integration, voice/audio lessons, real-time collaboration.
- Teacher as a spawned sub-agent (TEACHER = main Claude session only).
- CLAUDE.md auto-editing (plugin never edits CLAUDE.md; all learner adaptation flows through `wiki/learner/*`).
- Arbitrary non-markdown source parsing beyond text/code/markdown/pdf-text-extract.

## 3. Runtime Flow — One Full Chapter Cycle (ASCII)

```
+---------+   /learn new-course <input>     +----------------+
| LEARNER |-------------------------------->|  MAIN SESSION  |
+---------+                                 |   (TEACHER)    |
                                            +--------+-------+
                                                     |
                 (1) ingest + crawl                  v
                 Task(researcher)  ---------->  wiki/courses/<slug>/raw/*
                      (gated by learning_crawl_guard)
                 Task(planner)     ---------->  wiki/courses/<slug>/outline.md (draft)
                 Task(critic)      ---------->  outline review notes
                                   <---------  outline-approved by learner (interactive)
                 Task(git-manager) ---------->  branch course/<slug> created
                                                     |
                                                     v
  +--------------------------  PER CHAPTER LOOP  --------------------------+
  |                                                                       |
  |  PHASE: read                                                          |
  |   MAIN picks tactic from wiki/learner/push-tactics.md, builds         |
  |        push_tactic_snapshot; passes to creator/evaluator/profiler     |
  |   Task(creator)     ----> wiki/courses/<slug>/<ch>/read.md            |
  |                           (validated against read-header schema)      |
  |   MAIN -- interactive QA -- LEARNER (streaming)                        |
  |   Task(wiki-maintainer) -> cross-links, index update, read-md gate    |
  |   Task(git-manager) -> commit "learn(read): <ch>"                     |
  |                                                                       |
  |  PHASE: summarize                                                     |
  |   LEARNER writes wiki/courses/<slug>/<ch>/summary.md (teacher silent) |
  |   Task(git-manager) -> commit "learn(summarize): <ch>"                |
  |                                                                       |
  |  PHASE: discuss                                                       |
  |   MAIN runs adaptive interrogation (sharp, strict, non-sycophantic)   |
  |   Transcript -> wiki/courses/<slug>/<ch>/discuss.md                   |
  |   Task(evaluator)   -> verdict.json {incomplete|partial|mastery}      |
  |   Task(profiler)    -> updates wiki/learner/{style,strengths,        |
  |                        weaknesses,push-tactics,session-log}.md       |
  |   Task(git-manager) -> commit "learn(discuss): <ch>"                 |
  |                          + commit "learn(profile): <ch>"              |
  |   Stop/SubagentStop hooks advance state idempotently (sig-guarded)    |
  |                                                                       |
  |  VERDICT GATE                                                         |
  |    mastery  -> Task(git-manager) merge course/<slug> -> main          |
  |                Task(dashboard-builder) regenerate -> dashboard/       |
  |                Task(git-manager) commit "docs(dashboard): <slug>"     |
  |    partial  -> loop (same branch, same chapter, next cycle iter)      |
  |    incomplete -> loop (teacher re-reads; next cycle with more ctx)    |
  +-----------------------------------------------------------------------+
```

## 4. Phase Index

| Phase | Name | Depends on | Purpose | Est. effort |
|-------|------|------------|---------|------------:|
| 0 | Architecture (LOD decomposition, contracts) | — | Lock file tree, module boundaries, calling specs | 1 day |
| 0.5 | Real-LLM schema spike (validation gate) | 0, 2, 3 (schemas green) | Validate evaluator/profiler/push-tactic contracts against real Claude BEFORE committing phases 4/5/6 | 0.5 day |
| 1 | Wiki-template repo scaffold | 0 | Ship a forkable wiki template with SCHEMA, learner/, courses/ layout, CLAUDE.md | 0.5 day |
| 2 | Plugin skeleton | 0 | package.json, .claude-plugin/plugin.json, hooks.json, .mcp.json, empty stubs | 0.5 day |
| 3 | MCP server handlers | 2 | `learning_status`, `learning_profile`, `learning_wiki_search`, `learning_verdict`, `learning_crawl_guard` + 7 schemas | 1 day |
| 4 | Core agents | 0, 2, 3, 0.5 (gate) | 9 agent markdown files with calling specs incl. push-tactic injection | 1 day |
| 5 | Core skills | 0, 2, 3, 4, 0.5 (gate) | 8 skill markdown files + their scripts | 1.5 days |
| 6 | Hooks | 2, 3, 0.5 (gate) | 5 learning-specific hook scripts wired to base lifecycle, race-guarded advance | 1 day |
| 7 | Dashboard generator | 1, 3 | Static HTML builder + optional GH Pages publish | 0.5 day |
| 8 | End-to-end smoke test | 1-7 | Ingest small GitHub repo, run one cycle, verify artifacts | 0.5 day |

Phase dependency graph:

```
            +----> 1 (wiki template)
            |
 0 ---------+----> 2 ----> 3 ----> 0.5 (gate) ----> 4
            |                                          \
            |                                           +---> 5 ----> 8
            |                                           |       ^
            +-------------------------------------------+-> 6 --+
                                                        |
                                                        +-> 7 --+
```

## 5. RALPLAN-DR Summary

### Principles (guiding shaping of the plan)

1. **Wiki is sovereign; CLAUDE.md is stable.** All teacher adaptation is data (`wiki/learner/*`), never code changes to CLAUDE.md. This mirrors karpathy's llm-wiki sovereignty and the spec §10.
2. **Deterministic seals around probabilistic cores.** Every LLM boundary is wrapped (Zero-Hallucination Contracts): verdict schema, profile-update schema, outline schema (with draft/review discriminant), read-header schema, crawl-budget schema — validated before being written to disk.
3. **One responsibility per file, <= 120 LOC per agent/skill page, <= 200 LOC per code file, hard 800 LOC ceiling.** Matches base plugin's wiki schema (`raw-data/jaewon-plugin/docs/wiki/SCHEMA.md:15`) and LOD Rule 1.
4. **Fork base plugin's proven plumbing; only change the domain.** Reuse `hooks/run.cjs`, `hooks/lib/stdin.mjs`, `mcp-server/server.js` registration pattern, `wiki-maintainer` page-format conventions. Do not reinvent lifecycle.
5. **TEACHER lives in the main session.** All other actors are sub-agents spawned via Task. This is a firm constraint per user ("TEACHER = main session, not a spawned agent").
6. **Validate LLM contracts with real LLMs early.** A cheap 0.5-day spike (phase 0.5) proves evaluator/profiler schemas before 45 dependent tasks assume they hold.

### Decision drivers (top 3)

1. **Adaptation without CLAUDE.md edits** — forces the plan to push all per-learner signal into `wiki/learner/*.md` read by SessionStart and by the main session at discuss-time.
2. **Two-repo topology** (plugin + forkable wiki template) — forces an explicit contract between what the plugin owns and what lives in the learner's fork.
3. **Full v0.1 vision** (crawl + branch + dashboard + self-improving teacher) — drives aggressive phasing; demands a smoke test to prove it end-to-end.

### Viable options considered

**Option A — Single monolithic plugin (wiki inside plugin repo)**
- Pros: simpler distribution; no fork step.
- Cons: learner data mingles with plugin code; plugin updates fight user commits; breaks the "wiki is the codebase" karpathy principle; can't render GitHub Pages per-learner.
- Invalidated: violates the forkable-template requirement (round 3 of the interview).

**Option B — Plugin + forkable wiki template (selected)**
- Pros: clean separation; per-learner GitHub Pages works; plugin can be updated independently; matches spec §3.
- Cons: two repos to ship + version; learner must fork once.
- Accepted: satisfies round-3 decision and aligns with llm-wiki pattern.

**Option C — Plugin + cloud-hosted wiki service**
- Pros: no fork step; central upgrades.
- Cons: hosting ops out of scope for v0.1; violates "user owns data" spirit; breaks offline use.
- Invalidated: non-goal per spec §11 (no multi-user / real-time).

### Selected
Option B. Plugin repo + `wiki-template/` subfolder shipped as a forkable standalone.

### Consequences
- Need publish/release workflow for `wiki-template/` as its own GitHub repo (deferred to a post-v0.1 task; smoke test uses the in-repo copy).
- Plugin code must treat the wiki fork as the sole source of truth for learner state; plugin repo must stay learner-data-free.
- CI / plugin tests must run against a synthetic wiki fork fixture (tracked in risks.md).

### Follow-ups (deferred decisions)
- Input format: `new-course` must accept both local folder path AND GitHub URL. Proposed: auto-detect by `/` and scheme prefix; clone URL into `wiki/courses/<slug>/raw/`. FLAGGED in notes.md for user confirmation.
- Dashboard publish: static HTML in `dashboard/` with optional `gh-pages` branch publish via git-manager. FLAGGED in notes.md.
- Resume UX: `/learn resume` auto-detects active branch + last cycle phase from `.jaewon-learning/status.json` (direct status read; no cycle-detect MCP projection — see revision log item 3). FLAGGED in notes.md.
- Session log format: karpathy-style `wiki/log.md` + per-session JSONL in `.jaewon-learning/sessions/`. FLAGGED in notes.md.

## 6. LOD Compliance Summary

| Rule | How the plan satisfies it |
|------|--------------------------|
| R1 — Max 800 LOC per file | Every planned file carries a LOC estimate in phase-0 (agents target <= 120 lines matching wiki-maintainer convention at `raw-data/jaewon-plugin/docs/wiki/SCHEMA.md:15`; code targets <= 200; hard cap 800). |
| R2 — One file, one responsibility | Each file in the tree carries a single-sentence responsibility; no "and" allowed. |
| R3 — Pure functions over methods | All MCP handler modules and hook-lib modules use standalone `export function` (mirrors `raw-data/jaewon-plugin/mcp-server/handlers/status-handler.js:23` and `raw-data/jaewon-plugin/hooks/lib/state.mjs:57`). No classes except the MCP server instance itself. |
| R4 — Flat over deep | No inheritance. Variants (agent kinds, skill kinds, verdict kinds, dashboard sections, crawl-guard actions, outline draft/review) use Variant Registry (dicts of name -> handler). |
| R5 — Explicit calling specs | Every public function in phase-0 lists inputs, outputs, side effects, determinism. Push-tactic-injection adds `push_tactic_snapshot` arg to 4 of 9 agent specs. |
| R6 — Deterministic logic sealed | `verdict-schema.mjs`, `profile-schema.mjs`, `outline-schema.mjs` (discriminant), `read-header-schema.mjs`, `crawl-budget-schema.mjs`, `wiki-link-parser.mjs`, `dashboard-render.mjs` are pure and tested; never mutated to accommodate LLM drift. |
| R7 — Probabilistic logic flexible | LLM boundaries (researcher crawl normalizer, evaluator verdict parser, profiler text->schema adapter, teacher-tactic selector) are wrapped adapters that validate against the sealed schemas before persisting. |

## 7. LOD Design Pattern Decisions

| Pattern | Decision | Why |
|---------|----------|-----|
| 1. Radical Fragmentation | APPLY | Profiler/dashboard/outline builders would naturally grow past 120 LOC; split per-concern from day 1. |
| 2. Calling Specs as Black Boxes | APPLY | Every module boundary documented in phase-0. |
| 3. Variant Registry | APPLY | agent-kinds registry, skill dispatcher, dashboard-section registry, verdict-handler registry, crawl-guard action registry. |
| 4. Toolification | APPLY | 5 MCP tools expose state to main session (added `learning_crawl_guard` in rev 2); dashboard-build exposed as a skill too. |
| 5. Orchestrator Recipes | APPLY | `learn` skill is a thin orchestrator (phase sequencer) — calls creator/evaluator/profiler without business logic. |
| 6. Schema Separation | APPLY | `schemas/verdict.mjs`, `schemas/profile.mjs`, `schemas/outline.mjs` (draft+review branches), `schemas/course-state.mjs` (incl. `last_advance_sig`), `schemas/read-header.mjs`, `schemas/crawl-budget.mjs` are shared across MCP, hooks, skills. |
| 7. Zero-Hallucination Contracts | APPLY | All agent outputs (researcher crawl manifest, planner outline, critic review, evaluator verdict, profiler updates, creator read.md frontmatter+headers) are validated against JSON schemas before persistence. |
| 8. Dict Dispatch | APPLY | Skill-name -> handler, verdict -> branch-action, push-tactic -> teacher-mode, crawl-guard action -> handler, outline kind -> schema branch all use map lookups. |
| 9. Feedback Loops | APPLY | Partial-verdict -> another cycle is a bounded loop (max 3 iterations per chapter before escalate-to-learner); phase 0.5 spike may loop into a schema-patch iteration before unblocking phase 4. |

## 8. Glossary

- **Course** — one input (folder/GitHub URL); lives on its own git branch `course/<slug>` in the wiki fork.
- **Chapter** — curriculum unit within a course; each runs one cycle (read -> summarize -> discuss).
- **Cycle** — the three-phase loop; can iterate within a chapter on Partial verdict.
- **Verdict** — Incomplete | Partial | Mastery. Mastery merges the branch.
- **Push-tactic** — one of {interrogator, debater, examiner, coach, blend}, chosen per session from `wiki/learner/push-tactics.md`. Passed as `push_tactic_snapshot` to tactic-aware sub-agents.
- **push_tactic_snapshot** — `{tactic, rationale, bar_adjustment, source_pages_hash}`; built by skill at entry, consumed by researcher/creator/evaluator/profiler (tactic-aware agents). Planner/critic/wiki-maintainer/dashboard-builder/git-manager are tactic-blind.
- **Learner profile** — the five `wiki/learner/*.md` pages: `learning-style.md`, `strengths.md`, `weaknesses.md`, `push-tactics.md`, `session-log.md`.
- **Wiki fork** — the user's clone of the `wiki-template` repo; plugin operates inside it.
- **`.jaewon-learning/`** — runtime state directory inside the wiki fork (mirrors `.jaewon/` pattern from base plugin at `raw-data/jaewon-plugin/CLAUDE.md:27`).
- **last_advance_sig** — deterministic hash stored in `status.course_state`; guards against Stop/SubagentStop double-advance (rev 2 item 5).
- **learning_crawl_guard** — MCP tool implementing a fails-closed circuit breaker for researcher crawls; enforces max_sources/max_elapsed_ms/max_tokens.

# Notes — jaewon-plugin-learning v0.1

<!-- scope: decisions log, open questions needing user confirmation, assumptions, real-LLM runbook, revision log -->
<!-- deps: overview.md, all phase docs, risks.md -->

## Decisions Log

| # | Decision | Rationale | Phase | Reference |
|---|----------|-----------|-------|-----------|
| D1 | TEACHER = main Claude session; never a sub-agent. | User hard constraint (round 5 clarification). | all | `docs/interview/interview-2026-04-16.md:46-49` |
| D2 | Plugin repo + forkable `wiki-template/` (Option B). | Satisfies two-repo topology + GitHub Pages per-learner. | 1 | overview.md §5 |
| D3 | `.jaewon-learning/` runtime dir inside the wiki fork. | Mirrors base plugin `.jaewon/` pattern without namespace clash. | 2, 6 | `raw-data/jaewon-plugin/CLAUDE.md:27-42` |
| D4 | All agent outputs validated against schemas before fs writes. | Zero-Hallucination Contracts; LOD Rule 7. | 3, 4, 5 | phase-0 §6.1, §7 |
| D5 | 120-LOC cap on every markdown under `wiki/`. | Preserves base wiki-maintainer convention. | 1, 4 | `raw-data/jaewon-plugin/docs/wiki/SCHEMA.md:15` |
| D6 | Push-tactic chosen per session, not hard-coded. | Spec §2 teacher voice is adaptive. | 5 | spec §2, §10 |
| D7 | Commit per cycle phase + merge on mastery. | Spec §4. | 5, 6 | spec §4 |
| D8 | Profiler is the single writer to `wiki/learner/*.md`. | Single-writer rule; prevents lost updates. | 4, 6 | `raw-data/jaewon-plugin/docs/wiki/SCHEMA.md:109-113` |
| D9 | Dashboard is opt-in publish (privacy mode available). | R9 mitigation. | 7 | risks.md R9 |
| D10 | Smoke test uses mock agents; real-LLM runbook is manual. | Bounds phase-8 scope; real run is release gate. | 8 | risks.md R10 |
| D11 | `outline.mjs` schema uses a `kind: 'draft'|'review'` discriminant; no separate `outline.review.mjs` file. | One schema, two branches; LOD Pattern 8 (Dict Dispatch) at schema level. Added in rev 2. | 3 | phase-3 task 3.2 |
| D12 | `read.md` header shape is validated by `mcp-server/schemas/read-header.mjs`; wiki-maintainer rejects malformed before commit. | Fixes rev 1 gap: markdown-only format had no structural check. Added in rev 2. | 3, 4 | phase-3 task 3.1/3.2, phase-4 task 4.5/4.8 |
| D13 | Researcher crawl gated by MCP tool `learning_crawl_guard`; fails closed; wired into researcher's mandatory steps. Chose Option A over file-only guard because MCP enforcement is testable and survives hook skipping. | R3 mitigation via code, not prompt text. Added in rev 2. | 3, 4 | phase-3 tasks 3.10/3.11, phase-4 task 4.2 |
| D14 | `hooks/lib/cycle-detect.mjs` is hook-internal only; no MCP projection tool. Resume skill derives state directly from `learning_status`. | Removes rev 1 orphan claim. Added in rev 2. | 5, 6 | phase-5 task 5.5, phase-6.2 |
| D15 | Push-tactic injection via argument (Option A): skill reads `push-tactics.md`, builds `push_tactic_snapshot`, passes to researcher/creator/evaluator/profiler. Planner, critic, wiki-maintainer, dashboard-builder, git-manager are tactic-blind by design. | Observable adaptive voice requires agents to see the tactic; agent-level file reads would duplicate I/O and risk drift within a single cycle. Added in rev 2. | 4, 5 | phase-4 §Push-Tactic Injection Contract, task 4.12; phase-5 tasks 5.3/5.4/5.6 |
| D16 | Stop/SubagentStop advance is idempotent via `course_state.last_advance_sig` compare-and-swap. Both hooks fire, at most one advance persists. | Fixes Stop vs SubagentStop race (rev 1 undefined ordering). Added in rev 2. | 6 | phase-6 §Stop vs SubagentStop Race, tasks 6.1/6.2/6.7/6.8 |
| D17 | Phase 0.5 real-LLM spike is a mandatory gate between phase 3 (schemas green) and phases 4/5/6 (agents/skills/hooks that consume the schemas). Option A chosen over a phase-8.6 exit criterion because 45 downstream tasks depend on the design being right. | R4/R6/R10 mitigation. Added in rev 2. | 0.5 | phase-0.5-real-llm-spike.md |

## Open Questions Flagged for User Confirmation

Each of these is a bounded default proposed in the plan. The executor should NOT proceed past the relevant phase until the user confirms or overrides.

### Q1. Input format for `new-course`
- **Plan default**: accept both local folder path (absolute or relative) AND GitHub URL; auto-detect by presence of `://` or starting with `github.com/`. Clone GitHub URLs into `wiki/courses/<slug>/raw/source/`. Copy local folders (symlink if on same filesystem).
- **Phase**: 5 (`new-course` skill, task 5.3 step 1).
- **Confirm / alternative**: user may prefer explicit subcommands (`/learn new-course github <url>` vs `/learn new-course folder <path>`).

### Q2. Dashboard publish
- **Plan default**: static HTML generator writes to `dashboard/` on main. Optional `gh-pages` branch publish via `git-manager` agent, opt-in per-run. Privacy mode redacts `weaknesses` + full session-log from published view.
- **Phase**: 7.
- **Confirm / alternative**: user may want Netlify/Vercel hook, local-only, or no publish at all in v0.1.

### Q3. Resume UX
- **Plan default**: `/learn resume` reads `.jaewon-learning/status.json` directly via `learning_status`; derives active course/chapter/phase from the returned fields; no cycle-detect projection. Prints state and hands control to `/learn`. No args. If multiple courses stalled, prints list and asks user to pick.
- **Phase**: 5 (`resume` skill, task 5.5).
- **Confirm / alternative**: user may want `/learn resume <course-slug>` explicit form.

### Q4. Session log format
- **Plan default**: karpathy-style `wiki/log.md` (human-readable, append-only) mirrored by per-session JSONL at `.jaewon-learning/sessions/<timestamp>.jsonl` (machine-readable for dashboard). Two sinks, same event stream.
- **Phase**: 6 (`session-end` hook, task 6.10) and 7 (`render-timeline`, task 7.3).
- **Confirm / alternative**: user may want JSONL only (skip human log) or Markdown only (skip JSONL; dashboard parses markdown).

## Assumptions

- A1. Node 20+ is available (base plugin dep same; `raw-data/jaewon-plugin/package.json:1-10`).
- A2. `@modelcontextprotocol/sdk@^1.26.0` is the only runtime dep; the plan explicitly avoids adding heavyweight deps (no ajv, no chalk, no axios). All JSON validation is hand-rolled in `mcp-server/lib/validate.js`.
- A3. User has `git` on PATH (required by git-manager and researcher's clone step).
- A4. Claude Code hook timeouts in `hooks.json` (3-10s) are sufficient; if session-start exceeds 5s due to large learner profile, we compact via `summarizeForContext`.
- A5. WebSearch / WebFetch tools are available to sub-agents by default; plugin does not bundle a custom crawler.
- A6. The user has a single active course at a time (R8). Multi-course concurrency is explicitly out of scope for v0.1.
- A7 (rev 2). `ANTHROPIC_API_KEY` is available for the phase 0.5 spike; spike spend is bounded at $5.

## Real-LLM Smoke Runbook (manual; release gate)

This is the section referenced by phase-8.5. Execute once before tagging v0.1.

1. Clone this repo. `cd jaewon-plugin-learning-dev`.
2. Fork `wiki-template/` into your own GitHub account (copy the folder into a fresh repo, `git init`, push).
3. Clone your wiki-template fork to a working dir: `git clone <your-fork-url> ~/learning-wiki`.
4. Install the plugin in Claude Code: add `jaewon-plugin-learning/` as a local plugin. (Follow Claude Code's plugin install docs.)
5. Open Claude Code with `~/learning-wiki` as CWD.
6. Run `/setup-learning-wiki`. Verify `.jaewon-learning/` is created.
7. Run `/learn new-course https://github.com/karpathy/nanoGPT`. Approve the outline. Verify `course/nanogpt` branch exists.
8. Run `/learn`. Complete the read phase interactively (answer the teacher's QA). Verify `wiki/courses/nanogpt/<chapter>/read.md` exists and passes the `read-header` schema.
9. Run `/learn` again; write your own summary in `wiki/courses/nanogpt/<chapter>/summary.md`; commit is automatic.
10. Run `/learn` once more; engage in the discuss phase; run `/verdict`. Verify:
    - `wiki/courses/nanogpt/<chapter>/verdict.json` is valid against the schema.
    - `wiki/learner/*.md` files have new entries; session-log entry cites `push_tactic_snapshot.tactic`.
    - If verdict was mastery: `course/nanogpt` is merged into `main`, `dashboard/*.html` regenerated, session-log updated.
    - If verdict was partial: `course/nanogpt` remains; `status.json` shows `cycle_iteration=2` and `last_advance_sig` populated.

If any step fails, file a bug under `.jaewon-learning/debug-history/` and capture divergence for v0.2.

## Deferred to v0.2+

- Multi-course concurrency.
- Spaced-repetition integration (Anki export from wiki).
- Voice/audio lessons.
- Non-markdown source parsing beyond text extraction (PDFs, notebooks).
- Plugin auto-update flow.
- Cross-learner comparison (multi-user; explicit non-goal per spec §11).

## Phase 0.5 Gate Decision: PROCEED (2026-04-16)

Spike `0.5.1` **skipped** and `0.5.2` resolved as **PROCEED** without running the standalone Node+Anthropic-SDK spike script.

**User rationale**: "everything will be on top of 'claude'". The plugin runs inside Claude Code; sub-agents (researcher, creator, evaluator, profiler, etc.) are invoked via the `Task` tool using the same Claude model that drives the main session. A separate API-key-based spike would validate a boundary (raw `@anthropic-ai/sdk` calls) that the runtime never crosses.

**Where the spike's coverage is recovered**:
- Task-tool sub-agent invocations during phase-4 agent definition bring-up surface any schema drift at real-LLM output time.
- Phase-8 end-to-end smoke test (8.1 -> 8.3) exercises the full agent chain against realistic input.
- Personal dogfooding (running `/new-course` on a real material) is the authoritative validation.

**If schemas fail at those points**: revisit the 7 sealed schemas (phase-3 task 3.2), patch, and re-run the affected phase's tests. Zero rework risk on phases 1-3 (already stable) or phase 7 (LLM-independent).

Phases 4, 5, 6 unblocked.

## Revision Log

### Iteration 1 -> 2 (architect revision, 2026-04-16)

Surgical edits to address 6 architect revision requests. Total added tasks: 6 (0.5.1, 0.5.2, 3.10, 3.11, 4.12, plus task renumbering in phase 3 so the existing REFACTOR task 3.9 now depends on 3.11). No tasks removed. Version stays v0.1.

#### Item 1 — Schema coverage gap (outline.review.json + read.md header)
- **Choice**: fold `outline.review.json` into `outline.mjs` via a `kind:'draft'|'review'` discriminant (option: discriminant, not a sixth schema file). Add a separate `read-header.mjs` schema for creator's `read.md` frontmatter + required section headers.
- **Files touched**: `phase-3-mcp-server.md`, `phase-4-agents.md` (creator §4.5 + wiki-maintainer §4.8), `notes.md` (D11, D12).
- **New tasks**: none new for item 1 (test cases added inline to task 3.1; schema files added inline to task 3.2). Phase 3's `Deliverable` now lists 7 schemas instead of 5.
- **Open question**: the read-header required section list (`## Overview`, `## Key Concepts`, `## Questions`) is the planner's proposal. User may want different section titles — confirm before phase 4 begins.

#### Item 2 — Crawl circuit breaker (code-level)
- **Choice**: Option A — new MCP tool `learning_crawl_guard`, fails closed, with `begin`/`check`/`record`/`end` actions. Option B (file-only decrement via hook) rejected because hook can be skipped by a rogue agent; MCP enforcement is observable.
- **Files touched**: `phase-3-mcp-server.md` (new tasks 3.10/3.11 + 3.9 depends_on update + deliverable bump to 5 tools), `phase-4-agents.md` (researcher §4.2 now lists `learning_crawl_guard` as a mandatory pre-fetch step + depends_on 3.11), `risks.md` (R3 updated to cite enforcement), `overview.md` (tool count now 5), `notes.md` (D13).
- **New tasks**: 3.10 (RED: crawl-guard handler tests), 3.11 (GREEN: crawl-guard handler). Task 3.9 now depends on 3.11 additionally.
- **Open question**: default token limit of 50000 is a planner guess. Real usage may need revision after phase 0.5 spike.

#### Item 3 — cycle-detect orphan claim
- **Choice**: rewrite resume skill step 2 to use `learning_status` directly. Mark `hooks/lib/cycle-detect.mjs` as hook-internal only. No new MCP tool (option: "rewrite, not add").
- **Files touched**: `phase-5-skills.md` (§5.5 rewritten), `phase-3-mcp-server.md` (Scope §NOT built now explicitly lists "no learning_cycle_detect tool"), `phase-6-hooks.md` (§6.2 cycle-detect is marked hook-internal with file header comment), `notes.md` (D14).
- **New tasks**: none. Adjusts acceptance of 5.5 and 5.10 (grep checks).
- **Open question**: none.

#### Item 4 — Push-tactic injection into sub-agents
- **Choice**: Option A — skill reads `push-tactics.md`, passes `push_tactic_snapshot` as structured arg. Tactic-aware agents: researcher, creator, evaluator, profiler. Tactic-blind (deliberately): planner, critic, wiki-maintainer, dashboard-builder, git-manager.
- **Files touched**: `phase-4-agents.md` (new §Push-Tactic Injection Contract + calling-spec updates for 4.2/4.5/4.6/4.7 + new task 4.12 + registry table now includes tactic-aware column), `phase-5-skills.md` (§5.3/§5.4/§5.6 steps read push-tactics and pass snapshot), `overview.md` (glossary), `notes.md` (D15).
- **New tasks**: 4.12 (RED+GREEN: push-tactic injection integration test). Task 4.11 now depends on 4.12 additionally.
- **Open question**: `bar_adjustment` values {strict, standard, lenient} are planner-proposed; real spike in phase 0.5 may reveal need for finer levels.

#### Item 5 — Stop vs SubagentStop race
- **Choice**: add `course_state.last_advance_sig` to status.json schema + compare-and-swap helper `state.advanceIfNewSig`. Both hooks compute same sig; second call observes match and returns `{advanced:false, reason:'sig_match'}`.
- **Files touched**: `phase-6-hooks.md` (new §Stop vs SubagentStop Race + 6.1/6.2/6.7/6.8 task updates), `phase-3-mcp-server.md` (task 3.2 course-state.mjs grows from 70 to 80 LOC to include `last_advance_sig`), `phase-3-mcp-server.md` (task 3.6 DEFAULT_STATUS update), `notes.md` (D16), `risks.md` (R16 new).
- **New tasks**: none new (tests 6.7#8, 6.7#9, 6.7#10 added to existing task; 6.1#10, 6.1#11 added; GREEN work subsumed in existing 6.2/6.8). Total tests in phase 6 grew ~5.
- **Open question**: none. Idempotency contract is complete.

#### Item 6 — Real-LLM validation earlier
- **Choice**: Option A — dedicated phase 0.5 as a gate between phase 3 (schemas green) and phases 4/5/6. Gate outcome: PROCEED / PATCH / ABORT. Phases 1, 2, 3, 7 are independent of the spike outcome.
- **Files touched**: new file `phase-0.5-real-llm-spike.md`, `overview.md` (phase index + DAG updated), `checklist.json` (new phase + depends_on graph updates), `risks.md` (R4/R6/R10 updates + R17 new), `notes.md` (D17).
- **New tasks**: 0.5.1 (RED/GREEN: write spike script), 0.5.2 (analyze + gate decision + notes.md Revision Log entry).
- **Open question**: what constitutes a "PROCEED" threshold for profile output quality is subjective; planner proposes "validates on schema first try + cites push_tactic in session-log entry". User may want tighter criteria.

### Early Abort Trigger (phase 0.5)

If the phase 0.5 spike returns ABORT, do NOT continue into phase 4. Instead:
1. Mark tasks 4.x, 5.x, 6.x in `checklist.json` as `status: "blocked"`.
2. Reopen phase-0 + phase-3 schemas in a micro-revision cycle with the architect.
3. Re-run the spike (task 0.5.1 is idempotent on fresh fixture).
4. Only after PROCEED or PATCH does phase 4 start.

This exists because 45 dependent tasks are too expensive to write on an untested contract.

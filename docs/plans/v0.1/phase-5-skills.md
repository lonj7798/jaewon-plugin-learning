# Phase 5 — Core Skills

<!-- scope: 8 skill folders, each SKILL.md + optional scripts, driving the teaching loop -->
<!-- deps: phase-3-mcp-server.md, phase-4-agents.md -->
<!-- see-also: phase-6-hooks.md, phase-8-smoke-test.md -->

## Metadata

- **Phase**: 5
- **Depends on**: 0, 2, 3, 4
- **Estimated effort**: 1.5 days
- **Deliverable**: 8 skill folders under `jaewon-plugin-learning/skills/`, plus a dispatch map.

## Scope

### Built
- `setup-learning-wiki/`, `new-course/`, `learn/`, `resume/`, `verdict/`, `wiki-lint/`, `dashboard/`, `profile-review/`.
- `skills/_dispatcher.mjs` (name -> SKILL.md path map; LOD Pattern 8).
- Shape tests + flow tests.
- Skill-level push-tactic injection: `new-course`, `learn`, and `verdict` skills read `wiki/learner/push-tactics.md` once at entry, select a tactic, and pass `push_tactic_snapshot` as a structured argument to every tactic-aware agent they invoke (see phase-4 §Push-Tactic Injection Contract).

### NOT built
- Hook integration (phase 6).
- Dashboard generator internals (phase 7).

## Task Breakdown

### Task 5.1 — RED: skill shape tests
- **Files**: `tests/phase-5/skill-shapes.test.mjs` (~150 LOC)
- **Parallel**: false
- **depends_on**: []
- **Test cases** (per skill):
  1. Skill folder exists.
  2. `SKILL.md` has YAML frontmatter with `name`, `description`, and keyword triggers.
  3. SKILL.md <= 100 LOC.
  4. Includes `<Purpose>`, `<Use_When>`, `<Do_Not_Use_When>`, `<Execution_Policy>`, `<Steps>` blocks (mirrors `raw-data/jaewon-plugin/skills/implement/SKILL.md:1-35`).
  5. Every step references either a specific agent by name (from phase-4 registry) or an MCP tool (from phase-3) — no free-floating LLM calls.
  6. **New**: `new-course`, `learn`, and `verdict` skills each contain the literal token `push_tactic_snapshot` in at least one Task() invocation description — verifies injection path (revision 2).
- **Acceptance**: 48 failing assertions (8 skills x 6 checks).

### Task 5.2 — GREEN: setup-learning-wiki
- **Files**: `skills/setup-learning-wiki/SKILL.md` (~80 LOC)
- **Parallel**: true
- **depends_on**: [5.1]
- **Steps in prompt**:
  1. Detect if CWD has `.jaewon-learning/` — if yes, announce and exit.
  2. Detect if CWD is a wiki-template fork (look for `wiki/` + `SCHEMA.md`). If no, instruct user to fork `wiki-template` and re-run from inside the fork.
  3. Create `.jaewon-learning/` with default settings.json + status.json.
  4. Confirm `wiki/learner/*.md` exists (template provides stubs).
  5. Print next-step: `/learn new-course <input>`.
- **Acceptance**: passes 6 shape checks (tactic-injection check is N/A-by-absence for setup-learning-wiki; the test treats absence as pass for skills not in the injection set).

### Task 5.3 — GREEN: new-course skill
- **Files**: `skills/new-course/SKILL.md` (~100 LOC)
- **Parallel**: true
- **depends_on**: [5.1]
- **Steps in prompt**:
  1. Accept input: local path OR GitHub URL (auto-detect).
  2. Ask user for course slug (suggest kebab-case from source name).
  3. **Load push-tactics**: Read `wiki/learner/push-tactics.md`; hash its contents (sha-short); select one tactic per the rubric; construct `push_tactic_snapshot = {tactic, rationale, bar_adjustment, source_pages_hash}`.
  4. Spawn `git-manager` to create `course/<slug>` branch from main.
  5. Spawn `researcher` agent with `{course_slug, source, breadth, push_tactic_snapshot}`.
  6. Spawn `planner` agent with crawl-manifest path (tactic-blind; no snapshot passed).
  7. Spawn `critic` agent with outline draft (tactic-blind).
  8. If critic returns REVISE, re-invoke planner (bounded to 3 iterations — LOD Pattern 9 Feedback Loop).
  9. Print outline.md; prompt user to approve, edit, or reject. On approve, promote draft to `wiki/courses/<slug>/outline.md`.
  10. Scaffold `wiki/courses/<slug>/<chapter>/` folders for every chapter in the outline (empty).
  11. Spawn `git-manager` to commit `feat(course): init <slug>`.
  12. Update `.jaewon-learning/status.json`: `plan.phase='new-course'`, `course_state.current_course=<slug>`, `course_state.current_chapter=<first chapter>`, `course_state.current_phase='read'`, `course_state.last_push_tactic_snapshot=<snapshot>`.
  13. Print next-step: `/learn`.
- **Acceptance**: passes 6 shape checks (including push_tactic_snapshot presence); flow diagram in SKILL.md matches overview.md §3.

### Task 5.4 — GREEN: learn skill (thin orchestrator)
- **Files**: `skills/learn/SKILL.md` (~100 LOC)
- **Parallel**: true
- **depends_on**: [5.1]
- **Steps in prompt** (Orchestrator Recipe — LOD Pattern 5, NO business logic):
  1. Call `learning_status` MCP tool to get `{course, chapter, phase, last_push_tactic_snapshot}`.
  2. **Load or refresh push-tactics**: Read `wiki/learner/push-tactics.md`; compute hash. If hash differs from `last_push_tactic_snapshot.source_pages_hash` or snapshot missing, re-select tactic and build a fresh `push_tactic_snapshot`. Otherwise reuse the stored snapshot.
  3. Dispatch by current phase (table-driven; no switch chains):
     - `read`: spawn creator with `{outline_chapter, raw_sources, push_tactic_snapshot}`; interactive QA in main session until learner signals "move on"; spawn wiki-maintainer for index update (tactic-blind); spawn git-manager for commit (tactic-blind).
     - `summarize`: instruct learner to write `summary.md`; teacher stays silent; on completion, spawn git-manager.
     - `discuss`: main session runs interrogation using `push_tactic_snapshot.tactic`; stream transcript into `discuss.md`; on completion -> invoke `/verdict` skill (passes snapshot forward via status.json).
  4. After any phase commit, re-read status to decide next phase.
- **Acceptance**: passes 6 shape checks; grep `switch|if.*phase==` finds zero chains — dispatch must be table-driven; grep finds `push_tactic_snapshot` in creator invocation.

### Task 5.5 — GREEN: resume skill (revision 2: removed orphan cycle-detect MCP projection claim)
- **Files**: `skills/resume/SKILL.md` (~80 LOC)
- **Parallel**: true
- **depends_on**: [5.1]
- **Steps**:
  1. Call `learning_status` MCP tool; receive `{plan.phase, course_state.current_course, course_state.current_chapter, course_state.current_phase, course_state.cycle_count, course_state.verdict_history, course_state.last_push_tactic_snapshot}` directly.
  2. Derive activity state from the returned status fields alone. **No MCP projection, no cycle-detect tool call.** `hooks/lib/cycle-detect.mjs` remains hook-internal only; the skill does not call it. (Revision 2, item 3.)
  3. If `course_state.current_course` is null, print "No active course — run /learn new-course".
  4. If multiple historical courses exist with non-mastery terminal verdict, list them and ask user to pick (first implementation: assume single-course per A6; print list for future multi-course support).
  5. Print context: course, chapter, phase, cycle count, verdict history tail, last push-tactic + bar_adjustment, last commit sha (from `git rev-parse HEAD`).
  6. Hand off to `/learn` skill. No writes.
- **Acceptance**: passes 6 shape checks; grep confirms `learning_status` is the only MCP call; grep confirms NO reference to `cycle-detect`, `cycle_detect`, or any MCP projection.

### Task 5.6 — GREEN: verdict skill
- **Files**: `skills/verdict/SKILL.md` (~85 LOC)
- **Parallel**: true
- **depends_on**: [5.1]
- **Steps**:
  1. Read `push_tactic_snapshot` from `course_state.last_push_tactic_snapshot` via `learning_status`; if missing or stale hash, rebuild from `wiki/learner/push-tactics.md`.
  2. Spawn `evaluator` agent with `{summary_path, discuss_transcript_path, raw_source_index, push_tactic_snapshot}`.
  3. Call `learning_verdict` MCP tool with evaluator's output.
  4. Spawn `profiler` agent with `{discuss_transcript_path, verdict_path, push_tactic_snapshot}` (unconditional after any discuss).
  5. Dispatch on verdict.next_action (dict dispatch, no switch):
     - `merge`: spawn git-manager (merge `course/<slug>` into `main`); spawn dashboard-builder; spawn git-manager (commit dashboard + tag milestone).
     - `rediscuss`: update status to `phase=discuss, cycle_iteration++`.
     - `reread`: update status to `phase=read`.
  6. Bounded loop: if cycle_iteration > 3 for same chapter, escalate to learner (print block + ask to adjust push-tactics).
- **Acceptance**: passes 6 shape checks.

### Task 5.7 — GREEN: wiki-lint, dashboard, profile-review
- **Files**:
  - `skills/wiki-lint/SKILL.md` (~60 LOC) — delegates to `wiki-maintainer` lint operation.
  - `skills/dashboard/SKILL.md` (~70 LOC) — spawns `dashboard-builder`, optional publish.
  - `skills/profile-review/SKILL.md` (~70 LOC) — prints learner profile; optional user-edit handoff (prints instructions only; user edits manually).
- **Parallel**: true
- **depends_on**: [5.1]
- **Acceptance**: each passes 6 shape checks (tactic check is N/A for these three; test config excludes them from the injection-set check).

### Task 5.8 — RED: end-to-end learn-cycle flow test (mocked)
- **Files**: `tests/phase-5/learn-flow.test.mjs` (~200 LOC)
- **Parallel**: false
- **depends_on**: [5.4, 5.6]
- **Test cases** (using fixture wiki + mock agent outputs):
  1. `flow_read_to_summarize_via_status_update` — call status_update mock, expect phase transition.
  2. `flow_discuss_to_verdict_invokes_evaluator_and_profiler`.
  3. `flow_mastery_verdict_triggers_merge_and_dashboard`.
  4. `flow_partial_verdict_loops_without_merge`.
  5. `flow_incomplete_verdict_returns_to_read_phase`.
  6. **New**: `flow_push_tactic_snapshot_propagates_to_evaluator_and_profiler_mocks` — asserts the mock Task() invocations for evaluator and profiler received a structured snapshot with the expected tactic + source_pages_hash.
- **Acceptance**: 6/6 failing until 5.9 completes.

### Task 5.9 — GREEN: skills/_dispatcher.mjs
- **Files**: `skills/_dispatcher.mjs` (~40 LOC)
- **Parallel**: false
- **depends_on**: [5.8]
- **Calling spec**:
  ```
  dispatch(skillName: string, args: object) -> { skill_path: string, args: object }
  input: skill name from user slash command
  output: { skill_path, args } (pure lookup)
  side effects: none
  deterministic: YES
  ```
- **Acceptance**: 6/6 from 5.8 pass.

### Task 5.10 — REFACTOR: cross-check
- **Files**: (none new)
- **depends_on**: [5.2-5.9]
- **Actions**:
  - Grep that each skill mentions at least one agent from phase-4 registry.
  - Grep that each skill mentions at least one MCP tool from phase-3.
  - Verify `/learn` skill contains zero explicit phase logic (only dispatches).
  - **New**: grep that `new-course`, `learn`, `verdict` all contain `push_tactic_snapshot`.
  - **New**: grep that `resume` contains `learning_status` but NOT `cycle-detect` / `cycle_detect`.
- **Acceptance**: grep passes all five checks.

## Phase Quality Gate

- All 8 SKILL.md files present, each <= 100 LOC.
- 48 shape assertions + 6 flow assertions pass.
- `skills/_dispatcher.mjs` is a pure dict lookup.
- No skill contains business logic duplicated from agents.
- `resume` skill derives state solely from `learning_status`; no orphan cycle-detect reference.
- Push-tactic injection path verified at mock level (full LLM verification is phase-0.5's job).

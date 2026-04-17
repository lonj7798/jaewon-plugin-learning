# Phase 8 — End-to-End Smoke Test

<!-- scope: ingest a small GitHub repo, run one full cycle, verify wiki + profile + dashboard + merge -->
<!-- deps: phases 1-7 -->
<!-- see-also: overview.md §2, risks.md -->

## Metadata

- **Phase**: 8
- **Depends on**: 1, 2, 3, 4, 5, 6, 7 (all)
- **Estimated effort**: 0.5 day
- **Deliverable**: an automated smoke script that takes the plugin from zero to a merged course on a fixture repo, plus documentation of manual verification points.

## Scope

### Built
- `jaewon-plugin-learning/tests/e2e/smoke.test.mjs` — orchestrates fixture setup -> full cycle -> artifact checks.
- Test fixture: `tests/fixtures/tiny-transformer/` — a 200-LOC self-contained mini-GPT implementation (3-4 files, 1 readme, 2 chapters of material) so the smoke test runs under 2 minutes.
- `tests/e2e/mock-agents.mjs` — deterministic mocks for researcher/planner/critic/creator/evaluator/profiler (the smoke test does NOT exercise real LLMs; it verifies plumbing).
- Manual-verification checklist in `docs/plans/v0.1/notes.md` (already referenced).

### NOT built
- Real LLM end-to-end test — that requires live API keys and is a release gate, not a plan gate. Tracked in risks.md.
- Performance benchmarking.

## Task Breakdown

### Task 8.1 — RED: smoke test scaffold
- **Files**: `tests/e2e/smoke.test.mjs` (~200 LOC)
- **Parallel**: false
- **depends_on**: []
- **Test cases** (each a distinct assertion stage; serial within the test):
  1. `stage_1_setup_wiki_fork_fixture` — copy `wiki-template/` to a tmp dir; `git init`; commit.
  2. `stage_2_invoke_setup_learning_wiki_creates_jaewon_learning_dir`.
  3. `stage_3_new_course_on_tiny_transformer_creates_course_branch` — mocks researcher+planner+critic; asserts branch `course/tiny-transformer` exists and `wiki/courses/tiny-transformer/outline.md` is valid per outline schema.
  4. `stage_4_learn_read_phase_writes_read_md_and_commits`.
  5. `stage_5_learn_summarize_phase_accepts_summary_md`.
  6. `stage_6_learn_discuss_phase_writes_discuss_md`.
  7. `stage_7_verdict_mastery_triggers_merge_to_main`.
  8. `stage_8_profiler_updates_learner_files_after_discuss` — assert all 5 `wiki/learner/*.md` have a new non-empty entry.
  9. `stage_9_dashboard_builder_regenerates_html` — asserts `dashboard/index.html`, `dashboard/tiny-transformer.html`, `dashboard/profile.html`, `dashboard/timeline.html` exist and are non-empty.
  10. `stage_10_status_json_reflects_completed_course` — `course_state.verdict_history[0] === 'mastery'`, `plan.phase === 'idle'`.
  11. `stage_11_wiki_lint_finds_zero_broken_links`.
  12. `stage_12_every_wiki_page_under_120_lines`.
  13. `stage_13_every_plugin_code_file_under_800_loc` — enforces LOD Rule 1 repo-wide.
- **Acceptance**: 13/13 stages failing initially (phase 8 starts before any green glue exists).

### Task 8.2 — GREEN: mock agents
- **Files**: `tests/e2e/mock-agents.mjs` (~180 LOC)
- **Parallel**: false
- **depends_on**: [8.1]
- **Calling spec**:
  ```
  mockAgentResult(agentName: string, inputs: object) -> { stdout: string, writes: Array<{path,content}> }
  side effects: none (pure function that returns planned writes; caller applies them).
  deterministic: YES.
  ```
- **Fixtures**:
  - Researcher mock: returns a 3-source crawl-manifest for tiny-transformer.
  - Planner mock: returns 2-chapter outline (intro, attention).
  - Critic mock: APPROVE.
  - Creator mock: returns fixture read.md content.
  - Evaluator mock: returns `{verdict:'mastery', evidence:['covered attention'], next_action:'merge', cycle_iteration:1}`.
  - Profiler mock: returns 5 profile-delta writes.
- **Acceptance**: stages 3-9 pass when smoke test calls mock dispatcher.

### Task 8.3 — GREEN: smoke runner
- **Files**: `tests/e2e/runner.mjs` (~150 LOC)
- **Parallel**: false
- **depends_on**: [8.2]
- **Role**: orchestrate the stages. Uses real hooks + real MCP handlers + real skills' logic paths, but substitutes mock agents for Task() calls.
- **Calling spec**:
  ```
  runSmoke(opts: {fixture: string, tmpDir: string}) -> SmokeReport { stages: [{name,status,duration_ms,errors}] }
  side effects: writes under tmpDir.
  ```
- **Acceptance**: all 13 stages from 8.1 pass.

### Task 8.4 — REFACTOR: repo-wide LOD lint
- **Files**: `jaewon-plugin-learning/tests/lod-lint.mjs` (~80 LOC)
- **Parallel**: false
- **depends_on**: [8.3]
- **Actions**:
  - Walk `jaewon-plugin-learning/**/*.{mjs,js,md}` excluding `node_modules`, `tests/fixtures/`.
  - Fail if any file > 800 LOC.
  - Fail if any agent/SKILL.md > 200 LOC (soft warn over 120).
  - Fail if any single function > 50 LOC (parsed via simple `function\s+\w+|=>\s*{` pattern counts).
  - Wire into `npm test` via `tests/run-all.mjs`.
- **Acceptance**: lint passes on the fully-built plugin. Stage 13 of smoke test redundantly calls this.

### Task 8.5 — DOCS: manual verification script in notes.md
- **Files**: update `docs/plans/v0.1/notes.md` (no new file)
- **Parallel**: false
- **depends_on**: [8.3]
- **Content**: one-page runbook for a human to do a real-LLM end-to-end on the `tiny-transformer` fixture (install plugin, fork wiki-template, run `/learn new-course`, run `/learn` once, verify artifacts manually). This is the release gate, deferred beyond v0.1 plan acceptance.
- **Acceptance**: notes.md contains a section titled "Real-LLM smoke runbook" with 10 numbered steps.

## Phase Quality Gate

- `npm test` in plugin dir: all 8 phase suites green, including 13/13 smoke stages.
- Repo-wide LOD lint: zero violations (confirmed by stage 13 AND Task 8.4).
- No `fs.write*` calls occur outside the expected allow-list (`.jaewon-learning/`, `wiki/`, `dashboard/`) — verified by Task 8.1 stage 9 indirectly and by git diff audit after the run.
- Smoke test runs in under 2 minutes on a modern laptop (mocks make this trivial; tracked so we notice regressions).

## Exit criteria for v0.1

When this phase is green AND `notes.md` has confirmations from the user on the 4 open items (input format, dashboard publish, resume UX, session log format), the plan is complete and ready for the executor to implement. A v0.2 post-mortem should document divergence from this plan.

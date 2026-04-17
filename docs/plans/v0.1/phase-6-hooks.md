# Phase 6 — Hooks

<!-- scope: SessionStart, UserPromptSubmit, Stop, SubagentStop, SessionEnd — load profile, nudge, advance state -->
<!-- deps: phase-2-plugin-skeleton.md, phase-3-mcp-server.md, phase-4-agents.md -->
<!-- see-also: phase-5-skills.md, phase-8-smoke-test.md -->

## Metadata

- **Phase**: 6
- **Depends on**: 2, 3 (needs schemas + state libs including `course_state.last_advance_sig`)
- **Parallelizable with**: 5 (disjoint file sets) and 7
- **Estimated effort**: 1 day
- **Deliverable**: 5 hook scripts wired in `hooks.json`, each deterministic or with validated adapter boundaries, with an idempotent state-advance contract.

## Stop vs SubagentStop Race — Ordering Contract (new in revision 2)

**Problem**: when the evaluator sub-agent completes, Claude may fire `SubagentStop` and `Stop` in undefined order (or both, depending on how the outer Task was used). Both hook cases in this phase can advance `course_state.cycle_iteration`, leading to double-advance.

**Contract**:
- `course_state.last_advance_sig` is a string stored in status.json. Its value is a deterministic hash of the last advance event: `sha1(agent_name + verdict_path + verdict_file_mtime_ms)` when the advance was triggered by evaluator completion.
- Every advance path (stop.mjs and subagent-stop.mjs) computes the expected sig BEFORE writing and aborts the write if `status.course_state.last_advance_sig` already equals it. Writes are atomic (read-compute-write-if-unchanged via compare-and-swap within a single fs.writeFile).
- Ordering: both hooks MAY fire; at most one advance is recorded.
- Visibility: the sig is exposed via `learning_status` for test inspection.

## Scope

### Built
- `hooks/lib/{settings,state,learner-profile,cycle-detect}.mjs`. `cycle-detect.mjs` is **hook-internal only** (not exposed via any MCP tool; see phase-3 Scope and phase-5.5).
- `hooks/{session-start,user-prompt-submit,stop,subagent-stop,session-end}.mjs`.
- Idempotent advance guard via `last_advance_sig`.

### NOT built
- HUD statusline (phase 7 — grouped with dashboard).
- Dashboard auto-publish on merge (phase 7).

## Task Breakdown

### Task 6.1 — RED: hooks/lib tests (deterministic cores)
- **Files**: `tests/phase-6/hook-libs.test.mjs` (~200 LOC)
- **Parallel**: false
- **depends_on**: []
- **Test cases**:
  1. `settings_mjs_returns_defaults_on_missing` — mirrors base at `raw-data/jaewon-plugin/hooks/lib/settings.mjs:73-89`.
  2. `settings_mjs_resolves_base_placeholder`.
  3. `state_mjs_readStatus_returns_defaults` — defaults include `course_state.last_advance_sig: null`.
  4. `state_mjs_saveStatus_writes_last_updated`.
  5. `learner_profile_loadLearnerProfile_reads_five_pages`.
  6. `learner_profile_summarizeForContext_truncates_to_maxChars`.
  7. `cycle_detect_detectCycle_idle_when_no_course`.
  8. `cycle_detect_detectCycle_derives_phase_from_status`.
  9. `cycle_detect_detectCycle_pure_function` — same input produces same output across 100 calls.
  10. **New**: `state_mjs_advance_with_sig_is_idempotent` — calling advance twice with the same sig writes once; second call is a noop and returns `{advanced:false, reason:'sig_match'}`.
  11. **New**: `state_mjs_advance_with_different_sig_updates` — distinct sigs produce distinct writes.
- **Acceptance**: 11/11 failing.

### Task 6.2 — GREEN: hook libs
- **Files**:
  - `hooks/lib/settings.mjs` (~80 LOC) — fork of `raw-data/jaewon-plugin/hooks/lib/settings.mjs:1-93`; default `base_dir: '.jaewon-learning'`.
  - `hooks/lib/state.mjs` (~100 LOC; grew from 90) — fork of `raw-data/jaewon-plugin/hooks/lib/state.mjs:1-85`; DEFAULT_STATUS extended with `course_state` subtree including `last_advance_sig: null`; adds `advanceIfNewSig(status, newSig, mutator)` helper that compare-and-swaps.
  - `hooks/lib/learner-profile.mjs` (~100 LOC).
  - `hooks/lib/cycle-detect.mjs` (~70 LOC; PURE; hook-internal — file header comment states "Not exposed via MCP; call from hooks only").
- **Parallel**: false
- **depends_on**: [6.1]
- **Calling specs**: phase-0 §6.4, §6.5.
  - `advanceIfNewSig(status, newSig, mutator) -> {advanced:boolean, status:Status, reason?:string}` — pure function; caller persists the returned status.
- **Acceptance**: 11/11 from 6.1 pass.

### Task 6.3 — RED: session-start hook tests
- **Files**: `tests/phase-6/session-start.test.mjs` (~140 LOC)
- **Parallel**: true (with 6.4, 6.5)
- **depends_on**: [6.2]
- **Test cases**:
  1. `session_start_creates_jaewon_learning_dir_if_missing`.
  2. `session_start_emits_systemMessage_containing_plugin_banner`.
  3. `session_start_injects_learner_profile_summary_when_profile_exists`.
  4. `session_start_injects_active_course_chapter_phase_when_on_course_branch`.
  5. `session_start_emits_wiki_staleness_warning_if_3plus_sessions_since_last_log` — mirrors `raw-data/jaewon-plugin/hooks/session-start.mjs:116-131`.
  6. `session_start_exit_code_zero_on_error` — never blocks Claude (mirrors base hook contract).
- **Acceptance**: 6/6 failing.

### Task 6.4 — GREEN: session-start.mjs
- **Files**: `hooks/session-start.mjs` (~150 LOC)
- **Parallel**: false
- **depends_on**: [6.3]
- **Calling spec**: phase-0 §6.7.
- **Structure**:
  1. Read stdin (via `lib/stdin.mjs`).
  2. Ensure `.jaewon-learning/` exists with defaults.
  3. Load status; get current branch; run `cycle-detect`.
  4. Load learner profile via `lib/learner-profile.mjs`; summarize.
  5. Assemble systemMessage: banner + cycle state + profile summary + HUD line + staleness warning.
  6. `console.log(JSON.stringify({systemMessage}))`; exit 0.
- **Acceptance**: 6/6 from 6.3 pass.

### Task 6.5 — RED: user-prompt-submit tests
- **Files**: `tests/phase-6/user-prompt-submit.test.mjs` (~90 LOC)
- **Parallel**: true
- **depends_on**: [6.2]
- **Test cases**:
  1. `nudge_noop_when_not_in_active_cycle`.
  2. `nudge_noop_when_prompt_looks_on_task` — heuristic: mentions chapter title OR contains discuss/summary keywords.
  3. `nudge_injected_when_cycle_active_and_prompt_off_topic` — adds systemMessage reminder of current phase.
  4. `nudge_never_blocks` — decision field not 'block'.
- **Acceptance**: 4/4 failing.

### Task 6.6 — GREEN: user-prompt-submit.mjs
- **Files**: `hooks/user-prompt-submit.mjs` (~90 LOC)
- **Parallel**: false
- **depends_on**: [6.5]
- **Calling spec**:
  ```
  INPUT stdin: UserPromptSubmit event JSON.
  OUTPUT stdout: either '' or {systemMessage: '...nudge...'}. Never {decision:'block'}.
  SIDE EFFECTS: none (read-only on fs).
  DETERMINISM: deterministic adapter (uses sealed cycle-detect + tiny keyword heuristic).
  ```
- **Acceptance**: 4/4 from 6.5 pass.

### Task 6.7 — RED: stop + subagent-stop tests (revision 2: adds race guard tests)
- **Files**: `tests/phase-6/stop-hooks.test.mjs` (~200 LOC, grew from 160)
- **Parallel**: true
- **depends_on**: [6.2]
- **Test cases**:
  1. `stop_allows_exit_when_no_active_cycle`.
  2. `stop_nudges_profiler_after_discuss_finishes` — if phase=discuss and verdict file written but profiler not yet run, emit systemMessage suggesting `/verdict`. Never blocks.
  3. `stop_respects_stop_hook_active_flag` — infinite-loop guard (mirrors `raw-data/jaewon-plugin/hooks/stop-guard.mjs:28-30`).
  4. `subagent_stop_evaluator_advances_state` — fake evaluator completion, assert status phase transition AND `last_advance_sig` updated to the expected hash.
  5. `subagent_stop_profiler_completion_logs_to_session_log_md`.
  6. `subagent_stop_git_manager_completion_noop` — no state change required.
  7. `subagent_stop_ignores_unknown_agent`.
  8. **New**: `subagent_stop_advances_once_even_if_stop_fires_first` — simulate Stop hook handling evaluator completion first (writes sig S1); then SubagentStop fires with same evaluator + same verdict file: expect NO double advance (status.course_state.cycle_iteration unchanged since the first advance; hook returns `{advanced:false, reason:'sig_match'}`).
  9. **New**: `stop_advances_once_even_if_subagent_stop_fires_first` — mirror case: SubagentStop writes sig S1; then Stop fires and observes same sig: NO double advance.
  10. **New**: `distinct_evaluator_runs_produce_distinct_sigs` — second real evaluator run (different verdict.json mtime) produces sig S2 != S1 and advances normally.
- **Acceptance**: 10/10 failing.

### Task 6.8 — GREEN: stop.mjs + subagent-stop.mjs (revision 2: adds sig-guarded advance)
- **Files**:
  - `hooks/stop.mjs` (~120 LOC, grew from 110)
  - `hooks/subagent-stop.mjs` (~140 LOC, grew from 130)
- **Parallel**: false
- **depends_on**: [6.7]
- **Calling specs**:
  ```
  stop.mjs:
    INPUT stdin: Stop event JSON { stop_hook_active?, cwd?, ... }.
    OUTPUT: either exit 0 silently OR {systemMessage: nudge} (never block).
    SIDE EFFECTS: may advance status via advanceIfNewSig when a verdict.json is freshly written and evaluator was the stopping agent.

  subagent-stop.mjs:
    INPUT stdin: SubagentStop event with agent name + last message.
    OUTPUT: either '' or {systemMessage: update summary}.
    SIDE EFFECTS: advances status.json (phase transition, cycle count, last_advance_sig) when evaluator finishes, via advanceIfNewSig — idempotent.
  ```
- **Ordering policy** (documented in both file headers):
  - Both hooks compute `sig = sha1(agent_name + verdict_path + verdict_file_mtime_ms)` before attempting advance.
  - Both call `state.advanceIfNewSig(status, sig, mutator)`.
  - The second caller observes `status.course_state.last_advance_sig === sig` and returns `{advanced:false, reason:'sig_match'}`. This is a normal path, not an error.
  - Neither hook retries; idempotency is the contract.
- **Key dispatch** (LOD Pattern 8):
  ```
  const AGENT_HANDLERS = {
    evaluator: handleEvaluatorStop,   // computes sig, calls advanceIfNewSig
    profiler: handleProfilerStop,
    git_manager: noop,
    researcher: logCompletion,
    // ... etc
  };
  ```
- **Acceptance**: 10/10 from 6.7 pass.

### Task 6.9 — RED: session-end tests
- **Files**: `tests/phase-6/session-end.test.mjs` (~100 LOC)
- **Parallel**: true
- **depends_on**: [6.2]
- **Test cases**:
  1. `session_end_appends_wiki_log_entry` — mirrors `raw-data/jaewon-plugin/hooks/session-end.mjs:71-77`.
  2. `session_end_writes_handoff_md_for_next_session`.
  3. `session_end_commits_pending_phase_work_via_git_manager_nudge`.
  4. `session_end_updates_status_last_end_timestamp`.
- **Acceptance**: 4/4 failing.

### Task 6.10 — GREEN: session-end.mjs
- **Files**: `hooks/session-end.mjs` (~130 LOC)
- **Parallel**: false
- **depends_on**: [6.9]
- **Source**: fork of `raw-data/jaewon-plugin/hooks/session-end.mjs`.
- **Diff**: swap `checklist.json` references for `course_state`; add `wiki/log.md` append logic verbatim.
- **Acceptance**: 4/4 from 6.9 pass.

### Task 6.11 — REFACTOR: hooks.json wire-up
- **Files**: `hooks/hooks.json` (update)
- **Parallel**: false
- **depends_on**: [6.4, 6.6, 6.8, 6.10]
- **Actions**:
  - Register 5 events -> 5 scripts (plus run.cjs shim, mirrors base at `raw-data/jaewon-plugin/hooks/hooks.json:1-134`).
  - Timeout policy: SessionStart 5s, UserPromptSubmit 2s, Stop 3s, SubagentStop 5s, SessionEnd 10s.
  - Smoke test: run each hook with a canned stdin JSON and assert exit 0.
- **Acceptance**: 5 smoke invocations pass.

## Phase Quality Gate

- All hook test suites green (6.1, 6.3, 6.5, 6.7, 6.9) — ~35 assertions total (grew from ~30 with race-guard tests).
- `hooks/hooks.json` registers exactly 5 events.
- No hook script exceeds 150 LOC.
- No hook emits `decision:'block'` except Stop (which does not block, per requirement; it only nudges).
- All hooks exit 0 on any caught error (mirrors base convention `raw-data/jaewon-plugin/hooks/session-start.mjs:153`).
- **Race guard**: evaluator-completion advance is idempotent per evaluator run; verified by tests 6.7#8 and 6.7#9.

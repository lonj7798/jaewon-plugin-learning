# Phase 4 — Core Agents

<!-- scope: 9 agent markdown files with calling specs + shape tests + push-tactic injection + crawl-guard wiring -->
<!-- deps: phase-0-architecture.md, phase-2-plugin-skeleton.md, phase-3-mcp-server.md (learning_crawl_guard), phase-0.5-real-llm-spike.md -->
<!-- see-also: phase-5-skills.md, phase-8-smoke-test.md -->

## Metadata

- **Phase**: 4
- **Depends on**: 0, 2, 3 (needs `learning_crawl_guard` tool), 0.5 (real-LLM spike must PROCEED before committing to the adaptive-voice design)
- **Parallelizable with**: 3 for agents that do not reference crawl_guard (non-researcher agents may begin in parallel with phase 3 once 3.2 green)
- **Estimated effort**: 1 day
- **Deliverable**: 9 agent `.md` files under `jaewon-plugin-learning/agents/`, each self-contained, <= 120 LOC, with YAML header, calling spec, operations, constraints, output format — mirroring the pattern at `raw-data/jaewon-plugin/agents/wiki-maintainer.md:1-206`.

## Scope

### Built
- Agent prompt files (markdown) for: researcher, planner, critic, creator, profiler, evaluator, wiki-maintainer (forked), dashboard-builder, git-manager (forked).
- Shape tests that verify each agent's YAML header and required sections.
- Push-tactic injection contract: researcher, creator, evaluator, profiler all accept a `push_tactic_snapshot` argument from their caller (skill); no sub-agent reads `push-tactics.md` directly. See §Push-Tactic Injection Contract below.

### NOT built
- Any executable code. Agents are prompts; orchestration lives in skills (phase 5) and hooks (phase 6).

## Push-Tactic Injection Contract (new in revision 2)

**Problem**: spec §2 + §10 require adaptive voice observably different next session. Only `skills/learn` read `wiki/learner/push-tactics.md` in rev 1 — sub-agents were tactic-blind. Selected Option A (injection by caller).

**Contract**:
- **Skill-level read**: `skills/learn` and `skills/new-course` and `skills/verdict` read `wiki/learner/push-tactics.md` once per cycle entry and select one active tactic from the 5 {interrogator, debater, examiner, coach, blend}.
- **Agent-level receive**: the selected tactic is passed as a structured `push_tactic_snapshot` argument to the Task() invocation of tactic-aware agents. Agents never read the file directly.
- **Tactic-aware agents (receive the snapshot)**: `researcher`, `creator`, `evaluator`, `profiler`.
- **Tactic-blind agents (deliberately do NOT receive it)**: `planner`, `critic`, `wiki-maintainer`, `dashboard-builder`, `git-manager`. Rationale: outline shaping, markup maintenance, and git plumbing are voice-invariant. Documented in each agent's prompt.
- **Snapshot shape**:
  ```
  push_tactic_snapshot = {
    tactic: 'interrogator' | 'debater' | 'examiner' | 'coach' | 'blend',
    rationale: string,                 // why skill picked this tactic (<=200 chars)
    bar_adjustment: 'strict' | 'standard' | 'lenient',
    source_pages_hash: string          // hash of push-tactics.md at read time, so agents can detect drift
  }
  ```

## Task Breakdown

### Task 4.1 — RED: agent shape tests
- **Files**: `tests/phase-4/agent-shapes.test.mjs` (~150 LOC)
- **Parallel**: false
- **depends_on**: []
- **Test cases** (run for each of the 9 agent files):
  1. `agent_has_yaml_frontmatter` — starts with `---\n`; parses.
  2. `agent_has_name_field_matching_filename`.
  3. `agent_has_description_field`.
  4. `agent_has_model_field_in_{haiku,sonnet,opus}`.
  5. `agent_has_Role_Success_Criteria_Operations_Constraints_FinalChecklist_blocks` — regex over required section headers.
  6. `agent_under_120_loc`.
  7. `agent_lists_allowed_tools_read_write_grep_glob_bash_task` — each agent declares only tools it actually needs.
  8. `researcher_declares_WebSearch_WebFetch_tools`.
  9. `git_manager_declares_Bash_only` — matches `raw-data/jaewon-plugin/agents/git-manager.md:29-38`.
  10. `profiler_declares_disallowedTools_contains_Edit` — profiler writes `wiki/learner/*.md` via Write only (matches wiki-maintainer pattern at `raw-data/jaewon-plugin/agents/wiki-maintainer.md:37-39`).
- **Acceptance**: 90 failing assertions (9 files x 10 checks) — count reflects file-per-check matrix.

### Task 4.2 — GREEN: write researcher agent
- **Files**: `agents/researcher.md` (~115 LOC)
- **Parallel**: true
- **depends_on**: [4.1, 3.11] (needs `learning_crawl_guard` tool spec)
- **Calling spec (in-file)**:
  ```
  INPUT: {
    course_slug: string,
    source: {kind:'folder'|'github_url'|'raw_dir', value:string},
    breadth: 'narrow'|'wide',
    push_tactic_snapshot?: PushTacticSnapshot    // optional; when present, bias relevance rubric toward tactic (e.g., debater => prefer opposing viewpoints)
  }
  OUTPUT: writes wiki/courses/<slug>/raw/crawl/manifest.json validated against crawl-manifest schema.
          stdout summary: bullet list of top-N sources with relevance scores + crawl-budget summary line.
  SIDE EFFECTS: WebSearch, WebFetch, git clone (if github_url), writes to wiki/courses/<slug>/raw/.
  TOOLS: Read, Write, Grep, Glob, Bash (for git clone), WebSearch, WebFetch, mcp__learning__learning_crawl_guard.
  MANDATORY CIRCUIT BREAKER (R3 mitigation):
    Step 0: call learning_crawl_guard {action:'begin', course_slug} before any fetch.
    Before every WebSearch/WebFetch/git-clone: call learning_crawl_guard {action:'check', estimated_tokens}.
      If allow:false -> STOP crawling; summarize what was gathered; exit with partial manifest.
    After every successful fetch: call learning_crawl_guard {action:'record', source_url, tokens_used}.
    On agent exit: call learning_crawl_guard {action:'end'} and include summary in stdout.
  TACTIC: widen query 3x, dedupe by URL hash, keep top-N by relevance rubric (in-prompt). If push_tactic_snapshot.tactic=='debater', explicitly include at least 1 dissenting source when available.
  ```
- **Acceptance**: passes 10 shape checks for researcher; grep finds `learning_crawl_guard` and `push_tactic_snapshot` in the file.

### Task 4.3 — GREEN: write planner agent (tactic-blind)
- **Files**: `agents/planner.md` (~110 LOC)
- **Parallel**: true
- **depends_on**: [4.1]
- **Calling spec**:
  ```
  INPUT: { course_slug, material_index, crawl_manifest_path }
  OUTPUT: writes wiki/courses/<slug>/outline.draft.json (kind:'draft') validated against outline schema discriminant.
  SIDE EFFECTS: Read only, then Write outline draft.
  TOOLS: Read, Write, Grep, Glob. model: opus.
  TACTIC POLICY: tactic-blind by design. Outline shape does not change with voice.
  ```
- **Acceptance**: passes 10 checks for planner.

### Task 4.4 — GREEN: write critic agent (tactic-blind)
- **Files**: `agents/critic.md` (~110 LOC)
- **Parallel**: true
- **depends_on**: [4.1]
- **Calling spec**:
  ```
  INPUT: { outline_draft_path }
  OUTPUT: wiki/courses/<slug>/outline.review.json (kind:'review', {verdict:'APPROVE'|'REVISE', objections:[...]}) validated against outline schema discriminant.
  SIDE EFFECTS: Read only; one Write for review file.
  TOOLS: Read, Write, Grep. model: opus.
  TACTIC POLICY: tactic-blind by design. Outline review is structural.
  ```
- **Acceptance**: passes 10 checks.

### Task 4.5 — GREEN: write creator agent (tactic-aware)
- **Files**: `agents/creator.md` (~115 LOC)
- **Parallel**: true
- **depends_on**: [4.1]
- **Calling spec**:
  ```
  INPUT: {
    course_slug,
    chapter_slug,
    outline_chapter,
    raw_source_paths[],
    push_tactic_snapshot?: PushTacticSnapshot   // biases QA-seed style: interrogator -> pointed questions, coach -> scaffolded questions
  }
  OUTPUT: wiki/courses/<slug>/<chapter>/read.md <= 120 LOC conforming to the read-header schema (phase-3 schemas/read-header.mjs).
          Required YAML frontmatter fields: {chapter, course, phase: 'read', created_at, tactic: <tactic or 'none'>}.
          Required section headers in order: ## Overview, ## Key Concepts, ## Questions.
  SIDE EFFECTS: Read raw sources; Write read.md.
  TOOLS: Read, Write, Grep, Glob. model: sonnet.
  CONSTRAINTS:
    - If content exceeds 120 lines, must split per wiki SCHEMA split protocol (see raw-data/jaewon-plugin/docs/wiki/SCHEMA.md:33-39).
    - Output MUST validate against mcp-server/schemas/read-header.mjs. wiki-maintainer rejects malformed read.md before commit (see phase-4.8 diff).
    - If push_tactic_snapshot absent, default tactic='coach' and record tactic:'coach-default' in frontmatter.
  ```
- **Acceptance**: passes 10 checks; grep finds `push_tactic_snapshot` and `read-header` references.

### Task 4.6 — GREEN: write profiler agent (tactic-aware)
- **Files**: `agents/profiler.md` (~115 LOC)
- **Parallel**: true
- **depends_on**: [4.1]
- **Calling spec**:
  ```
  INPUT: {
    course_slug,
    chapter_slug,
    discuss_transcript_path,
    verdict_path,
    push_tactic_snapshot: PushTacticSnapshot    // REQUIRED — profiler needs to know which tactic was used to attribute observations correctly
  }
  OUTPUT: updates wiki/learner/{learning-style,strengths,weaknesses,push-tactics,session-log}.md
          Each file validated (post-write) against profile schema section contract.
          session-log entry includes push_tactic_snapshot.tactic + source_pages_hash for drift detection.
  SIDE EFFECTS: Read + Write (not Edit) only within wiki/learner/.
  TOOLS: Read, Write, Grep, Glob. disallowedTools: Edit.
  BEHAVIOR: append-delta to session-log, synthesize updates to other four files (never replace wholesale).
           If source_pages_hash differs from current file hash, log a "tactics-drifted" marker in session-log.
  ```
- **Acceptance**: passes 10 checks.

### Task 4.7 — GREEN: write evaluator agent (tactic-aware)
- **Files**: `agents/evaluator.md` (~115 LOC)
- **Parallel**: true
- **depends_on**: [4.1]
- **Calling spec**:
  ```
  INPUT: {
    course_slug,
    chapter_slug,
    summary_path,
    discuss_transcript_path,
    raw_source_index,
    push_tactic_snapshot: PushTacticSnapshot    // REQUIRED — bar_adjustment shifts mastery threshold
  }
  OUTPUT: learning_verdict MCP tool call with validated verdict payload.
          Falls back to direct Write of verdict.json if MCP call fails.
          verdict.evidence bullets must cite push_tactic_snapshot.tactic at least once when non-'blend'.
  SIDE EFFECTS: Read only (tool call does writes).
  TOOLS: Read, Grep. model: sonnet.
  RUBRIC: thresholds for incomplete/partial/mastery defined in-prompt.
          bar_adjustment='strict' raises mastery threshold by +1 evidence bullet required;
          bar_adjustment='lenient' lowers by -1 (floor 3);
          'standard' is default.
  ```
- **Acceptance**: passes 10 checks.

### Task 4.8 — GREEN: write wiki-maintainer (forked, tactic-blind)
- **Files**: `agents/wiki-maintainer.md` (~115 LOC)
- **Parallel**: true
- **depends_on**: [4.1]
- **Source**: fork of `raw-data/jaewon-plugin/agents/wiki-maintainer.md`.
- **Diff from source**:
  - Scope `docs/wiki/` -> `wiki/`.
  - Add awareness of `wiki/learner/` (read-only for this agent; profiler owns writes).
  - Add awareness of `wiki/courses/*/` subtree.
  - Keep 120-LOC page cap (already present in source).
  - **New**: when linting a freshly-written `wiki/courses/*/<ch>/read.md`, wiki-maintainer MUST run it through the read-header schema (via a deterministic CLI invocation of `mcp-server/schemas/read-header.mjs` — no MCP dependency) and REJECT (refuse to add index links) if validation fails. Documented as a new operation "read-md gate".
  - Tactic policy: tactic-blind.
- **Acceptance**: passes 10 checks; grep shows no `docs/wiki/` references; grep shows `read-header` reference.

### Task 4.9 — GREEN: write dashboard-builder (tactic-blind)
- **Files**: `agents/dashboard-builder.md` (~100 LOC)
- **Parallel**: true
- **depends_on**: [4.1]
- **Calling spec**:
  ```
  INPUT: { publish: boolean }
  OUTPUT: dashboard/*.html regenerated; if publish=true, gh-pages branch updated via git-manager delegation.
  SIDE EFFECTS: Bash (invokes dashboard/build.mjs), Read wiki/, Write dashboard/, delegates git to git-manager.
  TOOLS: Read, Bash, Task. model: haiku.
  TACTIC POLICY: tactic-blind by design.
  ```
- **Acceptance**: passes 10 checks.

### Task 4.10 — GREEN: write git-manager (forked, tactic-blind)
- **Files**: `agents/git-manager.md` (~115 LOC)
- **Parallel**: true
- **depends_on**: [4.1]
- **Source**: fork of `raw-data/jaewon-plugin/agents/git-manager.md`.
- **Diff from source**:
  - Branch policy: `main` (canonical) + `course/<slug>` (active course) + optional `gh-pages` (dashboard publish). Remove `dev` as default.
  - Commit format: `learn({phase}): {chapter} [{verdict}]` for cycle commits; `docs(dashboard): {slug}` for dashboard commits; `merge(course): {slug}` for merges.
  - Merge gate: mastery verdict recorded AND tests (if any) pass.
  - Tactic policy: tactic-blind.
- **Acceptance**: passes 10 checks; grep shows no `dev` branch references.

### Task 4.12 — RED+GREEN: push-tactic injection integration test (new in revision 2)
- **Files**: `tests/phase-4/push-tactic-injection.test.mjs` (~120 LOC)
- **Parallel**: false
- **depends_on**: [4.2, 4.5, 4.6, 4.7]
- **Purpose**: verify the injection path end-to-end without needing real LLMs. Asserts the calling contract, not the LLM behavior (that is phase-0.5's job).
- **Test cases**:
  1. `researcher_prompt_references_push_tactic_snapshot_arg` — grep `agents/researcher.md` for the exact token `push_tactic_snapshot`.
  2. `creator_prompt_references_push_tactic_snapshot_arg`.
  3. `evaluator_prompt_declares_push_tactic_snapshot_required`.
  4. `profiler_prompt_declares_push_tactic_snapshot_required`.
  5. `tactic_blind_agents_do_not_reference_push_tactic_snapshot` — planner, critic, wiki-maintainer, dashboard-builder, git-manager: grep MUST find zero occurrences, confirming intentional blindness.
  6. `push_tactic_snapshot_shape_documented_in_phase4_md` — grep this plan doc for the snapshot schema.
  7. `profiler_prompt_contains_source_pages_hash_drift_check`.
  8. `evaluator_prompt_cites_bar_adjustment_effect`.
- **Acceptance**: 8/8 pass (this is a shape/integration test; its GREEN is covered by 4.2/4.5/4.6/4.7 having written the right text).

### Task 4.11 — REFACTOR: agent registry + cross-links
- **Files**: `agents/_registry.md` (~45 LOC)
- **Parallel**: false
- **depends_on**: [4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.12]
- **Actions**:
  - Create a single-table registry: agent-name | model | invoked-by (skill list) | writes-to (path glob) | calling-spec-ref | tactic-aware? (Y/N).
  - Ensure no agent mentions another agent by role in a way that creates circular invocation (e.g., profiler must not invoke evaluator).
- **Acceptance**: registry table has exactly 9 rows; tactic-aware column shows 4 Y (researcher, creator, evaluator, profiler) + 5 N; inbound/outbound count balances (each agent has >=1 caller — checked against phase-5 skills).

## Phase Quality Gate

- All 9 agent files exist under `agents/`.
- Every file <= 120 LOC.
- All 90 shape-test assertions pass + 8 push-tactic injection assertions pass = 98 total.
- Registry table validates that every agent is invoked by at least one skill (cross-checked with phase 5).
- Registry table validates tactic-awareness partition: exactly 4 tactic-aware agents, 5 tactic-blind.
- No agent uses inheritance, switch/case chains, or references anything under `docs/wiki/` (old base-plugin path).
- Researcher agent wires `learning_crawl_guard` into its mandatory steps (verified by grep in 4.2 acceptance).

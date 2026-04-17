# Phase 7 — Dashboard Generator

<!-- scope: static HTML dashboard builder + HUD statusline + optional gh-pages publish -->
<!-- deps: phase-1-wiki-template.md, phase-3-mcp-server.md -->
<!-- see-also: phase-8-smoke-test.md -->

## Metadata

- **Phase**: 7
- **Depends on**: 1, 3
- **Parallelizable with**: 5, 6 (disjoint file sets)
- **Estimated effort**: 0.5 day
- **Deliverable**: `dashboard/build.mjs` + 4 pure render modules + HUD statusline; publish flow delegates to git-manager agent.

## Scope

### Built
- `dashboard/{build,render-home,render-course,render-profile,render-timeline,templates}.mjs`.
- `hud/learning-hud.mjs`.
- Publish path: write to `dashboard/`, commit on main, optional push to `gh-pages`.

### NOT built
- GitHub Pages bootstrap (one-time setup outside plugin scope; documented in notes.md).
- Non-static dashboard (live API, interactive charts beyond static SVG).

## Task Breakdown

### Task 7.1 — RED: pure renderer tests
- **Files**: `tests/phase-7/renderers.test.mjs` (~200 LOC) + fixtures `tests/fixtures/dashboard/`.
- **Parallel**: false
- **depends_on**: []
- **Test cases**:
  1. `render_home_snapshot_matches_fixture` — given a known course list JSON, produces expected HTML string.
  2. `render_home_escapes_html_in_course_titles`.
  3. `render_course_shows_chapter_verdict_badges`.
  4. `render_course_groups_by_cycle_iteration`.
  5. `render_profile_sections_learning_style_strengths_weaknesses_pushtactics`.
  6. `render_profile_truncates_session_log_to_last_20`.
  7. `render_timeline_produces_github_style_contribution_grid` — asserts SVG with 365 rect elements.
  8. `render_timeline_colors_cells_by_verdict_intensity`.
  9. `templates_escape_function_handles_lt_gt_amp_quotes`.
  10. `renderers_all_pure` — given same input twice, byte-identical output.
- **Acceptance**: 10/10 failing.

### Task 7.2 — GREEN: templates + render-home + render-course
- **Files**:
  - `dashboard/templates.mjs` (~110 LOC)
  - `dashboard/render-home.mjs` (~100 LOC)
  - `dashboard/render-course.mjs` (~120 LOC)
- **Parallel**: true
- **depends_on**: [7.1]
- **Calling spec**:
  ```
  renderHome(data: {courses: Course[]}) -> string (HTML)
  renderCourse(data: {course: Course, chapters: Chapter[], verdicts: Verdict[]}) -> string
  escapeHtml(s: string) -> string
  side effects: none; deterministic.
  ```
- **Acceptance**: tests 1-4 + 9 + relevant 10 assertions pass.

### Task 7.3 — GREEN: render-profile + render-timeline
- **Files**:
  - `dashboard/render-profile.mjs` (~110 LOC)
  - `dashboard/render-timeline.mjs` (~140 LOC)
- **Parallel**: true (with 7.2)
- **depends_on**: [7.1]
- **Calling spec**:
  ```
  renderProfile(profile: LearnerProfile) -> string
  renderTimeline(data: {sessions: SessionEntry[], verdicts: Verdict[]}) -> string
  side effects: none; deterministic.
  ```
- **Acceptance**: tests 5-8 + remaining 10 assertions pass.

### Task 7.4 — RED: build orchestrator test
- **Files**: `tests/phase-7/build.test.mjs` (~80 LOC)
- **Parallel**: false
- **depends_on**: [7.2, 7.3]
- **Test cases**:
  1. `build_scans_wiki_and_writes_all_expected_html_files` — index.html, <slug>.html per course, profile.html, timeline.html.
  2. `build_returns_BuildReport_with_duration_and_pages_written`.
  3. `build_is_idempotent` — running twice produces identical files.
  4. `build_throws_on_missing_wiki_dir`.
- **Acceptance**: 4/4 failing.

### Task 7.5 — GREEN: build.mjs orchestrator
- **Files**: `dashboard/build.mjs` (~90 LOC)
- **Parallel**: false
- **depends_on**: [7.4]
- **Calling spec**: phase-0 §6.6.
- **Structure** (pure orchestrator, no logic):
  ```
  1. scanWiki(wikiRoot) -> WikiIndex
  2. For each section in SECTION_REGISTRY = {home, course, profile, timeline}:
       render via dispatch; writeFileSync(outDir/<section>.html).
  3. Return BuildReport.
  ```
- **Acceptance**: 4/4 from 7.4 pass.

### Task 7.6 — RED: HUD tests
- **Files**: `tests/phase-7/hud.test.mjs` (~120 LOC)
- **Parallel**: true
- **depends_on**: []
- **Test cases**:
  1. `hud_reads_jaewon_learning_status_json`.
  2. `hud_format_shows_course_chapter_phase`.
  3. `hud_shows_verdict_history_bar_with_color_codes` — mastery=green, partial=yellow, incomplete=red.
  4. `hud_falls_back_to_default_when_no_active_course`.
  5. `hud_exits_zero_on_missing_status`.
  6. `hud_output_under_120_chars` — to fit a single statusline.
- **Acceptance**: 6/6 failing.

### Task 7.7 — GREEN: learning-hud.mjs
- **Files**: `hud/learning-hud.mjs` (~180 LOC)
- **Parallel**: false
- **depends_on**: [7.6]
- **Source**: forked shape from `raw-data/jaewon-plugin/hud/jaewon-hud.mjs:1-40` (stdin handling, ANSI codes).
- **Calling spec**:
  ```
  stdin: Claude Code statusline event JSON.
  stdout: single ANSI-colored line.
  side effects: reads .jaewon-learning/status.json + wiki/learner/session-log.md.
  ```
- **Acceptance**: 6/6 from 7.6 pass.

### Task 7.8 — REFACTOR: publish flow documentation
- **Files**: `dashboard/README.md` (new, ~60 LOC)
- **Parallel**: false
- **depends_on**: [7.5, 7.7]
- **Content**:
  - How `dashboard` skill invokes builder.
  - How publish flow delegates to `git-manager` agent for gh-pages commit.
  - Why publish is opt-in (privacy: learner profile on public web).
- **Acceptance**: document exists; referenced from phase-5 dashboard skill.

## Phase Quality Gate

- All 20 renderer assertions + 4 build assertions + 6 HUD assertions pass.
- `grep -l 'class ' dashboard/*.mjs` returns empty (pure functions only).
- `grep -l 'writeFileSync\|appendFileSync' dashboard/render-*.mjs` returns empty (renderers are PURE).
- `build.mjs` is the only dashboard file with fs writes (orchestration).
- HUD statusline output fits in single terminal line (<=120 chars).

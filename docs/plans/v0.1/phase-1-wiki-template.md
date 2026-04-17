# Phase 1 — Wiki Template Repo Scaffold

<!-- scope: forkable wiki-template/ directory with SCHEMA, learner/, courses/, CLAUDE.md -->
<!-- deps: phase-0-architecture.md -->
<!-- see-also: phase-2-plugin-skeleton.md, phase-7-dashboard.md -->

## Metadata

- **Phase**: 1
- **Depends on**: 0
- **Parallelizable with**: 2
- **Estimated effort**: 0.5 day
- **Deliverable**: `wiki-template/` subfolder that can be forked into a standalone repo.

## Scope

### Built
- `wiki-template/` with: README, CLAUDE.md, SCHEMA.md, seed wiki/index.md, wiki/log.md, wiki/learner/*.md (5 stubs), wiki/courses/.gitkeep, dashboard/.gitkeep, .jaewon-learning/.gitkeep, .gitignore.
- Schema validation fixture JSON used by later phases.

### NOT built
- Executable code (still no code phase). Only markdown + fixtures.
- The actual GitHub template-repo creation (deferred to release task; smoke test uses in-repo copy).

## Task Breakdown

### Task 1.1 — RED: schema-integrity tests for the template
- **Type**: test (red)
- **Files**: `jaewon-plugin-learning/tests/phase-1/template-structure.test.mjs` (~100 LOC)
- **Parallel**: false (blocks 1.2)
- **depends_on**: []
- **Test cases**:
  1. `test_all_required_files_exist` — asserts every path in phase-0 §5.8 exists after scaffold.
  2. `test_every_markdown_page_has_calling_spec_header` — regex `/^#\s+.+\n<!--\s*scope:/m` passes for every `.md` under `wiki/`.
  3. `test_pages_under_120_lines` — each `.md` under `wiki-template/wiki/` <= 120 lines.
  4. `test_wikilinks_resolve` — every `[[name]]` in seed pages maps to an existing stub file.
  5. `test_learner_folder_has_five_stubs` — explicit set `{learning-style, strengths, weaknesses, push-tactics, session-log}.md`.
  6. `test_push_tactics_seed_lists_five_tactics` — regex match for `interrogator|debater|examiner|coach|blend`.
- **Acceptance**: all 6 tests written and failing because scaffold files do not exist.

### Task 1.2 — GREEN: create the wiki-template scaffold
- **Type**: implementation (green)
- **Files**: all under `wiki-template/` listed in phase-0 §5.8 (~15 markdown files, est 480 LOC total)
- **Parallel**: false
- **depends_on**: [1.1]
- **Calling specs**: see phase-0 §5.8.
- **Acceptance**: all 6 tests from 1.1 pass.

### Task 1.3 — REFACTOR: lint + cross-link pass
- **Type**: refactor
- **Files**: same set
- **Parallel**: false
- **depends_on**: [1.2]
- **Actions**:
  - Add `see-also:` wikilinks to every learner page cross-referencing `session-log`.
  - Ensure `index.md` TOC sections match wiki-maintainer output format from `raw-data/jaewon-plugin/docs/wiki/SCHEMA.md:57-69`.
  - Add example entries to `push-tactics.md` with rubric rows: tactic | when-to-use | signal-for | anti-signal.
- **Acceptance**: tests still pass; orphan-page count = 0; every learner page links to at least one other learner page.

### Task 1.4 — GREEN: wiki-template/CLAUDE.md (learner-level workflow)
- **Type**: implementation
- **Files**: `wiki-template/CLAUDE.md` (~120 LOC)
- **Parallel**: true (can run alongside 1.3)
- **depends_on**: [1.2]
- **Content contract**:
  - Section "How the teacher reads this wiki" — explicit instruction that `wiki/learner/*` is read on every SessionStart.
  - Section "What never to edit" — `wiki/courses/*/verdict.json` (written by evaluator only), `wiki/index.md` (wiki-maintainer only).
  - Section "Branches" — `main` = canonical; `course/<slug>` = active course.
  - Section "Dashboard" — regenerated on merge; never hand-edit `dashboard/*.html`.
- **Acceptance**: CLAUDE.md <=120 LOC; contains all four sections; wikilinks resolve.

## Phase Quality Gate

- All tests in 1.1 pass (6/6 green).
- `wc -l wiki-template/wiki/**/*.md` shows no file > 120 lines.
- `grep -rc '\[\[' wiki-template/wiki/ | awk -F: '$2==0'` is empty (every page has at least one outbound link).
- `ls wiki-template/wiki/learner/ | wc -l` == 5.
- `wiki-template/CLAUDE.md` exists and contains the four required sections.

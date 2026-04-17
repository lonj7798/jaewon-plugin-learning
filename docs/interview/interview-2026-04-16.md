# Interview — jaewon-plugin-learning

**Date:** 2026-04-16
**Mode:** Socratic, one question at a time
**Rounds:** 7

## Context (from initial request)

Build a Claude Code plugin `jaewon-plugin-learning` in the `jaewon-plugin-learning/` subfolder. Learning-focused fork of `jaewon-plugin`. Keep the wiki-first recording/retrieval approach but replace most skills. Inspired by karpathy's llm-wiki, Claude-for-Education teaching flow, and a single-material teaching pattern like code-understanding-claude/docs. Must support many materials one-by-one (code, math, science, articles), expand wiki/courses/progress via GitHub. Need CLAUDE.md design + sub-agents/teammates/skills for material design, teaching, guiding. Main session = TEACHER that self-improves and customizes to the learner (style, strengths, weaknesses, lazy areas, how to push) via wiki/folder-memory that CLAUDE.md references — never CLAUDE.md direct edit.

## Round 1 — Teaching mode (clarified)

**Q:** Which teaching style should be the PRIMARY mode?

**A (clarified in free-text):** Small learning cycle per chapter =
1. Read materials (with interactive QA)
2. Summarize by myself what I learned
3. Discuss — teacher should be very sharp and strict, not sycophantic
4. All recorded in wiki so I can retrieve my learning AND teacher can retrieve my learning style + improve next iteration

Chapter = a folder or GitHub repo I drop. Teacher actively crawls related materials to augment and designs the learning flow. Distributes to teammates/sub-agents. Wiki serves as primary retrieval (avoid re-reading source) and maps to original sources.

Bonus wants: visualized website to track progress (GitHub-style), manage everything through a GitHub repo with main branch + branch per material + merge-on-complete.

**Decision:** Hybrid — live Socratic session over a persistent wiki with per-chapter read→summarize→discuss cycle. Full GitHub workflow. Website dashboard.

## Round 2 — MVP scope

**Q:** Which scope for v0.1?

**A:** **Full vision in v0.1** — crawling, branching, dashboard, core loop.

## Round 3 — Repo topology

**Q:** Is the GitHub repo separate from the plugin repo?

**A:** **Plugin + wiki-template repo (forkable).** Plugin ships a template repo design. User forks once, plugin operates on the fork.

## Round 4 — Profile memory

**Q:** Where should the learner profile live?

**A:** **Wiki section + profile file.** `wiki/learner/` with named pages (learning-style.md, strengths.md, weaknesses.md, push-tactics.md, session-log.md). CLAUDE.md references this folder. Profiler agent writes after every discuss phase. Human-readable, versioned.

## Round 5 — Teacher voice (clarified)

**Q:** Which discussion-phase behavior best captures TEACHER?

**A (clarified):** "Depends on — teacher needs to find out the better way." **Adaptive: no fixed persona.** Teacher reads `wiki/learner/push-tactics.md` each session and picks a mode (interrogator, debater, examiner, coach, or blend) based on what has worked for this learner. Profiler logs which tactic produced engagement/depth. Never defaults to sycophancy.

## Round 6 — Curriculum flow

**Q:** How does input (folder / GitHub URL) become chapter plan, and who approves?

**A:** **Outline → approve → teach.** researcher+planner read material + crawl related, propose chapter outline with concepts-per-chapter. User edits/approves. Teacher begins cycle 1.

## Round 7 — Three closing decisions

**Crawl scope:** Aggressive auto-ingest. Researcher crawls widely (WebSearch, WebFetch, GitHub, arxiv, transcripts) and ingests what it judges relevant.

**Advancement:** Teacher verdict after discuss (Incomplete / Partial / Mastery). Mastery → merge branch; Partial → another cycle in same branch. Teacher uses learner-profile for threshold.

**Commit cadence:** Per cycle phase (read, summarize, discuss, profiler). Push on branch merge.

## Open items (to be resolved by planner with explicit flag for user review)

- Input format: accept both local folder path AND GitHub URL (clone URL into materials/)?
- Dashboard: static HTML generator + optional GitHub Pages?
- Resume UX: `/learn resume` auto-detects active branch + last cycle phase?
- Session log format: karpathy-style wiki/log.md + per-session JSONL?

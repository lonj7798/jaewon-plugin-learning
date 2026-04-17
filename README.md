# jaewon-plugin-learning

A Claude Code plugin that teaches you one learning material at a time. Each chapter runs a small cycle — **read (with QA) → summarize → discuss (sharp, strict)** — and grows a persistent wiki that includes your learner profile so the teacher keeps getting more customized to you.

## How to install

Edit `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "jaewon-plugin-learning": {
      "source": { "source": "github", "repo": "lonj7798/jaewon-plugin-learning" }
    }
  },
  "enabledPlugins": {
    "jaewon-plugin-learning@jaewon-plugin-learning": true
  }
}
```

Restart Claude Code. The plugin registers 8 slash commands and 5 lifecycle hooks.

## How to initiate (one-time setup)

The plugin ships with one setup skill: **`/setup-learning-wiki`**. Run it once inside the directory you want to use as your personal learning wiki repo.

```
cd ~/my-learning-wiki          # create an empty directory (or cd into an existing one)
# open Claude Code, then:
/setup-learning-wiki
```

What it does:
1. Copies `wiki-template/` from the plugin install into your directory (wiki/, SCHEMA.md, CLAUDE.md, dashboard/, `.jaewon-learning/` scaffolding).
2. Creates `.jaewon-learning/settings.json` + `status.json` (state used by hooks + MCP tools).
3. Runs `git init` + `git checkout -b main` if there's no repo yet (skipped if one already exists).
4. Verifies the 5 learner-profile pages exist at `wiki/learner/*.md`.
5. Prints the next command: `/new-course <course-input>`.

Idempotent — safe to re-run; existing files are preserved.

## Daily use

```
/new-course ~/path/to/material     # or a GitHub URL; researcher crawls, planner drafts outline, you approve
/learn                              # run one chapter cycle: read → summarize → discuss
/verdict                            # evaluator + profiler; Mastery merges, Partial loops, Incomplete re-reads
/resume                             # pick up from last phase if you stopped mid-cycle
/dashboard                          # regenerate static HTML dashboard
```

## Slash commands

| Command | Purpose |
|---|---|
| `/setup-learning-wiki` | One-command setup: copies wiki-template, inits state, creates git repo. |
| `/new-course <folder-or-url>` | Ingest material, crawl related sources, draft outline, branch `course/<slug>`. |
| `/learn` | Run the per-chapter cycle (read → summarize → discuss). Commits per phase. |
| `/verdict` | Evaluate chapter; Mastery merges branch, Partial loops, Incomplete re-reads. |
| `/resume` | Continue from the last cycle phase. |
| `/dashboard` | Rebuild static HTML (index + per-course + profile + timeline). |
| `/wiki-lint` | Check wiki integrity (broken links, orphans, >120-LOC pages). |
| `/profile-review` | Display learner profile for inspection / manual edit. |

## Repository layout

- `agents/` — 9 sub-agents (researcher, planner, critic, creator, profiler, evaluator, wiki-maintainer, dashboard-builder, git-manager) + `_registry.md`.
- `skills/` — 8 slash-command skills.
- `hooks/` — 5 lifecycle hooks with race-guarded advance (Stop vs SubagentStop via `advanceIfNewSig`).
- `mcp-server/` — 5 MCP tools, 7 sealed schemas at every LLM boundary (verdict, profile, outline, course-state, crawl-manifest, read-header, crawl-budget).
- `dashboard/` — static HTML generator.
- `hud/` — Claude Code statusline HUD.
- `wiki-template/` — bundled template. `/setup-learning-wiki` copies this into the user's working dir on first run.
- `tests/` — 305 tests across schemas, handlers, agents, skills, hooks, dashboard, e2e.
- `docs/plans/v0.1/` — Planner → Architect → Critic approved implementation plan.
- `docs/interview/` — Socratic interview transcript + spec that drove the plan.

## How the teacher adapts

Every `discuss` phase:

1. **Evaluator** produces a verdict (Incomplete | Partial | Mastery), citing `bar_adjustment` from the current `push_tactic_snapshot`.
2. **Profiler** updates `wiki/learner/*.md` — records which tactic was used and whether it produced engagement.
3. Next chapter, the teacher reads `wiki/learner/push-tactics.md` first and selects a tactic accordingly. **No `CLAUDE.md` edits.**

Tactic-aware agents: researcher, creator, profiler, evaluator.
Tactic-blind (deliberately): planner, critic, wiki-maintainer, dashboard-builder, git-manager.

## Your learning wiki

Your wiki is a **separate repo** you fork (or let `/setup-learning-wiki` scaffold for you). It holds:

- `wiki/learner/*.md` — your learning style, strengths, weaknesses, push-tactics, session-log. Written by `profiler` after each discuss phase.
- `wiki/courses/<slug>/<chapter>/` — per-chapter artifacts: `read.md`, `summary.md`, `discuss.md`, `verdict.json`.
- `wiki/log.md` — append-only session log.
- `dashboard/` — generated HTML.
- `CLAUDE.md` — the teacher's constitution. Stable; adaptation lives in `wiki/learner/`.

## Development

```bash
npm install
npm test              # 305 tests
node tests/lod-lint.mjs   # zero files >800 LOC, zero functions >50 LOC
```

## Plan + consensus

Built from a versioned plan at `docs/plans/v0.1/`:

- Planner → Architect (2 iterations) APPROVE → Critic ACCEPT
- 58 tasks, TDD RED/GREEN/REFACTOR throughout
- 7 sealed schemas at every LLM boundary
- Code-level crawl circuit breaker (`learning_crawl_guard`)
- Stop vs SubagentStop race guard via `advanceIfNewSig` CAS

## License

MIT

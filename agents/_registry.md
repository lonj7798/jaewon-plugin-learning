<!-- scope: catalog of all 9 learning-pipeline agents with tactic-awareness, tool, and invocation graph -->
<!-- deps: researcher.md, planner.md, critic.md, creator.md, profiler.md, evaluator.md, wiki-maintainer.md, dashboard-builder.md, git-manager.md -->

# Agent Registry

| Agent | Model | Role (one-line) | Tactic-aware | Primary tool | Invokes |
|---|---|---|---|---|---|
| researcher | sonnet | Crawls sources and writes crawl-manifest.json, gated by learning_crawl_guard | Y | WebSearch / WebFetch | — |
| planner | opus | Reads crawl manifest and raw material to produce outline.draft.json | N | Read | — |
| critic | opus | Reviews outline draft and emits APPROVE/REVISE verdict | N | Read | — |
| creator | sonnet | Drafts wiki/courses/<slug>/<ch>/read.md from raw sources | Y | Write | — |
| profiler | sonnet | Updates wiki/learner/ profile delta after each discuss phase | Y | Write | — |
| evaluator | sonnet | Scores discuss transcript and emits mastery verdict via learning_verdict MCP | Y | Read | — |
| wiki-maintainer | sonnet | Maintains wiki/ pages, index, links, and read-md gate | N | Edit | — |
| dashboard-builder | haiku | Regenerates static HTML dashboard and optionally publishes | N | Bash | git-manager |
| git-manager | haiku | Executes branch, commit, merge, and push operations for the pipeline | N | Bash | — |

## Cross-Invocation Audit

Invocation edges (caller → callee):

- `dashboard-builder` → `git-manager` (publish path only, when `publish=true`)

All other agents are leaves: they accept inputs from skills and write outputs but do not invoke other agents.
Skills (`learn`, `new-course`, `verdict`) are the top-level orchestrators; they call agents directly via Task().

The graph is acyclic — `git-manager` has no outbound edges, and no agent calls back into `dashboard-builder` or any upstream agent. **No circular invocation paths.**

## Push-Tactic Injection Contract

Skills read `wiki/learner/push-tactics.md` once per cycle and select the active tactic, then pass a `push_tactic_snapshot` argument to tactic-aware agents via the Task() call. Agents never read the file directly.

Tactic-aware agents that receive `push_tactic_snapshot`: **researcher**, **creator**, **evaluator**, **profiler**.

Tactic-blind agents that deliberately do NOT receive it: **planner**, **critic**, **wiki-maintainer**, **dashboard-builder**, **git-manager** — outline shaping, markup maintenance, and git plumbing are voice-invariant.

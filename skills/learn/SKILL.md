---
name: learn
description: Core teaching orchestrator that runs one learning cycle (read, summarize, discuss) for the current chapter, dispatching tactic-aware agents with push_tactic_snapshot and committing each phase.
keywords:
  - learn
  - read
  - study
  - teach me
---

<Purpose>
Thin orchestrator for one learning cycle. Loads current status and push_tactic_snapshot,
then dispatches the current phase via a table-driven registry (no switch chains).
All content generation happens inside spawned agents; main session orchestrates only.
</Purpose>

<Use_When>
- User says "learn", "read", "study", or "teach me"
- An active course exists in .jaewon-learning/status.json
- current_phase is "read", "summarize", or "discuss"
</Use_When>

<Do_Not_Use_When>
- No active course — run /learn new-course first
- User wants to set up the wiki — use /setup-learning-wiki
- User wants to resume a paused session — use /resume
- User wants a final verdict — use /verdict
</Do_Not_Use_When>

<Execution_Policy>
- Main session ORCHESTRATES only — never writes course content directly
- Phase dispatch is table-driven (PHASES registry); zero switch/case on phase
- push_tactic_snapshot is loaded once per invocation; reused if hash unchanged
- Each phase ends with a git-manager commit (tactic-blind)
- All agent calls use Task() with explicit named arguments
</Execution_Policy>

<Steps>

## Step 1: Load Status

Call `learning_status` MCP tool. Receive: `{course, chapter, phase, last_push_tactic_snapshot}`.

## Step 2: Load or Refresh push_tactic_snapshot

Read `wiki/learner/push-tactics.md`; compute sha-short.

```
if snapshot missing OR sha != last_push_tactic_snapshot.source_pages_hash:
    build push_tactic_snapshot = {tactic, rationale, bar_adjustment, source_pages_hash}
else:
    reuse last_push_tactic_snapshot
```

## Step 3: Dispatch by Phase (table-driven)

```
PHASES = {
  "read":      run_read_phase,
  "summarize": run_summarize_phase,
  "discuss":   run_discuss_phase,
}
PHASES[current_phase](course, chapter, push_tactic_snapshot)
```

### read phase

Locate the researcher's crawl manifest for this chapter at
`wiki/courses/<slug>/<chapter>/crawl-manifest.json` (produced by the researcher
during `/new-course`). If the manifest is missing or has zero sources >=0.6
relevance, halt and surface the error — do NOT let creator produce a shallow
fallback.

Spawn creator with the manifest explicitly:
`Task(subagent_type="creator", args={course_slug, chapter_slug, outline_chapter, crawl_manifest_path, raw_source_paths, push_tactic_snapshot})`
Walk learner through read.md; if creator emitted excerpts/*.md sub-pages,
open each one as the learner works through it. Ask questions until "move on".
Spawn wiki-maintainer (index update, tactic-blind).
Spawn git-manager: commit `learn(read): <chapter> [course/<slug>]`.

### summarize phase

Instruct learner to write `wiki/courses/<slug>/<chapter>/summary.md`.
Teacher stays silent until learner signals done.
Spawn git-manager: commit `learn(summarize): <chapter> [course/<slug>]`.

### discuss phase

Run adaptive discussion using `push_tactic_snapshot.tactic`.
Stream transcript to `wiki/courses/<slug>/<chapter>/discuss.md`.
On completion, invoke `/verdict` (snapshot forwarded via status.json).
Spawn git-manager: commit `learn(discuss): <chapter> [course/<slug>]`.

## Step 4: After Commit

Re-read status via `learning_status`. Auto-advance if next phase is pending.

</Steps>

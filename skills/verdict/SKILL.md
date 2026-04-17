---
name: verdict
description: End-of-discuss evaluator that grades learner mastery, persists the verdict, updates the learner profile, and dispatches the next action (merge, rediscuss, or reread) with a bounded retry loop capped at max 3 iterations.
keywords:
  - verdict
  - judge
  - grade
---

<Purpose>
Post-discuss evaluation orchestrator. Loads push_tactic_snapshot, spawns evaluator to
grade the chapter, persists verdict via MCP, updates learner profile, then dispatches
next action via dict-driven registry. Enforces bounded loop: max 3 iterations of
(discuss → verdict) per chapter before escalating to learner.
</Purpose>

<Use_When>
- Discuss phase of a chapter has just completed
- Invoked automatically by /learn at end of discuss phase
- User explicitly requests grading or a verdict on the current chapter
</Use_When>

<Do_Not_Use_When>
- No discuss transcript exists for the current chapter
- Learner has not yet completed read and summarize phases
- User wants to skip evaluation and force-merge — use git-manager directly
</Do_Not_Use_When>

<Execution_Policy>
- Main session ORCHESTRATES only — never writes verdict content directly
- Next-action dispatch is dict-driven (ACTIONS registry); zero switch/case on verdict
- push_tactic_snapshot loaded from status or rebuilt if hash is stale
- profiler always spawned after any discuss, regardless of verdict outcome
- Bounded loop: if cycle_iteration > 3, escalate to learner
- All agent calls use Task() with explicit named arguments
</Execution_Policy>

<Steps>
## Step 1: Load push_tactic_snapshot
Call `learning_status` MCP tool. Extract `course_state.last_push_tactic_snapshot`.
If missing or stale hash: read `wiki/learner/push-tactics.md`, build
`push_tactic_snapshot = {tactic, rationale, bar_adjustment, source_pages_hash}`.

## Step 2: Evaluate
Spawn evaluator agent:
`Task(subagent_type="evaluator", args={summary_path, discuss_transcript_path, raw_source_index, push_tactic_snapshot})`
Returns `{verdict, rationale, next_action}`. Verdict: `Incomplete | Partial | Mastery`.

## Step 3: Persist Verdict
Call `learning_verdict` MCP tool:
`learning_verdict({verdict, rationale, next_action, chapter, course_slug})`

## Step 4: Update Learner Profile
Spawn profiler (unconditional — after any discuss):
`Task(subagent_type="profiler", args={discuss_transcript_path, verdict_path, push_tactic_snapshot})`

## Step 5: Dispatch on next_action (dict-driven)
```
ACTIONS = {"merge": run_merge, "rediscuss": run_rediscuss, "reread": run_reread}
ACTIONS[verdict.next_action](course_slug, chapter)
```
- **merge**: spawn git-manager (merge `course/<slug>` → main, push); spawn dashboard-builder; spawn git-manager (commit + tag milestone).
- **rediscuss**: update status `phase=discuss, cycle_iteration++`.
- **reread**: update status `phase=read`.

## Step 6: Bounded Loop Guard
If `cycle_iteration > 3` for same chapter: print block message — "max 3 iterations
reached without Mastery" — and halt, awaiting learner to adjust push-tactics or bar.
</Steps>

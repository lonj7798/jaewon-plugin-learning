---
name: resume
description: Resumes an active course from the last known state. Reads current status via learning_status MCP tool, prints context, and hands off to /learn.
keywords:
  - resume
  - continue
---

<Purpose>
Resume an interrupted learning session. Derives all activity state directly from
`learning_status` MCP tool — no writes, no projection. Announces current context
and delegates continuation to the /learn skill.
</Purpose>

<Use_When>
- User says "resume" or "continue"
- User returns after a break and wants to pick up where they left off
- An active course exists in .jaewon-learning/status.json
</Use_When>

<Do_Not_Use_When>
- No course has been started — tell user to run `/learn new-course` first
- User wants to start a brand-new course — use `/learn new-course`
- User wants a verdict on completed discuss phase — use `/verdict`
</Do_Not_Use_When>

<Execution_Policy>
- Read-only: this skill makes NO writes to status.json or the wiki
- All state is derived from `learning_status` return value — no supplemental MCP calls
- Hand off to `/learn` for all actual teaching actions
- Cycle count is plain data read from status fields; no loop-guard logic runs here
</Execution_Policy>

<Steps>

## Step 1: Load Status

Call `learning_status` MCP tool. Receive:
```
{
  plan.phase,
  course_state.current_course,
  course_state.current_chapter,
  course_state.current_phase,
  course_state.cycle_count,
  course_state.verdict_history,
  course_state.last_push_tactic_snapshot
}
```

## Step 2: Guard — No Active Course

If `course_state.current_course` is null or empty:
```
Print: "No active course — run /learn new-course first."
Stop.
```

## Step 3: Print Resume Context

Print a summary of current state:
```
Course  : <current_course>
Chapter : <current_chapter>
Phase   : <current_phase>
Cycles  : <cycle_count>
Verdict history (tail): <last 3 entries of verdict_history>
Push tactic : <last_push_tactic_snapshot.tactic> (bar_adjustment: <bar_adjustment>)
Last commit : <run git rev-parse --short HEAD>
```

## Step 4: Handle Multi-Course History (future-ready)

If `verdict_history` contains entries with non-mastery terminal verdicts for previous
courses, list them so the user is aware. For the first implementation (single active
course per A6), simply print the list without interactive selection.

## Step 5: Hand Off to /learn

Invoke `/learn` to continue from `current_phase`.
Pass `current_phase` from the `learning_status` result — do not recompute it.

</Steps>

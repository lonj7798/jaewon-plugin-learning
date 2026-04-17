---
name: profile-review
description: Presents the current learner profile from wiki/learner/*.md for inspection. No agents invoked — displays contents and instructs the user how to edit manually.
keywords:
  - profile
  - learner profile
  - review profile
  - push tactics
---

<Purpose>
Display the learner profile files (`wiki/learner/*.md`) in the main session
for review. Prints file contents and provides instructions for manual editing.
No agents are spawned and no writes are performed.
</Purpose>

<Use_When>
- User says "profile", "learner profile", "review profile", or "push tactics"
- User wants to inspect or update their learning preferences and push-tactics
- Before starting a new course to confirm profile settings are current
</Use_When>

<Do_Not_Use_When>
- User wants to run a lint check — use /wiki-lint instead
- User wants to regenerate the dashboard — use /dashboard instead
- No wiki exists — run /setup-learning-wiki first
</Do_Not_Use_When>

<Execution_Policy>
- Read-only skill: no files are written, no agents are spawned
- File contents are read directly in the main session (no Task() calls)
- User edits their profile manually using their own editor
- Tactic-blind: reads profile files but does not select or apply tactics
</Execution_Policy>

<Steps>

## Step 1: Read learner profile files

Read all files matching `wiki/learner/*.md`.
Expected files (from wiki-template):
- `wiki/learner/profile.md` — learning goals, background, preferences
- `wiki/learner/push-tactics.md` — tactic rubric for push-tactic selection
- `wiki/learner/verdict-history.md` — historical verdict log (if present)

## Step 2: Display contents

For each file found, print:
```
=== wiki/learner/<filename>.md ===
<file contents>
```

If `wiki/learner/` is empty or missing, print:
"No learner profile found. Check your wiki-template fork for wiki/learner/ stubs."

## Step 3: Print edit instructions

```
To edit your profile:
  Open wiki/learner/profile.md in your editor and save.
  Open wiki/learner/push-tactics.md to adjust tactics.

Changes take effect on the next /learn or /new-course invocation.
```

</Steps>

---
name: setup-learning-wiki
description: Bootstrap a learning wiki by detecting or cloning the wiki-template, creating .jaewon-learning/ state, and preparing the repo for the /learn workflow.
keywords:
  - setup
  - init
  - fork template
  - bootstrap wiki
disable-model-invocation: true
---

<Purpose>
One-time setup skill. Detects a wiki-template fork in the current directory, creates
the `.jaewon-learning/` state directory with default config, ensures a git repo on
`main` exists, then prints the next-step command for the learner.
</Purpose>

<Use_When>
- Starting a new learning project from scratch.
- `.jaewon-learning/` does not yet exist in the current directory.
- The user has just forked `wiki-template` and needs to initialize state.
</Use_When>

<Do_Not_Use_When>
- `.jaewon-learning/` already exists (setup is already complete).
- Adding a new course — use `/learn new-course` instead.
- Resuming an existing session — use `/resume` instead.
</Do_Not_Use_When>

<Execution_Policy>
- Idempotent: check before creating — skip steps already done.
- Tactic-blind: does not read push-tactics or pass push_tactic_snapshot.
- No agent spawning: all steps run in the main session.
</Execution_Policy>

<Steps>

## Step 1: Guard — already initialized?

If `.jaewon-learning/` exists, print "Already initialized." and exit.

## Step 2: Ensure wiki-template scaffold present

Check for `wiki/` and `SCHEMA.md` in CWD.
- Found: print "Wiki template detected. Proceeding."
- Not found: copy the bundled template from the plugin install:
  `cp -R "${CLAUDE_PLUGIN_ROOT}/wiki-template/." .` (this brings in wiki/, SCHEMA.md, README.md, CLAUDE.md, dashboard/).
  Then print "Wiki template copied from plugin; edit to taste."

## Step 3: Create .jaewon-learning/ state

```
mkdir .jaewon-learning/

.jaewon-learning/settings.json:
{ "version": "0.1", "wiki_dir": "wiki", "courses_dir": "wiki/courses", "learner_dir": "wiki/learner" }

.jaewon-learning/status.json:
{ "plan": { "phase": "setup" },
  "course_state": { "current_course": null, "current_chapter": null,
    "current_phase": null, "cycle_count": 0, "verdict_history": [],
    "last_push_tactic_snapshot": null } }
```

## Step 4: Confirm wiki/learner/ stubs

If `wiki/learner/` is missing, warn: "wiki/learner/ not found — check your wiki-template fork."

## Step 5: Git init + main branch

If no `.git/`: run `git init && git checkout -b main`.
Otherwise: skip and note "Git repo detected."

## Step 6: Report

```
Setup complete!
- .jaewon-learning/ initialized (settings.json + status.json)
- Wiki template verified (wiki/ + wiki/learner/)
- Git: main branch ready

Next: /learn new-course <course-input>
```

</Steps>

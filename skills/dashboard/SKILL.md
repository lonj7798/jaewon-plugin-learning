---
name: dashboard
description: Regenerates the learning dashboard by invoking the dashboard-builder agent. Optionally publishes to GitHub Pages after user confirmation.
keywords:
  - dashboard
  - regenerate dashboard
  - publish
  - github pages
---

<Purpose>
Orchestrate dashboard regeneration. Spawns `dashboard-builder` to rebuild
the HTML dashboard from current wiki state, then optionally publishes to
GitHub Pages after asking the user.
</Purpose>

<Use_When>
- User says "dashboard", "regenerate dashboard", or "publish"
- After a course milestone merge to refresh progress metrics
- Periodic refresh to keep the dashboard current
</Use_When>

<Do_Not_Use_When>
- No wiki has been initialized — run /setup-learning-wiki first
- User wants to check wiki health — use /wiki-lint instead
- User wants to review their learner profile — use /profile-review instead
</Do_Not_Use_When>

<Execution_Policy>
- All dashboard generation runs inside dashboard-builder via Task()
- Main session only orchestrates and handles the publish prompt
- GitHub Pages publish is opt-in: always ask before pushing
- Tactic-blind: does not read push-tactics or pass push_tactic_snapshot
- No direct git calls from main session — git-manager handles commits
</Execution_Policy>

<Steps>

## Step 1: Spawn dashboard-builder

```
Task(subagent_type="dashboard-builder", args={
  wiki_dir: "wiki",
  output_path: "dashboard/index.html"
})
```

Wait for confirmation that `dashboard/index.html` was written.

## Step 2: Report generation result

Print: "Dashboard regenerated at dashboard/index.html."

## Step 3: Prompt for GitHub Pages publish (optional)

Ask user: "Publish to GitHub Pages? (yes / no)"

- If yes:
  1. Spawn `git-manager`: commit `chore(dashboard): regenerate [<iso-date>]`.
  2. Spawn `git-manager`: push `gh-pages` branch (or configured pages branch).
  3. Print: "Published. View at <github-pages-url>."
- If no:
  Print: "Skipped publish. Run /dashboard again to publish later."

</Steps>

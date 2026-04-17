---
name: update-plugin
description: Pull the latest jaewon-plugin-learning from its marketplace and reinstall, so the user gets the newest agents / skills / hooks without editing settings by hand.
keywords:
  - update
  - upgrade
  - pull
  - refresh
  - update plugin
---

<Purpose>
One-command plugin self-update. Refreshes the marketplace metadata, reinstalls
the plugin at the latest published version, and shows the learner what changed.
Tactic-blind; no agent spawning.
</Purpose>

<Use_When>
- User says "update plugin", "upgrade", "pull latest", or equivalent.
- User wants the newest agents/skills/hooks without editing settings.json.
- User just saw a release/commit mentioned and wants to pick it up.
</Use_When>

<Do_Not_Use_When>
- Plugin is not yet installed — use `claude plugin install jaewon-plugin-learning@jaewon-plugin-learning` first.
- User is editing the plugin source locally (they'd bypass the marketplace).
- User wants to update a DIFFERENT plugin (this skill only updates jaewon-plugin-learning).

</Do_Not_Use_When>

<Execution_Policy>
- Idempotent: re-runs are safe; if already at HEAD, commands are no-ops.
- Runs ONLY these two `claude plugin` subcommands; does not edit settings.json.
- Never touches the user's wiki repo or learning state.
- On failure at any step, surface the error and stop — do not try to recover.
- After successful update, instruct the user to restart Claude Code.
</Execution_Policy>

<Steps>

## Step 1: Show the current installed version

Display what is currently installed so the user can compare before/after:

```
claude plugin list 2>/dev/null | grep jaewon-plugin-learning || echo "(plugin not currently installed)"
```

If the grep finds nothing, ask the user to confirm the plugin name — do not
proceed if the plugin isn't already installed.

## Step 2: Refresh marketplace metadata

Pull the latest marketplace.json + plugin.json from GitHub:

```
claude plugin marketplace update jaewon-plugin-learning
```

The marketplace name is `jaewon-plugin-learning` (defined in `.claude-plugin/marketplace.json`
at the repo root; referenced in user settings under `extraKnownMarketplaces`).

If this step fails with "unknown marketplace", the user's settings.json is missing
the `extraKnownMarketplaces.jaewon-plugin-learning` entry — point them at the
README for the install snippet.

## Step 3: Reinstall at latest

Force the plugin files to be refreshed from the updated marketplace:

```
claude plugin install jaewon-plugin-learning@jaewon-plugin-learning
```

This is the same command as first-time install; Claude Code treats it as
"install-or-update" depending on current state.

## Step 4: Show what changed (optional)

If the marketplace cache dir is accessible, show the last few commits so the
user knows what they just pulled. Typical cache path:

```
git -C ~/.claude/plugins/marketplaces/jaewon-plugin-learning log --oneline -10 2>/dev/null || true
```

## Step 5: Report and prompt restart

```
Plugin update complete!
- Marketplace refreshed
- Plugin reinstalled at latest published version
- Restart Claude Code to load the new agents / skills / hooks
```

Remind the user that hook changes take effect only after a full restart — simply
closing the current session is not enough.

</Steps>

# Dashboard

Static HTML view of your wiki — home index, learner profile, and activity timeline.

## Purpose

Reads your wiki tree (`courses/`, `learner/`) and writes a self-contained set of HTML
files you can open locally or publish to GitHub Pages.

## How it runs

```bash
# CLI
node dashboard/build.mjs --wikiRoot=<path> --outDir=<path>

# Via /dashboard skill (recommended) — uses workspace defaults and opens browser
```

## Section registry

`build.mjs` uses a `SECTIONS` array (dict pattern, no switch/case). To add a section,
append `{ out: 'name.html', render: () => renderFn(data) }` and create the matching
pure renderer in `dashboard/render-name.mjs`.

## Directory layout

```
dashboard/
  index.html      # home — course list
  profile.html    # learner profile (style, strengths, weaknesses, tactics)
  timeline.html   # GitHub-style contribution grid (365 days)
  <slug>.html     # one page per course (auto-generated)
```

## Publish flow (opt-in)

Publishing is **opt-in** — the learner profile contains personal notes that may not
belong on a public site.

1. Run the builder to populate `dashboard/` with fresh HTML.
2. Ask the `git-manager` agent (or `dashboard-builder` agent) to commit `dashboard/`
   to a `gh-pages` branch and push.
3. In GitHub repo settings set **Pages source** to the `gh-pages` branch, root folder.
4. Site goes live at `https://<user>.github.io/<repo>/`.

Re-run steps 1-2 whenever you want to refresh the published site.

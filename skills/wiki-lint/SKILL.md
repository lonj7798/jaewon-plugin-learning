---
name: wiki-lint
description: Checks wiki integrity for broken wikilinks, orphan pages, missing calling-spec headers, and pages exceeding 120 LOC. Delegates to the wiki-maintainer agent.
keywords:
  - lint
  - wiki check
  - broken links
  - orphan pages
---

<Purpose>
Integrity audit for the learning wiki. Delegates all lint checks to the
`wiki-maintainer` agent and surfaces a structured report of issues found.
No writes are performed — this skill is read-only.
</Purpose>

<Use_When>
- User says "lint", "wiki check", "broken links", or "orphan pages"
- Before merging a course branch to verify wiki health
- Periodic maintenance to keep the wiki clean
</Use_When>

<Do_Not_Use_When>
- User wants to fix wiki issues — let wiki-maintainer handle repairs directly
- No wiki exists — run /setup-learning-wiki first
- User wants to update the dashboard — use /dashboard instead
</Do_Not_Use_When>

<Execution_Policy>
- Read-only: no files are written or deleted during this skill
- All lint logic runs inside the wiki-maintainer agent via Task()
- Results are printed to main session; no status.json updates
- Tactic-blind: does not read push-tactics or pass push_tactic_snapshot
</Execution_Policy>

<Steps>

## Step 1: Spawn wiki-maintainer for lint

```
Task(subagent_type="wiki-maintainer", args={
  operation: "lint",
  wiki_dir: "wiki",
  checks: ["broken-wikilinks", "orphan-pages", "missing-calling-spec", "page-over-120-loc"]
})
```

## Step 2: Receive lint report

Wait for wiki-maintainer output: `{ issues: [...], summary: { broken, orphan, missing_spec, overlength } }`.

## Step 3: Print report

```
Wiki Lint Report
----------------
Broken wikilinks : <count>
Orphan pages     : <count>
Missing spec hdr : <count>
Pages > 120 LOC  : <count>

Issues:
<list each issue with file path and description>

Run /wiki-lint --fix to delegate repairs to wiki-maintainer.
```

If zero issues: print "Wiki is clean."

</Steps>

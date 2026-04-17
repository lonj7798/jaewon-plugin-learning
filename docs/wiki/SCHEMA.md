# Wiki Schema

Obsidian-compatible wiki for this project. Pages live in `docs/wiki/pages/` and link via `[[wikilinks]]`.

## Page Structure

Every page starts with a calling-spec header:

```markdown
# Page Title

**Scope:** What this module/concept covers
**Deps:** [[page-a]], [[page-b]]
**See-also:** [[page-c]]

## Body
...
```

## Rules

- Each page ≤ 120 lines (LOD limit). Split larger pages into focused sub-pages.
- Use `[[page-name]]` for wikilinks (kebab-case, no `.md`).
- Cross-reference generously — wiki value scales with link density.
- Categorize via sections in `index.md`, not folder nesting.
- Log every ingest/update in `log.md` (append-only).

## Categories

- **modules/** — code units (one page per significant module)
- **decisions/** — architectural decisions (ADR-style)
- **concepts/** — cross-cutting domain concepts
- **workflows/** — how-to guides for recurring tasks

## Maintenance

Run `wiki-maintainer` agent on:
- `ingest` — scan code, create/update pages
- `lint` — find broken links, orphans, stale info
- `stub` — create placeholder for a new page

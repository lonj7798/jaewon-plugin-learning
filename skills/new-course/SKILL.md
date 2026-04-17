---
name: new-course
description: Ingest a new course from a local folder or GitHub URL. Crawls source material, builds a tactic-aware outline, gets user approval, and scaffolds chapter branches.
keywords:
  - new course
  - ingest
  - import
---

<Purpose>
Orchestrate ingestion of a new learning course. Accepts a local path or GitHub URL, clones remote sources, reads push-tactics, spawns researcher/planner/critic agents, presents the outline for approval, then scaffolds the course branch and chapter directories.
</Purpose>

<Use_When>
- User says "new course", "ingest", "import course", "add course", or provides a folder/URL to learn from
- No active course exists or user wants to start a separate course branch
</Use_When>

<Do_Not_Use_When>
- A course is already active and user wants to resume — use `resume` instead
- User wants to review verdicts or manage existing chapters — use `verdict` or `learn`
- No wiki has been initialized — run `setup-learning-wiki` first
</Do_Not_Use_When>

<Execution_Policy>
- This skill is a pure orchestrator — it spawns agents and writes state; it contains no teaching logic
- All agent invocations use Task() with explicit inputs; no free-floating LLM calls
- push_tactic_snapshot is built once at entry and passed to every tactic-aware agent
- git-manager handles all branch and commit operations; skill never calls git directly
- Critic loop is bounded to 3 iterations (LOD Pattern 9)
- On user rejection of outline: re-spawn planner with rejection notes (bounded to 1 retry)
</Execution_Policy>

<Steps>

## Step 1: Parse Input

1. Detect input type: local path (starts with `/` or `./`) or GitHub URL (`github.com`).
2. If GitHub URL: ask git-manager to clone into `raw-materials/<slug>/`.
3. Ask user for course slug if not derivable from source name; suggest kebab-case.

## Step 2: Create Course Branch

1. Spawn `git-manager` agent: create branch `course/<slug>` from main.

## Step 3: Load Push-Tactics Snapshot

1. Read `wiki/learner/push-tactics.md`; compute sha-short hash of contents.
2. Select one tactic per the rubric in that file.
3. Construct:
   ```
   push_tactic_snapshot = {
     tactic, rationale, bar_adjustment, source_pages_hash
   }
   ```

## Step 4: Research

1. Spawn `researcher` agent with `{ course_slug, source, breadth: "standard", push_tactic_snapshot }`.
2. Researcher performs aggressive crawl bounded by `learning_crawl_guard`.
3. Wait for crawl-manifest path output.

## Step 5: Plan Outline

1. Spawn `planner` agent with crawl-manifest path (tactic-blind; no snapshot passed).
2. Wait for outline draft path.

## Step 6: Critic Review (bounded loop, max 3)

1. Spawn `critic` agent with outline draft (tactic-blind).
2. If critic returns REVISE: re-invoke `planner` with revision notes (iteration++).
3. If iteration > 3: use last draft as-is and warn user.

## Step 7: User Approval

1. Print `outline.md` contents to user.
2. Prompt: approve / edit / reject.
3. On approve: write `wiki/courses/<slug>/outline.md`.
4. On edit: apply edits inline and write.
5. On reject (once): re-spawn `planner` with rejection notes; repeat Step 6.

## Step 8: Scaffold and Commit

1. For each chapter in the approved outline: create empty `wiki/courses/<slug>/<chapter>/` dir.
2. Write `wiki/courses/<slug>/meta.json`:
   ```json
   { "slug": "<slug>", "source": "<source>", "created_at": "<iso-date>", "push_tactic_snapshot": <snapshot> }
   ```
3. Spawn `git-manager`: commit `feat(course): init <slug>`.
4. Update `.jaewon-learning/status.json`:
   - `plan.phase = "new-course"`
   - `course_state.current_course = <slug>`
   - `course_state.current_chapter = <first chapter>`
   - `course_state.current_phase = "read"`
   - `course_state.last_push_tactic_snapshot = <push_tactic_snapshot>`
5. Print next-step: `/learn`.

</Steps>

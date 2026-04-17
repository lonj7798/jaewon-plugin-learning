# Phase 0.5 — Real-LLM Schema Spike (Validation Gate)

<!-- scope: real-LLM spike to validate evaluator + profiler schemas BEFORE phases 4/5/6 implement 45 dependent tasks -->
<!-- deps: phase-0-architecture.md (schemas specced), phase-2-plugin-skeleton.md (server boots) -->
<!-- see-also: phase-3-mcp-server.md, phase-4-agents.md, risks.md R4/R6/R10 -->

## Metadata

- **Phase**: 0.5
- **Depends on**: 0 (architecture + schema specs), 2 (plugin skeleton so MCP can run), 3 (schemas + validator implemented — see note below)
- **Estimated effort**: 0.5 day
- **Deliverable**: a recorded real-LLM run of `evaluator + profiler + one cycle iteration` on a toy fixture, demonstrating schemas survive LLM output, OR a list of concrete schema adjustments required before phase 4/5/6 begin.

> **Ordering note**: this phase RUNS after 3.2 (schemas green) but BEFORE 4.x/5.x/6.x begin. It is the gate that answers risks.md R4 and R6 with evidence instead of assumption. If the spike exposes schema drift, iterate phase-0 + phase-3 schemas before touching phase 4.

## Why this phase exists

Risks R4 (schema drift) and R6 (sycophantic fallback) and R10 (mock/real drift) are all LLM-behavior risks. No amount of schema unit testing answers them. 45 dependent tasks (phases 4/5/6) assume the schemas work against real Claude output. If they do not, the blast radius is a full replan. Spending 0.5 day here saves up to 4 days of rework.

## Scope

### Built
- `jaewon-plugin-learning/tests/spike/real-llm-spike.mjs` — one-shot script that drives evaluator + profiler + one discuss iteration against a toy fixture using real Claude API (Task/subagent invocations).
- `jaewon-plugin-learning/tests/spike/README.md` — instructions to run (needs ANTHROPIC_API_KEY; not in CI).
- Recorded output: `docs/plans/v0.1/evidence/phase-0.5-spike-results.md` — observed evaluator/profiler JSON, schema pass/fail, push-tactic adherence.

### NOT built
- Full cycle (no read/summarize phases, no merge, no dashboard). Narrowest possible spike.
- No CI wiring — spike is manual and happens once per plan iteration.
- No mocks; this phase is the opposite of mocks.

## Task Breakdown

### Task 0.5.1 — Write spike script (no tests — spike is itself the test)
- **Files**: `jaewon-plugin-learning/tests/spike/real-llm-spike.mjs` (~150 LOC)
- **Parallel**: false
- **depends_on**: [3.2] (needs real schemas + validator compiled)
- **Behavior**:
  1. Set up a tiny in-memory fixture: a toy summary ("attention is a weighted sum") and a toy discuss transcript (3 QA turns of varying depth).
  2. Spawn the evaluator sub-agent via the real Claude Task API with the phase-4 prompt.
  3. Capture the evaluator's output; pass it to `validateVerdict` from `mcp-server/schemas/verdict.mjs`.
  4. Spawn the profiler sub-agent on the same discuss transcript + a mock verdict; capture its 5 proposed writes; pass each through `validateProfileDelta`.
  5. For push-tactic check: inject a `push_tactic_snapshot` (one of the 5 tactics from push-tactics.md stub) and verify the evaluator's rubric reasoning cites it.
- **Acceptance**:
  - Script runs to completion on `ANTHROPIC_API_KEY` environment.
  - Output file `evidence/phase-0.5-spike-results.md` exists with raw JSON + schema verdict.

### Task 0.5.2 — Analyze and gate
- **Files**: `docs/plans/v0.1/evidence/phase-0.5-spike-results.md`, `docs/plans/v0.1/notes.md` (append)
- **Parallel**: false
- **depends_on**: [0.5.1]
- **Gate decision — one of three**:
  - **A. PROCEED**: evaluator + profiler outputs validate on first try; push-tactic cited. Record result in notes.md Revision Log. Phases 4/5/6 unblock.
  - **B. PATCH**: schemas need minor tightening (enum additions, optional field relaxations). Open a micro-revision of phase-0 + phase-3; re-run spike; then unblock.
  - **C. ABORT**: evaluator cannot produce valid JSON under the current contract, or profiler collapses into sycophantic single-paragraph output. Escalate — this means the plan's adaptive-voice design needs rework before phase 4 is worth writing. Add "early abort trigger" notice to notes.md.
- **Acceptance**:
  - notes.md Revision Log records one of {PROCEED, PATCH, ABORT} with evidence links.
  - If PATCH, the follow-up schema diffs are listed explicitly (file + field + change).
  - If ABORT, phases 4/5/6 tasks in checklist.json are marked `status: "blocked"` until replan.

## Phase Quality Gate

Phase 0.5 is DONE when:
1. `evidence/phase-0.5-spike-results.md` exists with at least one real Claude-generated evaluator verdict and one profiler delta set.
2. Each captured output is run through the schema validator and the result (ok/errors) is recorded verbatim.
3. notes.md Revision Log contains the PROCEED / PATCH / ABORT decision.
4. `checklist.json` either unblocks or blocks phases 4/5/6 based on that decision.

## Cost bound

Single spike run: roughly 4-6 Task() invocations (evaluator x 2 variants, profiler x 1, critic x 1 optional). Budget under $2 of API spend. Abort if hitting $5 without a completed run — that is itself a signal (see R3).

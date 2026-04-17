# Tiny Transformer

<!-- scope: minimal course fixture for e2e smoke test
     deps: none
     see-also: [[intro]], [[attention]]
-->

A self-contained mini-transformer implementation used as the fixture course
for the phase-8 end-to-end smoke test. Not a real course — just enough
structure to exercise the full plugin pipeline without real LLM calls.

## Contents

- `intro.md` — what a transformer is and why it matters
- `attention.md` — the attention mechanism in detail

## Usage

This fixture is consumed by `tests/e2e/smoke.test.mjs`. The mock agents
return deterministic responses based on these files so the smoke test runs
in under 2 minutes without API keys.

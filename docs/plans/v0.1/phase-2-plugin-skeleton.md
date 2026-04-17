# Phase 2 — Plugin Skeleton

<!-- scope: package.json, plugin.json, hooks.json, .mcp.json, empty stubs, test harness -->
<!-- deps: phase-0-architecture.md -->
<!-- see-also: phase-3-mcp-server.md, phase-4-agents.md, phase-6-hooks.md -->

## Metadata

- **Phase**: 2
- **Depends on**: 0
- **Parallelizable with**: 1
- **Estimated effort**: 0.5 day
- **Deliverable**: plugin loads under Claude Code with zero agents/skills/tools functional, but all wiring valid.

## Scope

### Built
- All config/manifest files for the plugin.
- Copied-verbatim shared libs from base plugin (`hooks/run.cjs`, `hooks/lib/stdin.mjs`, `mcp-server/lib/file-ops.js`).
- Test harness: `jaewon-plugin-learning/tests/` with node's built-in `node:test` runner (no external test dep; matches spec §12 success criteria).
- Minimal `mcp-server/server.js` that starts but registers zero tools.

### NOT built
- Any agent logic, skill logic, hook logic, MCP tool handler. All stubs throw `NotImplemented`.

## Task Breakdown

### Task 2.1 — RED: plugin manifest tests
- **Files**: `tests/phase-2/manifest.test.mjs` (~120 LOC)
- **Parallel**: false
- **depends_on**: []
- **Test cases**:
  1. `test_plugin_json_valid` — parses as JSON; has `name`, `version`, `skills`, `hooks`, `mcpServers`.
  2. `test_version_is_0_1_0`.
  3. `test_hooks_json_declares_five_events` — SessionStart, UserPromptSubmit, Stop, SubagentStop, SessionEnd.
  4. `test_mcp_json_registers_learning_server`.
  5. `test_package_json_is_type_module`.
  6. `test_package_json_declares_mcp_sdk_dep`.
- **Acceptance**: 6/6 failing.

### Task 2.2 — GREEN: write manifests
- **Files**:
  - `jaewon-plugin-learning/.claude-plugin/plugin.json` (15 LOC)
  - `jaewon-plugin-learning/.mcp.json` (12 LOC)
  - `jaewon-plugin-learning/package.json` (12 LOC)
  - `jaewon-plugin-learning/hooks/hooks.json` (60 LOC)
- **Parallel**: false
- **depends_on**: [2.1]
- **Calling spec**: static config; no functions.
- **Acceptance**: 6/6 from 2.1 pass.

### Task 2.3 — RED: shared-lib integration tests
- **Files**: `tests/phase-2/shared-libs.test.mjs` (~100 LOC)
- **Parallel**: true (can run alongside 2.2)
- **depends_on**: []
- **Test cases**:
  1. `test_run_cjs_exists_and_is_executable`.
  2. `test_stdin_mjs_exports_readStdin`.
  3. `test_file_ops_exports_readJSON_writeJSON_appendMarkdown`.
  4. `test_readJSON_missing_file_returns_null` — mirrors `raw-data/jaewon-plugin/mcp-server/lib/file-ops.js:22-28`.
  5. `test_writeJSON_creates_parent_dir`.
- **Acceptance**: 5/5 failing (files not copied yet).

### Task 2.4 — GREEN: copy shared libs verbatim
- **Files**:
  - `jaewon-plugin-learning/hooks/run.cjs` (98 LOC — copy from `raw-data/jaewon-plugin/hooks/run.cjs`)
  - `jaewon-plugin-learning/hooks/lib/stdin.mjs` (49 LOC — copy from `raw-data/jaewon-plugin/hooks/lib/stdin.mjs`)
  - `jaewon-plugin-learning/mcp-server/lib/file-ops.js` (50 LOC — copy from `raw-data/jaewon-plugin/mcp-server/lib/file-ops.js`)
- **Parallel**: false
- **depends_on**: [2.3]
- **Calling specs**: identical to source.
- **Acceptance**: 5/5 from 2.3 pass.

### Task 2.5 — RED: minimal MCP boot test
- **Files**: `tests/phase-2/server-boot.test.mjs` (~80 LOC)
- **Parallel**: false
- **depends_on**: [2.4]
- **Test cases**:
  1. `test_server_js_imports_without_throwing` — spawn `node mcp-server/server.js` with immediate SIGTERM; assert exit code 0 or 143.
  2. `test_server_registers_zero_tools_by_default` — capture stdout, assert no tool registration events (since handlers are empty).
- **Acceptance**: 2/2 failing.

### Task 2.6 — GREEN: minimal server.js + stub handlers
- **Files**:
  - `mcp-server/server.js` (45 LOC — mirrors `raw-data/jaewon-plugin/mcp-server/server.js:1-40`; registers nothing in this phase)
  - `mcp-server/handlers/status-handler.js` (~10 LOC export empty `registerStatusTools`)
  - `mcp-server/handlers/profile-handler.js` (stub)
  - `mcp-server/handlers/wiki-search-handler.js` (stub)
  - `mcp-server/handlers/verdict-handler.js` (stub)
  - `mcp-server/lib/paths.js` (60 LOC — forked from base; adjust base dir to `.jaewon-learning`)
- **Parallel**: false
- **depends_on**: [2.5]
- **Calling specs**: all handler exports are no-ops returning undefined.
- **Acceptance**: 2/2 from 2.5 pass.

### Task 2.7 — REFACTOR: test harness + CI contract
- **Files**: `jaewon-plugin-learning/tests/run-all.mjs` (~50 LOC), `jaewon-plugin-learning/package.json` scripts entry `"test": "node --test tests/**/*.test.mjs"`
- **Parallel**: false
- **depends_on**: [2.2, 2.4, 2.6]
- **Actions**: wire `npm test` to run all `tests/**/*.test.mjs`; add `README.md` snippet documenting how to run.
- **Acceptance**: `cd jaewon-plugin-learning && npm test` runs all three suites green.

## Phase Quality Gate

- `npm test` in plugin dir: all phase-2 suites green.
- Directory tree matches phase-0 §5.1–5.5 at manifest-only level (no handler logic).
- All copied files are byte-identical to source (verified by test in 2.4 optional assertion).

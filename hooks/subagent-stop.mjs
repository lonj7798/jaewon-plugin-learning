#!/usr/bin/env node
/**
 * subagent-stop.mjs — SubagentStop hook for jaewon-plugin-learning
 *
 * Ordering policy (Stop vs SubagentStop race guard):
 *   Both stop.mjs and subagent-stop.mjs compute sig = sha1(agent_name + verdict_path + mtime_ms)
 *   before attempting any advance. Both call advanceIfNewSig. The second caller observes
 *   last_advance_sig === sig and returns { advanced: false, reason: 'sig_match' }. Neither retries.
 *
 * @calling-spec
 * - main(): Promise<void>
 *   Input: stdin JSON event { agent_name?, cwd?, _test_override_sig?, last_assistant_message?, ... }
 *   Output: stdout '' OR JSON.stringify({ systemMessage: update summary })
 *   Side effects: advances status.json via advanceIfNewSig when evaluator finishes (idempotent)
 *   Contract: ALWAYS exits 0; NEVER emits decision:'block'
 *   Dispatch: uses AGENT_HANDLERS dict (not switch/case) — LOD Pattern 8
 *   Depends on: ./lib/stdin.mjs, ./lib/state.mjs, node:fs, node:path, node:crypto
 */

import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readStdin } from './lib/stdin.mjs';
import { readState, writeState, advanceIfNewSig } from './lib/state.mjs';

/** Compute a deterministic sig from agent name + verdict path + mtime_ms. */
function computeSig(agentName, verdictPath) {
  try {
    const mtime = existsSync(verdictPath)
      ? statSync(verdictPath).mtimeMs
      : 0;
    return createHash('sha1')
      .update(`${agentName}${verdictPath}${mtime}`)
      .digest('hex');
  } catch {
    return null;
  }
}

/** Resolve the verdict.json path for a given project dir. */
function getVerdictPath(projectDir) {
  return join(projectDir, '.jaewon-learning', 'evaluator', 'verdict.json');
}

/** Mutator for evaluator completion: advance cycle_count, transition phase. */
function evaluatorMutator(status) {
  const cs = status.course_state || {};
  cs.cycle_count = (cs.cycle_count || 0) + 1;
  cs.current_phase = 'idle';
  status.course_state = cs;
}

/** Handler for 'evaluator' agent completion. Sig-guarded advance. */
function handleEvaluatorStop(projectDir, status, payload) {
  const vPath = getVerdictPath(projectDir);
  if (!existsSync(vPath)) {
    return { status, advanced: false };
  }

  const overrideSig = payload._test_override_sig ?? null;
  const sig = overrideSig !== null
    ? overrideSig
    : computeSig('evaluator', vPath);

  if (sig === null) {
    return { status, advanced: false };
  }

  const result = advanceIfNewSig(status, sig, evaluatorMutator);
  if (result.advanced) {
    try {
      writeState(projectDir, result.status);
    } catch { /* non-critical */ }
    return { status: result.status, advanced: true };
  }

  // sig_match — no advance, idempotent noop
  return { status, advanced: false, reason: result.reason };
}

/** Handler for 'profiler' agent completion: log completion note to session log. */
function handleProfilerStop(projectDir, status, _payload) {
  try {
    const cs = status.course_state || {};
    writeState(projectDir, {
      course_state: {
        ...cs,
        profiler_run: true,
        profiler_last_run: new Date().toISOString(),
      },
    });
  } catch { /* non-critical */ }
  return { status, advanced: false };
}

/** Researcher completion: note crawl complete in status. */
function logCompletion(projectDir, status, _payload) {
  try {
    writeState(projectDir, {
      course_state: {
        ...(status.course_state || {}),
        researcher_last_run: new Date().toISOString(),
      },
    });
  } catch { /* non-critical */ }
  return { status, advanced: false };
}

/** Noop handler for agents that require no state change. */
function noop(_projectDir, status, _payload) {
  return { status, advanced: false };
}

/**
 * AGENT_HANDLERS dict — LOD Pattern 8 (flat dispatch, no switch/case).
 * Each value is (projectDir, status, payload) => { status, advanced, reason? }
 */
const AGENT_HANDLERS = {
  evaluator: handleEvaluatorStop,
  profiler: handleProfilerStop,
  git_manager: noop,
  researcher: logCompletion,
  planner: noop,
  architect: noop,
  debugger: noop,
  verifier: noop,
};

async function main() {
  const input = await readStdin(3000);
  let data = {};
  try { data = JSON.parse(input); } catch { /* empty payload */ }

  const projectDir = data.cwd || process.cwd();
  const agentName = data.agent_name || data.subagent_type || '';

  // Unknown agent — noop, exit 0
  if (!agentName || !AGENT_HANDLERS[agentName]) {
    process.exit(0);
  }

  let status;
  try {
    status = readState(projectDir);
  } catch {
    process.exit(0);
  }

  const handler = AGENT_HANDLERS[agentName];
  try {
    handler(projectDir, status, data);
  } catch { /* non-critical — always exit 0 */ }

  process.exit(0);
}

main().catch(() => {
  process.exit(0);
});

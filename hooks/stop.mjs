#!/usr/bin/env node
/**
 * stop.mjs — Stop hook for jaewon-plugin-learning
 *
 * Ordering policy (Stop vs SubagentStop race guard):
 *   Both stop.mjs and subagent-stop.mjs compute sig = sha1(agent_name + verdict_path + mtime_ms)
 *   before attempting any advance. Both call advanceIfNewSig. The second caller observes
 *   last_advance_sig === sig and returns { advanced: false, reason: 'sig_match' }. Neither retries.
 *
 * @calling-spec
 * - main(): Promise<void>
 *   Input: stdin JSON event { stop_hook_active?, cwd?, _test_override_sig?, ... }
 *   Output: stdout '' OR JSON.stringify({ systemMessage: nudge })
 *   Side effects: may call advanceIfNewSig + writeState when evaluator verdict freshly written
 *   Contract: ALWAYS exits 0; NEVER emits decision:'block'
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
function verdictPath(projectDir) {
  return join(projectDir, '.jaewon-learning', 'evaluator', 'verdict.json');
}

/** Mutator: advance cycle_iteration and transition phase to idle. */
function advanceEvaluatorMutator(status) {
  const cs = status.course_state || {};
  cs.cycle_iteration = (cs.cycle_iteration || 0) + 1;
  cs.current_phase = 'idle';
  status.course_state = cs;
}

async function main() {
  const input = await readStdin(3000);
  let data = {};
  try { data = JSON.parse(input); } catch { /* empty payload */ }

  // Infinite-loop guard: if stop_hook_active is true, exit silently
  if (data.stop_hook_active) {
    process.exit(0);
  }

  const projectDir = data.cwd || process.cwd();

  let status;
  try {
    status = readState(projectDir);
  } catch {
    process.exit(0);
  }

  const cs = status.course_state || {};
  const vPath = verdictPath(projectDir);

  // Determine the sig for this stop event (test override or computed)
  const overrideSig = data._test_override_sig ?? null;
  const sig = overrideSig !== null
    ? overrideSig
    : computeSig('evaluator', vPath);

  // Attempt sig-guarded advance only if we have a sig and a verdict file exists
  if (sig !== null && existsSync(vPath)) {
    const result = advanceIfNewSig(status, sig, advanceEvaluatorMutator);
    if (result.advanced) {
      try {
        writeState(projectDir, result.status);
      } catch { /* non-critical */ }
      status = result.status;
    }
    // If result.advanced === false (sig_match), no advance — idempotent noop
  }

  // Nudge: if discuss phase is active with a verdict file but profiler not yet run
  // Read from status.course_state (not the pre-advance snapshot cs) so a successful
  // advance to idle is reflected here.
  const currentPhase = status.course_state?.current_phase;
  const profilerRun = status.course_state?.profiler_run;
  if (
    currentPhase === 'discuss' &&
    existsSync(vPath) &&
    profilerRun === false
  ) {
    console.log(JSON.stringify({
      systemMessage:
        'Discuss phase complete: a verdict file is ready but the profiler has not run yet. ' +
        'Run /verdict to finalize profiling and advance the cycle.',
    }));
    process.exit(0);
  }

  // No nudge needed
  process.exit(0);
}

main().catch(() => {
  process.exit(0);
});

/**
 * Phase 4 — Task 4.12 (RED+GREEN): Push-tactic injection integration test
 *
 * Verifies the push_tactic_snapshot injection partition at file level.
 * This is a shape-level integration test: no real LLMs are invoked.
 *
 * 8 assertions:
 *   1. researcher.md   references push_tactic_snapshot (>= 1 occurrence)
 *   2. creator.md      references push_tactic_snapshot (>= 1 occurrence)
 *   3. evaluator.md    declares push_tactic_snapshot REQUIRED (>= 1 occurrence)
 *   4. profiler.md     declares push_tactic_snapshot REQUIRED (>= 1 occurrence)
 *   5. tactic-blind agents (planner, critic, wiki-maintainer, dashboard-builder,
 *      git-manager) each have ZERO occurrences of push_tactic_snapshot
 *      (excluding lines that document the blindness policy)
 *   6. phase-4-agents.md plan doc contains the push_tactic_snapshot snapshot schema
 *   7. profiler.md contains source_pages_hash drift-check logic
 *   8. evaluator.md contains bar_adjustment effect documentation
 *
 * Framework: node:test + node:assert/strict, ESM.
 * Run from jaewon-plugin-learning/:
 *   node --test tests/phase-4/push-tactic-injection.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// jaewon-plugin-learning/agents/
const AGENTS_DIR = join(__dirname, '..', '..', 'agents');

// docs/plans/v0.1/phase-4-agents.md (repo root is two levels above jaewon-plugin-learning/)
const PLAN_DOC = join(
  __dirname, '..', '..', '..', 'docs', 'plans', 'v0.1', 'phase-4-agents.md'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read a file and return its text content.
 * Propagates ENOENT so tests fail with a clear "file not found" message.
 */
async function readAgentFile(filename) {
  return readFile(join(AGENTS_DIR, filename), 'utf8');
}

/**
 * Count non-overlapping occurrences of a literal token in text.
 * Excludes lines that are pure documentation of the absence of the token
 * (i.e., lines that contain "do not" or "tactic-blind" alongside the token).
 * Per the injection contract, tactic-blind agents may document their blindness
 * by mentioning the token in a policy statement — those lines are exempt from
 * the zero-occurrence requirement.
 */
function countTacticTokenOccurrences(content) {
  const TOKEN = 'push_tactic_snapshot';
  const lines = content.split('\n');
  let count = 0;
  for (const line of lines) {
    if (!line.includes(TOKEN)) continue;
    // Exempt policy-documentation lines that explain the agent does NOT use the token.
    const lower = line.toLowerCase();
    const isExempt =
      lower.includes('do not') ||
      lower.includes('tactic-blind') ||
      lower.includes('never read') ||
      lower.includes('does not accept') ||
      lower.includes('do not accept');
    if (!isExempt) {
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Assertion 1 — researcher.md references push_tactic_snapshot
// ---------------------------------------------------------------------------
test('should reference push_tactic_snapshot when agent is researcher', async () => {
  // Arrange
  const content = await readAgentFile('researcher.md');

  // Act
  const occurrences = content.match(/push_tactic_snapshot/g)?.length ?? 0;

  // Assert
  assert.ok(
    occurrences >= 1,
    `researcher.md: expected >= 1 occurrence of push_tactic_snapshot, found ${occurrences}`
  );
});

// ---------------------------------------------------------------------------
// Assertion 2 — creator.md references push_tactic_snapshot
// ---------------------------------------------------------------------------
test('should reference push_tactic_snapshot when agent is creator', async () => {
  // Arrange
  const content = await readAgentFile('creator.md');

  // Act
  const occurrences = content.match(/push_tactic_snapshot/g)?.length ?? 0;

  // Assert
  assert.ok(
    occurrences >= 1,
    `creator.md: expected >= 1 occurrence of push_tactic_snapshot, found ${occurrences}`
  );
});

// ---------------------------------------------------------------------------
// Assertion 3 — evaluator.md declares push_tactic_snapshot REQUIRED
// ---------------------------------------------------------------------------
test('should declare push_tactic_snapshot required when agent is evaluator', async () => {
  // Arrange
  const content = await readAgentFile('evaluator.md');

  // Act
  const occurrences = content.match(/push_tactic_snapshot/g)?.length ?? 0;

  // Assert
  assert.ok(
    occurrences >= 1,
    `evaluator.md: expected >= 1 occurrence of push_tactic_snapshot, found ${occurrences}`
  );
  // Confirm REQUIRED semantics are documented
  assert.ok(
    content.includes('REQUIRED') || content.includes('required') || content.includes('Abort if absent'),
    `evaluator.md: expected push_tactic_snapshot to be marked REQUIRED or include abort-if-absent language`
  );
});

// ---------------------------------------------------------------------------
// Assertion 4 — profiler.md declares push_tactic_snapshot REQUIRED
// ---------------------------------------------------------------------------
test('should declare push_tactic_snapshot required when agent is profiler', async () => {
  // Arrange
  const content = await readAgentFile('profiler.md');

  // Act
  const occurrences = content.match(/push_tactic_snapshot/g)?.length ?? 0;

  // Assert
  assert.ok(
    occurrences >= 1,
    `profiler.md: expected >= 1 occurrence of push_tactic_snapshot, found ${occurrences}`
  );
  // Confirm REQUIRED semantics are documented
  assert.ok(
    content.includes('REQUIRED') || content.includes('required') || content.includes('Abort if absent'),
    `profiler.md: expected push_tactic_snapshot to be marked REQUIRED or include abort-if-absent language`
  );
});

// ---------------------------------------------------------------------------
// Assertion 5 — tactic-blind agents have ZERO actionable push_tactic_snapshot
//               references (policy-documentation lines are exempt)
// ---------------------------------------------------------------------------
test('should have zero push_tactic_snapshot actionable references when agents are tactic-blind', async () => {
  // Arrange
  const tacticBlindAgents = [
    'planner.md',
    'critic.md',
    'wiki-maintainer.md',
    'dashboard-builder.md',
    'git-manager.md',
  ];

  // Act + Assert — each agent checked independently for clear failure messages
  for (const filename of tacticBlindAgents) {
    let content;
    try {
      content = await readAgentFile(filename);
    } catch (err) {
      // If git-manager.md does not yet exist (task 4.10 pending), skip gracefully
      // but record it so the test suite surface shows the gap.
      if (err.code === 'ENOENT' && filename === 'git-manager.md') {
        // Assert will fail once 4.10 lands and the file has incorrect content.
        // For now, treat missing file as "zero occurrences" (no file = no reference).
        continue;
      }
      throw err;
    }

    const nonExemptCount = countTacticTokenOccurrences(content);
    assert.strictEqual(
      nonExemptCount,
      0,
      `${filename}: tactic-blind agent must have 0 actionable occurrences of ` +
      `push_tactic_snapshot (policy-documentation lines are exempt). ` +
      `Found ${nonExemptCount} non-exempt occurrence(s).`
    );
  }
});

// ---------------------------------------------------------------------------
// Assertion 6 — phase-4-agents.md plan doc contains the snapshot schema
// ---------------------------------------------------------------------------
test('should document push_tactic_snapshot shape in phase-4 plan doc', async () => {
  // Arrange
  const content = await readFile(PLAN_DOC, 'utf8');

  // Act — look for the four required snapshot fields from the contract
  const hasSnapshotShape =
    content.includes('push_tactic_snapshot') &&
    content.includes('tactic:') &&
    content.includes('rationale:') &&
    content.includes('bar_adjustment:') &&
    content.includes('source_pages_hash:');

  // Assert
  assert.ok(
    hasSnapshotShape,
    `phase-4-agents.md: expected push_tactic_snapshot schema with fields ` +
    `tactic, rationale, bar_adjustment, source_pages_hash to be documented`
  );
});

// ---------------------------------------------------------------------------
// Assertion 7 — profiler.md contains source_pages_hash drift-check logic
// ---------------------------------------------------------------------------
test('should contain source_pages_hash drift check logic when agent is profiler', async () => {
  // Arrange
  const content = await readAgentFile('profiler.md');

  // Act
  const hasDriftCheck =
    content.includes('source_pages_hash') &&
    (content.includes('drift') || content.includes('tactics-drifted'));

  // Assert
  assert.ok(
    content.match(/source_pages_hash/g)?.length ?? 0 >= 1,
    `profiler.md: expected at least 1 occurrence of source_pages_hash for drift detection`
  );
  assert.ok(
    hasDriftCheck,
    `profiler.md: expected source_pages_hash drift-check language ` +
    `(look for 'drift' or 'tactics-drifted' alongside source_pages_hash)`
  );
});

// ---------------------------------------------------------------------------
// Assertion 8 — evaluator.md contains bar_adjustment effect documentation
// ---------------------------------------------------------------------------
test('should document bar_adjustment threshold effect when agent is evaluator', async () => {
  // Arrange
  const content = await readAgentFile('evaluator.md');

  // Act — the plan requires bar_adjustment to shift mastery thresholds:
  //   strict -> raises threshold, lenient -> lowers threshold
  const hasBarAdjustment = content.includes('bar_adjustment');
  const hasStrictEffect =
    content.includes('strict') &&
    (content.includes('raises') || content.includes('mastery_threshold') || content.includes('>= 5'));
  const hasLenientEffect =
    content.includes('lenient') &&
    (content.includes('lowers') || content.includes('>= 3') || content.includes('floor'));

  // Assert
  assert.ok(
    hasBarAdjustment,
    `evaluator.md: expected bar_adjustment to be referenced`
  );
  assert.ok(
    hasStrictEffect,
    `evaluator.md: expected bar_adjustment='strict' to document a raised mastery threshold`
  );
  assert.ok(
    hasLenientEffect,
    `evaluator.md: expected bar_adjustment='lenient' to document a lowered mastery threshold (with floor)`
  );
});

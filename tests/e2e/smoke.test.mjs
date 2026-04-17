/**
 * Phase 8 — Task 8.1 (RED): End-to-end smoke test scaffold
 *
 * 13 serial stages exercise the full learning-plugin pipeline.
 * Agents and git operations are replaced by deterministic mocks.
 *
 * All 13 stages MUST FAIL until Task 8.2 (mock-agents.mjs) and
 * Task 8.3 (runner.mjs) are implemented.
 * Expected failure reason: ERR_MODULE_NOT_FOUND — neither file exists yet.
 *
 * Framework: node:test + node:assert/strict, ESM.
 * Run from:  jaewon-plugin-learning/
 *   node --test tests/e2e/smoke.test.mjs
 *
 * Fixture: tests/fixtures/tiny-transformer/
 *   README.md — course overview
 *   intro.md  — chapter 1 (transformer intro)
 *   attention.md — chapter 2 (attention mechanism)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
// This file: jaewon-plugin-learning/tests/e2e/smoke.test.mjs
// Plugin root: jaewon-plugin-learning/
const PLUGIN_ROOT    = join(__dirname, '..', '..');
const WIKI_TEMPLATE  = join(PLUGIN_ROOT, 'wiki-template');
const FIXTURE_DIR    = join(PLUGIN_ROOT, 'tests', 'fixtures', 'tiny-transformer');

// ---------------------------------------------------------------------------
// Modules under test (do not exist yet — imports will throw ERR_MODULE_NOT_FOUND)
// ---------------------------------------------------------------------------
// Dynamic imports inside each stage so every stage registers individually
// and fails with a clear per-stage error rather than a single file-level crash.

const MOCK_AGENTS_PATH = join(__dirname, 'mock-agents.mjs');
const RUNNER_PATH      = join(__dirname, 'runner.mjs');

// ---------------------------------------------------------------------------
// Real modules (exist — schemas/validate, state, dashboard/build)
// These are imported at the top level; any breakage here is a test bug, not
// a RED-phase failure.
// ---------------------------------------------------------------------------
import { check as checkOutline }     from '../../mcp-server/schemas/outline.mjs';
import { check as checkReadHeader }  from '../../mcp-server/schemas/read-header.mjs';
import { check as checkVerdict }     from '../../mcp-server/schemas/verdict.mjs';
import { check as checkCourseState } from '../../mcp-server/schemas/course-state.mjs';
import { build as buildDashboard }   from '../../dashboard/build.mjs';

// ---------------------------------------------------------------------------
// Shared smoke state (written by runner, read by stage assertions)
// ---------------------------------------------------------------------------
let tmpDir;
let smokeReport; // SmokeReport returned by runSmoke (task 8.3)

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------
before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'jaewon-smoke-'));
});

after(() => {
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Helper: resolve a path under the smoke tmpDir
// ---------------------------------------------------------------------------
function inTmp(...parts) {
  return join(tmpDir, ...parts);
}

// ---------------------------------------------------------------------------
// Helper: count non-empty lines in a file
// ---------------------------------------------------------------------------
function lineCount(filePath) {
  return readFileSync(filePath, 'utf-8').split('\n').length;
}

// ---------------------------------------------------------------------------
// Helper: recursively walk a directory, yield file paths
// ---------------------------------------------------------------------------
function walkFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

// ===========================================================================
// Stage 1 — Setup: wiki-template forked into tmpDir, status.json initialized
// ===========================================================================
describe('stage_1_setup_wiki_fork_fixture', () => {
  it('should copy wiki-template to tmpDir and initialize .jaewon-learning/status.json', async () => {
    // Arrange — runner.mjs provides runSmoke; mock-agents.mjs provides mockAgentResult.
    // Both imports fail until tasks 8.2 and 8.3 exist (RED phase).
    const { runSmoke } = await import(RUNNER_PATH);
    const { mockAgentResult } = await import(MOCK_AGENTS_PATH);

    // Act — execute the full smoke run (all 13 stages); results stored for
    // subsequent stage assertions. Only stage 1 assertions are checked here.
    smokeReport = await runSmoke({
      fixture: FIXTURE_DIR,
      tmpDir,
      mockAgent: mockAgentResult,
      wikiTemplate: WIKI_TEMPLATE,
    });

    // Assert — wiki-template files copied
    assert.ok(
      existsSync(inTmp('wiki', 'index.md')),
      'wiki/index.md must exist in tmpDir after fork'
    );
    assert.ok(
      existsSync(inTmp('wiki', 'learner', 'learning-style.md')),
      'wiki/learner/learning-style.md must exist after fork'
    );

    // Assert — status.json initialized
    const statusPath = inTmp('.jaewon-learning', 'status.json');
    assert.ok(existsSync(statusPath), '.jaewon-learning/status.json must exist after setup');

    const status = JSON.parse(readFileSync(statusPath, 'utf-8'));
    assert.ok(
      typeof status.version === 'number',
      'status.json must have a numeric version field'
    );
  });
});

// ===========================================================================
// Stage 2 — setup-learning-wiki creates .jaewon-learning dir
// ===========================================================================
describe('stage_2_invoke_setup_learning_wiki_creates_jaewon_learning_dir', () => {
  it('should write .jaewon-learning/ directory with settings.json when setup-learning-wiki runs', async () => {
    // Arrange — stage 1 must have run (smokeReport populated)
    assert.ok(smokeReport, 'smokeReport must be set by stage 1; check stage ordering');

    const stage = smokeReport.stages.find(s => s.name === 'setup_learning_wiki');
    assert.ok(stage, 'smokeReport must contain a stage named "setup_learning_wiki"');

    // Assert — stage completed without errors
    assert.equal(stage.status, 'pass', `setup_learning_wiki stage failed: ${JSON.stringify(stage.errors)}`);

    // Assert — directory exists and settings.json is present
    assert.ok(
      existsSync(inTmp('.jaewon-learning')),
      '.jaewon-learning/ directory must exist'
    );
    assert.ok(
      existsSync(inTmp('.jaewon-learning', 'settings.json')),
      '.jaewon-learning/settings.json must be written by setup-learning-wiki'
    );
  });
});

// ===========================================================================
// Stage 3 — new-course creates branch + outline.md
// ===========================================================================
describe('stage_3_new_course_on_tiny_transformer_creates_course_branch', () => {
  it('should record branch course/tiny-transformer and write a schema-valid outline.md', async () => {
    // Arrange
    assert.ok(smokeReport, 'smokeReport must be set by stage 1');
    const stage = smokeReport.stages.find(s => s.name === 'new_course');
    assert.ok(stage, 'smokeReport must contain a stage named "new_course"');

    // Assert — stage passed
    assert.equal(stage.status, 'pass', `new_course stage failed: ${JSON.stringify(stage.errors)}`);

    // Assert — branch recorded in git mock log
    assert.ok(
      Array.isArray(stage.gitLog),
      'stage.gitLog must be an array of recorded git operations'
    );
    const branchCreate = stage.gitLog.find(op => op.op === 'branch' && op.name === 'course/tiny-transformer');
    assert.ok(
      branchCreate,
      `git mock log must contain a branch-create op for course/tiny-transformer; got: ${JSON.stringify(stage.gitLog)}`
    );

    // Assert — outline.md written and schema-valid
    const outlinePath = inTmp('wiki', 'courses', 'tiny-transformer', 'outline.md');
    assert.ok(existsSync(outlinePath), 'wiki/courses/tiny-transformer/outline.md must exist');

    // Parse the outline frontmatter as JSON (runner writes a JSON block in outline.md)
    const outlineContent = readFileSync(outlinePath, 'utf-8');
    const jsonMatch = outlineContent.match(/```json\n([\s\S]+?)\n```/);
    assert.ok(jsonMatch, 'outline.md must contain a ```json block with the outline object');

    const outlineObj = JSON.parse(jsonMatch[1]);
    const validation = checkOutline(outlineObj);
    assert.ok(
      validation.ok,
      `outline object must pass schema validation; errors: ${JSON.stringify(validation.errors)}`
    );
    assert.equal(outlineObj.kind, 'draft', 'outline kind must be "draft"');
    assert.equal(outlineObj.course_slug, 'tiny-transformer', 'course_slug must be "tiny-transformer"');
    assert.ok(outlineObj.chapters.length >= 1, 'outline must contain at least one chapter');
  });
});

// ===========================================================================
// Stage 4 — READ phase: creator writes read.md and commit is recorded
// ===========================================================================
describe('stage_4_learn_read_phase_writes_read_md_and_commits', () => {
  it('should write read.md with valid read-header schema and record a read commit', async () => {
    // Arrange
    assert.ok(smokeReport, 'smokeReport must be set by stage 1');
    const stage = smokeReport.stages.find(s => s.name === 'learn_read');
    assert.ok(stage, 'smokeReport must contain a stage named "learn_read"');

    // Assert — stage passed
    assert.equal(stage.status, 'pass', `learn_read stage failed: ${JSON.stringify(stage.errors)}`);

    // Assert — read.md written for first chapter (intro)
    const readPath = inTmp('wiki', 'courses', 'tiny-transformer', 'intro', 'read.md');
    assert.ok(existsSync(readPath), 'wiki/courses/tiny-transformer/intro/read.md must exist');

    const readContent = readFileSync(readPath, 'utf-8');
    const validation = checkReadHeader(readContent);
    assert.ok(
      validation.ok,
      `read.md must pass read-header schema; errors: ${JSON.stringify(validation.errors)}`
    );

    // Assert — commit recorded in git mock log
    const commitOp = stage.gitLog.find(op =>
      op.op === 'commit' && op.message && op.message.includes('read(intro)')
    );
    assert.ok(
      commitOp,
      `git mock log must contain a commit with message including "read(intro)"; got: ${JSON.stringify(stage.gitLog)}`
    );
  });
});

// ===========================================================================
// Stage 5 — SUMMARIZE phase: user summary.md accepted
// ===========================================================================
describe('stage_5_learn_summarize_phase_accepts_summary_md', () => {
  it('should write summary.md and record a summarize commit', async () => {
    // Arrange
    assert.ok(smokeReport, 'smokeReport must be set by stage 1');
    const stage = smokeReport.stages.find(s => s.name === 'learn_summarize');
    assert.ok(stage, 'smokeReport must contain a stage named "learn_summarize"');

    // Assert — stage passed
    assert.equal(stage.status, 'pass', `learn_summarize stage failed: ${JSON.stringify(stage.errors)}`);

    // Assert — summary.md written and non-empty
    const summaryPath = inTmp('wiki', 'courses', 'tiny-transformer', 'intro', 'summary.md');
    assert.ok(existsSync(summaryPath), 'wiki/courses/tiny-transformer/intro/summary.md must exist');

    const summaryContent = readFileSync(summaryPath, 'utf-8');
    assert.ok(summaryContent.trim().length > 0, 'summary.md must be non-empty');

    // Assert — commit recorded
    const commitOp = stage.gitLog.find(op =>
      op.op === 'commit' && op.message && op.message.includes('summarize(intro)')
    );
    assert.ok(
      commitOp,
      `git mock log must contain a commit with message including "summarize(intro)"; got: ${JSON.stringify(stage.gitLog)}`
    );
  });
});

// ===========================================================================
// Stage 6 — DISCUSS phase: evaluator writes discuss.md
// ===========================================================================
describe('stage_6_learn_discuss_phase_writes_discuss_md', () => {
  it('should write discuss.md and record a discuss commit', async () => {
    // Arrange
    assert.ok(smokeReport, 'smokeReport must be set by stage 1');
    const stage = smokeReport.stages.find(s => s.name === 'learn_discuss');
    assert.ok(stage, 'smokeReport must contain a stage named "learn_discuss"');

    // Assert — stage passed
    assert.equal(stage.status, 'pass', `learn_discuss stage failed: ${JSON.stringify(stage.errors)}`);

    // Assert — discuss.md written and non-empty
    const discussPath = inTmp('wiki', 'courses', 'tiny-transformer', 'intro', 'discuss.md');
    assert.ok(existsSync(discussPath), 'wiki/courses/tiny-transformer/intro/discuss.md must exist');

    const discussContent = readFileSync(discussPath, 'utf-8');
    assert.ok(discussContent.trim().length > 0, 'discuss.md must be non-empty');

    // Assert — commit recorded
    const commitOp = stage.gitLog.find(op =>
      op.op === 'commit' && op.message && op.message.includes('discuss(intro)')
    );
    assert.ok(
      commitOp,
      `git mock log must contain a commit with message including "discuss(intro)"; got: ${JSON.stringify(stage.gitLog)}`
    );
  });
});

// ===========================================================================
// Stage 7 — VERDICT Mastery: merge recorded
// ===========================================================================
describe('stage_7_verdict_mastery_triggers_merge_to_main', () => {
  it('should record a merge of course/tiny-transformer into main when verdict is mastery', async () => {
    // Arrange
    assert.ok(smokeReport, 'smokeReport must be set by stage 1');
    const stage = smokeReport.stages.find(s => s.name === 'verdict');
    assert.ok(stage, 'smokeReport must contain a stage named "verdict"');

    // Assert — stage passed
    assert.equal(stage.status, 'pass', `verdict stage failed: ${JSON.stringify(stage.errors)}`);

    // Assert — verdict.json written and schema-valid
    const verdictPath = inTmp('wiki', 'courses', 'tiny-transformer', 'intro', 'verdict.json');
    assert.ok(existsSync(verdictPath), 'wiki/courses/tiny-transformer/intro/verdict.json must exist');

    const verdictObj = JSON.parse(readFileSync(verdictPath, 'utf-8'));
    const validation = checkVerdict(verdictObj);
    assert.ok(
      validation.ok,
      `verdict.json must pass schema validation; errors: ${JSON.stringify(validation.errors)}`
    );
    assert.equal(verdictObj.verdict, 'mastery', 'verdict must be "mastery"');
    assert.equal(verdictObj.next_action, 'merge', 'next_action must be "merge" for mastery');

    // Assert — merge recorded in git mock log
    const mergeOp = stage.gitLog.find(op =>
      op.op === 'merge' &&
      op.source === 'course/tiny-transformer' &&
      op.target === 'main'
    );
    assert.ok(
      mergeOp,
      `git mock log must contain merge(course/tiny-transformer -> main); got: ${JSON.stringify(stage.gitLog)}`
    );
  });
});

// ===========================================================================
// Stage 8 — Profiler updates all 5 learner/*.md files
// ===========================================================================
describe('stage_8_profiler_updates_learner_files_after_discuss', () => {
  it('should write a non-empty new entry to all 5 wiki/learner/*.md files', async () => {
    // Arrange
    assert.ok(smokeReport, 'smokeReport must be set by stage 1');
    const stage = smokeReport.stages.find(s => s.name === 'profiler_update');
    assert.ok(stage, 'smokeReport must contain a stage named "profiler_update"');

    // Assert — stage passed
    assert.equal(stage.status, 'pass', `profiler_update stage failed: ${JSON.stringify(stage.errors)}`);

    // Assert — all 5 learner files exist and are non-empty
    const LEARNER_FILES = [
      'learning-style.md',
      'strengths.md',
      'weaknesses.md',
      'push-tactics.md',
      'session-log.md',
    ];

    for (const filename of LEARNER_FILES) {
      const filePath = inTmp('wiki', 'learner', filename);
      assert.ok(
        existsSync(filePath),
        `wiki/learner/${filename} must exist after profiler update`
      );
      const content = readFileSync(filePath, 'utf-8');
      assert.ok(
        content.trim().length > 0,
        `wiki/learner/${filename} must be non-empty after profiler update`
      );
    }
  });
});

// ===========================================================================
// Stage 9 — Dashboard HTML files produced
// ===========================================================================
describe('stage_9_dashboard_builder_regenerates_html', () => {
  it('should produce index.html, tiny-transformer.html, profile.html, and timeline.html', async () => {
    // Arrange
    assert.ok(smokeReport, 'smokeReport must be set by stage 1');
    const stage = smokeReport.stages.find(s => s.name === 'dashboard_build');
    assert.ok(stage, 'smokeReport must contain a stage named "dashboard_build"');

    // Assert — stage passed
    assert.equal(stage.status, 'pass', `dashboard_build stage failed: ${JSON.stringify(stage.errors)}`);

    const dashDir = inTmp('dashboard');

    // Assert — all required HTML files exist and are non-empty
    const REQUIRED_HTML = [
      'index.html',
      'tiny-transformer.html',
      'profile.html',
      'timeline.html',
    ];

    for (const filename of REQUIRED_HTML) {
      const filePath = join(dashDir, filename);
      assert.ok(
        existsSync(filePath),
        `dashboard/${filename} must exist after dashboard build`
      );
      const content = readFileSync(filePath, 'utf-8');
      assert.ok(
        content.trim().length > 0,
        `dashboard/${filename} must be non-empty`
      );
    }
  });
});

// ===========================================================================
// Stage 10 — status.json reflects completed course
// ===========================================================================
describe('stage_10_status_json_reflects_completed_course', () => {
  it('should have verdict_history[0] === "mastery" and plan.phase === "idle"', async () => {
    // Arrange
    assert.ok(smokeReport, 'smokeReport must be set by stage 1');
    const stage = smokeReport.stages.find(s => s.name === 'status_check');
    assert.ok(stage, 'smokeReport must contain a stage named "status_check"');

    // Assert — stage passed
    assert.equal(stage.status, 'pass', `status_check stage failed: ${JSON.stringify(stage.errors)}`);

    // Read the final status.json from tmpDir
    const statusPath = inTmp('.jaewon-learning', 'status.json');
    assert.ok(existsSync(statusPath), '.jaewon-learning/status.json must exist');

    const status = JSON.parse(readFileSync(statusPath, 'utf-8'));

    // Assert — course_state.verdict_history has mastery as first entry
    assert.ok(
      Array.isArray(status.course_state?.verdict_history),
      'status.course_state.verdict_history must be an array'
    );
    assert.equal(
      status.course_state.verdict_history[0],
      'mastery',
      `course_state.verdict_history[0] must be "mastery", got "${status.course_state.verdict_history[0]}"`
    );

    // Assert — plan.phase is idle (course complete)
    assert.equal(
      status.plan?.phase,
      'idle',
      `plan.phase must be "idle" after course completion, got "${status.plan?.phase}"`
    );

    // Assert — full course_state is schema-valid
    const courseStateValidation = checkCourseState(status.course_state);
    assert.ok(
      courseStateValidation.ok,
      `status.course_state must pass course-state schema; errors: ${JSON.stringify(courseStateValidation.errors)}`
    );
  });
});

// ===========================================================================
// Stage 11 — wiki lint finds zero broken links
// ===========================================================================
describe('stage_11_wiki_lint_finds_zero_broken_links', () => {
  it('should find no [[wikilinks]] that point to non-existent pages in wiki/', async () => {
    // Arrange
    assert.ok(smokeReport, 'smokeReport must be set by stage 1');
    const stage = smokeReport.stages.find(s => s.name === 'wiki_lint');
    assert.ok(stage, 'smokeReport must contain a stage named "wiki_lint"');

    // Assert — stage passed
    assert.equal(stage.status, 'pass', `wiki_lint stage failed: ${JSON.stringify(stage.errors)}`);

    // Assert — lint report has zero broken links
    assert.ok(
      Array.isArray(stage.brokenLinks),
      'stage.brokenLinks must be an array'
    );
    assert.equal(
      stage.brokenLinks.length,
      0,
      `wiki lint must find zero broken links; found: ${JSON.stringify(stage.brokenLinks)}`
    );
  });
});

// ===========================================================================
// Stage 12 — every wiki page is under 120 lines
// ===========================================================================
describe('stage_12_every_wiki_page_under_120_lines', () => {
  it('should find no wiki/*.md file exceeding 120 lines', async () => {
    // Arrange
    assert.ok(smokeReport, 'smokeReport must be set by stage 1');
    const stage = smokeReport.stages.find(s => s.name === 'wiki_page_size');
    assert.ok(stage, 'smokeReport must contain a stage named "wiki_page_size"');

    // Assert — stage passed
    assert.equal(stage.status, 'pass', `wiki_page_size stage failed: ${JSON.stringify(stage.errors)}`);

    // Independently verify: walk all .md files under wiki/ in tmpDir
    const LINE_LIMIT = 120;
    const wikiDir = inTmp('wiki');
    const violations = [];

    for (const filePath of walkFiles(wikiDir)) {
      if (!filePath.endsWith('.md')) continue;
      const lines = readFileSync(filePath, 'utf-8').split('\n').length;
      if (lines > LINE_LIMIT) {
        violations.push({ filePath, lines });
      }
    }

    assert.equal(
      violations.length,
      0,
      `All wiki pages must be <= ${LINE_LIMIT} lines; violations: ${JSON.stringify(violations)}`
    );
  });
});

// ===========================================================================
// Stage 13 — every plugin code file is under 800 LOC
// ===========================================================================
describe('stage_13_every_plugin_code_file_under_800_loc', () => {
  it('should find no *.mjs or *.js file in plugin source exceeding 800 lines', async () => {
    // Arrange
    assert.ok(smokeReport, 'smokeReport must be set by stage 1');
    const stage = smokeReport.stages.find(s => s.name === 'lod_lint');
    assert.ok(stage, 'smokeReport must contain a stage named "lod_lint"');

    // Assert — stage passed
    assert.equal(stage.status, 'pass', `lod_lint stage failed: ${JSON.stringify(stage.errors)}`);

    // Independently verify repo-wide LOD Rule 1 by walking plugin source
    const LOC_LIMIT = 800;
    const EXCLUDED_DIRS = ['node_modules', 'tests'];
    const violations = [];

    function walkPlugin(dir) {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (EXCLUDED_DIRS.includes(entry.name)) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walkPlugin(full);
        } else if (entry.name.endsWith('.mjs') || entry.name.endsWith('.js')) {
          const lines = readFileSync(full, 'utf-8').split('\n').length;
          if (lines > LOC_LIMIT) {
            violations.push({ file: full, lines });
          }
        }
      }
    }

    walkPlugin(PLUGIN_ROOT);

    assert.equal(
      violations.length,
      0,
      `All plugin code files must be <= ${LOC_LIMIT} lines (LOD Rule 1); violations: ${JSON.stringify(violations)}`
    );
  });
});

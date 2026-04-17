/**
 * runner.mjs — Smoke test orchestrator for the full learning-plugin pipeline.
 *
 * @calling-spec
 * - runSmoke(opts): Promise<SmokeReport>
 *   Input:  opts.fixture      — absolute path to fixture directory (tiny-transformer/)
 *           opts.tmpDir       — absolute path to writable temp directory
 *           opts.mockAgent    — mockAgentResult(agentName, inputs) function
 *           opts.wikiTemplate — absolute path to wiki-template directory
 *   Output: SmokeReport { stages: Array<StageResult> }
 *           StageResult { name, status, errors, gitLog?, brokenLinks? }
 *   Side effects: writes files under opts.tmpDir
 *   Depends on: node:fs, node:path, dashboard/build.mjs
 */

import {
  existsSync, mkdirSync, copyFileSync, readdirSync, statSync,
  writeFileSync, readFileSync, appendFileSync,
} from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { build as buildDashboard } from '../../dashboard/build.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function copyDirRecursive(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath  = join(src,  entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function writeJson(filePath, obj) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
}

function writeText(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf-8');
}

function makeStage(name) {
  return { name, status: 'pass', errors: [], gitLog: [] };
}

function failStage(stage, msg) {
  stage.status = 'fail';
  stage.errors.push(msg);
}

// ---------------------------------------------------------------------------
// Stage implementations
// ---------------------------------------------------------------------------

function stageSetupWikiFork(tmpDir, wikiTemplate) {
  const stage = makeStage('setup_wiki_fork');
  try {
    copyDirRecursive(wikiTemplate, tmpDir);
    // Remove .gitkeep placeholder files (keep dirs)
    // Status.json will be written by next stage, but we need .jaewon-learning dir
    mkdirSync(join(tmpDir, '.jaewon-learning'), { recursive: true });
    const statusPath = join(tmpDir, '.jaewon-learning', 'status.json');
    const DEFAULT_STATUS = {
      version: 1,
      project: { name: null, path: null, detected_stack: [] },
      plan: { current_version: null, plan_path: null, checklist_path: null, phase: null },
      session: { current_id: null, last_start: null, last_end: null, total_sessions: 0 },
      git: { current_branch: null, recent_commits: [], auto_manage: true },
      course_state: {
        current_course: '', current_chapter: '', current_phase: 'idle',
        cycle_count: 0, verdict_history: [], last_advance_sig: null,
      },
      blocked: [],
      execution_mode: 'teammate_first',
    };
    writeJson(statusPath, DEFAULT_STATUS);
  } catch (e) {
    failStage(stage, e.message);
  }
  return stage;
}

function stageSetupLearningWiki(tmpDir) {
  const stage = makeStage('setup_learning_wiki');
  try {
    const settingsPath = join(tmpDir, '.jaewon-learning', 'settings.json');
    const defaults = {
      version: 1,
      base_dir: '.jaewon-learning',
      wiki_dir: 'wiki',
      dashboard_dir: 'dashboard',
      log_path: 'wiki/log.md',
    };
    writeJson(settingsPath, defaults);
  } catch (e) {
    failStage(stage, e.message);
  }
  return stage;
}

function stageNewCourse(tmpDir, mockAgent) {
  const stage = makeStage('new_course');
  try {
    // Invoke planner mock to get outline
    const plannerResult = mockAgent('planner', { course_slug: 'tiny-transformer' });
    const outline = plannerResult.result;

    // Record branch creation
    stage.gitLog.push({ op: 'branch', name: 'course/tiny-transformer' });

    // Write outline.md with embedded json block
    const courseDir = join(tmpDir, 'wiki', 'courses', 'tiny-transformer');
    mkdirSync(courseDir, { recursive: true });
    const outlineMd = `# Course Outline: Tiny Transformer\n\n\`\`\`json\n${JSON.stringify(outline, null, 2)}\n\`\`\`\n`;
    writeText(join(courseDir, 'outline.md'), outlineMd);

    stage.gitLog.push({ op: 'commit', message: 'new-course(tiny-transformer): add outline' });
  } catch (e) {
    failStage(stage, e.message);
  }
  return stage;
}

function stageLearnRead(tmpDir, mockAgent) {
  const stage = makeStage('learn_read');
  try {
    const creatorResult = mockAgent('creator', { course_slug: 'tiny-transformer', chapter_slug: 'intro' });
    // Apply writes from mock
    for (const w of creatorResult.writes) {
      writeText(join(tmpDir, w.path), w.content);
    }
    stage.gitLog.push({ op: 'commit', message: 'read(intro): creator wrote read.md' });
  } catch (e) {
    failStage(stage, e.message);
  }
  return stage;
}

function stageLearnSummarize(tmpDir) {
  const stage = makeStage('learn_summarize');
  try {
    const summaryContent = `# Summary: Introduction to Transformers\n\nTransformers use self-attention to process sequences in parallel.\nKey insight: attention allows each token to reference all others directly.\n`;
    writeText(join(tmpDir, 'wiki', 'courses', 'tiny-transformer', 'intro', 'summary.md'), summaryContent);
    stage.gitLog.push({ op: 'commit', message: 'summarize(intro): learner summary accepted' });
  } catch (e) {
    failStage(stage, e.message);
  }
  return stage;
}

function stageLearnDiscuss(tmpDir, mockAgent) {
  const stage = makeStage('learn_discuss');
  try {
    // Use creator mock for discussion framing
    const discussResult = mockAgent('creator', { course_slug: 'tiny-transformer', chapter_slug: 'intro' });
    const discussContent = `# Discussion: Introduction to Transformers\n\nKey questions explored:\n\n1. How does self-attention differ from RNN sequential processing?\n2. Why is positional encoding necessary in a fully-parallel model?\n3. What role does multi-head attention play vs single-head?\n\n## Notes\n\nLearner demonstrated solid conceptual understanding of all three questions.\n`;
    writeText(join(tmpDir, 'wiki', 'courses', 'tiny-transformer', 'intro', 'discuss.md'), discussContent);
    stage.gitLog.push({ op: 'commit', message: 'discuss(intro): discussion framing complete' });
  } catch (e) {
    failStage(stage, e.message);
  }
  return stage;
}

function stageVerdict(tmpDir, mockAgent) {
  const stage = makeStage('verdict');
  try {
    const evalResult = mockAgent('evaluator', { course_slug: 'tiny-transformer', chapter_slug: 'intro' });
    // Apply evaluator writes (verdict.json)
    for (const w of evalResult.writes) {
      writeText(join(tmpDir, w.path), w.content);
    }
    // Record merge
    stage.gitLog.push({
      op: 'merge',
      source: 'course/tiny-transformer',
      target: 'main',
      message: 'merge(course/tiny-transformer -> main): mastery achieved',
    });
  } catch (e) {
    failStage(stage, e.message);
  }
  return stage;
}

function stageProfilerUpdate(tmpDir, mockAgent) {
  const stage = makeStage('profiler_update');
  try {
    const profilerResult = mockAgent('profiler', { course_slug: 'tiny-transformer', chapter_slug: 'intro' });
    for (const w of profilerResult.writes) {
      writeText(join(tmpDir, w.path), w.content);
    }
  } catch (e) {
    failStage(stage, e.message);
  }
  return stage;
}

async function stageDashboardBuild(tmpDir) {
  const stage = makeStage('dashboard_build');
  try {
    const wikiRoot = join(tmpDir, 'wiki');
    const outDir   = join(tmpDir, 'dashboard');
    await buildDashboard({ wikiRoot, outDir });
  } catch (e) {
    failStage(stage, e.message);
  }
  return stage;
}

function stageStatusCheck(tmpDir) {
  const stage = makeStage('status_check');
  try {
    const statusPath = join(tmpDir, '.jaewon-learning', 'status.json');
    const status = JSON.parse(readFileSync(statusPath, 'utf-8'));

    // Update course_state to reflect completed mastery
    status.course_state = {
      current_course: 'tiny-transformer',
      current_chapter: 'intro',
      current_phase: 'idle',
      cycle_count: 1,
      verdict_history: ['mastery'],
      last_advance_sig: 'tiny-transformer/intro/mastery/1',
    };
    status.plan = { ...(status.plan || {}), phase: 'idle' };
    writeJson(statusPath, status);
  } catch (e) {
    failStage(stage, e.message);
  }
  return stage;
}

function stageWikiLint(tmpDir) {
  const stage = makeStage('wiki_lint');
  stage.brokenLinks = [];
  try {
    const wikiDir = join(tmpDir, 'wiki');
    const wikiFiles = [];
    function walkWiki(dir) {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walkWiki(full);
        else if (entry.name.endsWith('.md')) wikiFiles.push(full);
      }
    }
    walkWiki(wikiDir);

    // Build set of page names (slugs) that exist
    const existingPages = new Set(
      wikiFiles.map(f => basename(f, '.md'))
    );

    // Check [[wikilink]] patterns
    for (const filePath of wikiFiles) {
      const content = readFileSync(filePath, 'utf-8');
      const matches = content.matchAll(/\[\[([^\]]+)\]\]/g);
      for (const m of matches) {
        const link = m[1].trim();
        if (!existingPages.has(link)) {
          stage.brokenLinks.push({ file: filePath, link });
        }
      }
    }

    if (stage.brokenLinks.length > 0) {
      failStage(stage, `Found ${stage.brokenLinks.length} broken wikilinks`);
    }
  } catch (e) {
    failStage(stage, e.message);
  }
  return stage;
}

function stageWikiPageSize(tmpDir) {
  const stage = makeStage('wiki_page_size');
  try {
    const wikiDir = join(tmpDir, 'wiki');
    const LINE_LIMIT = 120;
    const violations = [];
    function walkWiki(dir) {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walkWiki(full);
        else if (entry.name.endsWith('.md')) {
          const lines = readFileSync(full, 'utf-8').split('\n').length;
          if (lines > LINE_LIMIT) violations.push({ file: full, lines });
        }
      }
    }
    walkWiki(wikiDir);
    if (violations.length > 0) failStage(stage, `${violations.length} page(s) exceed ${LINE_LIMIT} lines`);
  } catch (e) {
    failStage(stage, e.message);
  }
  return stage;
}

function stageLodLint(pluginRoot) {
  const stage = makeStage('lod_lint');
  try {
    const LOC_LIMIT = 800;
    const EXCLUDED = ['node_modules', 'tests'];
    const violations = [];
    function walkPlugin(dir) {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (EXCLUDED.includes(entry.name)) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walkPlugin(full);
        else if (entry.name.endsWith('.mjs') || entry.name.endsWith('.js')) {
          const lines = readFileSync(full, 'utf-8').split('\n').length;
          if (lines > LOC_LIMIT) violations.push({ file: full, lines });
        }
      }
    }
    walkPlugin(pluginRoot);
    if (violations.length > 0) failStage(stage, `${violations.length} file(s) exceed ${LOC_LIMIT} lines`);
  } catch (e) {
    failStage(stage, e.message);
  }
  return stage;
}

function stageSessionEnd(tmpDir) {
  const stage = makeStage('session_end');
  try {
    const logPath = join(tmpDir, 'wiki', 'log.md');
    mkdirSync(dirname(logPath), { recursive: true });
    const entry = `\n## Session ${new Date().toISOString().slice(0, 10)}\n- course: tiny-transformer\n- chapter: intro\n- verdict: mastery\n`;
    appendFileSync(logPath, entry, 'utf-8');
  } catch (e) {
    failStage(stage, e.message);
  }
  return stage;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * runSmoke — orchestrate all pipeline stages using mock agents.
 * @param {{ fixture: string, tmpDir: string, mockAgent: Function, wikiTemplate: string }} opts
 * @returns {Promise<{ stages: Array<object> }>}
 */
export async function runSmoke({ fixture, tmpDir, mockAgent, wikiTemplate }) {
  // Derive plugin root (two dirs up from this file: tests/e2e/runner.mjs)
  const PLUGIN_ROOT = join(new URL(import.meta.url).pathname, '..', '..', '..');

  const stages = [];

  // Stage 1 — fork wiki template + init status.json
  stages.push(stageSetupWikiFork(tmpDir, wikiTemplate));

  // Stage 2 — setup-learning-wiki: create settings.json
  stages.push(stageSetupLearningWiki(tmpDir));

  // Stage 3 — new-course: planner outline + branch
  stages.push(stageNewCourse(tmpDir, mockAgent));

  // Stage 4 — learn READ phase
  stages.push(stageLearnRead(tmpDir, mockAgent));

  // Stage 5 — learn SUMMARIZE phase
  stages.push(stageLearnSummarize(tmpDir));

  // Stage 6 — learn DISCUSS phase
  stages.push(stageLearnDiscuss(tmpDir, mockAgent));

  // Stage 7 — verdict + merge
  stages.push(stageVerdict(tmpDir, mockAgent));

  // Stage 8 — profiler updates learner files
  stages.push(stageProfilerUpdate(tmpDir, mockAgent));

  // Stage 9 — dashboard rebuild (async)
  stages.push(await stageDashboardBuild(tmpDir));

  // Stage 10 — update and validate status.json
  stages.push(stageStatusCheck(tmpDir));

  // Stage 11 — wiki lint (broken links)
  stages.push(stageWikiLint(tmpDir));

  // Stage 12 — wiki page size lint
  stages.push(stageWikiPageSize(tmpDir));

  // Stage 13 — LOD lint on plugin source
  stages.push(stageLodLint(PLUGIN_ROOT));

  // Stage: session-end (append log.md)
  stageSessionEnd(tmpDir);

  return { stages };
}

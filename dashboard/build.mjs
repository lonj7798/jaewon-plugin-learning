/**
 * Dashboard build orchestrator — scans wiki data and writes all HTML pages.
 *
 * @calling-spec
 * - build({ wikiRoot, outDir }): Promise<BuildReport>
 *   Input:  wikiRoot — absolute path to the wiki root directory (contains courses/, learner/)
 *           outDir   — absolute path to output directory (will be created if absent)
 *   Output: { durationMs: number, pagesWritten: string[] }
 *   Side effects: reads wikiRoot/**; writes HTML files to outDir
 *   Depends on: ./render-home.mjs, ./render-course.mjs, ./render-profile.mjs,
 *               ./render-timeline.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { renderHome }     from './render-home.mjs';
import { renderCourse }   from './render-course.mjs';
import { renderProfile }  from './render-profile.mjs';
import { renderTimeline } from './render-timeline.mjs';

// ---------------------------------------------------------------------------
// Wiki readers (pure data extraction, no rendering)
// ---------------------------------------------------------------------------

function readJsonFile(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function readTextFile(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function scanCourses(wikiRoot) {
  const coursesDir = join(wikiRoot, 'courses');
  if (!existsSync(coursesDir)) return [];

  const slugs = readdirSync(coursesDir).filter((name) => {
    return statSync(join(coursesDir, name)).isDirectory();
  });

  return slugs.map((slug) => {
    const courseDir = join(coursesDir, slug);
    const meta = readJsonFile(join(courseDir, 'meta.json')) || { slug, title: slug };

    const chapterDirs = readdirSync(courseDir).filter((name) => {
      const full = join(courseDir, name);
      return statSync(full).isDirectory();
    }).sort();

    const chapters = chapterDirs.map((chSlug) => {
      const verdict = readJsonFile(join(courseDir, chSlug, 'verdict.json'));
      return { slug: chSlug, title: chSlug, verdict };
    });

    return { ...meta, slug, chapters };
  });
}

function readProfile(wikiRoot) {
  const learnerDir = join(wikiRoot, 'learner');
  return {
    style:        readTextFile(join(learnerDir, 'learning-style.md')),
    strengths:    readTextFile(join(learnerDir, 'strengths.md')),
    weaknesses:   readTextFile(join(learnerDir, 'weaknesses.md')),
    push_tactics: readTextFile(join(learnerDir, 'push-tactics.md')),
    session_log:  readTextFile(join(learnerDir, 'session-log.md')),
  };
}

function parseSessionLog(md) {
  const sessions = [];
  const blocks = md.split(/^##\s+/m).slice(1);

  for (const block of blocks) {
    const lines = block.split('\n');
    const date = (lines[0] || '').trim();
    const entry = { date, course: '', chapter: '', phase: '', verdict: null, notes: '' };
    const noteLines = [];

    for (const line of lines.slice(1)) {
      const m = line.match(/^-\s+(\w[\w\s-]*):\s*(.+)/);
      if (m) {
        const key = m[1].trim().toLowerCase();
        const val = m[2].trim();
        if (key === 'course')  entry.course  = val;
        if (key === 'chapter') entry.chapter = val;
        if (key === 'phase')   entry.phase   = val;
        if (key === 'verdict') entry.verdict = val;
        if (key === 'notes')   noteLines.push(val);
      } else if (line.trim()) {
        noteLines.push(line.trim());
      }
    }
    entry.notes = noteLines.join(' ');
    sessions.push(entry);
  }

  return sessions;
}

function writeHtml(outDir, filename, html) {
  const filePath = join(outDir, filename);
  writeFileSync(filePath, html, 'utf-8');
  return filePath;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function buildSections({ courses, profile, sessions, verdicts }) {
  return [
    { out: 'index.html',    render: () => renderHome({ courses, profile }) },
    { out: 'profile.html',  render: () => renderProfile(profile) },
    { out: 'timeline.html', render: () => renderTimeline({ sessions, verdicts }) },
  ];
}

export async function build({ wikiRoot, outDir }) {
  const start = Date.now();

  if (!existsSync(wikiRoot)) {
    const err = new Error(`wikiRoot does not exist: ${wikiRoot}`);
    err.code = 'ENOENT';
    throw err;
  }

  mkdirSync(outDir, { recursive: true });

  const courses  = scanCourses(wikiRoot);
  const profile  = readProfile(wikiRoot);
  const sessions = parseSessionLog(profile.session_log || '');
  const verdicts = courses.flatMap((c) =>
    c.chapters.filter((ch) => ch.verdict).map((ch) => ch.verdict)
  );

  const pagesWritten = [];

  for (const section of buildSections({ courses, profile, sessions, verdicts })) {
    pagesWritten.push(writeHtml(outDir, section.out, section.render()));
  }

  for (const course of courses) {
    pagesWritten.push(writeHtml(outDir, `${course.slug}.html`, renderCourse({ course })));
  }

  return { durationMs: Date.now() - start, pagesWritten };
}

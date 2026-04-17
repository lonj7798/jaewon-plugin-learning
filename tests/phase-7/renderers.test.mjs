/**
 * Phase 7 — Task 7.1 (RED): Dashboard renderer tests
 *
 * All 10 tests must FAIL until Tasks 7.2 + 7.3 create:
 *   dashboard/templates.mjs
 *   dashboard/render-home.mjs
 *   dashboard/render-course.mjs
 *   dashboard/render-profile.mjs
 *   dashboard/render-timeline.mjs
 *
 * Framework: node:test + node:assert/strict, ESM.
 *
 * Imports are dynamic (inside each test) so all 10 tests are registered
 * individually and each fails with ERR_MODULE_NOT_FOUND — not a single
 * file-level crash. This gives the implementer clear per-test feedback.
 *
 * Fixtures: tests/fixtures/dashboard/
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// This file: jaewon-plugin-learning/tests/phase-7/renderers.test.mjs
// Plugin root: jaewon-plugin-learning/
const DASHBOARD = join(__dirname, '..', '..', 'dashboard');
const FIXTURES = join(__dirname, '..', 'fixtures', 'dashboard');

// ---------------------------------------------------------------------------
// Fixture helpers (synchronous reads — fixtures are tiny, always present)
// ---------------------------------------------------------------------------

function loadJSON(relPath) {
  return JSON.parse(readFileSync(join(FIXTURES, relPath), 'utf8'));
}

function loadMD(relPath) {
  return readFileSync(join(FIXTURES, relPath), 'utf8');
}

// Shared fixture data (read once at module scope — fixtures are pure static files)
const META = loadJSON('wiki/courses/dynamic-programming/meta.json');
const INTRO_VERDICT = loadJSON('wiki/courses/dynamic-programming/intro/verdict.json');
const KNAPSACK_VERDICT = loadJSON('wiki/courses/dynamic-programming/knapsack/verdict.json');
const SESSION_LOG = loadJSON('session-log.json');

const PROFILE = {
  style: loadMD('wiki/learner/learning-style.md'),
  strengths: loadMD('wiki/learner/strengths.md'),
  weaknesses: loadMD('wiki/learner/weaknesses.md'),
  push_tactics: loadMD('wiki/learner/push-tactics.md'),
  session_log: loadMD('wiki/learner/session-log.md'),
};

const COURSES = [
  {
    slug: 'dynamic-programming',
    title: 'Dynamic Programming Fundamentals',
    branch: META.branch,
    latest_commit: META.latest_commit,
    chapters: [
      { slug: 'intro', title: 'Introduction to DP', verdict: INTRO_VERDICT },
      { slug: 'knapsack', title: 'Knapsack Problem', verdict: KNAPSACK_VERDICT },
    ],
    current_chapter: META.current_chapter,
  },
];

// ---------------------------------------------------------------------------
// Test 1 — templates_wrap_produces_valid_html5_doctype_title_body
// ---------------------------------------------------------------------------

test('templates: wrap produces valid HTML5 doctype, title element, and body content', async () => {
  // Arrange
  const { wrap } = await import(`${DASHBOARD}/templates.mjs`);
  const title = 'Learning Dashboard';
  const body = '<p>Hello world</p>';
  const nav = '<nav></nav>';

  // Act
  const html = wrap({ title, nav, body });

  // Assert — HTML5 doctype, title tag, body content all present
  assert.ok(
    typeof html === 'string',
    'wrap must return a string'
  );
  assert.ok(
    html.startsWith('<!DOCTYPE html>') || html.startsWith('<!doctype html>'),
    `expected HTML5 doctype at start, got: ${html.slice(0, 40)}`
  );
  assert.ok(
    html.includes('<title>Learning Dashboard</title>'),
    'expected <title> element containing the provided title'
  );
  assert.ok(
    html.includes('<p>Hello world</p>'),
    'expected body content to appear verbatim in output'
  );
  assert.ok(
    html.includes('<html') && html.includes('</html>'),
    'expected <html> root element'
  );
});

// ---------------------------------------------------------------------------
// Test 2 — templates_wrap_includes_nav_links_to_all_sections
// ---------------------------------------------------------------------------

test('templates: wrap includes nav links to home, courses, profile, and timeline', async () => {
  // Arrange
  const { wrap } = await import(`${DASHBOARD}/templates.mjs`);

  // Act
  const html = wrap({ title: 'Test', nav: '', body: '' });

  // Assert — all four primary navigation destinations must be reachable
  assert.ok(
    html.includes('href="index.html"') || html.includes('href="/"') || html.includes('href="./"'),
    'expected a nav link to home (index.html or /)'
  );
  assert.ok(
    html.includes('href="profile.html"'),
    'expected a nav link to profile.html'
  );
  assert.ok(
    html.includes('href="timeline.html"'),
    'expected a nav link to timeline.html'
  );
  // nav area must exist as a structural element
  assert.ok(
    html.includes('<nav') || html.includes('role="navigation"'),
    'expected a <nav> element or role="navigation" in the layout'
  );
});

// ---------------------------------------------------------------------------
// Test 3 — render_home_lists_courses_with_chapter_progress
// ---------------------------------------------------------------------------

test('render-home: lists all courses with per-chapter verdict progress', async () => {
  // Arrange
  const { renderHome } = await import(`${DASHBOARD}/render-home.mjs`);
  const data = { courses: COURSES };

  // Act
  const html = renderHome(data);

  // Assert — course title and both chapter titles must appear
  assert.ok(typeof html === 'string', 'renderHome must return a string');
  assert.ok(
    html.includes('Dynamic Programming Fundamentals'),
    'expected course title in output'
  );
  assert.ok(
    html.includes('Introduction to DP'),
    'expected first chapter title in output'
  );
  assert.ok(
    html.includes('Knapsack Problem'),
    'expected second chapter title in output'
  );
  // At least one verdict label must appear (mastery or partial)
  assert.ok(
    html.includes('mastery') || html.includes('Mastery'),
    'expected verdict "mastery" for intro chapter to appear'
  );
  assert.ok(
    html.includes('partial') || html.includes('Partial'),
    'expected verdict "partial" for knapsack chapter to appear'
  );
});

// ---------------------------------------------------------------------------
// Test 4 — render_home_shows_current_profile_summary_section
// ---------------------------------------------------------------------------

test('render-home: shows current profile summary section with learner name or style', async () => {
  // Arrange
  const { renderHome } = await import(`${DASHBOARD}/render-home.mjs`);
  const data = { courses: COURSES, profile: PROFILE };

  // Act
  const html = renderHome(data);

  // Assert — profile section must appear in the home page
  assert.ok(typeof html === 'string', 'renderHome must return a string');
  // Profile section must exist as a distinct region
  assert.ok(
    html.includes('profile') || html.includes('Profile') || html.includes('learner') || html.includes('Learner'),
    'expected a profile or learner section in the home output'
  );
  // At least one snippet from the learning-style fixture must appear or be referenced
  assert.ok(
    html.includes('Visual learner') || html.includes('visual learner') || html.includes('learning-style'),
    'expected learning style content or link to appear in the profile summary'
  );
});

// ---------------------------------------------------------------------------
// Test 5 — render_course_shows_chapter_verdict_badges_with_distinct_styling
// ---------------------------------------------------------------------------

test('render-course: shows per-chapter verdict badges (mastery/partial/incomplete) with distinct CSS classes', async () => {
  // Arrange
  const { renderCourse } = await import(`${DASHBOARD}/render-course.mjs`);
  const course = {
    slug: 'dynamic-programming',
    title: 'Dynamic Programming Fundamentals',
    branch: META.branch,
    latest_commit: META.latest_commit,
    chapters: [
      { slug: 'intro', title: 'Introduction to DP', verdict: INTRO_VERDICT },
      { slug: 'knapsack', title: 'Knapsack Problem', verdict: KNAPSACK_VERDICT },
      { slug: 'lcs', title: 'Longest Common Subsequence', verdict: null },
    ],
  };

  // Act
  const html = renderCourse({ course });

  // Assert — each verdict level must use a distinct CSS class or data attribute
  assert.ok(typeof html === 'string', 'renderCourse must return a string');
  assert.ok(
    html.includes('mastery') || html.includes('Mastery'),
    'expected mastery verdict to appear'
  );
  assert.ok(
    html.includes('partial') || html.includes('Partial'),
    'expected partial verdict to appear'
  );
  assert.ok(
    html.includes('incomplete') || html.includes('Incomplete') || html.includes('lcs'),
    'expected incomplete/pending chapter to appear'
  );
  // Distinct styling: mastery and partial must use different class names or markers
  const masteryIdx = html.indexOf('mastery');
  const partialIdx = html.indexOf('partial');
  assert.ok(
    masteryIdx !== partialIdx,
    'mastery and partial must appear at different positions (distinct badges)'
  );
});

// ---------------------------------------------------------------------------
// Test 6 — render_course_includes_branch_name_and_latest_commit_pointer
// ---------------------------------------------------------------------------

test('render-course: includes git branch name and latest commit SHA in output', async () => {
  // Arrange
  const { renderCourse } = await import(`${DASHBOARD}/render-course.mjs`);
  const course = {
    slug: 'dynamic-programming',
    title: 'Dynamic Programming Fundamentals',
    branch: 'course/dynamic-programming',
    latest_commit: 'a1b2c3d4e5f6',
    chapters: [
      { slug: 'intro', title: 'Introduction to DP', verdict: INTRO_VERDICT },
    ],
  };

  // Act
  const html = renderCourse({ course });

  // Assert — branch and commit must appear verbatim
  assert.ok(typeof html === 'string', 'renderCourse must return a string');
  assert.ok(
    html.includes('course/dynamic-programming'),
    'expected branch name "course/dynamic-programming" in output'
  );
  assert.ok(
    html.includes('a1b2c3d4e5f6'),
    'expected latest commit SHA "a1b2c3d4e5f6" in output'
  );
});

// ---------------------------------------------------------------------------
// Test 7 — render_profile_has_five_section_layout_matching_learner_pages
// ---------------------------------------------------------------------------

test('render-profile: output contains all five learner-profile sections', async () => {
  // Arrange
  const { renderProfile } = await import(`${DASHBOARD}/render-profile.mjs`);

  // Act
  const html = renderProfile(PROFILE);

  // Assert — all five sections defined in phase-0 §5.6 must appear
  assert.ok(typeof html === 'string', 'renderProfile must return a string');
  assert.ok(
    html.includes('Learning Style') || html.includes('learning-style') || html.includes('learning style'),
    'expected Learning Style section'
  );
  assert.ok(
    html.includes('Strengths') || html.includes('strengths'),
    'expected Strengths section'
  );
  assert.ok(
    html.includes('Weaknesses') || html.includes('weaknesses'),
    'expected Weaknesses section'
  );
  assert.ok(
    html.includes('Push Tactics') || html.includes('push-tactics') || html.includes('push tactics'),
    'expected Push Tactics section'
  );
  assert.ok(
    html.includes('Session Log') || html.includes('session-log') || html.includes('session log'),
    'expected Session Log section'
  );
});

// ---------------------------------------------------------------------------
// Test 8 — render_profile_renders_markdown_content_as_html
// ---------------------------------------------------------------------------

test('render-profile: renders markdown content as HTML (headers, lists, links)', async () => {
  // Arrange
  const { renderProfile } = await import(`${DASHBOARD}/render-profile.mjs`);
  // strengths.md contains: # Strengths header and bullet list items
  // weaknesses.md contains: # Weaknesses header and bullet list items
  // push-tactics.md contains: ## Push Tactics + ## Selection Rubric + numbered/bulleted items

  // Act
  const html = renderProfile(PROFILE);

  // Assert — raw markdown syntax must NOT appear; HTML tags must be used instead
  assert.ok(typeof html === 'string', 'renderProfile must return a string');
  // A markdown # heading must be converted to an <h1> or <h2> etc. element
  assert.ok(
    html.includes('<h1') || html.includes('<h2') || html.includes('<h3'),
    'expected markdown headers to be converted to <h1>/<h2>/<h3> elements'
  );
  // Markdown bullet list items (-) must be converted to <li> elements
  assert.ok(
    html.includes('<li>') || html.includes('<li '),
    'expected markdown list items to be converted to <li> elements'
  );
  // Raw markdown heading syntax must not leak into output
  assert.ok(
    !html.includes('\n# ') && !html.match(/^# /m),
    'raw markdown "# " heading syntax must not appear in rendered HTML output'
  );
});

// ---------------------------------------------------------------------------
// Test 9 — render_timeline_produces_entries_in_reverse_chronological_order
// ---------------------------------------------------------------------------

test('render-timeline: session entries appear in reverse-chronological order (newest first)', async () => {
  // Arrange
  const { renderTimeline } = await import(`${DASHBOARD}/render-timeline.mjs`);
  // SESSION_LOG is already sorted newest-first in fixture; renderer must enforce it
  const data = {
    sessions: [...SESSION_LOG].reverse(), // deliberately pass oldest-first to test sorting
    verdicts: [INTRO_VERDICT, KNAPSACK_VERDICT],
  };

  // Act
  const html = renderTimeline(data);

  // Assert — 2026-04-16 (newest) must appear before 2026-04-10 (oldest) in the output string
  assert.ok(typeof html === 'string', 'renderTimeline must return a string');
  assert.ok(
    html.includes('2026-04-16'),
    'expected newest session date 2026-04-16 in output'
  );
  assert.ok(
    html.includes('2026-04-10'),
    'expected oldest session date 2026-04-10 in output'
  );
  const newestIdx = html.indexOf('2026-04-16');
  const oldestIdx = html.indexOf('2026-04-10');
  assert.ok(
    newestIdx < oldestIdx,
    `expected 2026-04-16 (newest) to appear before 2026-04-10 (oldest) in HTML; ` +
    `got newestIdx=${newestIdx}, oldestIdx=${oldestIdx}`
  );
});

// ---------------------------------------------------------------------------
// Test 10 — renderers_all_pure_and_no_leaked_template_literal_syntax
// ---------------------------------------------------------------------------

test('all renderers: output is deterministic and contains no leaked template literal syntax', async () => {
  // Arrange — import all five renderer modules
  const { wrap } = await import(`${DASHBOARD}/templates.mjs`);
  const { renderHome } = await import(`${DASHBOARD}/render-home.mjs`);
  const { renderCourse } = await import(`${DASHBOARD}/render-course.mjs`);
  const { renderProfile } = await import(`${DASHBOARD}/render-profile.mjs`);
  const { renderTimeline } = await import(`${DASHBOARD}/render-timeline.mjs`);

  const courseArg = {
    slug: 'dynamic-programming',
    title: 'Dynamic Programming Fundamentals',
    branch: META.branch,
    latest_commit: META.latest_commit,
    chapters: [
      { slug: 'intro', title: 'Introduction to DP', verdict: INTRO_VERDICT },
    ],
  };
  const timelineArg = { sessions: SESSION_LOG, verdicts: [INTRO_VERDICT, KNAPSACK_VERDICT] };

  // Act — call each renderer twice with identical inputs
  const wrapA = wrap({ title: 'T', nav: '<nav/>', body: '<p>b</p>' });
  const wrapB = wrap({ title: 'T', nav: '<nav/>', body: '<p>b</p>' });

  const homeA = renderHome({ courses: COURSES, profile: PROFILE });
  const homeB = renderHome({ courses: COURSES, profile: PROFILE });

  const courseA = renderCourse({ course: courseArg });
  const courseB = renderCourse({ course: courseArg });

  const profileA = renderProfile(PROFILE);
  const profileB = renderProfile(PROFILE);

  const timelineA = renderTimeline(timelineArg);
  const timelineB = renderTimeline(timelineArg);

  // Assert — byte-identical on second call (pure / deterministic)
  assert.equal(wrapA, wrapB, 'templates.wrap must be deterministic (same input -> same output)');
  assert.equal(homeA, homeB, 'renderHome must be deterministic');
  assert.equal(courseA, courseB, 'renderCourse must be deterministic');
  assert.equal(profileA, profileB, 'renderProfile must be deterministic');
  assert.equal(timelineA, timelineB, 'renderTimeline must be deterministic');

  // Assert — no leaked "${...}" template literal placeholders in any output
  const allOutputs = [wrapA, homeA, courseA, profileA, timelineA];
  for (const html of allOutputs) {
    assert.ok(
      !html.includes('${'),
      `output contains a leaked template literal placeholder "\${": ${html.slice(0, 200)}`
    );
  }
});

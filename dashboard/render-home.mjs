/**
 * Renders the home/index page of the learning dashboard.
 *
 * @calling-spec
 * - renderHome({ courses, profile }): string
 *   Input: courses (Course[]) — array of course objects with slug, title, chapters, branch, latest_commit;
 *          profile (object, optional) — learner profile with style, strengths, weaknesses, push_tactics, session_log
 *   Output: HTML string (body fragment — not a full document)
 *   Side effects: none
 *   Depends on: dashboard/templates.mjs (escapeHtml)
 */

import { escapeHtml } from './templates.mjs';

/**
 * Determine badge CSS class from a verdict string.
 * @param {string|null} verdict
 * @returns {string}
 */
function verdictClass(verdict) {
  switch (verdict) {
    case 'mastery':    return 'verdict-mastery';
    case 'partial':    return 'verdict-partial';
    case 'incomplete': return 'verdict-incomplete';
    default:           return 'verdict-pending';
  }
}

/**
 * Render a single course card with chapter progress.
 * @param {object} course
 * @returns {string}
 */
function renderCourseCard(course) {
  const title = escapeHtml(course.title);
  const slug  = escapeHtml(course.slug);

  const chapters = (course.chapters || []).map((ch) => {
    const chTitle   = escapeHtml(ch.title);
    const verdict   = ch.verdict ? ch.verdict.verdict : null;
    const label     = verdict ? escapeHtml(verdict) : 'pending';
    const cls       = verdictClass(verdict);
    return [
      '<div class="chapter-row">',
      `<span class="badge ${cls}">${label}</span>`,
      `<span>${chTitle}</span>`,
      '</div>',
    ].join('');
  }).join('\n');

  return [
    '<div class="course-card">',
    `<h2>${title}</h2>`,
    `<div class="meta">slug: ${slug}</div>`,
    chapters,
    '</div>',
  ].join('\n');
}

/**
 * Extract the first non-empty, non-heading line from markdown content.
 * @param {string} md
 * @returns {string}
 */
function firstContentLine(md) {
  const lines = md.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      return trimmed;
    }
  }
  return '';
}

/**
 * Render profile summary section for the home page.
 * @param {object} profile
 * @returns {string}
 */
function renderProfileSummary(profile) {
  if (!profile) return '';

  const styleLine = firstContentLine(profile.style || '');
  const safeStyle = escapeHtml(styleLine);

  return [
    '<section id="profile-summary">',
    '<h2>Learner Profile</h2>',
    `<p class="learning-style">${safeStyle}</p>`,
    '<p><a href="profile.html">View full profile</a></p>',
    '</section>',
  ].join('\n');
}

/**
 * Render the home page body fragment.
 * @param {{ courses: object[], profile?: object }} data
 * @returns {string}
 */
export function renderHome({ courses = [], profile = null }) {
  const cards = courses.map(renderCourseCard).join('\n');

  const courseSection = [
    '<section id="courses">',
    '<h1>Learning Dashboard</h1>',
    cards,
    '</section>',
  ].join('\n');

  const profileSection = renderProfileSummary(profile);

  return [courseSection, profileSection].filter(Boolean).join('\n');
}

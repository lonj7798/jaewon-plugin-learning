/**
 * Renders a single course detail page for the learning dashboard.
 *
 * @calling-spec
 * - renderCourse({ course }): string
 *   Input: course (object) — { slug, title, branch, latest_commit, chapters[] }
 *          Each chapter: { slug, title, verdict: { verdict, evidence, next_action, cycle_iteration } | null }
 *   Output: HTML string (body fragment — not a full document)
 *   Side effects: none
 *   Depends on: dashboard/templates.mjs (escapeHtml)
 */

import { escapeHtml } from './templates.mjs';

/**
 * Map a verdict string to its CSS class.
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
 * Render a single chapter row with a verdict badge.
 * @param {{ slug: string, title: string, verdict: object|null }} chapter
 * @returns {string}
 */
function renderChapterRow(chapter) {
  const chTitle    = escapeHtml(chapter.title);
  const chSlug     = escapeHtml(chapter.slug);
  const verdictVal = chapter.verdict ? chapter.verdict.verdict : null;
  const label      = verdictVal ? escapeHtml(verdictVal) : 'pending';
  const cls        = verdictClass(verdictVal);

  const cycleIter  = chapter.verdict ? chapter.verdict.cycle_iteration : null;
  const cyclePart  = cycleIter != null
    ? `<span class="meta">cycle ${escapeHtml(String(cycleIter))}</span>`
    : '';

  const nextAction = chapter.verdict && chapter.verdict.next_action
    ? `<span class="meta">next: ${escapeHtml(chapter.verdict.next_action)}</span>`
    : '';

  return [
    '<div class="chapter-row">',
    `<span class="badge ${cls}" data-chapter="${chSlug}">${label}</span>`,
    `<span>${chTitle}</span>`,
    cyclePart,
    nextAction,
    '</div>',
  ].join('');
}

/**
 * Render the course detail page body fragment.
 * @param {{ course: object }} data
 * @returns {string}
 */
export function renderCourse({ course }) {
  const title        = escapeHtml(course.title);
  const branch       = escapeHtml(course.branch || '');
  const latestCommit = escapeHtml(course.latest_commit || '');

  const chapterRows = (course.chapters || []).map(renderChapterRow).join('\n');

  return [
    '<section id="course-detail">',
    `<h1>${title}</h1>`,
    '<div class="meta">',
    `<span>branch: ${branch}</span>`,
    `<span> &nbsp; commit: ${latestCommit}</span>`,
    '</div>',
    '<div id="chapters">',
    chapterRows,
    '</div>',
    '</section>',
  ].join('\n');
}

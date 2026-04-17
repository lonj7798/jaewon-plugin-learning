/**
 * Renders a learning timeline page from session entries and verdicts.
 *
 * @calling-spec
 * - renderTimeline(data): string
 *   Input: data.sessions — array of session entry objects (date, course, chapter, phase, verdict, notes)
 *          data.verdicts — array of verdict objects (optional, used for enrichment)
 *   Output: HTML string with sessions rendered in reverse-chronological order (newest first)
 *   Side effects: none
 *   Depends on: none
 */

/**
 * Compares two date strings (ISO 8601 YYYY-MM-DD) for descending sort (newest first).
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} negative if a > b (a is newer), positive if a < b
 */
function compareDateDesc(a, b) {
  if (a > b) return -1;
  if (a < b) return 1;
  return 0;
}

/**
 * Escapes special HTML characters in a string.
 *
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders a single session entry as an HTML list item.
 *
 * @param {Object} session
 * @param {string} session.date
 * @param {string} session.course
 * @param {string} session.chapter
 * @param {string} session.phase
 * @param {string|null} session.verdict
 * @param {string} session.notes
 * @returns {string} HTML string for one entry
 */
function renderSessionEntry(session) {
  const date = escapeHtml(session.date || '');
  const course = escapeHtml(session.course || '');
  const chapter = escapeHtml(session.chapter || '');
  const phase = escapeHtml(session.phase || '');
  const verdict = session.verdict ? escapeHtml(session.verdict) : null;
  const notes = escapeHtml(session.notes || '');

  const verdictHtml = verdict
    ? '<span class="verdict verdict--' + verdict + '">' + verdict + '</span>'
    : '<span class="verdict verdict--none">in progress</span>';

  return (
    '<li class="timeline-entry">\n' +
    '  <time class="entry-date" datetime="' + date + '">' + date + '</time>\n' +
    '  <div class="entry-meta">\n' +
    '    <span class="entry-course">' + course + '</span>\n' +
    '    <span class="entry-chapter">' + chapter + '</span>\n' +
    '    <span class="entry-phase">' + phase + '</span>\n' +
    '    ' + verdictHtml + '\n' +
    '  </div>\n' +
    '  <p class="entry-notes">' + notes + '</p>\n' +
    '</li>'
  );
}

/**
 * Renders a complete learning timeline as an HTML string.
 * Sessions are always sorted newest-first regardless of input order.
 *
 * @param {Object} data
 * @param {Array} data.sessions - Session entry objects
 * @param {Array} [data.verdicts] - Verdict objects (used for enrichment)
 * @returns {string} HTML string
 */
export function renderTimeline(data) {
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];

  const sorted = sessions.slice().sort(function(a, b) {
    return compareDateDesc(a.date || '', b.date || '');
  });

  const entries = sorted.map(renderSessionEntry);

  return (
    '<section class="learning-timeline">\n' +
    '  <h1>Learning Timeline</h1>\n' +
    '  <ul class="timeline-list">\n' +
    entries.join('\n') + '\n' +
    '  </ul>\n' +
    '</section>'
  );
}

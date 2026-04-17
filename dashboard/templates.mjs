/**
 * HTML5 page wrapper with inlined CSS and navigation.
 *
 * @calling-spec
 * - wrap({ title, nav, body }): string
 *   Input: title (string) — page title; nav (string) — nav HTML fragment (ignored, built-in nav used);
 *          body (string) — inner body HTML
 *   Output: complete HTML5 document string
 *   Side effects: none
 *   Depends on: none
 *
 * - escapeHtml(s): string
 *   Input: s (string) — raw text that may contain HTML special characters
 *   Output: string with &, <, >, ", ' escaped to HTML entities
 *   Side effects: none
 *   Depends on: none
 */

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0d1117;color:#c9d1d9;line-height:1.6;padding:1rem}
nav{background:#161b22;border-bottom:1px solid #30363d;padding:.5rem 1rem;margin-bottom:1.5rem;display:flex;gap:1rem}
nav a{color:#58a6ff;text-decoration:none;font-size:.9rem}
nav a:hover{text-decoration:underline}
h1,h2,h3{color:#e6edf3;margin:.75rem 0 .4rem}
h1{font-size:1.6rem}h2{font-size:1.25rem}h3{font-size:1rem}
section{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:1rem;margin-bottom:1rem}
ul{padding-left:1.25rem}
li{margin:.25rem 0}
.badge{display:inline-block;padding:.1rem .5rem;border-radius:12px;font-size:.75rem;font-weight:600;text-transform:uppercase}
.verdict-mastery{background:#1a4731;color:#3fb950}
.verdict-partial{background:#3d2b00;color:#e3b341}
.verdict-incomplete{background:#3d1a00;color:#f0883e}
.verdict-pending{background:#21262d;color:#8b949e}
.meta{font-size:.8rem;color:#8b949e;margin:.25rem 0}
.course-card{background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:.75rem;margin:.5rem 0}
.chapter-row{display:flex;align-items:center;gap:.5rem;margin:.25rem 0}
`.trim();

/**
 * Escape HTML special characters to prevent injection.
 * @param {string} s
 * @returns {string}
 */
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Wrap a body fragment in a full HTML5 document with nav and CSS.
 * @param {{ title: string, nav: string, body: string }} opts
 * @returns {string}
 */
export function wrap({ title, nav, body }) {
  const safeTitle = escapeHtml(title);
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${safeTitle}</title>`,
    `<style>${CSS}</style>`,
    '</head>',
    '<body>',
    '<nav role="navigation">',
    '<a href="index.html">Home</a>',
    '<a href="profile.html">Profile</a>',
    '<a href="timeline.html">Timeline</a>',
    '</nav>',
    body,
    '</body>',
    '</html>',
  ].join('\n');
}

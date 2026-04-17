/**
 * Renders a learner profile page from five markdown sections.
 *
 * @calling-spec
 * - renderProfile(profile): string
 *   Input: profile object with keys: style, strengths, weaknesses, push_tactics, session_log
 *          each value is a markdown string
 *   Output: HTML string containing all five learner-profile sections with markdown converted to HTML
 *   Side effects: none
 *   Depends on: none
 */

// Minimal line-based markdown to HTML converter.
// Handles: # headings (h1-h6), - bullet lists, [text](url) links.
// Does NOT handle nested lists, blockquotes, or other advanced syntax.
function markdownToHtml(md) {
  const lines = md.split('\n');
  const output = [];
  let inList = false;

  for (const line of lines) {
    // Heading: # through ######
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      if (inList) {
        output.push('</ul>');
        inList = false;
      }
      const level = headingMatch[1].length;
      const text = convertInline(headingMatch[2]);
      output.push('<h' + level + '>' + text + '</h' + level + '>');
      continue;
    }

    // Unordered list item: starts with "- "
    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      if (!inList) {
        output.push('<ul>');
        inList = true;
      }
      const text = convertInline(bulletMatch[1]);
      output.push('<li>' + text + '</li>');
      continue;
    }

    // Ordered list item: starts with "N. "
    const orderedMatch = line.match(/^\d+\.\s+(.+)/);
    if (orderedMatch) {
      if (!inList) {
        output.push('<ul>');
        inList = true;
      }
      const text = convertInline(orderedMatch[1]);
      output.push('<li>' + text + '</li>');
      continue;
    }

    // Close list if we hit a non-list line
    if (inList) {
      output.push('</ul>');
      inList = false;
    }

    // Blank line
    if (line.trim() === '') {
      continue;
    }

    // Regular paragraph
    const text = convertInline(line);
    output.push('<p>' + text + '</p>');
  }

  if (inList) {
    output.push('</ul>');
  }

  return output.join('\n');
}

// Convert inline markdown: **bold**, [text](url)
function convertInline(text) {
  // Links: [text](url)
  let result = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Bold: **text**
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return result;
}

const SECTIONS = [
  { key: 'style',       label: 'Learning Style', id: 'learning-style' },
  { key: 'strengths',   label: 'Strengths',       id: 'strengths'      },
  { key: 'weaknesses',  label: 'Weaknesses',      id: 'weaknesses'     },
  { key: 'push_tactics',label: 'Push Tactics',    id: 'push-tactics'   },
  { key: 'session_log', label: 'Session Log',     id: 'session-log'    },
];

/**
 * Renders a complete learner profile page as an HTML string.
 *
 * @param {Object} profile - Keys: style, strengths, weaknesses, push_tactics, session_log (each a markdown string)
 * @returns {string} HTML string with all five sections rendered
 */
export function renderProfile(profile) {
  const sections = SECTIONS.map(function(section) {
    const md = profile[section.key] || '';
    const bodyHtml = markdownToHtml(md);
    return (
      '<section id="' + section.id + '">\n' +
      '  <h2>' + section.label + '</h2>\n' +
      '  <div class="section-content">\n' +
      bodyHtml + '\n' +
      '  </div>\n' +
      '</section>'
    );
  });

  return (
    '<article class="learner-profile">\n' +
    '  <h1>Learner Profile</h1>\n' +
    sections.join('\n') +
    '\n</article>'
  );
}

/**
 * Phase 5 — Task 5.1 (RED): Skill shape tests
 *
 * 8 skills × 6 shape checks = 48 assertions — ALL must fail until
 * Tasks 5.2–5.7 create the skill markdown files under skills/.
 *
 * Framework: node:test + node:assert/strict, ESM.
 * Run from jaewon-plugin-learning/:
 *   node --test tests/phase-5/skill-shapes.test.mjs
 *
 * Checks per skill (plan task 5.1):
 *  1. Skill folder exists and SKILL.md has YAML frontmatter (starts with `---\n`)
 *  2. Frontmatter has `name:` matching the directory name
 *  3. Frontmatter has `description:` (non-empty, <= 500 chars)
 *  4. Body includes <Purpose>, <Use_When>, <Do_Not_Use_When>, <Execution_Policy>, <Steps>
 *  5. File is <= 100 LOC
 *  6. Skill-specific check:
 *       new-course, learn, verdict : body contains `push_tactic_snapshot`
 *       resume                     : body contains `learning_status` AND
 *                                    has ZERO references to `cycle-detect` or `cycle_detect`
 *       Others (setup-learning-wiki, wiki-lint, dashboard, profile-review):
 *                                    frontmatter has at least one keyword trigger declared
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// tests/phase-5/ -> up 2 -> jaewon-plugin-learning/
const SKILLS_DIR = join(__dirname, '..', '..', 'skills');

// ---------------------------------------------------------------------------
// Frontmatter helpers  (mirrors phase-4/agent-shapes.test.mjs conventions)
// ---------------------------------------------------------------------------

/**
 * Parse the YAML frontmatter block from markdown content.
 * Returns { raw: string, fields: Map<string, string|string[]> }.
 * Throws if no frontmatter block found.
 */
function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) {
    throw new Error('Missing YAML frontmatter: file does not start with ---\\n');
  }
  const end = content.indexOf('\n---\n', 4);
  if (end === -1) {
    throw new Error('Unclosed YAML frontmatter: no closing ---');
  }
  const raw = content.slice(4, end);
  const fields = new Map();
  let currentKey = null;
  let inList = false;
  const listValues = [];

  for (const line of raw.split('\n')) {
    const scalarMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (scalarMatch) {
      if (inList && currentKey !== null) {
        fields.set(currentKey, listValues.slice());
        listValues.length = 0;
        inList = false;
      }
      currentKey = scalarMatch[1];
      const val = scalarMatch[2].trim();
      fields.set(currentKey, val === '' || val === '|' ? '' : val);
      continue;
    }
    const listMatch = line.match(/^\s+-\s+(.*)/);
    if (listMatch && currentKey !== null) {
      if (!inList) { inList = true; listValues.length = 0; }
      listValues.push(listMatch[1].trim());
      fields.set(currentKey, listValues.slice());
      continue;
    }
    if (line.match(/^\s+\S/) && currentKey !== null && !inList) {
      const prev = fields.get(currentKey) ?? '';
      fields.set(currentKey, (prev + ' ' + line.trim()).trim());
    }
  }

  return { raw, fields };
}

/**
 * Load a skill file and return { content, lines, fm }.
 * Propagates ENOENT so tests fail with a clear "file not found" message.
 */
async function loadSkill(dirName) {
  const filePath = join(SKILLS_DIR, dirName, 'SKILL.md');
  const content = await readFile(filePath, 'utf8');
  const lines = content.split('\n').length;
  const fm = parseFrontmatter(content);
  return { content, lines, fm, filePath };
}

// ---------------------------------------------------------------------------
// Skill roster: [dirName, nameStem]
// ---------------------------------------------------------------------------
const SKILLS = [
  ['setup-learning-wiki', 'setup-learning-wiki'],
  ['new-course',          'new-course'],
  ['learn',               'learn'],
  ['resume',              'resume'],
  ['verdict',             'verdict'],
  ['wiki-lint',           'wiki-lint'],
  ['dashboard',           'dashboard'],
  ['profile-review',      'profile-review'],
];

// Skills that must contain push_tactic_snapshot
const TACTIC_INJECTION_SET = new Set(['new-course', 'learn', 'verdict']);

// Required XML section tags in body (plan check 4)
const REQUIRED_SECTIONS = ['Purpose', 'Use_When', 'Do_Not_Use_When', 'Execution_Policy', 'Steps'];

// ---------------------------------------------------------------------------
// Generate 6 tests per skill (8 × 6 = 48 total)
// ---------------------------------------------------------------------------
for (const [dirName, stem] of SKILLS) {

  // Check 1 — folder exists and SKILL.md has YAML frontmatter
  test(`${stem}: should have YAML frontmatter when SKILL.md exists`, async () => {
    // Arrange
    const filePath = join(SKILLS_DIR, dirName, 'SKILL.md');

    // Act — readFile propagates ENOENT if file/folder missing
    const content = await readFile(filePath, 'utf8');

    // Assert
    assert.ok(
      content.startsWith('---\n'),
      `${dirName}/SKILL.md: expected file to start with ---\\n (YAML frontmatter delimiter)`
    );
    assert.ok(
      content.includes('\n---\n'),
      `${dirName}/SKILL.md: expected closing ---\\n for frontmatter block`
    );
  });

  // Check 2 — name: field matches directory name
  test(`${stem}: should have name field matching directory name`, async () => {
    // Arrange
    const { fm } = await loadSkill(dirName);

    // Act
    const nameVal = fm.fields.get('name');

    // Assert
    assert.ok(nameVal, `${dirName}/SKILL.md: expected 'name:' field in frontmatter`);
    assert.equal(
      nameVal.trim(),
      stem,
      `${dirName}/SKILL.md: expected name:'${stem}', got '${nameVal}'`
    );
  });

  // Check 3 — description: present, non-empty, <= 500 chars
  test(`${stem}: should have non-empty description field within 500 chars`, async () => {
    // Arrange
    const { fm } = await loadSkill(dirName);

    // Act
    const desc = fm.fields.get('description');

    // Assert
    assert.ok(desc, `${dirName}/SKILL.md: expected 'description:' field in frontmatter`);
    const descStr = Array.isArray(desc) ? desc.join(' ') : desc;
    assert.ok(
      descStr.trim().length > 0,
      `${dirName}/SKILL.md: description field is empty`
    );
    assert.ok(
      descStr.length <= 500,
      `${dirName}/SKILL.md: description exceeds 500 chars (got ${descStr.length})`
    );
  });

  // Check 4 — body includes all five required XML section tags
  test(`${stem}: should have Purpose, Use_When, Do_Not_Use_When, Execution_Policy, Steps sections`, async () => {
    // Arrange
    const { content } = await loadSkill(dirName);

    // Act + Assert — check each tag individually for clear failure messages
    for (const section of REQUIRED_SECTIONS) {
      assert.ok(
        content.includes(`<${section}>`),
        `${dirName}/SKILL.md: missing required section tag <${section}>`
      );
    }
  });

  // Check 5 — file is <= 100 LOC
  test(`${stem}: should be at most 100 lines`, async () => {
    // Arrange
    const { lines } = await loadSkill(dirName);

    // Assert
    assert.ok(
      lines <= 100,
      `${dirName}/SKILL.md: file has ${lines} lines, exceeds 100-line cap`
    );
  });

  // Check 6 — skill-specific structural check
  test(`${stem}: should satisfy skill-specific structural requirement`, async () => {
    // Arrange
    const { content, fm } = await loadSkill(dirName);

    if (TACTIC_INJECTION_SET.has(stem)) {
      // new-course, learn, verdict: must contain push_tactic_snapshot
      const occurrences = (content.match(/push_tactic_snapshot/g) ?? []).length;
      assert.ok(
        occurrences >= 1,
        `${dirName}/SKILL.md: expected >= 1 occurrence of 'push_tactic_snapshot' ` +
        `(tactic-injection set requires it), found ${occurrences}`
      );
    } else if (stem === 'resume') {
      // resume: must reference learning_status and must NOT reference cycle-detect/cycle_detect
      assert.ok(
        content.includes('learning_status'),
        `${dirName}/SKILL.md: expected 'learning_status' MCP call (sole state source for resume)`
      );
      assert.ok(
        !content.includes('cycle-detect') && !content.includes('cycle_detect'),
        `${dirName}/SKILL.md: must NOT reference 'cycle-detect' or 'cycle_detect' ` +
        `(revision 2: hook-internal only; skill derives state from learning_status alone)`
      );
    } else {
      // setup-learning-wiki, wiki-lint, dashboard, profile-review:
      // frontmatter must declare at least one keyword trigger
      const keywords = fm.fields.get('keywords');
      assert.ok(
        fm.fields.has('keywords'),
        `${dirName}/SKILL.md: expected 'keywords:' field in frontmatter (trigger list required)`
      );
      const kwArr = Array.isArray(keywords) ? keywords : (keywords ? [keywords] : []);
      assert.ok(
        kwArr.length > 0,
        `${dirName}/SKILL.md: 'keywords:' list is empty — skill must declare at least one trigger`
      );
    }
  });

} // end for SKILLS

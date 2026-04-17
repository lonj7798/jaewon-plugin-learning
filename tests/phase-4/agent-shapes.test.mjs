/**
 * Phase 4 — Task 4.1 (RED): Agent shape tests
 *
 * 9 agents × 10 shape checks = 90 assertions — ALL must fail until
 * Tasks 4.2–4.10 create the agent markdown files under agents/.
 *
 * Framework: node:test + node:assert/strict, ESM.
 * Run from jaewon-plugin-learning/:
 *   node --test tests/phase-4/agent-shapes.test.mjs
 *
 * Checks per agent (plan task 4.1):
 *  1. File exists and has YAML frontmatter (starts with `---\n`)
 *  2. `name:` field matches the agent filename stem
 *  3. `description:` field present and non-empty
 *  4. `model:` field is one of {haiku, sonnet, opus}
 *  5. Body contains required XML section tags:
 *       <Role>, <Success_Criteria>, <Operations>, <Constraints>, <Final_Checklist>
 *  6. File is under 120 lines
 *  7. `tools:` block is present in frontmatter
 *  8. researcher declares WebSearch + WebFetch in tools
 *  9. git-manager declares Bash only (Read, Write, Grep NOT listed in tools)
 * 10. profiler declares disallowedTools containing Edit
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// tests/phase-4/ -> up 2 -> jaewon-plugin-learning/
const AGENTS_DIR = join(__dirname, '..', '..', 'agents');

// ---------------------------------------------------------------------------
// Frontmatter helpers
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
    // Scalar field: "key: value" or "key: |" or "key:"
    const scalarMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (scalarMatch) {
      // Flush previous list
      if (inList && currentKey !== null) {
        fields.set(currentKey, listValues.slice());
        listValues.length = 0;
        inList = false;
      }
      currentKey = scalarMatch[1];
      const val = scalarMatch[2].trim();
      if (val === '' || val === '|') {
        // Value follows on subsequent lines or as list items
        fields.set(currentKey, '');
      } else {
        fields.set(currentKey, val);
        inList = false;
      }
      continue;
    }
    // List item: "  - value"
    const listMatch = line.match(/^\s+-\s+(.*)/);
    if (listMatch && currentKey !== null) {
      if (!inList) {
        inList = true;
        listValues.length = 0;
      }
      listValues.push(listMatch[1].trim());
      fields.set(currentKey, listValues.slice());
      continue;
    }
    // Multi-line scalar continuation (indented)
    if (line.match(/^\s+\S/) && currentKey !== null && !inList) {
      const prev = fields.get(currentKey) ?? '';
      fields.set(currentKey, (prev + ' ' + line.trim()).trim());
    }
  }

  return { raw, fields };
}

/**
 * Load an agent file and return { content, lines, fm }.
 * Throws with ENOENT propagated if file does not exist.
 */
async function loadAgent(filename) {
  const filePath = join(AGENTS_DIR, filename);
  const content = await readFile(filePath, 'utf8');
  const lines = content.split('\n').length;
  const fm = parseFrontmatter(content);
  return { content, lines, fm, filePath };
}

/**
 * Get the tools list from frontmatter (field may be array or string).
 */
function getToolsList(fm) {
  const val = fm.fields.get('tools');
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

/**
 * Get the disallowedTools list from frontmatter.
 */
function getDisallowedToolsList(fm) {
  const val = fm.fields.get('disallowedTools');
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

// ---------------------------------------------------------------------------
// Agent roster: [filename, nameStem]
// ---------------------------------------------------------------------------
const AGENTS = [
  ['researcher.md',       'researcher'],
  ['planner.md',         'planner'],
  ['critic.md',          'critic'],
  ['creator.md',         'creator'],
  ['profiler.md',        'profiler'],
  ['evaluator.md',       'evaluator'],
  ['wiki-maintainer.md', 'wiki-maintainer'],
  ['dashboard-builder.md','dashboard-builder'],
  ['git-manager.md',     'git-manager'],
];

// Required XML section tags in body (plan check 5)
const REQUIRED_SECTIONS = ['Role', 'Success_Criteria', 'Operations', 'Constraints', 'Final_Checklist'];

// Valid model values (plan check 4)
const VALID_MODELS = new Set(['haiku', 'sonnet', 'opus']);

// ---------------------------------------------------------------------------
// Generate 10 tests per agent (9 × 10 = 90 total)
// ---------------------------------------------------------------------------
for (const [filename, stem] of AGENTS) {

  // Check 1 — file exists and has YAML frontmatter
  test(`${stem}: should have YAML frontmatter when file exists`, async () => {
    // Arrange
    const filePath = join(AGENTS_DIR, filename);

    // Act — readFile throws ENOENT if file missing; parseFrontmatter throws if malformed
    const content = await readFile(filePath, 'utf8');

    // Assert
    assert.ok(
      content.startsWith('---\n'),
      `${filename}: expected file to start with ---\\n (YAML frontmatter delimiter)`
    );
    // Confirm closing delimiter exists
    assert.ok(
      content.includes('\n---\n'),
      `${filename}: expected closing ---\\n for frontmatter block`
    );
  });

  // Check 2 — name: field matches filename stem
  test(`${stem}: should have name field matching filename stem`, async () => {
    // Arrange
    const { fm } = await loadAgent(filename);

    // Act
    const nameVal = fm.fields.get('name');

    // Assert
    assert.ok(nameVal, `${filename}: expected 'name:' field in frontmatter`);
    assert.equal(
      nameVal.trim(),
      stem,
      `${filename}: expected name:'${stem}', got '${nameVal}'`
    );
  });

  // Check 3 — description: field present and non-empty
  test(`${stem}: should have non-empty description field`, async () => {
    // Arrange
    const { fm } = await loadAgent(filename);

    // Act
    const desc = fm.fields.get('description');

    // Assert
    assert.ok(desc, `${filename}: expected 'description:' field in frontmatter`);
    assert.ok(
      typeof desc === 'string' ? desc.trim().length > 0 : desc.length > 0,
      `${filename}: description field is empty`
    );
    // Reasonable char limit check (plan spec: <= 500 chars)
    const descStr = Array.isArray(desc) ? desc.join(' ') : desc;
    assert.ok(
      descStr.length <= 500,
      `${filename}: description exceeds 500 chars (got ${descStr.length})`
    );
  });

  // Check 4 — model: in {haiku, sonnet, opus}
  test(`${stem}: should have model field set to haiku, sonnet, or opus`, async () => {
    // Arrange
    const { fm } = await loadAgent(filename);

    // Act
    const model = fm.fields.get('model');

    // Assert
    assert.ok(model, `${filename}: expected 'model:' field in frontmatter`);
    assert.ok(
      VALID_MODELS.has(model.trim()),
      `${filename}: model '${model}' is not one of {haiku, sonnet, opus}`
    );
  });

  // Check 5 — body contains all required XML section tags
  test(`${stem}: should have Role, Success_Criteria, Operations, Constraints, Final_Checklist sections`, async () => {
    // Arrange
    const { content } = await loadAgent(filename);

    // Act + Assert — check each section tag individually for clear failure messages
    for (const section of REQUIRED_SECTIONS) {
      assert.ok(
        content.includes(`<${section}>`),
        `${filename}: missing required section tag <${section}>`
      );
    }
  });

  // Check 6 — file is under 120 lines
  test(`${stem}: should be under 120 lines`, async () => {
    // Arrange
    const { lines } = await loadAgent(filename);

    // Assert
    assert.ok(
      lines <= 120,
      `${filename}: file has ${lines} lines, exceeds 120-line cap`
    );
  });

  // Check 7 — tools: block is present in frontmatter
  test(`${stem}: should declare allowed tools list in frontmatter`, async () => {
    // Arrange
    const { fm } = await loadAgent(filename);

    // Act
    const tools = getToolsList(fm);

    // Assert
    assert.ok(
      fm.fields.has('tools'),
      `${filename}: expected 'tools:' block in frontmatter`
    );
    assert.ok(
      tools.length > 0,
      `${filename}: tools list is empty — agent must declare at least one allowed tool`
    );
  });

  // Check 8 — researcher declares WebSearch + WebFetch (only runs for researcher)
  test(`${stem}: should declare WebSearch and WebFetch tools when agent is researcher`, async () => {
    // Arrange
    const { fm } = await loadAgent(filename);
    const tools = getToolsList(fm);

    // Act + Assert
    if (stem === 'researcher') {
      assert.ok(
        tools.includes('WebSearch'),
        `researcher.md: missing 'WebSearch' in tools list`
      );
      assert.ok(
        tools.includes('WebFetch'),
        `researcher.md: missing 'WebFetch' in tools list`
      );
    } else {
      // Non-researcher agents are NOT expected to have WebSearch/WebFetch —
      // but this check slot still exercises tools parsing so assertion is structural.
      assert.ok(
        Array.isArray(tools),
        `${filename}: tools field must be a parseable list`
      );
    }
  });

  // Check 9 — git-manager declares Bash only (Read/Write/Grep NOT in tools)
  test(`${stem}: should list Bash only (no Read, Write, or Grep) when agent is git-manager`, async () => {
    // Arrange
    const { fm } = await loadAgent(filename);
    const tools = getToolsList(fm);

    // Act + Assert
    if (stem === 'git-manager') {
      assert.ok(
        tools.includes('Bash'),
        `git-manager.md: expected 'Bash' in tools list`
      );
      assert.ok(
        !tools.includes('Read'),
        `git-manager.md: 'Read' must NOT be in tools (Bash-only policy)`
      );
      assert.ok(
        !tools.includes('Write'),
        `git-manager.md: 'Write' must NOT be in tools (Bash-only policy)`
      );
      assert.ok(
        !tools.includes('Grep'),
        `git-manager.md: 'Grep' must NOT be in tools (Bash-only policy)`
      );
    } else {
      // For non-git-manager agents, assert the tools field is a list (structural)
      assert.ok(
        Array.isArray(tools),
        `${filename}: tools field must be a parseable list`
      );
    }
  });

  // Check 10 — profiler declares disallowedTools containing Edit
  test(`${stem}: should declare disallowedTools containing Edit when agent is profiler`, async () => {
    // Arrange
    const { fm } = await loadAgent(filename);

    // Act + Assert
    if (stem === 'profiler') {
      const disallowed = getDisallowedToolsList(fm);
      assert.ok(
        fm.fields.has('disallowedTools'),
        `profiler.md: expected 'disallowedTools:' field in frontmatter`
      );
      assert.ok(
        disallowed.includes('Edit'),
        `profiler.md: expected 'Edit' in disallowedTools (profiler writes via Write only)`
      );
    } else {
      // Other agents: confirm frontmatter is parseable — structural health check
      assert.ok(
        fm.fields.size > 0,
        `${filename}: frontmatter parsed zero fields — frontmatter is malformed`
      );
    }
  });

} // end for AGENTS

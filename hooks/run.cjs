#!/usr/bin/env node
'use strict';
const { spawnSync } = require('child_process');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const { resolve, basename, dirname, join } = require('path');

const target = process.argv[2];
if (!target) process.exit(0);

// Resolve target, handle missing
const resolved = resolve(target);
if (!existsSync(resolved)) {
  process.exit(0); // Missing script = no-op, never block Claude
}

const hookName = basename(resolved, '.mjs');

// Read stdin
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const input = Buffer.concat(chunks).toString('utf-8');
  const args = process.argv.slice(3);

  const result = spawnSync(process.execPath, [resolved, ...args], {
    input,
    encoding: 'utf-8',
    timeout: 30000,
    env: { ...process.env }
  });

  // Hook succeeded — pass through output
  if (result.status === 0 || result.status === null) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status || 0);
    return;
  }

  // Hook failed — log error and suggest error-healing
  const errorMsg = (result.stderr || result.stdout || 'Unknown error').trim();
  const errorFile = resolveErrorLog(input);

  if (errorFile) {
    logHookError(errorFile, hookName, resolved, errorMsg, result.status);
  }

  // Output systemMessage so Claude sees the failure and can heal it
  const suggestion = JSON.stringify({
    continue: true,
    systemMessage: [
      `Hook "${hookName}" failed (exit ${result.status}): ${errorMsg.slice(0, 200)}`,
      `Run /jaewon-plugin:error-healing to fix this hook error.`,
      `Hook source: ${resolved}`
    ].join('\n')
  });
  process.stdout.write(suggestion);
  process.exit(0); // Exit 0 so we don't block Claude
});

function resolveErrorLog(input) {
  let cwd = process.cwd();
  try {
    const data = JSON.parse(input);
    if (data.cwd) cwd = data.cwd;
  } catch { /* ignore */ }

  const jaewonDir = join(cwd, '.jaewon');
  if (!existsSync(jaewonDir)) {
    try { mkdirSync(jaewonDir, { recursive: true }); } catch { return null; }
  }
  return join(jaewonDir, 'hook-errors.json');
}

function logHookError(errorFile, name, scriptPath, error, exitCode) {
  let errors = [];
  try {
    if (existsSync(errorFile)) {
      errors = JSON.parse(readFileSync(errorFile, 'utf-8'));
    }
  } catch { errors = []; }

  errors.push({
    hook: name,
    script: scriptPath,
    error: error.slice(0, 500),
    exitCode,
    timestamp: new Date().toISOString()
  });

  // Keep last 20 errors
  if (errors.length > 20) errors = errors.slice(-20);

  try {
    writeFileSync(errorFile, JSON.stringify(errors, null, 2), 'utf-8');
  } catch { /* best effort */ }
}

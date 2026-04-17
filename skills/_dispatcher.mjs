/**
 * Pure dict dispatcher for the learn skill phases.
 *
 * @calling-spec
 * - dispatch(phase, args): { skill_path: string, args: object } | { ok: false, error: string }
 *   Input:  phase (string) — one of read, summarize, discuss, verdict; args (object) — passed through unchanged
 *   Output: { skill_path: string, args: object } on known phase; { ok: false, error: string } on unknown
 *   Side effects: none
 *   Depends on: nothing
 */

const PHASE_SKILL_MAP = {
  read:      'skills/learn/SKILL.md',
  summarize: 'skills/learn/SKILL.md',
  discuss:   'skills/learn/SKILL.md',
  verdict:   'skills/verdict/SKILL.md',
};

export function dispatch(phase, args) {
  const skill_path = PHASE_SKILL_MAP[phase];
  if (!skill_path) return { ok: false, error: `unknown phase: ${phase}` };
  return { skill_path, args };
}

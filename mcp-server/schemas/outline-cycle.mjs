/**
 * outline-cycle.mjs — Cycle detection for chapter dependency graphs
 *
 * @calling-spec
 * - hasCircularDeps(graph): boolean
 *   Input: graph (Map<string, string[]>) — adjacency list where each key is
 *          a chapter slug and each value is an array of dependency slugs
 *   Output: true if a cycle exists, false otherwise
 *   Side effects: none
 *   Depends on: nothing
 */

const WHITE = 0; // unvisited
const GRAY = 1;  // in current DFS path
const BLACK = 2; // fully processed

/**
 * dfs(node, graph, color) — depth-first search to detect back edges (cycles)
 * @param {string} node
 * @param {Map<string, string[]>} graph
 * @param {Map<string, number>} color
 * @returns {boolean}
 */
function dfs(node, graph, color) {
  color.set(node, GRAY);
  const neighbors = graph.get(node) || [];
  for (const neighbor of neighbors) {
    if (!color.has(neighbor)) continue; // unknown dep — skip
    if (color.get(neighbor) === GRAY) return true; // back edge = cycle
    if (color.get(neighbor) === WHITE && dfs(neighbor, graph, color)) return true;
  }
  color.set(node, BLACK);
  return false;
}

/**
 * hasCircularDeps(graph) — returns true if the dependency graph contains a cycle
 * @param {Map<string, string[]>} graph
 * @returns {boolean}
 */
export function hasCircularDeps(graph) {
  const color = new Map();
  for (const node of graph.keys()) {
    color.set(node, WHITE);
  }
  for (const node of graph.keys()) {
    if (color.get(node) === WHITE) {
      if (dfs(node, graph, color)) return true;
    }
  }
  return false;
}

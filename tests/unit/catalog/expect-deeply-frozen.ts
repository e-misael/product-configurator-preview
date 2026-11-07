/**
 * Asserts that `value` and every object or array reachable from it is frozen.
 * Returns the number of objects checked so callers can assert it is non-trivial.
 */
export function expectDeeplyFrozen(value: unknown): number {
  const visited = new Set<object>();
  const unfrozen: string[] = [];

  function walk(node: unknown, path: string): void {
    if (typeof node !== 'object' || node === null || visited.has(node)) return;
    visited.add(node);
    if (!Object.isFrozen(node)) unfrozen.push(path);
    for (const [key, child] of Object.entries(node)) {
      walk(child, Array.isArray(node) ? `${path}[${key}]` : `${path}.${key}`);
    }
  }

  walk(value, 'catalog');
  expect(unfrozen).toEqual([]);
  return visited.size;
}

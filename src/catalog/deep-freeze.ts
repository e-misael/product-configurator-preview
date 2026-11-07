/**
 * Recursively freezes plain objects and arrays in place and returns the
 * same value. Shared and repeated references are frozen once.
 */
export function deepFreeze<T>(value: T): T {
  const visited = new WeakSet<object>();

  function freeze(node: unknown): void {
    if (typeof node !== 'object' || node === null || visited.has(node)) return;
    visited.add(node);
    for (const child of Object.values(node)) {
      freeze(child);
    }
    Object.freeze(node);
  }

  freeze(value);
  return value;
}

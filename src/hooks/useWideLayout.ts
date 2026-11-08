import { useSyncExternalStore } from 'react';

/** Two columns from this width up; below it the steps are collapsible (D-058). */
export const WIDE_LAYOUT_QUERY = '(min-width: 48rem)';

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(WIDE_LAYOUT_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

/** Without `matchMedia` (non-browser environments) the wide layout is assumed. */
function snapshot() {
  return typeof window.matchMedia !== 'function' || window.matchMedia(WIDE_LAYOUT_QUERY).matches;
}

export function useWideLayout(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => true);
}

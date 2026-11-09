import { useEffect, useState } from 'react';
import type { FontFamily } from '../domain';
import { isLetteringFontLoaded, loadLetteringFont, type FontState } from '../preview/font-loading';

/**
 * The loading state of the lettering font for `family` (D-072). A family
 * loaded earlier is reported loaded at once, so switching back never flashes.
 */
export function useLetteringFont(family: FontFamily): FontState {
  const [states, setStates] = useState<ReadonlyMap<FontFamily, FontState>>(new Map());
  const ready = isLetteringFontLoaded(family);

  useEffect(() => {
    if (ready) return;
    let active = true;
    const report = (state: FontState) => {
      if (active) setStates((previous) => new Map(previous).set(family, state));
    };
    loadLetteringFont(family).then(
      () => report('loaded'),
      () => report('error'),
    );
    return () => {
      active = false;
    };
  }, [family, ready]);

  return ready ? 'loaded' : (states.get(family) ?? 'loading');
}

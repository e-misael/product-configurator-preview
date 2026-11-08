import { useEffect, useState } from 'react';
import type { ImageState } from '../preview/scene';

/**
 * Loads same-origin images and reports each one's state by `src`. A source
 * that has not reported yet is treated as loading by the consumer. Images
 * stay cached for the component's lifetime so switching back is instant; an
 * errored source is requested again the next time it is needed.
 */
export function useImages(sources: readonly string[]): ReadonlyMap<string, ImageState> {
  const [states, setStates] = useState<ReadonlyMap<string, ImageState>>(new Map());
  const key = sources.join('\n');

  useEffect(() => {
    let active = true;
    const report = (src: string, state: ImageState) => {
      if (active) setStates((previous) => new Map(previous).set(src, state));
    };
    for (const src of key === '' ? [] : key.split('\n')) {
      const image = new Image();
      image.onload = () =>
        report(
          src,
          image.naturalWidth > 0 && image.naturalHeight > 0
            ? { status: 'loaded', image }
            : { status: 'error' },
        );
      image.onerror = () => report(src, { status: 'error' });
      image.src = src;
    }
    return () => {
      active = false;
    };
  }, [key]);

  return states;
}

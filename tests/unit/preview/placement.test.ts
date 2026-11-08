import { textBlockOf } from '../../../src/preview/placement';
import type { Scene } from '../../../src/preview/scene';

describe('textBlockOf', () => {
  it('finds the text layer, or nothing', () => {
    const empty: Scene<{ naturalWidth: number; naturalHeight: number }> = {
      width: 0,
      height: 0,
      layers: [],
      notices: [],
      description: undefined,
    };
    expect(textBlockOf(empty)).toBeUndefined();
  });
});

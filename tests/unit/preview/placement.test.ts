import { dragPosition, hitsBlock, textBlockOf, toLogical } from '../../../src/preview/placement';
import type { Scene } from '../../../src/preview/scene';

describe('toLogical', () => {
  const scene = { width: 400, height: 200 };

  it('converts displayed CSS pixels to scene units, whatever the displayed size', () => {
    // Displayed at half size, offset on the page.
    const display = { left: 10, top: 20, width: 200, height: 100 };
    expect(toLogical(110, 70, display, scene)).toEqual({ x: 200, y: 100 });
    // Displayed larger than the scene.
    expect(toLogical(800, 400, { left: 0, top: 0, width: 800, height: 400 }, scene)).toEqual({
      x: 400,
      y: 200,
    });
  });

  it('does not divide by zero for an undisplayed canvas', () => {
    expect(toLogical(5, 5, { left: 0, top: 0, width: 0, height: 0 }, scene)).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('hitsBlock', () => {
  const bounds = { x: 100, y: 50, width: 80, height: 40 };

  it('hits inside the block and within the tolerance around it', () => {
    expect(hitsBlock(bounds, { x: 140, y: 70 }, 0)).toBe(true);
    expect(hitsBlock(bounds, { x: 95, y: 70 }, 0)).toBe(false);
    expect(hitsBlock(bounds, { x: 95, y: 70 }, 6)).toBe(true);
    expect(hitsBlock(bounds, { x: 140, y: 97 }, 6)).toBe(false);
  });
});

describe('dragPosition', () => {
  const slack = { x: 200, y: 100 };

  it('moves each axis by the fraction of its free space travelled', () => {
    expect(dragPosition({ x: 0, y: 0 }, slack, { x: 50, y: 25 })).toEqual({ x: 0.25, y: 0.25 });
    expect(dragPosition({ x: 0.5, y: 0.5 }, slack, { x: -20, y: 10 })).toEqual({
      x: 0.4,
      y: 0.6,
    });
  });

  it('stops at the edges of the safe area', () => {
    expect(dragPosition({ x: 0.9, y: 0.1 }, slack, { x: 500, y: -500 })).toEqual({ x: 1, y: 0 });
  });

  it('keeps an axis without free space where it is', () => {
    expect(dragPosition({ x: 0.3, y: 0.7 }, { x: 0, y: -10 }, { x: 50, y: 50 })).toEqual({
      x: 0.3,
      y: 0.7,
    });
  });
});

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

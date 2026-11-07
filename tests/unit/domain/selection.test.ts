import { getFrameOptions, selectPlate } from '../../../src/domain';
import { testCatalog, validConfiguration } from './fixtures';

describe('selectPlate', () => {
  it('clears a selected frame when the new plate does not support frames', () => {
    const config = validConfiguration({ frameId: 'test-frame-any' });

    expect(selectPlate(config, 'test-plate-circle', testCatalog)).toEqual({
      config: { ...config, plateId: 'test-plate-circle', frameId: null },
      cleared: ['frameId'],
    });
  });

  it('uses the capability, not the shape, to decide', () => {
    const config = validConfiguration({ frameId: 'test-frame-square' });

    expect(selectPlate(config, 'test-plate-square-frameless', testCatalog).cleared).toEqual([
      'frameId',
    ]);
  });

  it('keeps the frame when the new plate supports frames', () => {
    const config = validConfiguration({ frameId: 'test-frame-any' });

    expect(selectPlate(config, 'test-plate-rectangle', testCatalog)).toEqual({
      config: { ...config, plateId: 'test-plate-rectangle' },
      cleared: [],
    });
  });

  it('keeps an incompatible frame on a plate that supports frames, for validation to report', () => {
    const config = validConfiguration({ frameId: 'test-frame-square' });

    expect(selectPlate(config, 'test-plate-rectangle', testCatalog)).toEqual({
      config: { ...config, plateId: 'test-plate-rectangle' },
      cleared: [],
    });
  });

  it('reports nothing cleared when there is no frame', () => {
    expect(selectPlate(validConfiguration(), 'test-plate-circle', testCatalog).cleared).toEqual([]);
  });

  it('stores an unknown plate ID and keeps the frame', () => {
    const config = validConfiguration({ frameId: 'test-frame-any' });

    expect(selectPlate(config, 'does-not-exist', testCatalog)).toEqual({
      config: { ...config, plateId: 'does-not-exist' },
      cleared: [],
    });
  });

  it('preserves every other field and does not modify the input', () => {
    const config = Object.freeze(
      validConfiguration({
        frameId: 'test-frame-any',
        colorCategory: 'colored',
        colorId: 'test-color-colored',
        text: ' Ana\n',
      }),
    );
    const snapshot = structuredClone(config);

    const result = selectPlate(config, 'test-plate-circle', testCatalog);

    expect(config).toEqual(snapshot);
    expect(result.config).toEqual({ ...snapshot, plateId: 'test-plate-circle', frameId: null });
  });
});

describe('getFrameOptions', () => {
  const ids = (plateId: string) => getFrameOptions(testCatalog, plateId).map((frame) => frame.id);

  it('returns available frames compatible with the plate', () => {
    expect(ids('test-plate-square')).toEqual([
      'test-frame-any',
      'test-frame-square',
      'test-frame-square-plate-only',
    ]);
    expect(ids('test-plate-rectangle')).toEqual(['test-frame-any']);
    expect(ids('test-plate-square-b')).toEqual(['test-frame-any', 'test-frame-square']);
  });

  it('returns no frames for plates without frame support', () => {
    expect(ids('test-plate-circle')).toEqual([]);
    expect(ids('test-plate-square-frameless')).toEqual([]);
  });

  it('returns no frames for an unknown plate', () => {
    expect(ids('does-not-exist')).toEqual([]);
  });
});

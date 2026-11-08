import { act, renderHook } from '@testing-library/react';
import { issueFor, useConfiguration } from '../../../src/hooks/useConfiguration';
import { testCatalog } from '../domain/fixtures';

function setup() {
  return renderHook(() => useConfiguration(testCatalog));
}

describe('useConfiguration', () => {
  it('starts empty and incomplete', () => {
    const { result } = setup();

    expect(result.current.config).toEqual({
      plateId: null,
      frameId: null,
      text: '',
      fontFamily: 'sans-serif',
      textColorId: null,
      secondaryColorId: null,
      secondaryRanges: [],
    });
    expect(result.current.validation.status).toBe('incomplete');
    expect(result.current.notice).toBeNull();
  });

  it('reaches a valid configuration through its actions', () => {
    const { result } = setup();

    act(() => result.current.choosePlate('test-plate-square'));
    act(() => result.current.chooseFrame('test-frame-any'));
    act(() => result.current.setText('  Linha 1\nLinha 2 '));
    act(() => result.current.chooseTextColor('test-text-color-a'));

    expect(result.current.config).toEqual({
      plateId: 'test-plate-square',
      frameId: 'test-frame-any',
      text: '  Linha 1\nLinha 2 ',
      fontFamily: 'sans-serif',
      textColorId: 'test-text-color-a',
      secondaryColorId: null,
      secondaryRanges: [],
    });
    expect(result.current.validation).toEqual({ status: 'valid' });
  });

  it('clears the frame on a frameless plate and raises a notice until the next change', () => {
    const { result } = setup();

    act(() => result.current.choosePlate('test-plate-square'));
    act(() => result.current.chooseFrame('test-frame-any'));
    act(() => result.current.choosePlate('test-plate-circle'));

    expect(result.current.config.frameId).toBeNull();
    expect(result.current.notice).toBe('frame-cleared');

    act(() => result.current.setText('Ana'));
    expect(result.current.notice).toBeNull();
  });

  it('keeps a frame that becomes incompatible and reports it as invalid', () => {
    const { result } = setup();

    act(() => result.current.choosePlate('test-plate-square'));
    act(() => result.current.chooseFrame('test-frame-square'));
    act(() => result.current.choosePlate('test-plate-rectangle'));

    expect(result.current.config.frameId).toBe('test-frame-square');
    expect(result.current.notice).toBeNull();
    expect(issueFor(result.current.validation, 'frameId')).toEqual({
      kind: 'invalid',
      field: 'frameId',
      code: 'incompatible-shape',
    });
  });
});

describe('useConfiguration: lettering', () => {
  const withText = (text: string) => {
    const hook = setup();
    act(() => hook.result.current.setText(text));
    act(() => hook.result.current.chooseTextColor('test-text-color-a'));
    act(() => hook.result.current.chooseSecondaryColor('test-text-color-b'));
    return hook;
  };

  it('stores the font and the primary color as chosen', () => {
    const { result } = setup();

    act(() => result.current.setFontFamily('serif'));
    act(() => result.current.chooseTextColor('test-text-color-b'));

    expect(result.current.config.fontFamily).toBe('serif');
    expect(result.current.config.textColorId).toBe('test-text-color-b');
  });

  it('applies and removes the secondary color without touching the text', () => {
    const { result } = withText('Casa da Ana');

    act(() => result.current.applySecondaryColor(0, 4));
    expect(result.current.config.secondaryRanges).toEqual([{ start: 0, end: 4 }]);
    expect(result.current.config.text).toBe('Casa da Ana');

    act(() => result.current.removeSecondaryColor(0, 4));
    expect(result.current.config.secondaryRanges).toEqual([]);
    expect(result.current.config.text).toBe('Casa da Ana');
  });

  it('keeps the secondary color when its last range is removed', () => {
    const { result } = withText('Casa');

    act(() => result.current.applySecondaryColor(0, 2));
    act(() => result.current.removeSecondaryColor(0, 2));

    expect(result.current.config.secondaryColorId).toBe('test-text-color-b');
    expect(result.current.config.secondaryRanges).toEqual([]);
  });

  it('clears the color and every range only on "no secondary color"', () => {
    const { result } = withText('Casa');
    act(() => result.current.applySecondaryColor(0, 2));

    act(() => result.current.chooseSecondaryColor('test-text-color-a'));
    expect(result.current.config.secondaryRanges).toEqual([{ start: 0, end: 2 }]);

    act(() => result.current.chooseSecondaryColor(null));
    expect(result.current.config.secondaryColorId).toBeNull();
    expect(result.current.config.secondaryRanges).toEqual([]);
  });

  it('moves ranges with the edit when the caret identifies it', () => {
    const { result } = withText('Casa');
    act(() => result.current.applySecondaryColor(2, 4));

    // Type "XY" at the start; caret ends after the insertion.
    act(() => result.current.setText('XYCasa', 2));

    expect(result.current.config.secondaryRanges).toEqual([{ start: 4, end: 6 }]);
    expect(result.current.notice).toBeNull();
  });

  it('removes the affected formatting and says so when the edit is ambiguous', () => {
    const { result } = withText('aaaa');
    act(() => result.current.applySecondaryColor(0, 4));

    // Without caret metadata, "aaaa" -> "aaa" cannot say which "a" went away.
    act(() => result.current.setText('aaa'));

    expect(result.current.config.secondaryRanges).toEqual([]);
    expect(result.current.config.secondaryColorId).toBe('test-text-color-b');
    expect(result.current.notice).toBe('formatting-removed');

    act(() => result.current.setText('aaab', 4));
    expect(result.current.notice).toBeNull();
  });

  it('reports the secondary color as invalid when equal to the primary', () => {
    const { result } = withText('Casa');
    act(() => result.current.chooseSecondaryColor('test-text-color-a'));

    expect(issueFor(result.current.validation, 'secondaryColorId')).toMatchObject({
      kind: 'invalid',
      code: 'same-as-primary',
    });
  });
});

describe('issueFor', () => {
  it('returns undefined for a valid result', () => {
    expect(issueFor({ status: 'valid' }, 'plateId')).toBeUndefined();
  });
});

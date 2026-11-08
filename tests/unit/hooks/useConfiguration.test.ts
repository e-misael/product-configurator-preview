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
      text: '',
      fontFamily: 'sans-serif',
      textColorId: null,
      highlightEnabled: false,
      secondaryColorId: null,
      secondaryRanges: [],
      textLayout: null,
      note: '',
    });
    expect(result.current.validation.status).toBe('incomplete');
    expect(result.current.notice).toBeNull();
  });

  it('starts at the catalog default lettering color, if any (D-064)', () => {
    const { result } = renderHook(() =>
      useConfiguration({ ...testCatalog, defaultTextColorId: 'test-text-color-a' }),
    );
    expect(result.current.config.textColorId).toBe('test-text-color-a');
  });

  it('reaches a valid configuration through its actions', () => {
    const { result } = setup();

    act(() => result.current.choosePlate('test-plate-square'));
    act(() => result.current.setText('  Linha 1\nLinha 2 '));
    act(() => result.current.chooseTextColor('test-text-color-a'));

    expect(result.current.config).toEqual({
      plateId: 'test-plate-square',
      text: '  Linha 1\nLinha 2 ',
      fontFamily: 'sans-serif',
      textColorId: 'test-text-color-a',
      highlightEnabled: false,
      secondaryColorId: null,
      secondaryRanges: [],
      textLayout: null,
      note: '',
    });
    expect(result.current.validation).toEqual({ status: 'valid' });
  });

  it('clears the model without touching any other choice (D-057)', () => {
    const { result } = setup();
    act(() => result.current.choosePlate('test-plate-square'));
    act(() => result.current.setText('Ana'));
    act(() => result.current.chooseTextColor('test-text-color-a'));
    act(() => result.current.placeText({ align: 'right', x: 1, y: 0 }));

    act(() => result.current.clearPlate());

    expect(result.current.config).toMatchObject({
      plateId: null,
      text: 'Ana',
      textColorId: 'test-text-color-a',
      textLayout: { align: 'right', x: 1, y: 0 },
    });
    expect(issueFor(result.current.validation, 'plateId')).toEqual({
      kind: 'missing',
      field: 'plateId',
    });
  });

  it('changes the model without touching any other choice', () => {
    const { result } = setup();
    act(() => result.current.setText('Ana'));
    act(() => result.current.placeText({ align: 'left', x: 0, y: 1 }));

    act(() => result.current.choosePlate('test-plate-circle'));
    act(() => result.current.choosePlate('bandeja-inexistente'));

    expect(result.current.config).toMatchObject({
      plateId: 'bandeja-inexistente',
      text: 'Ana',
      textLayout: { align: 'left', x: 0, y: 1 },
    });
    expect(result.current.notice).toBeNull();
    expect(issueFor(result.current.validation, 'plateId')).toMatchObject({
      code: 'unknown-reference',
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

  it('stores the note exactly as typed without affecting validation (D-062)', () => {
    const { result } = setup();
    act(() => result.current.choosePlate('test-plate-square'));
    act(() => result.current.setText('Ana'));
    act(() => result.current.chooseTextColor('test-text-color-a'));

    act(() => result.current.setNote('  Sem pressa\n'));
    expect(result.current.config.note).toBe('  Sem pressa\n');
    expect(result.current.validation).toEqual({ status: 'valid' });
  });

  it('stores the font and the primary color as chosen', () => {
    const { result } = setup();

    act(() => result.current.setFontFamily('serif'));
    act(() => result.current.chooseTextColor('test-text-color-b'));

    expect(result.current.config.fontFamily).toBe('serif');
    expect(result.current.config.textColorId).toBe('test-text-color-b');
  });

  it('starts with highlighting off and keeps its words when turned off (D-071)', () => {
    const { result } = withText('Casa da Ana');
    expect(result.current.config.highlightEnabled).toBe(false);

    act(() => result.current.setHighlightEnabled(true));
    act(() => result.current.toggleHighlightWord({ start: 0, end: 4 }));
    act(() => result.current.setHighlightEnabled(false));
    expect(result.current.config.secondaryRanges).toEqual([{ start: 0, end: 4 }]);
    expect(result.current.config.secondaryColorId).toBe('test-text-color-b');

    act(() => result.current.setHighlightEnabled(true));
    expect(result.current.config.secondaryRanges).toEqual([{ start: 0, end: 4 }]);
  });

  it('toggles word occurrences independently, without touching the text', () => {
    const { result } = withText('Ana e Ana');
    act(() => result.current.setHighlightEnabled(true));

    act(() => result.current.toggleHighlightWord({ start: 6, end: 9 }));
    act(() => result.current.toggleHighlightWord({ start: 0, end: 3 }));
    expect(result.current.config.secondaryRanges).toEqual([
      { start: 0, end: 3 },
      { start: 6, end: 9 },
    ]);
    act(() => result.current.toggleHighlightWord({ start: 0, end: 3 }));
    expect(result.current.config.secondaryRanges).toEqual([{ start: 6, end: 9 }]);
    expect(result.current.config.text).toBe('Ana e Ana');
  });

  it('swaps the colors when the highlight color is chosen as primary (D-071)', () => {
    const { result } = withText('Casa da Ana');
    act(() => result.current.setHighlightEnabled(true));
    act(() => result.current.toggleHighlightWord({ start: 0, end: 4 }));

    act(() => result.current.chooseTextColor('test-text-color-b'));

    expect(result.current.config.textColorId).toBe('test-text-color-b');
    expect(result.current.config.secondaryColorId).toBe('test-text-color-a');
    expect(result.current.config.secondaryRanges).toEqual([{ start: 0, end: 4 }]);
    expect(result.current.notice).toBe('colors-swapped');
    expect(result.current.validation.status).not.toBe('invalid');
  });

  it('swaps silently while highlighting is off', () => {
    const { result } = withText('Casa');
    act(() => result.current.chooseTextColor('test-text-color-b'));
    expect(result.current.config.secondaryColorId).toBe('test-text-color-a');
    expect(result.current.notice).toBeNull();
  });

  it('moves highlights with the edit when the caret identifies it', () => {
    const { result } = withText('Casa da Ana');
    act(() => result.current.toggleHighlightWord({ start: 8, end: 11 }));

    // Type "Oi " at the start; caret ends after the insertion.
    act(() => result.current.setText('Oi Casa da Ana', 3));

    expect(result.current.config.secondaryRanges).toEqual([{ start: 11, end: 14 }]);
    expect(result.current.notice).toBeNull();
  });

  it('removes the affected highlight and says so when the edit is ambiguous', () => {
    const { result } = withText('Ana Ana');
    act(() => result.current.toggleHighlightWord({ start: 4, end: 7 }));

    // Without caret metadata, "Ana Ana" -> "Ana" cannot say which "Ana" went away.
    act(() => result.current.setText('Ana'));

    expect(result.current.config.secondaryRanges).toEqual([]);
    expect(result.current.config.secondaryColorId).toBe('test-text-color-b');
    expect(result.current.notice).toBe('formatting-removed');

    act(() => result.current.setText('Ana b', 5));
    expect(result.current.notice).toBeNull();
  });

  it('reports a highlight color equal to the primary once words are highlighted', () => {
    const { result } = withText('Casa');
    act(() => result.current.chooseSecondaryColor('test-text-color-a'));
    // Off, or on without words, the highlight color is not checked (D-071).
    expect(issueFor(result.current.validation, 'secondaryColorId')).toBeUndefined();
    act(() => result.current.setHighlightEnabled(true));
    expect(issueFor(result.current.validation, 'secondaryColorId')).toBeUndefined();
    act(() => result.current.toggleHighlightWord({ start: 0, end: 4 }));

    expect(issueFor(result.current.validation, 'secondaryColorId')).toMatchObject({
      kind: 'invalid',
      code: 'same-as-primary',
    });
  });
});

describe('useConfiguration: text placement', () => {
  it('stores a placement, then moves only the position', () => {
    const { result } = setup();
    act(() => result.current.choosePlate('test-plate-square'));

    act(() => result.current.placeText({ align: 'right', x: 0, y: 0 }));
    act(() => result.current.nudgeText(0.1, 0.02));
    expect(result.current.config.textLayout).toEqual({ align: 'right', x: 0.1, y: 0.02 });
  });

  it('starts nudges from the catalog default', () => {
    const { result } = setup();
    act(() => result.current.choosePlate('test-plate-square'));

    act(() => result.current.nudgeText(-0.02, 0));
    expect(result.current.config.textLayout).toEqual({ align: 'center', x: 0.48, y: 0.5 });
  });

  it('keeps the placement across model changes; reset restores the position, not the alignment', () => {
    const { result } = setup();
    act(() => result.current.choosePlate('test-plate-square'));
    act(() => result.current.placeText({ align: 'right', x: 1, y: 1 }));

    act(() => result.current.choosePlate('test-plate-circle'));
    expect(result.current.config.textLayout).toEqual({ align: 'right', x: 1, y: 1 });

    act(() => result.current.resetTextLayout());
    expect(result.current.config.textLayout).toEqual({ align: 'right', x: 0.5, y: 0.5 });
  });

  it('clears the stored layout when reset leaves the catalog alignment', () => {
    const { result } = setup();
    act(() => result.current.choosePlate('test-plate-square'));
    act(() => result.current.placeText({ align: 'center', x: 0, y: 1 }));

    act(() => result.current.resetTextLayout());
    expect(result.current.config.textLayout).toBeNull();
  });

  it.each(['left', 'center', 'right'] as const)(
    'aligns the lines %s without moving the block (D-059)',
    (align) => {
      const { result } = setup();
      act(() => result.current.choosePlate('test-plate-square'));
      act(() => result.current.placeText({ align: 'center', x: 0.2, y: 0.9 }));

      act(() => result.current.alignText(align));
      expect(result.current.config.textLayout).toEqual({ align, x: 0.2, y: 0.9 });
    },
  );

  it('aligns from the catalog default position when nothing is stored', () => {
    const { result } = setup();
    act(() => result.current.choosePlate('test-plate-square'));

    act(() => result.current.alignText('left'));
    expect(result.current.config.textLayout).toEqual({ align: 'left', x: 0.5, y: 0.5 });
  });
});

describe('issueFor', () => {
  it('returns undefined for a valid result', () => {
    expect(issueFor({ status: 'valid' }, 'plateId')).toBeUndefined();
  });
});

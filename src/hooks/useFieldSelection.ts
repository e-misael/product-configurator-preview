import { useEffect, useState, type RefObject } from 'react';

export interface FieldSelection {
  readonly start: number;
  readonly end: number;
}

const NONE: FieldSelection = { start: 0, end: 0 };

/** The field's current selection, read from the element itself. */
export function readSelection(field: HTMLTextAreaElement | null): FieldSelection {
  return field === null ? NONE : { start: field.selectionStart, end: field.selectionEnd };
}

/**
 * Follows the selection in a textarea, however it was made: mouse, keyboard,
 * or touch handles. React's `onSelect` misses selections made by touch or
 * without a mouse/key release (D-068), so the native `selectionchange`
 * (fired on the document or, in newer engines, on the field) and `select`
 * events are used. A textarea keeps its selection when it loses focus, so the
 * value stays valid while the customer picks a color or taps a button.
 */
export function useFieldSelection(ref: RefObject<HTMLTextAreaElement | null>): FieldSelection {
  const [selection, setSelection] = useState<FieldSelection>(NONE);

  useEffect(() => {
    const field = ref.current;
    if (field === null) return;
    const update = () => {
      const next = readSelection(field);
      setSelection((previous) =>
        previous.start === next.start && previous.end === next.end ? previous : next,
      );
    };
    const events = ['select', 'selectionchange', 'input', 'keyup', 'pointerup', 'focus'];
    for (const type of events) field.addEventListener(type, update);
    // Some engines report selection changes on the document only.
    const onDocument = () => {
      if (document.activeElement === field) update();
    };
    document.addEventListener('selectionchange', onDocument);
    update();
    return () => {
      for (const type of events) field.removeEventListener(type, update);
      document.removeEventListener('selectionchange', onDocument);
    };
  }, [ref]);

  return selection;
}

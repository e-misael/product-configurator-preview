import { useCallback, useMemo, useState } from 'react';
import {
  alignPlacement,
  catalogTextAlign,
  createEmptyConfiguration,
  effectivePlacement,
  nudgePlacement,
  remapWords,
  resetPosition,
  toggleWord,
  validateConfiguration,
  type Catalog,
  type Configuration,
  type ConfigurationField,
  type FontFamily,
  type TextAlignment,
  type TextPlacement,
  type TextRange,
  type ValidationIssue,
  type ValidationResult,
} from '../domain';

/** A one-off message about a change the app made on the user's behalf. */
export type Notice = 'formatting-removed' | 'colors-swapped';

interface State {
  readonly config: Configuration;
  readonly notice: Notice | null;
}

/**
 * Configuration state over the pure domain functions. Selections are stored
 * exactly as chosen (the lettering color starts at the catalog default, D-064) and reported by validation; the only automatic change is
 * formatting that cannot follow an ambiguous text edit (D-042).
 */
export function useConfiguration(catalog: Catalog, note = '') {
  const [state, setState] = useState<State>(() => ({
    // The catalog's default lettering color, if any, is the starting choice (D-064);
    // a note kept through a restart is the only other starting input (D-070).
    config: {
      ...createEmptyConfiguration(),
      textColorId: catalog.defaultTextColorId ?? null,
      note,
    },
    notice: null,
  }));

  const update = useCallback((patch: Partial<Configuration>) => {
    setState(({ config }) => ({ config: { ...config, ...patch }, notice: null }));
  }, []);

  // Changing the model keeps the text, colors, and placement (D-044, D-057).
  const choosePlate = useCallback((plateId: string) => update({ plateId }), [update]);
  /** No model selected, e.g. while a model group waits for its size (D-057). */
  const clearPlate = useCallback(() => update({ plateId: null }), [update]);
  /**
   * The highlighted words follow the edit by position (D-071). `caret` is the
   * textarea selection after the edit; a highlight whose word changed or could
   * not be located is removed and a notice says so.
   */
  const setText = useCallback((text: string, caret?: number) => {
    setState(({ config }) => {
      const { ranges, removed } = remapWords(config.text, text, config.secondaryRanges, caret);
      return {
        config: { ...config, text, secondaryRanges: ranges },
        notice: removed ? 'formatting-removed' : null,
      };
    });
  }, []);

  /** The optional note, kept exactly as typed (D-062). */
  const setNote = useCallback((note: string) => update({ note }), [update]);
  const setFontFamily = useCallback((fontFamily: FontFamily) => update({ fontFamily }), [update]);
  /**
   * Choosing the highlight color as the primary swaps the two (D-071): the
   * highlighted words keep a different color, and the swap is announced while
   * highlighting is on.
   */
  const chooseTextColor = useCallback(
    (textColorId: string | null) =>
      setState(({ config }) => {
        const swap = textColorId !== null && textColorId === config.secondaryColorId;
        return {
          config: swap
            ? { ...config, textColorId, secondaryColorId: config.textColorId }
            : { ...config, textColorId },
          notice: swap && config.highlightEnabled ? 'colors-swapped' : null,
        };
      }),
    [],
  );
  /** Changing the highlight color keeps the highlighted words. */
  const chooseSecondaryColor = useCallback(
    (secondaryColorId: string) => update({ secondaryColorId }),
    [update],
  );
  /** Turning highlighting off keeps its color and words for when it is turned on again. */
  const setHighlightEnabled = useCallback(
    (highlightEnabled: boolean) => update({ highlightEnabled }),
    [update],
  );
  /** Highlights one word occurrence, or removes its highlight (D-071). */
  const toggleHighlightWord = useCallback(
    (word: TextRange) =>
      setState(({ config }) => ({
        config: { ...config, secondaryRanges: toggleWord(config.secondaryRanges, word) },
        notice: null,
      })),
    [],
  );

  // Text placement (D-044). The placement survives model changes: it is relative
  // to whichever calibrated text area the selected model has.
  const placeText = useCallback((textLayout: TextPlacement) => update({ textLayout }), [update]);
  /** Moves the block by fractions of the free space (2%, or 10% with Shift). */
  const nudgeText = useCallback(
    (dx: number, dy: number) =>
      setState(({ config }) => ({
        config: {
          ...config,
          textLayout: nudgePlacement(effectivePlacement(config, catalog), dx, dy),
        },
        notice: null,
      })),
    [catalog],
  );
  /** The line alignment alone; the block stays where it is (D-059). */
  const alignText = useCallback(
    (align: TextAlignment) =>
      setState(({ config }) => ({
        config: {
          ...config,
          textLayout: alignPlacement(effectivePlacement(config, catalog), align),
        },
        notice: null,
      })),
    [catalog],
  );
  /** Back to the catalog default position; the chosen line alignment is kept (D-059). */
  const resetTextLayout = useCallback(
    () =>
      setState(({ config }) => {
        const plate = catalog.plates.find((candidate) => candidate.id === config.plateId);
        return {
          config: {
            ...config,
            textLayout: resetPosition(effectivePlacement(config, catalog), catalogTextAlign(plate)),
          },
          notice: null,
        };
      }),
    [catalog],
  );

  const validation = useMemo(
    () => validateConfiguration(state.config, catalog),
    [state.config, catalog],
  );

  return {
    config: state.config,
    notice: state.notice,
    validation,
    choosePlate,
    clearPlate,
    setText,
    setNote,
    setFontFamily,
    chooseTextColor,
    chooseSecondaryColor,
    setHighlightEnabled,
    toggleHighlightWord,
    placeText,
    nudgeText,
    alignText,
    resetTextLayout,
  };
}

export function issueFor(
  result: ValidationResult,
  field: ConfigurationField,
): ValidationIssue | undefined {
  return result.status === 'valid' ? undefined : result.issues.find((i) => i.field === field);
}

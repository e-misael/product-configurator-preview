import { useCallback, useMemo, useState } from 'react';
import {
  addRange,
  createEmptyConfiguration,
  effectivePlacement,
  nudgePlacement,
  remapRanges,
  removeRange,
  validateConfiguration,
  type Catalog,
  type Configuration,
  type ConfigurationField,
  type FontFamily,
  type TextPlacement,
  type ValidationIssue,
  type ValidationResult,
} from '../domain';

/** A one-off message about a change the app made on the user's behalf. */
export type Notice = 'formatting-removed';

interface State {
  readonly config: Configuration;
  readonly notice: Notice | null;
}

/**
 * Configuration state over the pure domain functions. Selections are stored
 * exactly as chosen and reported by validation; the only automatic change is
 * formatting that cannot follow an ambiguous text edit (D-042).
 */
export function useConfiguration(catalog: Catalog) {
  const [state, setState] = useState<State>(() => ({
    config: createEmptyConfiguration(),
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
   * The secondary-color ranges follow the edit (D-042). `caret` is the textarea
   * selection after the edit; when the edit cannot be located the affected
   * formatting is removed and a notice says so.
   */
  const setText = useCallback((text: string, caret?: number) => {
    setState(({ config }) => {
      const { ranges, ambiguous } = remapRanges(config.text, text, config.secondaryRanges, caret);
      return {
        config: { ...config, text, secondaryRanges: ranges },
        notice: ambiguous ? 'formatting-removed' : null,
      };
    });
  }, []);

  const setFontFamily = useCallback((fontFamily: FontFamily) => update({ fontFamily }), [update]);
  const chooseTextColor = useCallback(
    (textColorId: string | null) => update({ textColorId }),
    [update],
  );
  /** Changing the second color keeps its ranges: they are drawn in the new color. */
  const chooseSecondaryColor = useCallback(
    (secondaryColorId: string) => update({ secondaryColorId }),
    [update],
  );
  /** "Remover segunda cor": the only action that clears the color and all its ranges. */
  const removeSecondaryColor = useCallback(
    () => update({ secondaryColorId: null, secondaryRanges: [] }),
    [update],
  );
  const applySecondaryColor = useCallback(
    (start: number, end: number) =>
      setState(({ config }) => ({
        config: {
          ...config,
          secondaryRanges: addRange(config.text, config.secondaryRanges, start, end),
        },
        notice: null,
      })),
    [],
  );
  const unapplySecondaryColor = useCallback(
    (start: number, end: number) =>
      setState(({ config }) => ({
        config: {
          ...config,
          secondaryRanges: removeRange(config.text, config.secondaryRanges, start, end),
        },
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
  /** Back to the catalog default alignment and position. */
  const resetTextLayout = useCallback(() => update({ textLayout: null }), [update]);

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
    setFontFamily,
    chooseTextColor,
    chooseSecondaryColor,
    applySecondaryColor,
    unapplySecondaryColor,
    removeSecondaryColor,
    placeText,
    nudgeText,
    resetTextLayout,
  };
}

export function issueFor(
  result: ValidationResult,
  field: ConfigurationField,
): ValidationIssue | undefined {
  return result.status === 'valid' ? undefined : result.issues.find((i) => i.field === field);
}

import { useCallback, useMemo, useState } from 'react';
import {
  addRange,
  createEmptyConfiguration,
  remapRanges,
  removeRange,
  selectPlate,
  validateConfiguration,
  type Catalog,
  type Configuration,
  type ConfigurationField,
  type FontFamily,
  type ValidationIssue,
  type ValidationResult,
} from '../domain';

/** A one-off message about a change the app made on the user's behalf. */
export type Notice = 'frame-cleared' | 'formatting-removed';

interface State {
  readonly config: Configuration;
  readonly notice: Notice | null;
}

/**
 * Configuration state over the pure domain functions. The only automatic
 * change is the one `selectPlate` makes (D-026); everything else is stored
 * exactly as chosen and reported by validation.
 */
export function useConfiguration(catalog: Catalog) {
  const [state, setState] = useState<State>(() => ({
    config: createEmptyConfiguration(),
    notice: null,
  }));

  const update = useCallback((patch: Partial<Configuration>) => {
    setState(({ config }) => ({ config: { ...config, ...patch }, notice: null }));
  }, []);

  const choosePlate = useCallback(
    (plateId: string) => {
      setState(({ config }) => {
        const result = selectPlate(config, plateId, catalog);
        return {
          config: result.config,
          notice: result.cleared.includes('frameId') ? 'frame-cleared' : null,
        };
      });
    },
    [catalog],
  );

  const chooseFrame = useCallback((frameId: string | null) => update({ frameId }), [update]);
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
  /** `null` ("Sem segunda cor") is the only action that also clears the ranges. */
  const chooseSecondaryColor = useCallback(
    (secondaryColorId: string | null) =>
      setState(({ config }) => ({
        config: {
          ...config,
          secondaryColorId,
          secondaryRanges: secondaryColorId === null ? [] : config.secondaryRanges,
        },
        notice: null,
      })),
    [],
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
  const removeSecondaryColor = useCallback(
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

  const validation = useMemo(
    () => validateConfiguration(state.config, catalog),
    [state.config, catalog],
  );

  return {
    config: state.config,
    notice: state.notice,
    validation,
    choosePlate,
    chooseFrame,
    setText,
    setFontFamily,
    chooseTextColor,
    chooseSecondaryColor,
    applySecondaryColor,
    removeSecondaryColor,
  };
}

export function issueFor(
  result: ValidationResult,
  field: ConfigurationField,
): ValidationIssue | undefined {
  return result.status === 'valid' ? undefined : result.issues.find((i) => i.field === field);
}

import { useCallback, useMemo, useState } from 'react';
import {
  createEmptyConfiguration,
  selectPlate,
  validateConfiguration,
  type Catalog,
  type Configuration,
  type ConfigurationField,
  type ValidationIssue,
  type ValidationResult,
} from '../domain';

/** A one-off message about a change the app made on the user's behalf. */
export type Notice = 'frame-cleared';

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
  const setText = useCallback((text: string) => update({ text }), [update]);

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
  };
}

export function issueFor(
  result: ValidationResult,
  field: ConfigurationField,
): ValidationIssue | undefined {
  return result.status === 'valid' ? undefined : result.issues.find((i) => i.field === field);
}

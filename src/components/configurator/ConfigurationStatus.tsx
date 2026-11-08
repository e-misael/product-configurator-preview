import type { ValidationResult } from '../../domain';
import { missingLabel } from './messages';

interface ConfigurationStatusProps {
  readonly validation: ValidationResult;
  /** A model group is chosen but not its size (D-057). */
  readonly sizePending?: boolean;
}

/**
 * Missing fields are summarized here, beside export (D-058); invalid choices
 * are explained at each field (D-029).
 */
export function ConfigurationStatus({ validation, sizePending = false }: ConfigurationStatusProps) {
  let summary: string;
  if (validation.status === 'valid') {
    summary = 'Configuração completa.';
  } else if (validation.status === 'invalid') {
    summary = 'Há escolhas incompatíveis — veja os avisos acima.';
  } else {
    const missing = validation.issues
      .filter((issue) => issue.kind === 'missing')
      .map((issue) => missingLabel(issue.field, sizePending));
    summary = `Falta escolher: ${missing.join(', ')}.`;
  }

  return (
    <section className="status" aria-label="Situação da configuração">
      <p className={`status__summary status__summary--${validation.status}`}>{summary}</p>
    </section>
  );
}

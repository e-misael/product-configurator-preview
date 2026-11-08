import type { ValidationResult } from '../../domain';
import type { Notice } from '../../hooks/useConfiguration';
import { FORMATTING_REMOVED_NOTICE, missingLabel } from './messages';

interface ConfigurationStatusProps {
  readonly validation: ValidationResult;
  readonly notice: Notice | null;
  /** A model group is chosen but not its size (D-057). */
  readonly sizePending?: boolean;
}

/** Missing fields are summarized here; invalid choices are explained at each field (D-029). */
export function ConfigurationStatus({
  validation,
  notice,
  sizePending = false,
}: ConfigurationStatusProps) {
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
      {/* Always rendered so assistive technology announces changes. */}
      <p className="status__notice" role="status">
        {notice === 'formatting-removed' && FORMATTING_REMOVED_NOTICE}
      </p>
      <p className={`status__summary status__summary--${validation.status}`}>{summary}</p>
    </section>
  );
}

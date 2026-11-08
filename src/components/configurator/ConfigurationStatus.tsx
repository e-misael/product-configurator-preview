import type { ValidationResult } from '../../domain';
import type { Notice } from '../../hooks/useConfiguration';
import { FIELD_LABELS, FORMATTING_REMOVED_NOTICE, FRAME_CLEARED_NOTICE } from './messages';

interface ConfigurationStatusProps {
  readonly validation: ValidationResult;
  readonly notice: Notice | null;
}

/** Missing fields are summarized here; invalid choices are explained at each field (D-029). */
export function ConfigurationStatus({ validation, notice }: ConfigurationStatusProps) {
  let summary: string;
  if (validation.status === 'valid') {
    summary = 'Configuração completa.';
  } else if (validation.status === 'invalid') {
    summary = 'Há escolhas incompatíveis — veja os avisos acima.';
  } else {
    const missing = validation.issues
      .filter((issue) => issue.kind === 'missing')
      .map((issue) => FIELD_LABELS[issue.field]);
    summary = `Falta escolher: ${missing.join(', ')}.`;
  }

  return (
    <section className="status" aria-label="Situação da configuração">
      {/* Always rendered so assistive technology announces changes. */}
      <p className="status__notice" role="status">
        {notice === 'frame-cleared' && FRAME_CLEARED_NOTICE}
        {notice === 'formatting-removed' && FORMATTING_REMOVED_NOTICE}
      </p>
      <p className={`status__summary status__summary--${validation.status}`}>{summary}</p>
    </section>
  );
}

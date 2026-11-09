import { RestartControl } from './RestartControl';
import type { ReviewSummary } from './review-summary';

interface ReviewPanelProps {
  readonly summary: ReviewSummary;
  /** Starts over with no choices ("Reiniciar configurações"). */
  readonly onRestart: () => void;
}

/**
 * "Revisar personalização" (D-058, D-078): the full selection and
 * "Reiniciar configurações", nothing else. The summary is also the canvas's
 * accessible description, and the order message repeats it.
 */
export function ReviewPanel({ summary, onRestart }: ReviewPanelProps) {
  return (
    <div className="review">
      <dl className="review__summary" id="review-summary">
        <dt>Modelo:</dt>
        <dd>{summary.model}</dd>
        <dt>Tamanho:</dt>
        <dd>{summary.size}</dd>
        <dt>Cor da peça:</dt>
        <dd>{summary.ceramicColor}</dd>
        <dt>Fonte:</dt>
        <dd>{summary.font}</dd>
        <dt>Cor do texto:</dt>
        <dd>{summary.textColor}</dd>
        <dt>Destaque:</dt>
        <dd>
          {summary.highlight === null
            ? '—'
            : `${summary.highlight.color}: ${summary.highlight.words.join(', ')}`}
        </dd>
        <dt>Alinhamento:</dt>
        <dd>{summary.alignment}</dd>
        <dt>Posição:</dt>
        <dd>{summary.position}</dd>
        <dt>Texto:</dt>
        <dd className="review__text">{summary.text === '' ? '—' : summary.text}</dd>
      </dl>
      <RestartControl onRestart={onRestart} />
    </div>
  );
}

import type { Catalog, Configuration, Plate, ValidationResult } from '../../domain';
import { exportRevision } from '../../preview/export';
import type { Scene } from '../../preview/scene';
import { ConfigurationStatus } from '../configurator/ConfigurationStatus';
import type { ModelGroup } from '../configurator/model-groups';
import { ExportControls } from '../preview/ExportControls';
import { orderMessage } from './order-message';
import { RestartControl } from './RestartControl';
import { reviewSummary } from './review-summary';

interface ReviewPanelProps {
  readonly catalog: Catalog;
  readonly config: Configuration;
  readonly plate: Plate | undefined;
  readonly groups: readonly ModelGroup[];
  readonly group: ModelGroup | undefined;
  readonly sizePending: boolean;
  readonly validation: ValidationResult;
  readonly scene: Scene;
  /** The section is open (or every step is, on wide screens). */
  readonly active: boolean;
  readonly onNote: (note: string) => void;
  /** Starts over with no choices ("Reiniciar configurações"). */
  readonly onRestart: () => void;
}

/**
 * "Revisar personalização" (D-058): the full selection, what is still missing,
 * the approved disclaimer (D-056, wording unchanged but TAAVI in capitals), and
 * the sharing and export actions last, with their blockers beside them
 * (D-076). The summary is also the canvas's accessible description, and the
 * order message repeats it.
 */
export function ReviewPanel({
  catalog,
  config,
  plate,
  groups,
  group,
  sizePending,
  validation,
  scene,
  active,
  onNote,
  onRestart,
}: ReviewPanelProps) {
  const summary = reviewSummary(catalog, config, plate, groups, group, sizePending);
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
      {/* Starting over belongs to the summary; export stays the last action (D-058). */}
      <RestartControl onRestart={onRestart} />
      <ConfigurationStatus validation={validation} sizePending={sizePending} />
      {/* Approved copy (D-056). */}
      <div className="disclaimer">
        <p>
          A pré-visualização é ilustrativa. Como nossas peças são produzidas artesanalmente, o
          produto final pode apresentar pequenas variações de formato, textura, acabamento,
          posicionamento das letras e tonalidade das cores em relação à imagem exibida na tela.
        </p>
        <p>
          As cores também podem variar conforme a iluminação, as características da cerâmica e as
          configurações de cada dispositivo.
        </p>
        <p>
          Todas as solicitações de personalização estão sujeitas à análise e aprovação da TAAVI.
        </p>
      </div>
      {/* Optional note (D-062): stored as typed, never drawn on the image. */}
      <div className="field">
        <label className="field__legend" htmlFor="note">
          Observação
        </label>
        <p className="field__info" id="note-hint">
          Opcional. Não aparece na imagem exportada.
        </p>
        <textarea
          id="note"
          className="textarea"
          rows={3}
          value={config.note}
          aria-describedby="note-hint"
          onChange={(e) => onNote(e.target.value)}
        />
      </div>
      <ExportControls
        scene={scene}
        validation={validation}
        plateId={config.plateId}
        sizePending={sizePending}
        revision={exportRevision(config)}
        active={active}
        orderMessage={orderMessage(summary, config.note)}
      />
    </div>
  );
}

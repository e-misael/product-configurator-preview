import {
  catalogTextAlign,
  findTextColor,
  type Catalog,
  type Configuration,
  type Plate,
  type ValidationResult,
} from '../../domain';
import type { Scene } from '../../preview/scene';
import { ConfigurationStatus } from '../configurator/ConfigurationStatus';
import { sizeLabel, type ModelGroup } from '../configurator/model-groups';
import { ExportControls } from '../preview/ExportControls';
import { ALIGNMENT_LABELS } from '../preview/messages';

interface ReviewPanelProps {
  readonly catalog: Catalog;
  readonly config: Configuration;
  readonly plate: Plate | undefined;
  readonly groups: readonly ModelGroup[];
  readonly group: ModelGroup | undefined;
  readonly sizePending: boolean;
  readonly validation: ValidationResult;
  readonly scene: Scene;
  readonly onNote: (note: string) => void;
}

function colorName(catalog: Catalog, id: string | null, none = '—'): string {
  return id === null ? none : (findTextColor(catalog, id)?.displayName ?? id);
}

/**
 * "Revisar personalização" (D-058): the full selection, what is still missing,
 * the approved disclaimer (D-056, wording unchanged), and export as the last
 * action with its blockers beside it. The summary is also the canvas's
 * accessible description.
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
  onNote,
}: ReviewPanelProps) {
  const align = config.textLayout?.align ?? catalogTextAlign(plate);
  return (
    <div className="review">
      <dl className="review__summary" id="review-summary">
        <dt>Modelo:</dt>
        <dd>{group?.name ?? plate?.displayName ?? '—'}</dd>
        <dt>Tamanho:</dt>
        <dd>{plate ? sizeLabel(groups, plate) : sizePending ? 'Não escolhido' : '—'}</dd>
        <dt>Cor da peça:</dt>
        <dd>{plate?.ceramicColor ?? '—'}</dd>
        <dt>Fonte:</dt>
        <dd>{config.fontFamily === 'serif' ? 'Com serifa' : 'Sem serifa'}</dd>
        <dt>Cor do texto:</dt>
        <dd>{colorName(catalog, config.textColorId, 'Não escolhida')}</dd>
        <dt>Segunda cor:</dt>
        <dd>
          {config.secondaryColorId === null
            ? '—'
            : `${colorName(catalog, config.secondaryColorId)} (${config.secondaryRanges.length} ${
                config.secondaryRanges.length === 1 ? 'trecho' : 'trechos'
              })`}
        </dd>
        <dt>Alinhamento:</dt>
        <dd>{ALIGNMENT_LABELS[align]}</dd>
        <dt>Texto:</dt>
        <dd className="review__text">{config.text === '' ? '—' : config.text}</dd>
      </dl>
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
          Todas as solicitações de personalização estão sujeitas à análise e aprovação da Taavi.
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
      />
    </div>
  );
}

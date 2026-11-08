import { useMemo, useState } from 'react';
import {
  findTextColor,
  type Catalog,
  type Configuration,
  type Plate,
  type TextPlacement,
  type ValidationResult,
} from '../../domain';
import { useImages } from '../../hooks/useImages';
import { composePreview, compositionSources } from '../../preview/composition';
import { createTextMeasurer } from '../../preview/draw';
import { textBlockOf, type Point } from '../../preview/placement';
import { buildScene } from '../../preview/scene';
import { sizeLabel, type ModelGroup } from '../configurator/model-groups';
import { ExportControls } from './ExportControls';
import { NOTICE_MESSAGES, overflowMessage, SIZE_PENDING_MESSAGE } from './messages';
import { PreviewCanvas } from './PreviewCanvas';
import { TextPositionControls } from './TextPositionControls';

interface PreviewPanelProps {
  readonly catalog: Catalog;
  readonly config: Configuration;
  readonly plate: Plate | undefined;
  /** Model groups of `catalog`, and the chosen one with or without its size (D-057). */
  readonly groups?: readonly ModelGroup[];
  readonly group?: ModelGroup | undefined;
  readonly sizePending?: boolean;
  readonly validation: ValidationResult;
  readonly positioning: {
    readonly place: (placement: TextPlacement) => void;
    readonly nudge: (dx: number, dy: number) => void;
    readonly reset: () => void;
  };
}

function colorName(catalog: Catalog, id: string | null, none = '—'): string {
  return id === null ? none : (findTextColor(catalog, id)?.displayName ?? id);
}

/**
 * Preview (FR-06, FR-08): composes the selection from the catalog's real
 * images on a canvas and says, in text, why anything is not shown. Missing,
 * loading, or failed images are never replaced by another product's image.
 * A text summary of the selection stays beside the canvas as its alternative.
 */
export function PreviewPanel({
  catalog,
  config,
  plate,
  groups = [],
  group,
  sizePending = false,
  validation,
  positioning,
}: PreviewPanelProps) {
  const composition = useMemo(
    () => composePreview(catalog, config, validation),
    [catalog, config, validation],
  );
  const measure = useMemo(() => createTextMeasurer(config.fontFamily), [config.fontFamily]);
  const images = useImages(compositionSources(composition));
  const scene = useMemo(
    () => buildScene(composition, images, measure),
    [composition, images, measure],
  );
  const block = textBlockOf(scene);
  const noticeMessage = (code: (typeof scene.notices)[number]) => {
    if (code === 'text-overflow') return overflowMessage(block?.excessLines ?? 0);
    if (code === 'plate-not-selected' && sizePending) return SIZE_PENDING_MESSAGE;
    return NOTICE_MESSAGES[code];
  };
  const messages = [...new Set(scene.notices.map(noticeMessage))];
  const [moveMode, setMoveMode] = useState(false);
  // Dragging changes only the block position; the line alignment is kept (D-044).
  const moveText = (position: Point) => {
    if (block !== undefined) positioning.place({ align: block.align, ...position });
  };

  return (
    <section className="preview" aria-labelledby="preview-title">
      <h2 className="preview__title" id="preview-title">
        Pré-visualização
      </h2>
      {scene.layers.length > 0 ? (
        <PreviewCanvas
          scene={scene}
          label={scene.description ?? 'Pré-visualização da configuração'}
          describedBy="preview-summary"
          moveMode={moveMode}
          onMoveText={moveText}
        />
      ) : (
        <div className="preview__empty">Sem imagem para exibir</div>
      )}
      <div className="preview__notices" id="preview-notices" aria-live="polite">
        {messages.length > 0 && (
          <ul className="preview__notice-list">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
      </div>
      <TextPositionControls
        block={block}
        customized={config.textLayout !== null}
        moveMode={moveMode}
        onToggleMoveMode={() => setMoveMode((on) => !on)}
        onPlace={positioning.place}
        onNudge={positioning.nudge}
        onReset={positioning.reset}
      />
      <ExportControls
        scene={scene}
        validation={validation}
        plateId={config.plateId}
        noticesId="preview-notices"
        sizePending={sizePending}
      />
      <dl className="preview__summary" id="preview-summary">
        <dt>Modelo</dt>
        <dd>{group?.name ?? plate?.displayName ?? '—'}</dd>
        <dt>Tamanho</dt>
        <dd>{plate ? sizeLabel(groups, plate) : sizePending ? 'Não escolhido' : '—'}</dd>
        <dt>Cor da peça</dt>
        <dd>{plate?.ceramicColor ?? '—'}</dd>
        <dt>Fonte</dt>
        <dd>{config.fontFamily === 'serif' ? 'Com serifa' : 'Sem serifa'}</dd>
        <dt>Cor do texto</dt>
        <dd>{colorName(catalog, config.textColorId, 'Não escolhida')}</dd>
        <dt>Segunda cor</dt>
        <dd>
          {config.secondaryColorId === null
            ? '—'
            : `${colorName(catalog, config.secondaryColorId)} (${config.secondaryRanges.length} ${
                config.secondaryRanges.length === 1 ? 'trecho' : 'trechos'
              })`}
        </dd>
        <dt>Texto</dt>
        <dd className="preview__text">{config.text === '' ? '—' : config.text}</dd>
      </dl>
    </section>
  );
}

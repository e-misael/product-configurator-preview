import { useMemo, useState } from 'react';
import {
  findFrame,
  findTextColor,
  type Catalog,
  type Configuration,
  type Plate,
  type TextAlignment,
  type TextPlacement,
  type ValidationResult,
} from '../../domain';
import { useImages } from '../../hooks/useImages';
import { composePreview, compositionSources } from '../../preview/composition';
import { createTextMeasurer } from '../../preview/draw';
import { textBlockOf, type Point } from '../../preview/placement';
import { buildScene } from '../../preview/scene';
import { modelLabel } from '../configurator/messages';
import { ExportControls } from './ExportControls';
import { NOTICE_MESSAGES } from './messages';
import { PreviewCanvas } from './PreviewCanvas';
import { TextPositionControls } from './TextPositionControls';

interface PreviewPanelProps {
  readonly catalog: Catalog;
  readonly config: Configuration;
  readonly plate: Plate | undefined;
  readonly validation: ValidationResult;
  readonly positioning: {
    readonly place: (placement: TextPlacement) => void;
    readonly align: (align: TextAlignment) => void;
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
  const messages = [...new Set(scene.notices.map((code) => NOTICE_MESSAGES[code]))];
  const block = textBlockOf(scene);
  const [moveMode, setMoveMode] = useState(false);
  // Dragging changes only the block position; the line alignment is kept (D-044).
  const moveText = (position: Point) => {
    if (block !== undefined) positioning.place({ align: block.align, ...position });
  };

  const frameName =
    config.frameId === null
      ? 'Sem moldura'
      : (findFrame(catalog, config.frameId)?.displayName ?? config.frameId);

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
        onAlign={positioning.align}
        onNudge={positioning.nudge}
        onReset={positioning.reset}
      />
      <ExportControls
        scene={scene}
        validation={validation}
        plateId={config.plateId}
        noticesId="preview-notices"
      />
      <dl className="preview__summary" id="preview-summary">
        <dt>Modelo</dt>
        <dd>{plate ? modelLabel(plate) : '—'}</dd>
        <dt>Moldura</dt>
        <dd>{frameName}</dd>
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

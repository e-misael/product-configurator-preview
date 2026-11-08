import { useMemo, useState } from 'react';
import {
  findFrame,
  type Catalog,
  type Configuration,
  type Plate,
  type ValidationResult,
} from '../../domain';
import { useImages } from '../../hooks/useImages';
import { composePreview, compositionSources } from '../../preview/composition';
import { createTextMeasurer } from '../../preview/draw';
import { buildScene } from '../../preview/scene';
import { modelLabel } from '../configurator/messages';
import { NOTICE_MESSAGES } from './messages';
import { PreviewCanvas } from './PreviewCanvas';

interface PreviewPanelProps {
  readonly catalog: Catalog;
  readonly config: Configuration;
  readonly plate: Plate | undefined;
  readonly validation: ValidationResult;
}

/**
 * Preview (FR-06, FR-08): composes the selection from the catalog's real
 * images on a canvas and says, in text, why anything is not shown. Missing,
 * loading, or failed images are never replaced by another product's image.
 * A text summary of the selection stays beside the canvas as its alternative.
 */
export function PreviewPanel({ catalog, config, plate, validation }: PreviewPanelProps) {
  const [measure] = useState(createTextMeasurer);
  const composition = useMemo(
    () => composePreview(catalog, config, validation),
    [catalog, config, validation],
  );
  const images = useImages(compositionSources(composition));
  const scene = useMemo(
    () => buildScene(composition, images, measure),
    [composition, images, measure],
  );
  const messages = [...new Set(scene.notices.map((code) => NOTICE_MESSAGES[code]))];

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
        />
      ) : (
        <div className="preview__empty">Sem imagem para exibir</div>
      )}
      <div className="preview__notices" aria-live="polite">
        {messages.length > 0 && (
          <ul className="preview__notice-list">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
      </div>
      <dl className="preview__summary" id="preview-summary">
        <dt>Modelo</dt>
        <dd>{plate ? modelLabel(plate) : '—'}</dd>
        <dt>Moldura</dt>
        <dd>{frameName}</dd>
        <dt>Cor da peça</dt>
        <dd>{plate?.ceramicColor ?? '—'}</dd>
        <dt>Texto</dt>
        <dd className="preview__text">{config.text === '' ? '—' : config.text}</dd>
      </dl>
    </section>
  );
}

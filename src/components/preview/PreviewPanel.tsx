import { findColor, findFrame, type Catalog, type Configuration, type Plate } from '../../domain';
import { CATEGORY_LABELS, SHAPE_LABELS } from '../configurator/messages';

interface PreviewPanelProps {
  readonly catalog: Catalog;
  readonly config: Configuration;
  readonly plate: Plate | undefined;
}

/**
 * Preview slot (FR-06, FR-08). Until the M3 renderer composes real product
 * images, it shows a labeled placeholder with a text summary of the current
 * selection — never a drawing presented as the product.
 */
export function PreviewPanel({ catalog, config, plate }: PreviewPanelProps) {
  const frameName =
    config.frameId === null
      ? 'Sem quadro'
      : (findFrame(catalog, config.frameId)?.displayName ?? config.frameId);
  const colorName =
    config.colorCategory === null
      ? '—'
      : [
          CATEGORY_LABELS[config.colorCategory],
          config.colorId === null ? undefined : findColor(catalog, config.colorId)?.displayName,
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <section className="preview" aria-labelledby="preview-title">
      <h2 className="preview__title" id="preview-title">
        Pré-visualização
      </h2>
      <div className="preview__placeholder">
        <p className="preview__label">
          Pré-visualização ilustrativa — as imagens reais dos produtos serão exibidas aqui.
        </p>
        <dl className="preview__summary">
          <dt>Placa</dt>
          <dd>{plate ? `${plate.displayName} · ${SHAPE_LABELS[plate.shape]}` : '—'}</dd>
          <dt>Quadro</dt>
          <dd>{frameName}</dd>
          <dt>Cor da placa</dt>
          <dd>{colorName}</dd>
          <dt>Texto</dt>
          <dd className="preview__text">{config.text === '' ? '—' : config.text}</dd>
        </dl>
      </div>
    </section>
  );
}

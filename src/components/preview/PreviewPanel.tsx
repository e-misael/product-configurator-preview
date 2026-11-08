import { textBlockOf } from '../../preview/placement';
import type { Scene } from '../../preview/scene';
import { noticeMessage } from './messages';
import { PreviewCanvas } from './PreviewCanvas';

interface PreviewPanelProps {
  readonly scene: Scene;
  /** A model is selected (or a model group waits for its size): the panel sticks on phones. */
  readonly active: boolean;
  readonly sizePending: boolean;
  /** Larger on phones while the text is being positioned (D-058). */
  readonly expanded: boolean;
  /**
   * Smaller on phones while the text step is open, leaving room for the
   * virtual keyboard. Tied to the step, not to focus, so leaving the field
   * never moves the page under the finger.
   */
  readonly reduced: boolean;
}

/**
 * Preview (FR-06, FR-08, D-058): the scene painted from the catalog's real
 * images, with the reasons anything is not shown. On phones it is a compact
 * band that stays at the top once a model is chosen and grows while the text
 * is positioned; its space is reserved from the start so choosing a model
 * does not shift the page. The text summary is in "Revisar personalização".
 */
export function PreviewPanel({ scene, active, sizePending, expanded, reduced }: PreviewPanelProps) {
  const block = textBlockOf(scene);
  // Overflow blocks export and needs the customer to act: it is shown as an error (D-063).
  // With no model chosen the empty stage itself says so; the notice would repeat it.
  const noModel = scene.notices.includes('plate-not-selected') && !sizePending;
  const notices = [...new Set(scene.notices)]
    .filter((code) => !(noModel && code === 'plate-not-selected'))
    .map((code) => ({
      code,
      message: noticeMessage(code, block?.excessLines ?? 0, sizePending),
    }));

  return (
    <section
      className={`preview${active ? ' preview--active' : ''}${expanded ? ' preview--expanded' : ''}${
        reduced ? ' preview--reduced' : ''
      }`}
      aria-labelledby="preview-title"
    >
      <h2 className="preview__title" id="preview-title">
        Pré-visualização
      </h2>
      <div className="preview__stage">
        {scene.layers.length > 0 ? (
          <PreviewCanvas
            scene={scene}
            label={scene.description ?? 'Pré-visualização da configuração'}
            describedBy="review-summary"
          />
        ) : (
          <div className="preview__empty">
            {noModel ? 'Selecione um modelo' : 'Sem imagem para exibir'}
          </div>
        )}
      </div>
      <div className="preview__notices" id="preview-notices" aria-live="polite">
        {notices.length > 0 && (
          <ul className="preview__notice-list">
            {notices.map(({ code, message }) => (
              <li
                key={code}
                className={code === 'text-overflow' ? 'preview__notice--error' : undefined}
              >
                {message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

import type { TextPlacement } from '../../domain';
import { textBlockOf, type Point } from '../../preview/placement';
import type { Scene } from '../../preview/scene';
import { NOTICE_MESSAGES, overflowMessage, SIZE_PENDING_MESSAGE } from './messages';
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
  /** "Ajustar manualmente": the text can be dragged on the canvas. */
  readonly moveMode: boolean;
  readonly onPlace: (placement: TextPlacement) => void;
}

/**
 * Preview (FR-06, FR-08, D-058): the scene painted from the catalog's real
 * images, with the reasons anything is not shown. On phones it is a compact
 * band that stays at the top once a model is chosen and grows while the text
 * is positioned; its space is reserved from the start so choosing a model
 * does not shift the page. The text summary is in "Revisar personalização".
 */
export function PreviewPanel({
  scene,
  active,
  sizePending,
  expanded,
  reduced,
  moveMode,
  onPlace,
}: PreviewPanelProps) {
  const block = textBlockOf(scene);
  const noticeMessage = (code: (typeof scene.notices)[number]) => {
    if (code === 'text-overflow') return overflowMessage(block?.excessLines ?? 0);
    if (code === 'plate-not-selected' && sizePending) return SIZE_PENDING_MESSAGE;
    return NOTICE_MESSAGES[code];
  };
  const messages = [...new Set(scene.notices.map(noticeMessage))];
  // Dragging changes only the block position; the line alignment is kept (D-059).
  const moveText = (position: Point) => {
    if (block !== undefined) onPlace({ align: block.align, ...position });
  };

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
            moveMode={moveMode}
            onMoveText={moveText}
          />
        ) : (
          <div className="preview__empty">Sem imagem para exibir</div>
        )}
      </div>
      <div className="preview__notices" id="preview-notices" aria-live="polite">
        {messages.length > 0 && (
          <ul className="preview__notice-list">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

import type { Configuration, ValidationResult } from '../../domain';
import { exportRevision } from '../../preview/export';
import type { Scene } from '../../preview/scene';
import { ExportControls } from '../preview/ExportControls';
import { orderMessage } from './order-message';
import type { ReviewSummary } from './review-summary';

interface FinalizePanelProps {
  readonly config: Configuration;
  readonly summary: ReviewSummary;
  readonly validation: ValidationResult;
  readonly scene: Scene;
  readonly sizePending: boolean;
  /** The PNG to share may be prepared now (see ExportControls). */
  readonly active: boolean;
}

/**
 * "Finalizar personalização" (D-078): the approved disclaimer (D-056, wording
 * unchanged but TAAVI in capitals), then what still blocks the actions, and
 * the sharing and export actions last (D-076).
 */
export function FinalizePanel({
  config,
  summary,
  validation,
  scene,
  sizePending,
  active,
}: FinalizePanelProps) {
  return (
    <div className="review">
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

import { useState } from 'react';
import { MIN_QUANTITY, type Configuration, type Plate, type ValidationResult } from '../../domain';
import type { Scene } from '../../preview/scene';
import { ExportControls } from '../preview/ExportControls';
import { orderMessage } from './order-message';
import { OrderSummary } from './OrderSummary';
import type { ReviewSummary } from './review-summary';

interface FinalizePanelProps {
  readonly config: Configuration;
  readonly plate: Plate | undefined;
  readonly summary: ReviewSummary;
  readonly validation: ValidationResult;
  readonly scene: Scene;
  readonly sizePending: boolean;
}

/**
 * "Finalize seu pedido" (D-080): for a valid configuration, the model, its
 * price, the quantity, and the estimated total; then the two actions. The
 * quantity is part of the inquiry, not of the design: it is not in the
 * configuration or the image, so changing it never re-renders the PNG. It is
 * kept through every edit, and the price follows a model change; a restart
 * remounts the panel, back to 1.
 */
export function FinalizePanel({
  config,
  plate,
  summary,
  validation,
  scene,
  sizePending,
}: FinalizePanelProps) {
  const [quantity, setQuantity] = useState(MIN_QUANTITY);
  const unitPriceCents = plate?.priceCents;
  return (
    <div className="review">
      {validation.status === 'valid' && (
        <OrderSummary
          product={`${summary.model} — ${summary.size}`}
          unitPriceCents={unitPriceCents}
          quantity={quantity}
          onQuantity={setQuantity}
        />
      )}
      <ExportControls
        scene={scene}
        validation={validation}
        plateId={config.plateId}
        sizePending={sizePending}
        orderMessage={orderMessage(summary, config.note, { quantity, unitPriceCents })}
      />
    </div>
  );
}

import { useState, type KeyboardEvent } from 'react';
import {
  clampQuantity,
  estimatedTotalCents,
  formatBRL,
  MAX_QUANTITY,
  MIN_QUANTITY,
  parseQuantity,
} from '../../domain';

interface OrderSummaryProps {
  /** The model with its size, as in the review, e.g. "Placa cerâmica — 10 × 10 cm". */
  readonly product: string;
  /** The model's list price (D-080); undefined while not supplied. */
  readonly unitPriceCents: number | undefined;
  readonly quantity: number;
  readonly onQuantity: (quantity: number) => void;
}

/**
 * What is being asked for (D-080): the model, its unit price, the quantity,
 * and the estimated total. Prices come from the catalog through `formatBRL`,
 * as in the WhatsApp message.
 */
export function OrderSummary({ product, unitPriceCents, quantity, onQuantity }: OrderSummaryProps) {
  return (
    <div className="order">
      <p className="order__product">{product}</p>
      <p className="order__line">
        <span>Valor unitário</span>
        <span>{unitPriceCents === undefined ? 'a confirmar' : formatBRL(unitPriceCents)}</span>
      </p>
      <QuantityField quantity={quantity} onQuantity={onQuantity} />
      {unitPriceCents !== undefined && (
        <p className="order__line order__total" aria-live="polite">
          <span>Total estimado</span>
          <strong>{formatBRL(estimatedTotalCents(unitPriceCents, quantity))}</strong>
        </p>
      )}
      <p className="field__info">Frete não incluso. Valor sujeito à confirmação da TAAVI.</p>
    </div>
  );
}

/**
 * Quantity from 1 to 99 (D-080): − and + buttons, the arrow keys, or typing.
 * Only a whole number within the limits is taken; while the field holds
 * anything else, the last valid quantity stays in use and is restored on leaving.
 */
function QuantityField({
  quantity,
  onQuantity,
}: {
  quantity: number;
  onQuantity: (quantity: number) => void;
}) {
  // What is typed, kept apart from the quantity so an empty field can be edited.
  const [draft, setDraft] = useState<{ quantity: number; text: string } | null>(null);
  const text = draft?.quantity === quantity ? draft.text : String(quantity);

  const set = (next: number) => {
    setDraft(null);
    onQuantity(clampQuantity(next));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      set(quantity + (event.key === 'ArrowUp' ? 1 : -1));
    }
  };

  return (
    <div className="order__line quantity">
      <label htmlFor="quantity">Quantidade</label>
      <div className="quantity__control">
        <button
          type="button"
          className="quantity__button"
          aria-label="Diminuir quantidade"
          aria-controls="quantity"
          aria-disabled={quantity <= MIN_QUANTITY}
          onClick={() => set(quantity - 1)}
        >
          −
        </button>
        <input
          id="quantity"
          className="quantity__input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          autoComplete="off"
          value={text}
          onChange={(event) => {
            const parsed = parseQuantity(event.target.value);
            const next = parsed ?? quantity;
            setDraft({ quantity: next, text: event.target.value });
            if (parsed !== null) onQuantity(parsed);
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="quantity__button"
          aria-label="Aumentar quantidade"
          aria-controls="quantity"
          aria-disabled={quantity >= MAX_QUANTITY}
          onClick={() => set(quantity + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

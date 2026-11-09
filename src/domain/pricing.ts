/**
 * List prices and the quantity of the order inquiry (D-080). Prices are whole
 * BRL cents, so totals are exact; formatting is done here, once, for the page
 * and the WhatsApp message alike.
 */

/** One piece at least; at most two digits (D-080). */
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 99;

/** A price as stored in the catalog: whole cents, above zero. */
export function isValidPriceCents(cents: unknown): cents is number {
  return typeof cents === 'number' && Number.isSafeInteger(cents) && cents > 0;
}

/**
 * "R$ 1.234,56": a plain space after "R$" and "." between thousands, the same
 * in every browser (no `Intl`, whose spacing differs between engines).
 */
export function formatBRL(cents: number): string {
  const reais = Math.trunc(cents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const centavos = (cents % 100).toString().padStart(2, '0');
  return `R$ ${reais},${centavos}`;
}

/** The nearest allowed quantity; anything not a number is the minimum. */
export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return MIN_QUANTITY;
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(quantity)));
}

/** A typed quantity: digits only, within the limits; otherwise null (never repaired). */
export function parseQuantity(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const quantity = Number(text);
  return quantity >= MIN_QUANTITY && quantity <= MAX_QUANTITY ? quantity : null;
}

/** Unit price × quantity, in cents. An estimate: shipping is not included. */
export function estimatedTotalCents(unitCents: number, quantity: number): number {
  return unitCents * quantity;
}

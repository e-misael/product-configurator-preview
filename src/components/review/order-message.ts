import { estimatedTotalCents, formatBRL } from '../../domain';
import type { ReviewSummary } from './review-summary';

/** The quantity asked for and the model's list price, if supplied (D-080). */
export interface OrderLine {
  readonly quantity: number;
  readonly unitPriceCents: number | undefined;
}

/**
 * The order inquiry sent to TAAVI (D-076, D-080), as plain text for the
 * WhatsApp link: the review's values (D-058), the quantity with the unit price
 * and estimated total from the catalog, the text with its line breaks, and
 * only the fields that apply. The customer attaches the image themselves. It
 * asks TAAVI to confirm availability, final price, and lead time; it states no
 * customer data, payment, or confirmation. Meant for a valid configuration.
 */
export function orderMessage(summary: ReviewSummary, note: string, order: OrderLine): string {
  const { quantity, unitPriceCents } = order;
  const prices =
    unitPriceCents === undefined
      ? ['Valor unitário: a confirmar']
      : [
          `Valor unitário: ${formatBRL(unitPriceCents)}`,
          `Total estimado: ${formatBRL(estimatedTotalCents(unitPriceCents, quantity))}`,
        ];
  const details = [
    `Fonte: ${summary.font}`,
    `Cor principal: ${summary.textColor}`,
    summary.highlight &&
      `Destaque: ${summary.highlight.color} (${summary.highlight.words.join(', ')})`,
    !summary.fixedPlacement && `Alinhamento: ${summary.alignment}`,
    !summary.fixedPlacement && `Posição: ${summary.position}`,
    note.trim() !== '' && `Observação: ${note.trim()}`,
  ].filter((line) => typeof line === 'string');
  return [
    'Olá, TAAVI!',
    '',
    'Gostaria de solicitar uma peça personalizada com estas características:',
    '',
    `Modelo: ${summary.model} — ${summary.size}`,
    `Quantidade: ${quantity}`,
    ...prices,
    '',
    'Texto:',
    summary.text,
    '',
    ...details,
    '',
    'Preparei uma imagem da personalização como referência e vou anexá-la nesta conversa.',
    '',
    'Podem confirmar a disponibilidade, o valor final e o prazo de produção?',
  ].join('\n');
}

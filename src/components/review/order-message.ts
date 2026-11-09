import type { ReviewSummary } from './review-summary';

/**
 * The order request sent with the image (D-076), as plain text for the share
 * sheet and the WhatsApp link: the review's values (D-058), the text with its
 * line breaks, and only the fields that apply. It asks TAAVI to confirm price,
 * availability, and lead time; it states no customer data and no confirmation.
 * Meant for a valid configuration.
 */
export function orderMessage(summary: ReviewSummary, note: string): string {
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
    '',
    'Texto:',
    summary.text,
    '',
    ...details,
    '',
    'Preparei uma imagem da personalização como referência.',
    '',
    'Podem confirmar o valor, a disponibilidade e o prazo de produção?',
  ].join('\n');
}

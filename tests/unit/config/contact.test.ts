import { orderMessage } from '../../../src/components/review/order-message';
import type { ReviewSummary } from '../../../src/components/review/review-summary';
import { TAAVI_WHATSAPP_NUMBER } from '../../../src/config/contact';
import { whatsAppNumber, whatsAppUrl } from '../../../src/preview/share';

/** TAAVI's official number (P-16), as supplied by the product owner: +55 61 99923-7316. */
describe('TAAVI_WHATSAPP_NUMBER (P-16)', () => {
  it('is the official number, digits only with the country code', () => {
    expect(TAAVI_WHATSAPP_NUMBER).toBe('5561999237316');
    expect(whatsAppNumber(TAAVI_WHATSAPP_NUMBER)).toBe('5561999237316');
  });

  it('opens TAAVI’s chat with the order message, encoded', () => {
    const summary: ReviewSummary = {
      model: 'Placa cerâmica',
      size: '10 × 10 cm',
      ceramicColor: 'Bege',
      font: 'Sem serifa',
      textColor: 'Azul',
      highlight: { color: 'Marrom', words: ['ANA'] },
      alignment: 'Centralizado',
      position: 'Centro',
      text: 'CASA DA ANA\n& CIA #1',
      fixedPlacement: false,
    };
    const message = orderMessage(summary, 'Entregar em maio?', {
      quantity: 2,
      unitPriceCents: 9800,
    });
    const number = whatsAppNumber(TAAVI_WHATSAPP_NUMBER);
    if (number === null) throw new Error('TAAVI_WHATSAPP_NUMBER is not valid');

    const url = whatsAppUrl(number, message);

    expect(url.startsWith('https://wa.me/5561999237316?text=')).toBe(true);
    expect(new URL(url).searchParams.get('text')).toBe(message);
    // Line breaks, accents, and URL characters are all encoded.
    expect(url.split('?text=')[1]).not.toMatch(/[ \n&#?áâêçã]/);
    expect(url).toContain('Ol%C3%A1%2C%20TAAVI!%0A%0A');
    expect(url).toContain('Total%20estimado%3A%20R%24%20196%2C00%0A');
  });
});

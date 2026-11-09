import { createEmptyConfiguration } from '../../../src/domain';
import { orderMessage } from '../../../src/components/review/order-message';
import { reviewSummary, type ReviewSummary } from '../../../src/components/review/review-summary';
import { previewCatalog } from '../preview/fixtures';

const summary = (overrides: Partial<ReviewSummary> = {}): ReviewSummary => ({
  model: 'Placa cerâmica',
  size: '10 × 10 cm',
  ceramicColor: 'Bege',
  font: 'Sem serifa',
  textColor: 'Azul',
  highlight: null,
  alignment: 'Centralizado',
  position: 'Centro',
  text: 'CASA DA ANA\nDESDE 2024',
  fixedPlacement: false,
  ...overrides,
});

describe('orderMessage (D-076)', () => {
  it('follows the approved structure, with every field that applies', () => {
    const message = orderMessage(
      summary({ highlight: { color: 'Marrom', words: ['ANA', '2024'] } }),
      'Presente de aniversário',
    );

    expect(message).toBe(
      [
        'Olá, TAAVI!',
        '',
        'Gostaria de solicitar uma peça personalizada com estas características:',
        '',
        'Modelo: Placa cerâmica — 10 × 10 cm',
        '',
        'Texto:',
        'CASA DA ANA',
        'DESDE 2024',
        '',
        'Fonte: Sem serifa',
        'Cor principal: Azul',
        'Destaque: Marrom (ANA, 2024)',
        'Alinhamento: Centralizado',
        'Posição: Centro',
        'Observação: Presente de aniversário',
        '',
        'Preparei uma imagem da personalização como referência.',
        '',
        'Podem confirmar o valor, a disponibilidade e o prazo de produção?',
      ].join('\n'),
    );
  });

  it('leaves out the highlight, a blank note, and the placement of a fixed model', () => {
    const message = orderMessage(
      summary({ model: 'Bandeja ondulada', size: 'M — 8 × 8 cm', fixedPlacement: true }),
      '  \n ',
    );

    expect(message).toContain('Modelo: Bandeja ondulada — M — 8 × 8 cm\n');
    expect(message).toContain('Fonte: Sem serifa\nCor principal: Azul\n\nPreparei');
    expect(message).not.toMatch(/Destaque|Alinhamento|Posição|Observação/);
  });

  it('keeps line breaks in the note, without its outer spaces', () => {
    expect(orderMessage(summary(), '  Entregar em maio.\nObrigado!  ')).toContain(
      'Observação: Entregar em maio.\nObrigado!\n\nPreparei',
    );
  });

  it('states no customer data and no confirmation', () => {
    const message = orderMessage(summary(), '');
    expect(message).not.toMatch(/enviad|recebid|confirmad|pedido n/i);
    expect(message).toMatch(/Podem confirmar o valor/);
  });
});

describe('reviewSummary feeds the message (D-076)', () => {
  const [square, , , , fixed] = previewCatalog.plates;

  it('uses the lettered text: capitals for "Sem serifa", as typed for "Com serifa"', () => {
    const config = {
      ...createEmptyConfiguration(),
      plateId: 'test-plate-square',
      text: 'Casa da Ana\nDesde 2024',
      textColorId: 'test-text-color-a',
    };
    const sans = reviewSummary(previewCatalog, config, square, [], undefined, false);
    const serif = reviewSummary(
      previewCatalog,
      { ...config, fontFamily: 'serif' },
      square,
      [],
      undefined,
      false,
    );

    expect(orderMessage(sans, '')).toContain(
      'Texto:\nCASA DA ANA\nDESDE 2024\n\nFonte: Sem serifa',
    );
    expect(orderMessage(serif, '')).toContain(
      'Texto:\nCasa da Ana\nDesde 2024\n\nFonte: Com serifa',
    );
    expect(orderMessage(sans, '')).toContain('Modelo: Test plate square — Test size\n');
    expect(orderMessage(sans, '')).toContain('Cor principal: Test ink A\n');
  });

  it('names the highlighted words as lettered, and only while highlighting is on', () => {
    const config = {
      ...createEmptyConfiguration(),
      plateId: 'test-plate-square',
      text: 'Casa da Ana',
      textColorId: 'test-text-color-a',
      highlightEnabled: true,
      secondaryColorId: 'test-text-color-b',
      secondaryRanges: [{ start: 8, end: 11 }],
    };
    const on = reviewSummary(previewCatalog, config, square, [], undefined, false);
    const off = reviewSummary(
      previewCatalog,
      { ...config, highlightEnabled: false },
      square,
      [],
      undefined,
      false,
    );

    expect(on.highlight).toEqual({ color: 'Test ink B', words: ['ANA'] });
    expect(orderMessage(on, '')).toContain('Destaque: Test ink B (ANA)\n');
    expect(off.highlight).toBeNull();
  });

  it('marks a model with a fixed placement', () => {
    expect(fixed?.id).toBe('test-plate-fixed');
    const config = { ...createEmptyConfiguration(), plateId: 'test-plate-fixed' };
    expect(reviewSummary(previewCatalog, config, fixed, [], undefined, false).fixedPlacement).toBe(
      true,
    );
  });
});

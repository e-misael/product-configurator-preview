import {
  NOTICE_MESSAGES,
  overflowMessage,
  SIZE_PENDING_MESSAGE,
} from '../../../src/components/preview/messages';

describe('overflowMessage (D-057)', () => {
  it('states the lines over, singular and plural', () => {
    expect(overflowMessage(1)).toBe(
      'O texto não cabe na área do modelo: 1 linha a mais. Reduza o texto ou use menos linhas.',
    );
    expect(overflowMessage(2)).toBe(
      'O texto não cabe na área do modelo: 2 linhas a mais. Reduza o texto ou use menos linhas.',
    );
  });

  it('keeps the general message for horizontal overflow', () => {
    expect(overflowMessage(0)).toBe(NOTICE_MESSAGES['text-overflow']);
  });

  it('asks for the size while a model group has none', () => {
    expect(SIZE_PENDING_MESSAGE).toBe('Escolha o tamanho para ver a pré-visualização.');
  });
});

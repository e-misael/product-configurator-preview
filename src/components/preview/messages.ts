import type { PreviewNoticeCode } from '../../preview/composition';

/** pt-BR wording for each reason part of the preview is not shown (D-037). */
export const NOTICE_MESSAGES: Record<PreviewNoticeCode, string> = {
  'plate-not-selected': 'Escolha um modelo para ver a pré-visualização.',
  'plate-invalid': 'O modelo selecionado não está disponível; nada é exibido.',
  'plate-image-pending': 'A foto deste modelo ainda não está disponível.',
  'plate-image-loading': 'Carregando imagem…',
  'plate-image-error': 'Não foi possível carregar a imagem do modelo.',
  'frame-invalid': 'A moldura selecionada é incompatível e não é exibida.',
  'frame-image-pending':
    'A imagem desta moldura para este modelo ainda não está disponível; a moldura não é exibida.',
  'frame-not-calibrated':
    'A posição do modelo nesta moldura ainda não foi calibrada; a moldura não é exibida.',
  'frame-image-loading': 'Carregando imagem…',
  'frame-image-error': 'Não foi possível carregar a imagem da moldura; a moldura não é exibida.',
  'frame-layers-mismatch':
    'As imagens da moldura têm proporções diferentes; a moldura não é exibida.',
  'text-area-pending':
    'A área do texto deste modelo ainda não foi calibrada; o texto não aparece na imagem.',
  'text-color-provisional':
    'Cor do texto ainda não escolhida: o texto aparece em uma cor provisória, que não é uma das cores disponíveis.',
  'text-overflow': 'O texto não cabe na área do modelo, mesmo no tamanho mínimo. Reduza o texto.',
};

import type { PreviewNoticeCode } from '../../preview/composition';

/** pt-BR wording for each reason part of the preview is not shown (D-037). */
export const NOTICE_MESSAGES: Record<PreviewNoticeCode, string> = {
  'plate-not-selected': 'Escolha um modelo para ver a pré-visualização.',
  'plate-invalid': 'O modelo selecionado não está disponível; nada é exibido.',
  'plate-image-pending': 'A foto deste modelo ainda não está disponível.',
  'plate-image-loading': 'Carregando imagem…',
  'plate-image-error': 'Não foi possível carregar a imagem do modelo.',
  'text-area-pending':
    'A área do texto deste modelo ainda não foi calibrada; o texto não aparece na imagem.',
  'text-size-pending':
    'O tamanho das letras deste modelo ainda não foi definido; o texto não aparece na imagem.',
  'text-color-provisional':
    'Cor do texto ainda não escolhida: o texto aparece em uma cor provisória, que não é uma das cores disponíveis.',
  'text-overflow': 'O texto não cabe na área do modelo. Reduza o texto ou use menos linhas.',
};

/** pt-BR wording for PNG export (D-008). */
export const EXPORT_MESSAGES = {
  empty: 'Não há imagem para exportar.',
  previewIncomplete: 'Resolva os avisos da pré-visualização acima.',
  working: 'Gerando a imagem…',
  done: 'Imagem exportada:',
  failed: 'Não foi possível gerar a imagem. Tente novamente.',
  invalidSize: 'As dimensões da imagem não permitem a exportação.',
} as const;

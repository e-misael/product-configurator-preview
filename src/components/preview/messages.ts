import type { PreviewNoticeCode } from '../../preview/composition';

/** pt-BR wording for each reason part of the preview is not shown (D-037). */
export const NOTICE_MESSAGES: Record<PreviewNoticeCode, string> = {
  'plate-not-selected': 'Escolha uma placa para ver a pré-visualização.',
  'plate-invalid': 'A placa selecionada não está disponível; nada é exibido.',
  'color-not-selected': 'Escolha a cor da placa para ver a foto.',
  'color-invalid': 'A cor escolhida não é válida para esta placa; a foto não é exibida.',
  'plate-image-pending': 'A foto desta placa nesta cor ainda não está disponível.',
  'plate-image-loading': 'Carregando imagem…',
  'plate-image-error': 'Não foi possível carregar a imagem da placa.',
  'frame-invalid': 'O quadro selecionado é incompatível e não é exibido.',
  'frame-image-pending':
    'A imagem deste quadro para esta placa ainda não está disponível; o quadro não é exibido.',
  'frame-not-calibrated':
    'A posição da placa neste quadro ainda não foi calibrada; o quadro não é exibido.',
  'frame-image-loading': 'Carregando imagem…',
  'frame-image-error': 'Não foi possível carregar a imagem do quadro; o quadro não é exibido.',
  'frame-layers-mismatch':
    'As imagens do quadro têm proporções diferentes; o quadro não é exibido.',
  'text-area-pending':
    'A área do texto desta placa ainda não foi calibrada; o texto não aparece na imagem.',
  'text-overflow': 'O texto não cabe na área da placa, mesmo no tamanho mínimo. Reduza o texto.',
};

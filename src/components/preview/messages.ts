import {
  matchesPreset,
  PRESET_COLUMNS,
  PRESET_ROWS,
  type PresetColumn,
  type PresetRow,
  type TextAlignment,
  type TextPlacement,
} from '../../domain';
import type { PreviewNoticeCode } from '../../preview/composition';

/** Line alignment inside the text block (D-059). */
export const ALIGNMENT_LABELS: Record<TextAlignment, string> = {
  left: 'À esquerda',
  center: 'Centralizado',
  right: 'À direita',
};

const ROW_LABELS: Record<PresetRow, string> = {
  top: 'Superior',
  middle: 'Meio',
  bottom: 'Inferior',
};
const COLUMN_LABELS: Record<PresetColumn, string> = {
  left: 'à esquerda',
  center: 'ao centro',
  right: 'à direita',
};

/** Preset names, as on the position buttons and in the review. */
export const presetLabel = (row: PresetRow, column: PresetColumn) =>
  row === 'middle' && column === 'center'
    ? 'Centro'
    : `${ROW_LABELS[row]} ${COLUMN_LABELS[column]}`;

/** The preset a placement sits at, if any. */
export function presetOf(placement: TextPlacement) {
  return PRESET_ROWS.flatMap((row) => PRESET_COLUMNS.map((column) => ({ row, column }))).find(
    ({ row, column }) => matchesPreset(placement, row, column),
  );
}

/** The help for a model whose lettering cannot be moved (D-068). */
export const FIXED_PLACEMENT_HINT = 'Nas bandejas, o texto fica sempre centralizado.';

/** pt-BR wording for each reason part of the preview is not shown (D-037). */
export const NOTICE_MESSAGES: Record<PreviewNoticeCode, string> = {
  'plate-not-selected': 'Escolha um modelo para ver a pré-visualização.',
  'size-not-selected': 'Selecione o tamanho para visualizar a personalização.',
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
  'watermark-error':
    'Não foi possível carregar a assinatura Taavi da imagem. Recarregue a página para exportar.',
};

/** Replaces "plate-not-selected" while a model group waits for its size (D-057). */
export const SIZE_PENDING_MESSAGE = 'Escolha o tamanho para ver a pré-visualização.';

/** Vertical overflow states how many lines are over (D-057). */
export function overflowMessage(excessLines: number): string {
  if (excessLines <= 0) return NOTICE_MESSAGES['text-overflow'];
  const count = excessLines === 1 ? '1 linha a mais' : `${excessLines} linhas a mais`;
  return `O texto não cabe na área do modelo: ${count}. Reduza o texto ou use menos linhas.`;
}

/** The message for a preview notice; overflow states the excess lines (D-057). */
export function noticeMessage(
  code: PreviewNoticeCode,
  excessLines: number,
  sizePending: boolean,
): string {
  if (code === 'text-overflow') return overflowMessage(excessLines);
  if (code === 'plate-not-selected' && sizePending) return SIZE_PENDING_MESSAGE;
  return NOTICE_MESSAGES[code];
}

/** A line break refused because the model holds no more lines (D-063). */
export function lineLimitMessage(maxLines: number): string {
  return maxLines === 1
    ? 'Este modelo comporta no máximo 1 linha.'
    : `Este modelo comporta no máximo ${maxLines} linhas.`;
}

/** pt-BR wording for PNG export (D-008). */
export const EXPORT_MESSAGES = {
  empty: 'Não há imagem para exportar.',
  working: 'Gerando a imagem…',
  done: 'Imagem exportada:',
  failed: 'Não foi possível gerar a imagem. Tente novamente.',
  invalidSize: 'As dimensões da imagem não permitem a exportação.',
  noWatermark: 'A assinatura Taavi não foi carregada; a imagem não pode ser exportada.',
} as const;

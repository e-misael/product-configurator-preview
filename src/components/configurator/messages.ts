import type {
  ColorCategory,
  ConfigurationField,
  InvalidCode,
  PlateShape,
  ValidationIssue,
} from '../../domain';

/** User-facing pt-BR text. Domain codes never reach the UI untranslated. */

export const SHAPE_LABELS: Record<PlateShape, string> = {
  square: 'Quadrada',
  rectangle: 'Retangular',
  circle: 'Redonda',
};

export const CATEGORY_LABELS: Record<ColorCategory, string> = {
  nude: 'Nude',
  colored: 'Colorida',
};

export const FIELD_LABELS: Record<ConfigurationField, string> = {
  plateId: 'Placa',
  frameId: 'Quadro',
  colorCategory: 'Cor da placa',
  colorId: 'Tom específico',
  text: 'Texto',
};

const INVALID_MESSAGES: Record<ConfigurationField, Partial<Record<InvalidCode, string>>> = {
  plateId: {
    'unknown-reference': 'Esta placa não está no catálogo.',
    unavailable: 'Esta placa está indisponível no momento.',
  },
  colorCategory: {
    'unsupported-by-plate': 'Esta placa não é feita nesta cor.',
  },
  colorId: {
    'unknown-reference': 'Este tom não está no catálogo.',
    unavailable: 'Este tom está indisponível no momento.',
    'category-mismatch': 'Este tom não pertence à cor escolhida.',
    'unsupported-by-plate': 'Este tom não está disponível para esta placa.',
  },
  frameId: {
    'unknown-reference': 'Quadro não encontrado no catálogo.',
    unavailable: 'Este quadro está indisponível no momento.',
    'frame-not-supported': 'Esta placa não aceita quadro.',
    'incompatible-shape': 'Este quadro não serve no formato desta placa.',
    'incompatible-plate': 'Este quadro não é compatível com esta placa.',
  },
  text: {
    blank: 'O texto não pode ficar em branco.',
  },
};

export function invalidMessage(issue: ValidationIssue): string {
  if (issue.kind === 'missing') return `Falta escolher: ${FIELD_LABELS[issue.field]}.`;
  return INVALID_MESSAGES[issue.field][issue.code] ?? 'Esta escolha não é válida.';
}

export const FRAME_CLEARED_NOTICE =
  'O quadro foi removido porque a placa escolhida não aceita quadro.';

import type { ConfigurationField, InvalidCode, Plate, ValidationIssue } from '../../domain';

/** User-facing pt-BR text. Domain codes never reach the UI untranslated. */

export const FIELD_LABELS: Record<ConfigurationField, string> = {
  plateId: 'Modelo',
  frameId: 'Moldura',
  text: 'Texto',
};

const INVALID_MESSAGES: Record<ConfigurationField, Partial<Record<InvalidCode, string>>> = {
  plateId: {
    'unknown-reference': 'Este modelo não está no catálogo.',
    unavailable: 'Este modelo está indisponível no momento.',
  },
  frameId: {
    'unknown-reference': 'Moldura não encontrada no catálogo.',
    unavailable: 'Esta moldura está indisponível no momento.',
    'frame-not-supported': 'Este modelo não aceita moldura.',
    'incompatible-shape': 'Esta moldura não serve no formato deste modelo.',
    'incompatible-plate': 'Esta moldura não é compatível com este modelo.',
  },
  text: {
    blank: 'O texto não pode ficar em branco.',
  },
};

export function invalidMessage(issue: ValidationIssue): string {
  if (issue.kind === 'missing') return `Falta escolher: ${FIELD_LABELS[issue.field]}.`;
  return INVALID_MESSAGES[issue.field][issue.code] ?? 'Esta escolha não é válida.';
}

/** Customer-facing model label: the name plus the supplied size description. */
export function modelLabel(plate: Pick<Plate, 'displayName' | 'sizeLabel'>): string {
  return `${plate.displayName} (${plate.sizeLabel})`;
}

export const FRAME_CLEARED_NOTICE =
  'A moldura foi removida porque o modelo escolhido não aceita moldura.';

import type { ConfigurationField, InvalidCode, Plate, ValidationIssue } from '../../domain';

/** User-facing pt-BR text. Domain codes never reach the UI untranslated. */

export const FIELD_LABELS: Record<ConfigurationField, string> = {
  plateId: 'Modelo',
  text: 'Texto',
  fontFamily: 'Fonte',
  textColorId: 'Cor do texto',
  highlightEnabled: 'Destacar parte(s) do texto',
  secondaryColorId: 'Cor de destaque',
  secondaryRanges: 'Palavras destacadas',
  textLayout: 'Posição do texto',
  note: 'Observação',
};

const INVALID_MESSAGES: Record<ConfigurationField, Partial<Record<InvalidCode, string>>> = {
  plateId: {
    'unknown-reference': 'Este modelo não está no catálogo.',
    unavailable: 'Este modelo está indisponível no momento.',
  },
  text: {
    blank: 'O texto não pode ficar em branco.',
  },
  fontFamily: {
    'unsupported-font': 'Esta fonte não está disponível.',
  },
  textColorId: {
    'unknown-reference': 'Esta cor não está no catálogo.',
    unavailable: 'Esta cor está indisponível no momento.',
  },
  secondaryColorId: {
    'unknown-reference': 'Esta cor não está no catálogo.',
    unavailable: 'Esta cor está indisponível no momento.',
    'same-as-primary': 'A cor de destaque deve ser diferente da cor do texto.',
  },
  secondaryRanges: {
    'invalid-ranges': 'As palavras destacadas não correspondem ao texto.',
  },
  highlightEnabled: {},
  textLayout: {
    'invalid-layout': 'A posição do texto não é válida. Use "Redefinir posição".',
  },
  // Free text, never validated (D-062).
  note: {},
};

/** While a group is chosen without its size, the missing model is reported as "Tamanho" (D-057). */
export const SIZE_LABEL = 'Tamanho';

export function missingLabel(field: ConfigurationField, sizePending = false): string {
  return field === 'plateId' && sizePending ? SIZE_LABEL : FIELD_LABELS[field];
}

export function invalidMessage(issue: ValidationIssue, sizePending = false): string {
  if (issue.kind === 'missing') return `Falta escolher: ${missingLabel(issue.field, sizePending)}.`;
  return INVALID_MESSAGES[issue.field][issue.code] ?? 'Esta escolha não é válida.';
}

/** Customer-facing model label as supplied, e.g. "Placa cerâmica — 10 × 10 cm" (D-046). */
export function modelLabel(plate: Pick<Plate, 'displayName' | 'sizeLabel'>): string {
  return `${plate.displayName} — ${plate.sizeLabel}`;
}

export const FORMATTING_REMOVED_NOTICE =
  'O destaque foi removido das palavras alteradas ou que não puderam ser localizadas com segurança.';

import { isAvailable, type Catalog, type Plate } from '../../domain';

/**
 * Presentation grouping of models offered in several sizes (D-057). Each size
 * stays its own catalog model with its own ID; the configuration stores that
 * ID only, so validation, preview, and export are unchanged. Names and size
 * letters as supplied by Taavi. The table belongs with its catalog: production
 * uses `MODEL_GROUPS`, demo mode its own (src/demo, D-028).
 */
export interface ModelGroup {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** In display order. */
  readonly sizes: readonly { readonly plateId: string; readonly letter: string }[];
  /**
   * The size whose photograph is shown, without lettering, before a size is
   * chosen; only for groups whose sizes share one photograph (M4.6). It
   * selects nothing: the configuration still has no model until a size is chosen.
   */
  readonly previewPlateId?: string;
}

export const MODEL_GROUPS: readonly ModelGroup[] = [
  {
    id: 'bandeja-ondulada',
    name: 'Bandeja ondulada',
    description: 'Disponível em dois tamanhos',
    sizes: [
      { plateId: 'bandeja-ondulada-m-8', letter: 'M' },
      { plateId: 'bandeja-ondulada-g-11', letter: 'G' },
    ],
    // M and G are photographed once: the two files are identical.
    previewPlateId: 'bandeja-ondulada-m-8',
  },
];

export function groupOf(
  groups: readonly ModelGroup[],
  plateId: string | null,
): ModelGroup | undefined {
  return groups.find((group) => group.sizes.some((size) => size.plateId === plateId));
}

/** Size label within a group, e.g. "M — 8 × 8 cm"; the plain size label elsewhere. */
export function sizeLabel(
  groups: readonly ModelGroup[],
  plate: Pick<Plate, 'id' | 'sizeLabel'>,
): string {
  const letter = groupOf(groups, plate.id)?.sizes.find((size) => size.plateId === plate.id)?.letter;
  return letter === undefined ? plate.sizeLabel : `${letter} — ${plate.sizeLabel}`;
}

export type ModelChoice =
  | { readonly kind: 'plate'; readonly plate: Plate }
  | { readonly kind: 'group'; readonly group: ModelGroup; readonly plates: readonly Plate[] };

/**
 * The model options in catalog order: a group takes the place of its first
 * available size and lists its available sizes in the group's order. A
 * group with no available size is not offered.
 */
export function modelChoices(catalog: Catalog, groups: readonly ModelGroup[]): ModelChoice[] {
  const available = catalog.plates.filter(isAvailable);
  const choices: ModelChoice[] = [];
  for (const plate of available) {
    const group = groupOf(groups, plate.id);
    if (group === undefined) {
      choices.push({ kind: 'plate', plate });
      continue;
    }
    if (choices.some((choice) => choice.kind === 'group' && choice.group.id === group.id)) continue;
    const plates = group.sizes.flatMap(
      (size) => available.find((candidate) => candidate.id === size.plateId) ?? [],
    );
    choices.push({ kind: 'group', group, plates });
  }
  return choices;
}

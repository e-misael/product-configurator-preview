import {
  findTextColor,
  isPlacementFixed,
  letteringText,
  placementFor,
  type Catalog,
  type Configuration,
  type Plate,
} from '../../domain';
import { sizeLabel, type ModelGroup } from '../configurator/model-groups';
import { ALIGNMENT_LABELS, presetLabel, presetOf } from '../preview/messages';

/**
 * The selection in pt-BR, as "Revisar personalização" lists it (D-058) and
 * the order message repeats it (D-076). `—` marks what is not chosen yet.
 */
export interface ReviewSummary {
  readonly model: string;
  readonly size: string;
  readonly ceramicColor: string;
  readonly font: string;
  readonly textColor: string;
  /** What the preview draws: none while highlighting is off or has no word (D-071). */
  readonly highlight: { readonly color: string; readonly words: readonly string[] } | null;
  readonly alignment: string;
  readonly position: string;
  /** As lettered: capitals for "Sem serifa" (D-068). */
  readonly text: string;
  /** The Bandejas: the lettering is always centered, so placement is not a choice (D-068). */
  readonly fixedPlacement: boolean;
}

function colorName(catalog: Catalog, id: string | null, none: string): string {
  return id === null ? none : (findTextColor(catalog, id)?.displayName ?? id);
}

export function reviewSummary(
  catalog: Catalog,
  config: Configuration,
  plate: Plate | undefined,
  groups: readonly ModelGroup[],
  group: ModelGroup | undefined,
  sizePending: boolean,
): ReviewSummary {
  // What the canvas uses: a fixed model's centered default, or the stored placement (D-068).
  const placement = placementFor(config.textLayout, plate);
  const preset = presetOf(placement);
  const text = letteringText(config.text, config.fontFamily);
  return {
    model: group?.name ?? plate?.displayName ?? '—',
    size: plate ? sizeLabel(groups, plate) : sizePending ? 'Não escolhido' : '—',
    ceramicColor: plate?.ceramicColor ?? '—',
    font: config.fontFamily === 'serif' ? 'Com serifa' : 'Sem serifa',
    textColor: colorName(catalog, config.textColorId, 'Não escolhida'),
    highlight:
      !config.highlightEnabled || config.secondaryRanges.length === 0
        ? null
        : {
            color: colorName(catalog, config.secondaryColorId, 'Cor não escolhida'),
            words: config.secondaryRanges.map(({ start, end }) => text.slice(start, end)),
          },
    alignment: ALIGNMENT_LABELS[placement.align],
    position: preset
      ? presetLabel(preset.row, preset.column)
      : `Personalizada (horizontal ${Math.round(placement.x * 100)}%, vertical ${Math.round(
          placement.y * 100,
        )}%)`,
    text,
    fixedPlacement: isPlacementFixed(plate),
  };
}

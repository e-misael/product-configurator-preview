import {
  findColor,
  isAvailable,
  type Catalog,
  type ColorCategory,
  type Configuration,
  type Plate,
  type PlateColor,
  type ValidationIssue,
} from '../../domain';
import { ChoiceOption } from './ChoiceOption';
import { InvalidSelection } from './InvalidSelection';
import { CATEGORY_LABELS, invalidMessage } from './messages';

interface ColorFieldProps {
  readonly catalog: Catalog;
  readonly config: Configuration;
  readonly plate: Plate | undefined;
  readonly categoryIssue: ValidationIssue | undefined;
  readonly colorIssue: ValidationIssue | undefined;
  readonly onChooseCategory: (category: ColorCategory) => void;
  readonly onChooseColor: (colorId: string | null) => void;
}

export function ColorField({
  catalog,
  config,
  plate,
  categoryIssue,
  colorIssue,
  onChooseCategory,
  onChooseColor,
}: ColorFieldProps) {
  const { colorCategory, colorId } = config;
  const invalidCategory = categoryIssue?.kind === 'invalid' ? categoryIssue : undefined;
  const invalidColor = colorIssue?.kind === 'invalid' ? colorIssue : undefined;
  const shades: PlateColor[] = [];
  if (plate && colorCategory !== null && !invalidCategory) {
    for (const id of plate.supportedColorIds) {
      const color = findColor(catalog, id);
      if (color && isAvailable(color) && color.category === colorCategory) shades.push(color);
    }
  }

  return (
    <fieldset
      className="field"
      aria-describedby={
        [invalidCategory && 'color-category-issue', invalidColor && 'color-issue']
          .filter(Boolean)
          .join(' ') || undefined
      }
    >
      <legend className="field__legend">Cor da placa</legend>

      {!plate && <p className="field__info">Escolha uma placa para ver as cores disponíveis.</p>}

      {invalidCategory && colorCategory !== null && (
        <InvalidSelection
          messageId="color-category-issue"
          title="Cor selecionada (indisponível para esta placa)"
          name={CATEGORY_LABELS[colorCategory]}
          message={invalidMessage(invalidCategory)}
        />
      )}

      {plate && (
        <div className="field__options">
          {plate.supportedColorCategories.map((category) => (
            <ChoiceOption
              key={category}
              name="color-category"
              value={category}
              checked={category === colorCategory}
              onSelect={() => onChooseCategory(category)}
            >
              {CATEGORY_LABELS[category]}
            </ChoiceOption>
          ))}
        </div>
      )}

      {invalidColor && colorId !== null && (
        <InvalidSelection
          messageId="color-issue"
          title="Tom selecionado (incompatível)"
          name={findColor(catalog, colorId)?.displayName ?? colorId}
          message={invalidMessage(invalidColor)}
          action={{ label: 'Remover tom', onClick: () => onChooseColor(null) }}
        />
      )}

      {shades.length > 0 && (
        <fieldset className="field field--nested">
          <legend className="field__legend field__legend--small">Tom específico (opcional)</legend>
          <div className="field__options">
            <ChoiceOption
              name="color"
              value=""
              checked={colorId === null}
              onSelect={() => onChooseColor(null)}
            >
              Sem preferência de tom
            </ChoiceOption>
            {shades.map((color) => (
              <ChoiceOption
                key={color.id}
                name="color"
                value={color.id}
                checked={color.id === colorId}
                onSelect={() => onChooseColor(color.id)}
              >
                {color.displayName}
              </ChoiceOption>
            ))}
          </div>
        </fieldset>
      )}
    </fieldset>
  );
}

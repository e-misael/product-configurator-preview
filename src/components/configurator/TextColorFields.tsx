import {
  findTextColor,
  isAvailable,
  type Catalog,
  type TextColor,
  type ValidationIssue,
} from '../../domain';
import { ChoiceOption } from './ChoiceOption';
import { InvalidSelection } from './InvalidSelection';
import { invalidMessage } from './messages';

function ColorLabel({ color }: { readonly color: TextColor }) {
  return (
    <>
      <span className="swatch" style={{ backgroundColor: color.hex }} aria-hidden="true" />
      {color.displayName}
    </>
  );
}

interface PrimaryProps {
  readonly catalog: Catalog;
  readonly colorId: string | null;
  readonly issue: ValidationIssue | undefined;
  readonly onChoose: (colorId: string | null) => void;
}

/** Required lettering color from the catalog palette. There is no default (D-042). */
export function TextColorField({ catalog, colorId, issue, onChoose }: PrimaryProps) {
  const options = catalog.textColors.filter(isAvailable);
  const invalid = issue?.kind === 'invalid' ? issue : undefined;
  const kept = colorId !== null && !options.some((color) => color.id === colorId);
  const keptName =
    colorId === null ? '' : (findTextColor(catalog, colorId)?.displayName ?? colorId);

  return (
    <fieldset className="field" aria-describedby={invalid ? 'text-color-issue' : undefined}>
      <legend className="field__legend">Cor do texto</legend>
      {kept && invalid && (
        <InvalidSelection
          messageId="text-color-issue"
          title="Cor selecionada (indisponível)"
          name={keptName}
          message={invalidMessage(invalid)}
          action={{ label: 'Remover cor', onClick: () => onChoose(null) }}
        />
      )}
      {options.length === 0 ? (
        <p className="field__info">As cores do texto ainda não foram definidas.</p>
      ) : (
        <div className="field__options">
          {options.map((color) => (
            <ChoiceOption
              key={color.id}
              name="text-color"
              value={color.id}
              checked={color.id === colorId}
              onSelect={() => onChoose(color.id)}
            >
              <ColorLabel color={color} />
            </ChoiceOption>
          ))}
        </div>
      )}
    </fieldset>
  );
}

interface SecondaryProps {
  readonly catalog: Catalog;
  readonly colorId: string | null;
  readonly primaryColorId: string | null;
  readonly issue: ValidationIssue | undefined;
  readonly onChoose: (colorId: string | null) => void;
}

/**
 * Optional second color. "Sem segunda cor" is the only way to clear it (and its
 * ranges); removing the last range keeps the color (D-042). A color equal to the
 * primary is rejected: it cannot be newly chosen, and a kept one is reported.
 */
export function SecondaryColorField({
  catalog,
  colorId,
  primaryColorId,
  issue,
  onChoose,
}: SecondaryProps) {
  const options = catalog.textColors.filter(isAvailable);
  if (catalog.textColors.length === 0) return null;
  const invalid = issue?.kind === 'invalid' ? issue : undefined;
  const kept = colorId !== null && !options.some((color) => color.id === colorId);
  const keptName =
    colorId === null ? '' : (findTextColor(catalog, colorId)?.displayName ?? colorId);

  return (
    <fieldset className="field" aria-describedby={invalid ? 'secondary-color-issue' : undefined}>
      <legend className="field__legend">Segunda cor (opcional)</legend>
      {kept && invalid && (
        <InvalidSelection
          messageId="secondary-color-issue"
          title="Segunda cor selecionada (indisponível)"
          name={keptName}
          message={invalidMessage(invalid)}
        />
      )}
      <div className="field__options">
        <ChoiceOption
          name="secondary-color"
          value=""
          checked={colorId === null}
          onSelect={() => onChoose(null)}
        >
          Sem segunda cor
        </ChoiceOption>
        {options.map((color) => (
          <ChoiceOption
            key={color.id}
            name="secondary-color"
            value={color.id}
            checked={color.id === colorId}
            disabled={color.id === primaryColorId && color.id !== colorId}
            onSelect={() => onChoose(color.id)}
          >
            <ColorLabel color={color} />
          </ChoiceOption>
        ))}
      </div>
      {invalid && !kept && (
        <p className="field__error" id="secondary-color-issue">
          {invalidMessage(invalid)}
        </p>
      )}
    </fieldset>
  );
}

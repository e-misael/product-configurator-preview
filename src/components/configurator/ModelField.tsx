import { isPlacementFixed, type Catalog, type Plate, type ValidationIssue } from '../../domain';
import { FIXED_PLACEMENT_HINT } from '../preview/messages';
import { ChoiceOption } from './ChoiceOption';
import { InvalidSelection } from './InvalidSelection';
import { invalidMessage, modelLabel } from './messages';
import { modelChoices, sizeLabel, type ModelGroup } from './model-groups';

interface ModelFieldProps {
  readonly catalog: Catalog;
  readonly plateId: string | null;
  readonly plate: Plate | undefined;
  readonly groups: readonly ModelGroup[];
  /** The chosen group, with or without a size (D-057). */
  readonly group: ModelGroup | undefined;
  readonly issue: ValidationIssue | undefined;
  readonly onChoose: (plateId: string) => void;
  readonly onChooseGroup: (group: ModelGroup) => void;
}

/**
 * Model picker. Models sold in several sizes are one option with a required
 * "Tamanho" choice, never preselected (D-057). The ceramic color is a fixed
 * catalog property, shown read-only.
 */
export function ModelField({
  catalog,
  plateId,
  plate,
  groups,
  group,
  issue,
  onChoose,
  onChooseGroup,
}: ModelFieldProps) {
  const choices = modelChoices(catalog, groups);
  const invalid = issue?.kind === 'invalid' ? issue : undefined;
  const sizes = choices.find((choice) => choice.kind === 'group' && choice.group.id === group?.id);

  return (
    <fieldset className="field" aria-describedby={invalid ? 'plate-issue' : undefined}>
      <legend className="field__legend">Modelo</legend>
      {invalid && plateId !== null && (
        <InvalidSelection
          messageId="plate-issue"
          title="Modelo selecionado (indisponível)"
          name={plate ? modelLabel(plate) : plateId}
          message={invalidMessage(invalid)}
        />
      )}
      <div className="field__options">
        {choices.map((choice) =>
          choice.kind === 'plate' ? (
            <ChoiceOption
              key={choice.plate.id}
              name="plate"
              value={choice.plate.id}
              checked={choice.plate.id === plateId}
              onSelect={() => onChoose(choice.plate.id)}
            >
              {modelLabel(choice.plate)}
            </ChoiceOption>
          ) : (
            <ChoiceOption
              key={choice.group.id}
              name="plate"
              value={choice.group.id}
              checked={choice.group.id === group?.id}
              onSelect={() => onChooseGroup(choice.group)}
              description={choice.group.description}
            >
              {choice.group.name}
            </ChoiceOption>
          ),
        )}
      </div>
      {sizes?.kind === 'group' && (
        <fieldset
          className="field field--nested"
          aria-describedby={sizes.plates.some(isPlacementFixed) ? 'size-hint' : undefined}
        >
          <legend className="field__legend">Tamanho</legend>
          <div className="field__options">
            {sizes.plates.map((option) => (
              <ChoiceOption
                key={option.id}
                name="plate-size"
                value={option.id}
                checked={option.id === plateId}
                onSelect={() => onChoose(option.id)}
              >
                {sizeLabel(groups, option)}
              </ChoiceOption>
            ))}
          </div>
          {/* The tray lettering cannot be moved (D-068). */}
          {sizes.plates.some(isPlacementFixed) && (
            <p className="field__info" id="size-hint">
              {FIXED_PLACEMENT_HINT}
            </p>
          )}
        </fieldset>
      )}
      {plate && (
        <p className="field__info">
          Cor da peça: <strong>{plate.ceramicColor}</strong>
        </p>
      )}
    </fieldset>
  );
}

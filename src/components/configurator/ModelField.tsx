import { isAvailable, type Catalog, type Plate, type ValidationIssue } from '../../domain';
import { ChoiceOption } from './ChoiceOption';
import { InvalidSelection } from './InvalidSelection';
import { invalidMessage, modelLabel } from './messages';

interface ModelFieldProps {
  readonly catalog: Catalog;
  readonly plateId: string | null;
  readonly plate: Plate | undefined;
  readonly issue: ValidationIssue | undefined;
  readonly onChoose: (plateId: string) => void;
}

/** Model picker. The ceramic color is a fixed catalog property, shown read-only. */
export function ModelField({ catalog, plateId, plate, issue, onChoose }: ModelFieldProps) {
  const options = catalog.plates.filter(isAvailable);
  const invalid = issue?.kind === 'invalid' ? issue : undefined;

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
        {options.map((option) => (
          <ChoiceOption
            key={option.id}
            name="plate"
            value={option.id}
            checked={option.id === plateId}
            onSelect={() => onChoose(option.id)}
          >
            {modelLabel(option)}
          </ChoiceOption>
        ))}
      </div>
      {plate && (
        <p className="field__info">
          Cor da peça: <strong>{plate.ceramicColor}</strong>
        </p>
      )}
    </fieldset>
  );
}

import { isAvailable, type Catalog, type Plate, type ValidationIssue } from '../../domain';
import { ChoiceOption } from './ChoiceOption';
import { InvalidSelection } from './InvalidSelection';
import { invalidMessage, SHAPE_LABELS } from './messages';

interface PlateFieldProps {
  readonly catalog: Catalog;
  readonly plateId: string | null;
  readonly plate: Plate | undefined;
  readonly issue: ValidationIssue | undefined;
  readonly onChoose: (plateId: string) => void;
}

export function PlateField({ catalog, plateId, plate, issue, onChoose }: PlateFieldProps) {
  const options = catalog.plates.filter(isAvailable);
  const invalid = issue?.kind === 'invalid' ? issue : undefined;

  return (
    <fieldset className="field" aria-describedby={invalid ? 'plate-issue' : undefined}>
      <legend className="field__legend">Placa</legend>
      {invalid && plateId !== null && (
        <InvalidSelection
          messageId="plate-issue"
          title="Placa selecionada (indisponível)"
          name={plate?.displayName ?? plateId}
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
            {option.displayName}{' '}
            <span className="choice__detail">{SHAPE_LABELS[option.shape]}</span>
          </ChoiceOption>
        ))}
      </div>
      {plate && (
        <p className="field__info">
          Formato da placa: <strong>{SHAPE_LABELS[plate.shape]}</strong>
        </p>
      )}
    </fieldset>
  );
}

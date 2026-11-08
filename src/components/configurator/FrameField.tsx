import {
  findFrame,
  getFrameOptions,
  type Catalog,
  type Plate,
  type ValidationIssue,
} from '../../domain';
import { ChoiceOption } from './ChoiceOption';
import { InvalidSelection } from './InvalidSelection';
import { invalidMessage } from './messages';

interface FrameFieldProps {
  readonly catalog: Catalog;
  readonly frameId: string | null;
  readonly plate: Plate | undefined;
  readonly issue: ValidationIssue | undefined;
  readonly onChoose: (frameId: string | null) => void;
}

/**
 * Offers `getFrameOptions` for the plate. A selected frame that is not among
 * them is still shown, marked invalid, with remove/replace actions (D-030).
 * "Sem quadro" is only ever checked when no frame is selected.
 */
export function FrameField({ catalog, frameId, plate, issue, onChoose }: FrameFieldProps) {
  const options = plate ? getFrameOptions(catalog, plate.id) : [];
  const kept = frameId !== null && !options.some((frame) => frame.id === frameId);
  const keptName = frameId === null ? '' : (findFrame(catalog, frameId)?.displayName ?? frameId);
  const keptMessage =
    issue?.kind === 'invalid'
      ? invalidMessage(issue)
      : 'Escolha uma placa para verificar este quadro.';

  return (
    <fieldset className="field" aria-describedby={kept ? 'frame-issue' : undefined}>
      <legend className="field__legend">Quadro</legend>

      {kept && (
        <InvalidSelection
          messageId="frame-issue"
          title="Quadro selecionado (incompatível)"
          name={keptName}
          message={keptMessage}
          action={{ label: 'Remover quadro', onClick: () => onChoose(null) }}
        />
      )}

      {!plate && !kept && (
        <p className="field__info">Escolha uma placa para ver os quadros disponíveis.</p>
      )}

      {plate && !plate.supportsFrame && !kept && (
        <div className="field__options">
          <ChoiceOption name="frame" value="" checked disabled onSelect={() => undefined}>
            Sem quadro
          </ChoiceOption>
          <p className="field__info">Esta placa não aceita quadro.</p>
        </div>
      )}

      {plate?.supportsFrame && (
        <div className="field__options">
          <ChoiceOption
            name="frame"
            value=""
            checked={frameId === null}
            onSelect={() => onChoose(null)}
          >
            Sem quadro
          </ChoiceOption>
          {options.map((frame) => (
            <ChoiceOption
              key={frame.id}
              name="frame"
              value={frame.id}
              checked={frame.id === frameId}
              onSelect={() => onChoose(frame.id)}
            >
              {frame.displayName}
            </ChoiceOption>
          ))}
          {options.length === 0 && (
            <p className="field__info">Nenhum quadro disponível para esta placa.</p>
          )}
        </div>
      )}
    </fieldset>
  );
}

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
 * Offers `getFrameOptions` for the model, and is hidden when there is nothing to
 * offer (no model yet, or a model that takes no frame). A selected frame that is
 * not among the options is still shown, marked invalid, with remove/replace
 * actions (D-030). "Sem moldura" is only ever checked when no frame is selected.
 */
export function FrameField({ catalog, frameId, plate, issue, onChoose }: FrameFieldProps) {
  const options = plate ? getFrameOptions(catalog, plate.id) : [];
  const kept = frameId !== null && !options.some((frame) => frame.id === frameId);
  const keptName = frameId === null ? '' : (findFrame(catalog, frameId)?.displayName ?? frameId);
  const keptMessage =
    issue?.kind === 'invalid'
      ? invalidMessage(issue)
      : 'Escolha um modelo para verificar esta moldura.';

  if (options.length === 0 && !kept) return null;

  return (
    <fieldset className="field" aria-describedby={kept ? 'frame-issue' : undefined}>
      <legend className="field__legend">Moldura (opcional)</legend>

      {kept && (
        <InvalidSelection
          messageId="frame-issue"
          title="Moldura selecionada (incompatível)"
          name={keptName}
          message={keptMessage}
          action={{ label: 'Remover moldura', onClick: () => onChoose(null) }}
        />
      )}

      {plate?.supportsFrame && (
        <div className="field__options">
          <ChoiceOption
            name="frame"
            value=""
            checked={frameId === null}
            onSelect={() => onChoose(null)}
          >
            Sem moldura
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
        </div>
      )}
    </fieldset>
  );
}

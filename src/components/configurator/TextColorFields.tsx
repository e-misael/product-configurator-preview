import { useRef } from 'react';
import {
  findTextColor,
  isAvailable,
  type Catalog,
  type TextColor,
  type ValidationIssue,
} from '../../domain';
import { InvalidSelection } from './InvalidSelection';
import { invalidMessage } from './messages';

interface SwatchProps {
  readonly name: string;
  readonly color: TextColor;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
}

/**
 * A native radio shown as a color chip with its name. The selected chip gets a
 * check mark and a heavier border, so the choice never depends on color alone.
 */
function Swatch({ name, color, checked, disabled, onSelect }: SwatchProps) {
  return (
    <label className="swatch-option">
      <input
        type="radio"
        className="swatch-option__input"
        name={name}
        value={color.id}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
      />
      <span
        className="swatch-option__chip"
        style={{ backgroundColor: color.hex }}
        aria-hidden="true"
      >
        <span className="swatch-option__check">✓</span>
      </span>
      <span className="swatch-option__name">{color.displayName}</span>
    </label>
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
        <div className="swatches">
          {options.map((color) => (
            <Swatch
              key={color.id}
              name="text-color"
              color={color}
              checked={color.id === colorId}
              onSelect={() => onChoose(color.id)}
            />
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
  readonly rangeCount: number;
  readonly issue: ValidationIssue | undefined;
  /** Whether the options are shown. Hiding them never changes the configuration. */
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly onChoose: (colorId: string) => void;
  /** Clears the second color and all its ranges. */
  readonly onRemove: () => void;
}

const rangeSummary = (count: number) => (count === 1 ? '1 trecho' : `${count} trechos`);

/**
 * Optional second color behind "Usar segunda cor" (D-047). Collapsing only hides
 * the options; "Remover segunda cor" is the one action that clears the color and
 * its ranges (D-042). A color equal to the primary cannot be chosen, and an
 * invalid kept choice stays visible until it is replaced or removed (D-030).
 */
export function SecondaryColorField({
  catalog,
  colorId,
  primaryColorId,
  rangeCount,
  issue,
  open,
  onToggle,
  onChoose,
  onRemove,
}: SecondaryProps) {
  const toggle = useRef<HTMLButtonElement>(null);
  if (catalog.textColors.length === 0) return null;
  const options = catalog.textColors.filter(isAvailable);
  const invalid = issue?.kind === 'invalid' ? issue : undefined;
  const expanded = open || invalid !== undefined;
  const kept = colorId !== null && !options.some((color) => color.id === colorId);
  const name = colorId === null ? '' : (findTextColor(catalog, colorId)?.displayName ?? colorId);

  return (
    <div className="field secondary">
      {invalid === undefined && (
        <button
          ref={toggle}
          type="button"
          className="button disclosure"
          aria-expanded={expanded}
          aria-controls="secondary-color-panel"
          onClick={onToggle}
        >
          <span className="disclosure__icon" aria-hidden="true">
            {expanded ? '▾' : '▸'}
          </span>
          Usar segunda cor
        </button>
      )}
      {!expanded && colorId !== null && (
        <p className="field__info">
          Segunda cor em uso: {name} ({rangeSummary(rangeCount)}).
        </p>
      )}
      <div id="secondary-color-panel" className="secondary__panel" hidden={!expanded}>
        <fieldset
          className="field"
          aria-describedby={invalid ? 'secondary-color-issue' : undefined}
        >
          <legend className="field__legend">Segunda cor</legend>
          {kept && invalid && (
            <InvalidSelection
              messageId="secondary-color-issue"
              title="Segunda cor selecionada (indisponível)"
              name={name}
              message={invalidMessage(invalid)}
            />
          )}
          <div className="swatches">
            {options.map((color) => (
              <Swatch
                key={color.id}
                name="secondary-color"
                color={color}
                checked={color.id === colorId}
                disabled={color.id === primaryColorId && color.id !== colorId}
                onSelect={() => onChoose(color.id)}
              />
            ))}
          </div>
          {invalid && !kept && (
            <p className="field__error" id="secondary-color-issue">
              {invalidMessage(invalid)}
            </p>
          )}
        </fieldset>
        {colorId === null ? (
          <p className="field__info">
            Escolha a segunda cor para destacar trechos do texto. Ela não pode ser igual à cor do
            texto.
          </p>
        ) : (
          <>
            <p className="field__info">
              Selecione um trecho no campo Texto e use &quot;Aplicar segunda cor à seleção&quot;.
            </p>
            <button
              type="button"
              className="button"
              onClick={() => {
                onRemove();
                toggle.current?.focus();
              }}
            >
              Remover segunda cor
            </button>
          </>
        )}
      </div>
    </div>
  );
}

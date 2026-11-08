import { useRef, useState, type RefObject } from 'react';
import {
  findTextColor,
  isAvailable,
  type Catalog,
  type TextColor,
  type ValidationIssue,
} from '../../domain';
import { readSelection, useFieldSelection } from '../../hooks/useFieldSelection';
import { InvalidSelection } from './InvalidSelection';
import { invalidMessage } from './messages';

interface SwatchProps {
  readonly name: string;
  readonly color: TextColor;
  readonly checked: boolean;
  readonly disabled?: boolean;
  /** Show the name only on the selected chip; the others keep it as their accessible name. */
  readonly compact?: boolean;
  readonly onSelect: () => void;
}

/**
 * A native radio shown as a color chip with its name. The selected chip gets a
 * check mark and a heavier border, so the choice never depends on color alone.
 * Compact chips show the name only when selected (a tooltip otherwise).
 */
function Swatch({ name, color, checked, disabled, compact = false, onSelect }: SwatchProps) {
  const hideName = compact && !checked;
  return (
    <label
      className={`swatch-option${hideName ? ' swatch-option--chip-only' : ''}`}
      title={hideName ? color.displayName : undefined}
    >
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
      <span className={hideName ? 'visually-hidden' : 'swatch-option__name'}>
        {color.displayName}
      </span>
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
              compact
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
  /** An invalid `secondaryRanges` issue, shown beside the actions. */
  readonly rangeIssue: ValidationIssue | undefined;
  /** The text as lettered (capitals for "Sem serifa"), to name what was selected. */
  readonly text: string;
  /** The "Texto" field whose selection the actions use. */
  readonly fieldRef: RefObject<HTMLTextAreaElement | null>;
  /** Whether the options are shown. Hiding them never changes the configuration. */
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly onChoose: (colorId: string) => void;
  readonly onApply: (start: number, end: number) => void;
  readonly onUnapply: (start: number, end: number) => void;
  /** Clears the second color and all its ranges. */
  readonly onRemove: () => void;
}

const rangeSummary = (count: number) => (count === 1 ? '1 trecho' : `${count} trechos`);

/** The selected characters as shown on the piece, on one line. */
const quoted = (text: string, start: number, end: number) =>
  `“${text.slice(start, end).replace(/\r\n|\r|\n/g, ' ')}”`;

const NO_SELECTION =
  'Nenhuma letra selecionada. Selecione no campo Texto as letras que devem mudar de cor.';

/**
 * Optional second color behind "Usar segunda cor" (D-047). Collapsing only hides
 * the options; "Remover segunda cor" is the one action that clears the color and
 * its ranges (D-042). A color equal to the primary cannot be chosen, and an
 * invalid kept choice stays visible until it is replaced or removed (D-030).
 *
 * Applying (D-068): the actions sit right after the swatches and read the
 * "Texto" field's selection when pressed, which the field keeps after losing
 * focus. They are never disabled: without a selection they say what to do,
 * and after acting they name the characters that changed.
 */
export function SecondaryColorField({
  catalog,
  colorId,
  primaryColorId,
  rangeCount,
  issue,
  rangeIssue,
  text,
  fieldRef,
  open,
  onToggle,
  onChoose,
  onApply,
  onUnapply,
  onRemove,
}: SecondaryProps) {
  const toggle = useRef<HTMLButtonElement>(null);
  const selection = useFieldSelection(fieldRef);
  // Feedback belongs to the selection and text it was given for.
  const [feedback, setFeedback] = useState<{
    readonly key: string;
    readonly message: string;
    readonly error: boolean;
  } | null>(null);
  const key = `${selection.start}:${selection.end}:${text}`;
  const shown = feedback?.key === key ? feedback : null;
  if (catalog.textColors.length === 0) return null;
  const options = catalog.textColors.filter(isAvailable);
  const invalid = issue?.kind === 'invalid' ? issue : undefined;
  const expanded = open || invalid !== undefined;
  const kept = colorId !== null && !options.some((color) => color.id === colorId);
  const name = colorId === null ? '' : (findTextColor(catalog, colorId)?.displayName ?? colorId);
  const selected = selection.end > selection.start;

  const act = (action: (start: number, end: number) => void, done: (what: string) => string) => {
    // Read at the moment of the press: the field keeps its selection when it loses focus.
    const { start, end } = readSelection(fieldRef.current);
    const what = text.slice(start, end).replace(/\r\n|\r|\n/g, '');
    if (end <= start || what === '') {
      setFeedback({ key: `${start}:${end}:${text}`, message: NO_SELECTION, error: true });
      return;
    }
    action(start, end);
    setFeedback({
      key: `${start}:${end}:${text}`,
      message: done(quoted(text, start, end)),
      error: false,
    });
  };

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
            Escolha a segunda cor para destacar letras do texto. Ela não pode ser igual à cor do
            texto.
          </p>
        ) : (
          <div className="selection-actions">
            <p className="field__info" id="secondary-help">
              Selecione as letras no campo Texto e toque em &quot;Aplicar segunda cor à
              seleção&quot;.
            </p>
            <p className="field__info selection-actions__selection">
              {selected
                ? `Seleção: ${quoted(text, selection.start, selection.end)}`
                : 'Nenhuma letra selecionada.'}
            </p>
            <div className="selection-actions__buttons">
              <button
                type="button"
                className="button"
                aria-describedby="secondary-help"
                onClick={() => act(onApply, (what) => `Segunda cor aplicada a ${what}.`)}
              >
                Aplicar segunda cor à seleção
              </button>
              <button
                type="button"
                className="button"
                onClick={() => act(onUnapply, (what) => `Segunda cor removida de ${what}.`)}
              >
                Remover segunda cor da seleção
              </button>
            </div>
            {/* Always rendered so assistive technology announces each result. */}
            <p className={shown?.error ? 'field__error' : 'field__info'} aria-live="polite">
              {shown?.message}
            </p>
            <p className="field__info">
              {rangeCount === 0
                ? 'Nenhum trecho com a segunda cor.'
                : rangeCount === 1
                  ? '1 trecho com a segunda cor.'
                  : `${rangeCount} trechos com a segunda cor.`}
            </p>
            {rangeIssue?.kind === 'invalid' && (
              <p className="field__error">{invalidMessage(rangeIssue)}</p>
            )}
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
          </div>
        )}
      </div>
    </div>
  );
}

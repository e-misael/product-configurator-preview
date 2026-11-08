import { useRef, useState, type RefObject } from 'react';
import {
  findTextColor,
  isAvailable,
  type Catalog,
  type TextColor,
  type TextRange,
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
  /**
   * Call `onSelect` on every activation, also of the chip already selected
   * (a second-color tap applies the color to a new selection, D-069).
   */
  readonly selectOnClick?: boolean;
  readonly onSelect: () => void;
}

/**
 * A native radio shown as a color chip with its name. The selected chip gets a
 * check mark and a heavier border, so the choice never depends on color alone.
 * Compact chips show the name only when selected (a tooltip otherwise).
 */
function Swatch({
  name,
  color,
  checked,
  disabled,
  compact = false,
  selectOnClick = false,
  onSelect,
}: SwatchProps) {
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
        // A click also follows arrow keys and Space, and fires on the checked chip.
        onChange={selectOnClick ? () => undefined : onSelect}
        onClick={selectOnClick ? onSelect : undefined}
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
  readonly ranges: readonly TextRange[];
  readonly issue: ValidationIssue | undefined;
  /** An invalid `secondaryRanges` issue, shown beside the list of trechos. */
  readonly rangeIssue: ValidationIssue | undefined;
  /** The text as lettered (capitals for "Sem serifa"), to name the letters. */
  readonly text: string;
  /** The "Texto" field whose selection a tap on a color uses. */
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

/** The characters as shown on the piece, on one line. */
const quoted = (text: string, start: number, end: number) =>
  `“${text.slice(start, end).replace(/\r\n|\r|\n/g, ' ')}”`;

/**
 * Optional second color behind "Usar segunda cor" (D-047). Collapsing only hides
 * the options; "Remover segunda cor" is the one action that clears the color and
 * its ranges (D-042). A color equal to the primary cannot be chosen, and an
 * invalid kept choice stays visible until it is replaced or removed (D-030).
 *
 * Applying (D-069): tapping a color applies it at once to the letters selected
 * in "Texto", read at the moment of the tap (the field keeps its selection
 * when it loses focus); without a selection the tap only chooses the color and
 * says what to do next. The colored trechos are listed, each removable.
 */
export function SecondaryColorField({
  catalog,
  colorId,
  primaryColorId,
  ranges,
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
  const removeAll = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const selection = useFieldSelection(fieldRef);
  // Feedback belongs to the text it was given for.
  const [feedback, setFeedback] = useState<{
    readonly text: string;
    readonly message: string;
  } | null>(null);
  const shown = feedback?.text === text ? feedback.message : '';
  if (catalog.textColors.length === 0) return null;
  const options = catalog.textColors.filter(isAvailable);
  const invalid = issue?.kind === 'invalid' ? issue : undefined;
  const expanded = open || invalid !== undefined;
  const kept = colorId !== null && !options.some((color) => color.id === colorId);
  const nameOf = (id: string) => findTextColor(catalog, id)?.displayName ?? id;
  const name = colorId === null ? '' : nameOf(colorId);
  const hex = colorId === null ? undefined : findTextColor(catalog, colorId)?.hex;
  const selected =
    selection.end > selection.start &&
    text.slice(selection.start, selection.end).replace(/\r\n|\r|\n/g, '') !== '';

  const choose = (color: TextColor) => {
    onChoose(color.id);
    // Read at the moment of the tap: the field keeps its selection when it loses focus.
    const { start, end } = readSelection(fieldRef.current);
    const letters = text.slice(start, end).replace(/\r\n|\r|\n/g, '');
    if (end <= start || letters === '') {
      setFeedback({
        text,
        message: `Segunda cor: ${color.displayName}. Selecione as letras no campo Texto e toque na cor para aplicá-la.`,
      });
      return;
    }
    onApply(start, end);
    setFeedback({
      text,
      message: `${color.displayName} aplicado a ${quoted(text, start, end)}.`,
    });
  };

  const unapply = (range: TextRange, index: number) => {
    onUnapply(range.start, range.end);
    setFeedback({
      text,
      message: `Segunda cor removida de ${quoted(text, range.start, range.end)}.`,
    });
    // Keep focus in the list: the next trecho, the previous one, or "Remover segunda cor".
    const buttons = list.current?.querySelectorAll('button');
    const next = buttons?.[index + 1] ?? buttons?.[index - 1];
    (next ?? removeAll.current)?.focus();
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
          Segunda cor em uso: {name} ({rangeSummary(ranges.length)}).
        </p>
      )}
      <div id="secondary-color-panel" className="secondary__panel" hidden={!expanded}>
        <fieldset
          className="field"
          aria-describedby={invalid ? 'secondary-color-issue secondary-help' : 'secondary-help'}
        >
          <legend className="field__legend">Segunda cor</legend>
          <p className="field__info" id="secondary-help">
            Selecione as letras no campo Texto e toque em uma cor para destacá-las.
          </p>
          <p className="field__info selection-actions__selection">
            {selected
              ? `Seleção: ${quoted(text, selection.start, selection.end)}`
              : 'Nenhuma letra selecionada.'}
          </p>
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
                compact
                selectOnClick
                onSelect={() => choose(color)}
              />
            ))}
          </div>
          {invalid && !kept && (
            <p className="field__error" id="secondary-color-issue">
              {invalidMessage(invalid)}
            </p>
          )}
        </fieldset>
        {/* Always rendered so assistive technology announces each result. */}
        <p className="field__info selection-actions__feedback" aria-live="polite">
          {shown}
        </p>
        {colorId !== null && (
          <div className="selection-actions">
            {ranges.length > 0 && (
              <>
                <p className="field__info">
                  {ranges.length === 1
                    ? `1 trecho em ${name}:`
                    : `${ranges.length} trechos em ${name}. Todos os trechos usam a mesma segunda cor:`}
                </p>
                <ul ref={list} className="secondary__ranges" aria-label="Trechos com a segunda cor">
                  {ranges.map((range, index) => (
                    <li key={`${range.start}:${range.end}`} className="secondary__range">
                      <span
                        className="secondary__range-chip"
                        style={{ backgroundColor: hex }}
                        aria-hidden="true"
                      />
                      <span className="secondary__range-text">
                        {quoted(text, range.start, range.end)}
                      </span>
                      <button
                        type="button"
                        className="button"
                        aria-label={`Remover segunda cor de ${quoted(text, range.start, range.end)}`}
                        onClick={() => unapply(range, index)}
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {rangeIssue?.kind === 'invalid' && (
              <p className="field__error">{invalidMessage(rangeIssue)}</p>
            )}
            <button
              ref={removeAll}
              type="button"
              className="button"
              onClick={() => {
                onRemove();
                setFeedback(null);
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

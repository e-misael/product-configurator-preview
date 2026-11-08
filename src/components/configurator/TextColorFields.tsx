import type { ReactNode } from 'react';
import {
  findTextColor,
  isAvailable,
  wordsOf,
  type Catalog,
  type TextColor,
  type TextRange,
  type ValidationIssue,
} from '../../domain';
import { readableInk } from './contrast';
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
 * A native radio shown as a color chip. Only the selected chip shows its name,
 * with a check mark and a heavier border, so the choice never depends on color
 * alone; the others keep the name as their accessible name and tooltip.
 */
function Swatch({ name, color, checked, disabled, onSelect }: SwatchProps) {
  return (
    <label
      className={`swatch-option${checked ? '' : ' swatch-option--chip-only'}`}
      title={checked ? undefined : color.displayName}
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
      <span className={checked ? 'swatch-option__name' : 'visually-hidden'}>
        {color.displayName}
      </span>
    </label>
  );
}

interface TextColorsProps {
  readonly catalog: Catalog;
  readonly colorId: string | null;
  readonly colorIssue: ValidationIssue | undefined;
  readonly highlightEnabled: boolean;
  readonly secondaryColorId: string | null;
  readonly secondaryIssue: ValidationIssue | undefined;
  readonly ranges: readonly TextRange[];
  readonly rangeIssue: ValidationIssue | undefined;
  /** The text as lettered (capitals for "Sem serifa"); same offsets as the stored text. */
  readonly text: string;
  /** The primary and highlight colors were just swapped (D-071). */
  readonly swapped: boolean;
  readonly onChoose: (colorId: string | null) => void;
  readonly onChooseSecondary: (colorId: string) => void;
  readonly onHighlight: (enabled: boolean) => void;
  readonly onToggleWord: (word: TextRange) => void;
}

const wordCount = (count: number) => (count === 1 ? '1 palavra' : `${count} palavras`);

/**
 * "Cores do texto" (D-071): the required primary color, always visible, and
 * "Destacar parte(s) do texto". With highlighting on, a highlight color and
 * the text's words as toggle buttons right after the switch, then the
 * highlight color; each tap highlights or restores one word
 * occurrence, and the preview follows at once. Turning highlighting off draws
 * one color but keeps the highlight color and words for when it is on again.
 */
export function TextColorsField({
  catalog,
  colorId,
  colorIssue,
  highlightEnabled,
  secondaryColorId,
  secondaryIssue,
  ranges,
  rangeIssue,
  text,
  swapped,
  onChoose,
  onChooseSecondary,
  onHighlight,
  onToggleWord,
}: TextColorsProps) {
  const options = catalog.textColors.filter(isAvailable);
  const nameOf = (id: string | null) =>
    id === null ? '' : (findTextColor(catalog, id)?.displayName ?? id);
  const primaryInvalid = colorIssue?.kind === 'invalid' ? colorIssue : undefined;
  const primaryKept = colorId !== null && !options.some((color) => color.id === colorId);
  const secondaryKept =
    secondaryColorId !== null && !options.some((color) => color.id === secondaryColorId);
  const highlightHex =
    secondaryColorId === null ? undefined : findTextColor(catalog, secondaryColorId)?.hex;

  return (
    <fieldset className="field colors">
      <legend className="field__legend">Cores do texto</legend>
      <fieldset
        className="field colors__group"
        aria-describedby={primaryInvalid ? 'text-color-issue' : undefined}
      >
        <legend className="colors__label">Cor do texto</legend>
        {primaryKept && primaryInvalid && (
          <InvalidSelection
            messageId="text-color-issue"
            title="Cor selecionada (indisponível)"
            name={nameOf(colorId)}
            message={invalidMessage(primaryInvalid)}
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
      {/* Always rendered so assistive technology announces the swap. */}
      <p className="field__info colors__feedback" aria-live="polite">
        {swapped && highlightEnabled
          ? `As cores foram trocadas: destaque agora em ${nameOf(secondaryColorId)}.`
          : ''}
      </p>
      {options.length > 0 && (
        <label className="switch">
          <input
            type="checkbox"
            role="switch"
            className="switch__input"
            checked={highlightEnabled}
            aria-controls="highlight-panel"
            onChange={(event) => onHighlight(event.target.checked)}
          />
          <span className="switch__track" aria-hidden="true" />
          <span>Destacar parte(s) do texto</span>
        </label>
      )}
      {!highlightEnabled && ranges.length > 0 && (
        <p className="field__info">
          Destaque desativado: {wordCount(ranges.length)} em {nameOf(secondaryColorId)} ficam
          guardadas.
        </p>
      )}
      <div id="highlight-panel" className="colors__panel" hidden={!highlightEnabled}>
        {highlightEnabled && (
          <>
            <WordPicker text={text} ranges={ranges} hex={highlightHex} onToggle={onToggleWord} />
            <fieldset
              className="field colors__group"
              aria-describedby={secondaryIssue ? 'secondary-color-issue' : undefined}
            >
              <legend className="colors__label">Cor de destaque</legend>
              {secondaryKept && secondaryIssue?.kind === 'invalid' && (
                <InvalidSelection
                  messageId="secondary-color-issue"
                  title="Cor de destaque selecionada (indisponível)"
                  name={nameOf(secondaryColorId)}
                  message={invalidMessage(secondaryIssue)}
                />
              )}
              <div className="swatches">
                {options.map((color) => (
                  <Swatch
                    key={color.id}
                    name="secondary-color"
                    color={color}
                    checked={color.id === secondaryColorId}
                    // The primary color cannot also be the highlight color.
                    disabled={color.id === colorId}
                    onSelect={() => onChooseSecondary(color.id)}
                  />
                ))}
              </div>
              {secondaryIssue !== undefined &&
                !(secondaryKept && secondaryIssue.kind === 'invalid') && (
                  <p className="field__error" id="secondary-color-issue">
                    {secondaryIssue.kind === 'missing'
                      ? 'Escolha a cor de destaque.'
                      : invalidMessage(secondaryIssue)}
                  </p>
                )}
            </fieldset>
            {rangeIssue?.kind === 'invalid' && (
              <p className="field__error">{invalidMessage(rangeIssue)}</p>
            )}
          </>
        )}
      </div>
    </fieldset>
  );
}

interface WordPickerProps {
  readonly text: string;
  readonly ranges: readonly TextRange[];
  readonly hex: string | undefined;
  readonly onToggle: (word: TextRange) => void;
}

/**
 * The text as compact word tokens, in order, with its punctuation, spaces,
 * and line breaks as plain text. Each occurrence is its own toggle button
 * (`aria-pressed`); repeated words are told apart by their occurrence number.
 */
function WordPicker({ text, ranges, hex, onToggle }: WordPickerProps) {
  const words = wordsOf(text);
  const count = ranges.length;
  const totals = new Map<string, number>();
  for (const word of words) {
    const letters = text.slice(word.start, word.end);
    totals.set(letters, (totals.get(letters) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const pieces: ReactNode[] = [];
  const pushPlain = (from: number, to: number) => {
    text
      .slice(from, to)
      .split(/\r\n|\r|\n/)
      .forEach((part, index) => {
        if (index > 0) pieces.push(<br key={`br-${from}-${index}`} />);
        if (part !== '') {
          pieces.push(
            <span key={`t-${from}-${index}`} className="words__plain" aria-hidden="true">
              {part}
            </span>,
          );
        }
      });
  };
  let cursor = 0;
  for (const word of words) {
    pushPlain(cursor, word.start);
    const letters = text.slice(word.start, word.end);
    const occurrence = (seen.get(letters) ?? 0) + 1;
    seen.set(letters, occurrence);
    const total = totals.get(letters) ?? 1;
    const pressed = ranges.some((r) => r.start === word.start && r.end === word.end);
    pieces.push(
      <button
        key={`w-${word.start}`}
        type="button"
        className="words__token"
        aria-pressed={pressed}
        aria-label={total > 1 ? `${letters} (${occurrence}ª de ${total})` : undefined}
        style={
          pressed && hex !== undefined
            ? { backgroundColor: hex, borderColor: hex, color: readableInk(hex) }
            : undefined
        }
        onClick={() => onToggle(word)}
      >
        {letters}
      </button>,
    );
    cursor = word.end;
  }
  pushPlain(cursor, text.length);

  return (
    <div className="colors__words" role="group" aria-labelledby="words-help">
      <p className="colors__label" id="words-help">
        Toque nas palavras que deseja destacar
      </p>
      {words.length === 0 ? (
        <p className="field__info">
          {text.trim() === ''
            ? 'Digite o texto para escolher as palavras.'
            : 'O texto não tem palavras para destacar.'}
        </p>
      ) : (
        <>
          <div className="words">{pieces}</div>
          <p className="field__info">
            {count === 0
              ? 'Nenhuma palavra destacada.'
              : count === 1
                ? '1 palavra destacada.'
                : `${count} palavras destacadas.`}
          </p>
        </>
      )}
    </div>
  );
}

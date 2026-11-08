import {
  PRESET_COLUMNS,
  PRESET_ROWS,
  presetPlacement,
  TEXT_ALIGNMENTS,
  type TextAlignment,
  type TextPlacement,
} from '../../domain';
import type { TextBlock } from '../../preview/scene';
import { FIXED_PLACEMENT_HINT, presetLabel, presetOf } from './messages';

interface TextPositionControlsProps {
  /** The text block as drawn; undefined when no text is on the image. */
  readonly block: TextBlock | undefined;
  /** The model's lettering is always centered (the Bandejas, D-068): nothing to choose. */
  readonly fixed: boolean;
  /** Whether the block is away from the catalog default position. */
  readonly moved: boolean;
  readonly onPlace: (placement: TextPlacement) => void;
  readonly onAlign: (align: TextAlignment) => void;
  readonly onReset: () => void;
}

/** Icon-only options; the names are for assistive technology (D-059). */
const ALIGNMENT_NAMES: Record<TextAlignment, string> = {
  left: 'Alinhar à esquerda',
  center: 'Centralizar texto',
  right: 'Alinhar à direita',
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

/**
 * Text position and alignment (D-044, D-057, D-059, D-068). The nine presets
 * place the block; the line alignment (three icon options) arranges the lines
 * inside it and never moves it. There is no manual adjustment or dragging
 * (D-068). A model with a fixed placement shows only a note. Until text is
 * drawn on the image only a hint is shown. One status line names the position.
 */
export function TextPositionControls({
  block,
  fixed,
  moved,
  onPlace,
  onAlign,
  onReset,
}: TextPositionControlsProps) {
  if (fixed) return <p className="field__info position__hint">{FIXED_PLACEMENT_HINT}</p>;

  const placement: TextPlacement | undefined =
    block === undefined ? undefined : { align: block.align, x: block.x, y: block.y };
  if (block === undefined || placement === undefined) {
    return (
      <p className="field__info position__hint">
        Disponível quando o texto aparece na pré-visualização: escolha o modelo e digite o texto.
      </p>
    );
  }
  const current = presetOf(placement);
  const canMove = { x: block.slack.x > 0, y: block.slack.y > 0 };

  return (
    <fieldset className="field position" data-align={placement.align}>
      <legend className="visually-hidden">Posição do texto</legend>
      <p className="field__info position__help" id="position-help">
        Escolha onde o bloco de texto fica na peça.
      </p>
      <div
        className="position__presets"
        role="group"
        aria-label="Posições predefinidas"
        aria-describedby="position-help"
      >
        {PRESET_ROWS.flatMap((row) =>
          PRESET_COLUMNS.map((column) => {
            const label = presetLabel(row, column);
            return (
              <button
                key={`${row}-${column}`}
                type="button"
                className={`position__preset position__preset--${row} position__preset--${column}`}
                aria-label={label}
                title={label}
                aria-pressed={current?.row === row && current.column === column}
                onClick={() => onPlace(presetPlacement(row, column, placement.align))}
              >
                {/* Three short lines, placed and aligned like the text will be. */}
                <span className="position__glyph" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </button>
            );
          }),
        )}
      </div>

      <fieldset className="field alignment">
        <legend className="field__legend field__legend--small">Alinhamento das linhas</legend>
        <div className="alignment__options">
          {TEXT_ALIGNMENTS.map((align) => (
            <label key={align} className="alignment__option" title={ALIGNMENT_NAMES[align]}>
              <input
                type="radio"
                name="text-align"
                value={align}
                aria-label={ALIGNMENT_NAMES[align]}
                checked={placement.align === align}
                onChange={() => onAlign(align)}
              />
              <span className={`alignment__glyph alignment__glyph--${align}`} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* The one position announcement: the preset, or a position kept from before (D-068). */}
      <p className="field__info position__current" role="status">
        {current === undefined
          ? `Posição personalizada: horizontal ${
              canMove.x ? percent(placement.x) : 'sem espaço livre'
            }, vertical ${canMove.y ? percent(placement.y) : 'sem espaço livre'}.`
          : `Posição: ${presetLabel(current.row, current.column)}.`}
      </p>

      <button type="button" className="button position__reset" disabled={!moved} onClick={onReset}>
        Redefinir posição
      </button>
    </fieldset>
  );
}

import type { KeyboardEvent, MouseEvent } from 'react';
import {
  LARGE_POSITION_STEP,
  matchesPreset,
  POSITION_STEP,
  PRESET_COLUMNS,
  PRESET_ROWS,
  presetPlacement,
  TEXT_ALIGNMENTS,
  type PresetColumn,
  type PresetRow,
  type TextAlignment,
  type TextPlacement,
} from '../../domain';
import type { TextBlock } from '../../preview/scene';

/** Presets or manual adjustment: only one set of controls is shown (D-058). */
export type PositionMode = 'presets' | 'manual';

interface TextPositionControlsProps {
  /** The text block as drawn; undefined when no text is on the image. */
  readonly block: TextBlock | undefined;
  /** Whether the block is away from the catalog default position. */
  readonly moved: boolean;
  /** "Ajustar manualmente" also enables dragging the text on the preview. */
  readonly mode: PositionMode;
  readonly onMode: (mode: PositionMode) => void;
  readonly onPlace: (placement: TextPlacement) => void;
  readonly onAlign: (align: TextAlignment) => void;
  readonly onNudge: (dx: number, dy: number) => void;
  readonly onReset: () => void;
}

/** Icon-only options; the names are for assistive technology (D-059). */
const ALIGNMENT_NAMES: Record<TextAlignment, string> = {
  left: 'Alinhar à esquerda',
  center: 'Centralizar texto',
  right: 'Alinhar à direita',
};

const MODES: readonly { mode: PositionMode; label: string }[] = [
  { mode: 'presets', label: 'Escolher posição' },
  { mode: 'manual', label: 'Ajustar manualmente' },
];

const ROW_LABELS: Record<PresetRow, string> = {
  top: 'Superior',
  middle: 'Meio',
  bottom: 'Inferior',
};
const COLUMN_LABELS: Record<PresetColumn, string> = {
  left: 'à esquerda',
  center: 'ao centro',
  right: 'à direita',
};

const presetLabel = (row: PresetRow, column: PresetColumn) =>
  row === 'middle' && column === 'center'
    ? 'Centro'
    : `${ROW_LABELS[row]} ${COLUMN_LABELS[column]}`;

type Direction = 'up' | 'down' | 'left' | 'right';
const DIRECTIONS: readonly { direction: Direction; label: string; symbol: string }[] = [
  { direction: 'up', label: 'Mover para cima', symbol: '↑' },
  { direction: 'left', label: 'Mover para a esquerda', symbol: '←' },
  { direction: 'right', label: 'Mover para a direita', symbol: '→' },
  { direction: 'down', label: 'Mover para baixo', symbol: '↓' },
];
const KEY_DIRECTIONS: Partial<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};
const VECTORS: Record<Direction, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

/**
 * Text position and alignment (D-044, D-057, D-058, D-059). The line
 * alignment (three icon options) arranges the lines inside the block and
 * never moves it. The block is placed in one of two modes: "Escolher posição"
 * shows the nine presets; "Ajustar manualmente" shows the 2% / 10% (Shift)
 * moves by button or arrow key and enables dragging on the preview. Switching
 * modes keeps the position; "Redefinir posição" works in both. Until text is
 * drawn on the image only a hint is shown. One status line names the
 * position; the groups are named for assistive technology.
 */
export function TextPositionControls({
  block,
  moved,
  mode,
  onMode,
  onPlace,
  onAlign,
  onNudge,
  onReset,
}: TextPositionControlsProps) {
  const placement: TextPlacement | undefined =
    block === undefined ? undefined : { align: block.align, x: block.x, y: block.y };
  const canMove = { x: (block?.slack.x ?? 0) > 0, y: (block?.slack.y ?? 0) > 0 };
  const current = PRESET_ROWS.flatMap((row) =>
    PRESET_COLUMNS.map((column) => ({ row, column })),
  ).find(({ row, column }) => placement !== undefined && matchesPreset(placement, row, column));

  const move = (direction: Direction, large: boolean) => {
    const [dx, dy] = VECTORS[direction];
    const step = large ? LARGE_POSITION_STEP : POSITION_STEP;
    // An axis without free space cannot move; its stored coordinate stays unchanged.
    const moveX = canMove.x ? dx * step : 0;
    const moveY = canMove.y ? dy * step : 0;
    if (moveX !== 0 || moveY !== 0) onNudge(moveX, moveY);
  };

  // Arrow keys work on any direction button, whichever has focus.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const direction = KEY_DIRECTIONS[event.key];
    if (direction === undefined) return;
    event.preventDefault();
    move(direction, event.shiftKey);
  };

  if (block === undefined || placement === undefined) {
    return (
      <p className="field__info position__hint">
        Disponível quando o texto aparece na pré-visualização: escolha o modelo e digite o texto.
      </p>
    );
  }

  return (
    <fieldset className="field position" data-align={placement.align}>
      <legend className="visually-hidden">Posição do texto</legend>
      <fieldset className="field">
        <legend className="field__legend field__legend--small">Posição do bloco</legend>
        <div className="segmented">
          {MODES.map((option) => (
            <label key={option.mode} className="segmented__option">
              <input
                type="radio"
                name="position-mode"
                value={option.mode}
                checked={mode === option.mode}
                onChange={() => onMode(option.mode)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {mode === 'presets' ? (
        <div className="position__presets" role="group" aria-label="Posições predefinidas">
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
      ) : (
        <div className="position__manual">
          <div
            className="position__moves"
            role="group"
            aria-label="Ajuste fino"
            aria-describedby="position-keys"
          >
            {DIRECTIONS.map(({ direction, label, symbol }) => (
              <button
                key={direction}
                type="button"
                className={`button position__move position__move--${direction}`}
                aria-label={label}
                title={label}
                disabled={direction === 'up' || direction === 'down' ? !canMove.y : !canMove.x}
                onClick={(event: MouseEvent<HTMLButtonElement>) => move(direction, event.shiftKey)}
                onKeyDown={onKeyDown}
              >
                <span aria-hidden="true">{symbol}</span>
              </button>
            ))}
          </div>
          <p className="field__info position__drag">Ou arraste o texto na pré-visualização.</p>
          {/* Read with the arrow pad; not shown, to keep the section uncluttered. */}
          <p className="visually-hidden" id="position-keys">
            Setas do teclado: 2% por passo, 10% com Shift.
          </p>
        </div>
      )}

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

      {/* The one position announcement: the preset, or the custom position in percent. */}
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

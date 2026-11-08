import type { KeyboardEvent, MouseEvent } from 'react';
import {
  LARGE_POSITION_STEP,
  matchesPreset,
  POSITION_STEP,
  PRESET_COLUMNS,
  PRESET_ROWS,
  presetPlacement,
  type PresetColumn,
  type PresetRow,
  type TextPlacement,
} from '../../domain';
import type { TextBlock } from '../../preview/scene';

interface TextPositionControlsProps {
  /** The text block as drawn; undefined when no text is on the image. */
  readonly block: TextBlock | undefined;
  /** Whether a placement is stored (otherwise the catalog default applies). */
  readonly customized: boolean;
  readonly moveMode: boolean;
  readonly onToggleMoveMode: () => void;
  readonly onPlace: (placement: TextPlacement) => void;
  readonly onNudge: (dx: number, dy: number) => void;
  readonly onReset: () => void;
}

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
 * Text position (D-044, simplified by D-047): nine presets that set the line
 * alignment and the block position together, 2% / 10% (Shift) directional
 * moves by button or arrow key, the touch "Mover texto" mode, and reset to the
 * catalog default. Disabled while no text is drawn on the image. One status
 * line names the position; the groups are named for assistive technology only (D-057).
 */
export function TextPositionControls({
  block,
  customized,
  moveMode,
  onToggleMoveMode,
  onPlace,
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

  return (
    <fieldset className="field position" disabled={block === undefined}>
      <legend className="field__legend">Posição do texto</legend>
      {block === undefined && (
        <p className="field__info">Disponível quando o texto aparece na pré-visualização.</p>
      )}

      <div className="position__controls">
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
                  onClick={() => onPlace(presetPlacement(row, column))}
                >
                  {/* Three short lines, aligned and placed like the text will be. */}
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
      </div>
      {/* The one position announcement: the preset, or the custom position in percent. */}
      <p className="field__info position__current" role="status">
        {placement === undefined
          ? ''
          : current === undefined
            ? `Posição personalizada: horizontal ${
                canMove.x ? percent(placement.x) : 'sem espaço livre'
              }, vertical ${canMove.y ? percent(placement.y) : 'sem espaço livre'}.`
            : `Posição: ${presetLabel(current.row, current.column)}.`}
      </p>
      <p className="field__info" id="position-keys">
        Setas do teclado: 2% por passo, 10% com Shift.
      </p>

      <div className="selection-actions__buttons">
        <button
          type="button"
          className="button"
          aria-pressed={moveMode}
          aria-describedby="move-mode-hint"
          onClick={onToggleMoveMode}
        >
          Mover texto
        </button>
        <button type="button" className="button" disabled={!customized} onClick={onReset}>
          Redefinir posição
        </button>
      </div>
      <p className="field__info" id="move-mode-hint">
        {moveMode
          ? 'Arraste o texto na imagem com o dedo ou o mouse.'
          : 'Com o mouse, arraste o texto na imagem. Na tela de toque, ative "Mover texto".'}
      </p>
    </fieldset>
  );
}

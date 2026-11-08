import { useRef, useState } from 'react';
import type { ValidationIssue } from '../../domain';
import { invalidMessage } from './messages';

interface TextFieldProps {
  readonly text: string;
  readonly issue: ValidationIssue | undefined;
  /** `caret` is the selection after the edit; it lets the ranges follow the edit exactly. */
  readonly onChange: (text: string, caret?: number) => void;
  /** Present only when a second color is chosen; enables the selection actions. */
  readonly secondary:
    | {
        readonly rangeCount: number;
        readonly issue: ValidationIssue | undefined;
        readonly onApply: (start: number, end: number) => void;
        readonly onRemove: (start: number, end: number) => void;
      }
    | undefined;
}

/**
 * The text is stored exactly as typed; nothing is trimmed or normalized.
 * The second color is applied to the selected characters with explicit
 * buttons; the textarea stays plain text (no rich-text editor).
 */
export function TextField({ text, issue, onChange, secondary }: TextFieldProps) {
  const invalid = issue?.kind === 'invalid' ? issue : undefined;
  const field = useRef<HTMLTextAreaElement>(null);
  const [hasSelection, setHasSelection] = useState(false);

  const trackSelection = (element: HTMLTextAreaElement) =>
    setHasSelection(element.selectionEnd > element.selectionStart);

  const act = (action: (start: number, end: number) => void) => {
    const element = field.current;
    if (element !== null && element.selectionEnd > element.selectionStart) {
      action(element.selectionStart, element.selectionEnd);
    }
  };

  return (
    <div className="field">
      <label className="field__legend" htmlFor="text">
        Texto
      </label>
      <p className="field__info" id="text-hint">
        As quebras de linha são mantidas.
      </p>
      <textarea
        ref={field}
        id="text"
        className="textarea"
        rows={3}
        value={text}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? 'text-hint text-issue' : 'text-hint'}
        onChange={(event) => {
          onChange(event.target.value, event.target.selectionStart);
          trackSelection(event.target);
        }}
        onSelect={(event) => trackSelection(event.currentTarget)}
      />
      {invalid && (
        <p className="field__error" id="text-issue">
          {invalidMessage(invalid)}
        </p>
      )}
      {secondary && (
        <div className="selection-actions">
          <p className="field__info">Selecione parte do texto para aplicar a segunda cor.</p>
          <div className="selection-actions__buttons">
            <button
              type="button"
              className="button"
              disabled={!hasSelection}
              onClick={() => act(secondary.onApply)}
            >
              Aplicar segunda cor à seleção
            </button>
            <button
              type="button"
              className="button"
              disabled={!hasSelection || secondary.rangeCount === 0}
              onClick={() => act(secondary.onRemove)}
            >
              Remover segunda cor da seleção
            </button>
          </div>
          <p className="field__info" aria-live="polite">
            {secondary.rangeCount === 0
              ? 'Nenhum trecho com a segunda cor.'
              : secondary.rangeCount === 1
                ? '1 trecho com a segunda cor.'
                : `${secondary.rangeCount} trechos com a segunda cor.`}
          </p>
          {secondary.issue?.kind === 'invalid' && (
            <p className="field__error">{invalidMessage(secondary.issue)}</p>
          )}
        </div>
      )}
    </div>
  );
}

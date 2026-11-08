import { useState, type RefObject } from 'react';
import type { ValidationIssue } from '../../domain';
import { invalidMessage } from './messages';

interface TextFieldProps {
  readonly text: string;
  readonly issue: ValidationIssue | undefined;
  /** `caret` is the selection after the edit; it lets the ranges follow the edit exactly. */
  readonly onChange: (text: string, caret?: number) => void;
  /** The textarea, read by the second-color actions (D-068). */
  readonly fieldRef: RefObject<HTMLTextAreaElement | null>;
  /** "Sem serifa": the field shows capitals; the stored text keeps the case as typed (D-068). */
  readonly uppercase: boolean;
  /** The overflow warning while the text does not fit; shown under the field (D-063). */
  readonly overflow?: string | undefined;
  /**
   * Present when the model's text area is known: an added line break that
   * would exceed it is refused and `message` explains why (D-063).
   */
  readonly lineLimit?:
    | {
        readonly refuses: (next: string) => boolean;
        readonly message: string;
      }
    | undefined;
}

/**
 * The text is stored exactly as typed; nothing is trimmed or normalized.
 * The second color is applied to the selected characters from the second-color
 * section (D-068); the textarea stays plain text (no rich-text editor).
 */
export function TextField({
  text,
  issue,
  onChange,
  fieldRef,
  uppercase,
  overflow,
  lineLimit,
}: TextFieldProps) {
  const invalid = issue?.kind === 'invalid' ? issue : undefined;
  // The refusal note belongs to the text it was shown for; any accepted edit clears it.
  const [refusedAt, setRefusedAt] = useState<string | null>(null);
  const refused = refusedAt === text && lineLimit !== undefined;
  const describedBy = [
    'text-hint',
    invalid && 'text-issue',
    overflow !== undefined && 'text-overflow',
    refused && 'text-line-limit',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="field">
      <label className="field__legend" htmlFor="text">
        Texto
      </label>
      <p className="field__info" id="text-hint">
        As quebras de linha são mantidas.
      </p>
      <textarea
        ref={fieldRef}
        id="text"
        className={uppercase ? 'textarea textarea--uppercase' : 'textarea'}
        rows={3}
        value={text}
        aria-invalid={invalid || overflow !== undefined ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          const element = event.target;
          if (lineLimit?.refuses(element.value)) {
            // Put the text and the caret back where they were before the edit.
            const caret = Math.max(
              0,
              element.selectionStart - (element.value.length - text.length),
            );
            element.value = text;
            element.setSelectionRange(caret, caret);
            setRefusedAt(text);
            return;
          }
          setRefusedAt(null);
          onChange(element.value, element.selectionStart);
        }}
      />
      {invalid && (
        <p className="field__error" id="text-issue">
          {invalidMessage(invalid)}
        </p>
      )}
      {overflow !== undefined && (
        <p className="field__error field__error--alert" id="text-overflow">
          {overflow}
        </p>
      )}
      {/* Always rendered so assistive technology announces a refused line break. */}
      <p className="field__error" id="text-line-limit" aria-live="polite">
        {refused && lineLimit.message}
      </p>
    </div>
  );
}

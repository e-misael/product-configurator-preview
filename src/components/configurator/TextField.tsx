import type { ValidationIssue } from '../../domain';
import { invalidMessage } from './messages';

interface TextFieldProps {
  readonly text: string;
  readonly issue: ValidationIssue | undefined;
  readonly onChange: (text: string) => void;
}

/** The text is stored exactly as typed; nothing is trimmed or normalized. */
export function TextField({ text, issue, onChange }: TextFieldProps) {
  const invalid = issue?.kind === 'invalid' ? issue : undefined;

  return (
    <div className="field">
      <label className="field__legend" htmlFor="text">
        Texto
      </label>
      <p className="field__info" id="text-hint">
        As quebras de linha são mantidas.
      </p>
      <textarea
        id="text"
        className="textarea"
        rows={3}
        value={text}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? 'text-hint text-issue' : 'text-hint'}
        onChange={(event) => onChange(event.target.value)}
      />
      {invalid && (
        <p className="field__error" id="text-issue">
          {invalidMessage(invalid)}
        </p>
      )}
    </div>
  );
}

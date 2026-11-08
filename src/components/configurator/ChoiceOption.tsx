import { useId, type ReactNode } from 'react';

interface ChoiceOptionProps {
  readonly name: string;
  readonly value: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
  readonly children: ReactNode;
  /** Secondary text shown beside the label; it describes the option without naming it. */
  readonly description?: string;
}

/** A native radio input with a full-width, touch-friendly label. */
export function ChoiceOption({
  name,
  value,
  checked,
  disabled,
  onSelect,
  children,
  description,
}: ChoiceOptionProps) {
  const id = useId();
  return (
    <label className="choice">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        aria-labelledby={description === undefined ? undefined : `${id}-label`}
        aria-describedby={description === undefined ? undefined : `${id}-description`}
      />
      <span className="choice__label">
        <span id={`${id}-label`}>{children}</span>
        {description !== undefined && (
          <span className="choice__detail" id={`${id}-description`}>
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

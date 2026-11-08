import type { ReactNode } from 'react';

interface ChoiceOptionProps {
  readonly name: string;
  readonly value: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
  readonly children: ReactNode;
}

/** A native radio input with a full-width, touch-friendly label. */
export function ChoiceOption({
  name,
  value,
  checked,
  disabled,
  onSelect,
  children,
}: ChoiceOptionProps) {
  return (
    <label className="choice">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
      />
      <span className="choice__label">{children}</span>
    </label>
  );
}

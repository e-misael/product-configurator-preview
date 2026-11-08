interface InvalidSelectionProps {
  /** Element ID for the message, referenced by the field's `aria-describedby`. */
  readonly messageId: string;
  readonly title: string;
  readonly name: string;
  readonly message: string;
  readonly action?: { readonly label: string; readonly onClick: () => void };
}

/**
 * A selection that is still part of the configuration but no longer valid.
 * It stays visible until the user removes or replaces it (D-030).
 */
export function InvalidSelection({
  messageId,
  title,
  name,
  message,
  action,
}: InvalidSelectionProps) {
  return (
    <div className="invalid-selection">
      <p className="invalid-selection__title">{title}</p>
      <p className="invalid-selection__name">{name}</p>
      <p className="invalid-selection__message" id={messageId}>
        {message}
      </p>
      {action && (
        <button type="button" className="button" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

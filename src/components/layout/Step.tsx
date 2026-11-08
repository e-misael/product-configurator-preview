import type { ReactNode } from 'react';

interface StepProps {
  readonly id: string;
  readonly title: string;
  /** One line describing the current choice, shown beside the title. */
  readonly summary: string;
  readonly complete: boolean;
  /** Collapsible on narrow screens; always open, with a plain heading, otherwise. */
  readonly collapsible: boolean;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly children: ReactNode;
}

/**
 * One step of the customization (D-058). A collapsed step stays mounted with
 * `hidden`, so its inputs and local state are kept. The heading is a button
 * named by the title alone; the summary and state describe it.
 */
export function Step({
  id,
  title,
  summary,
  complete,
  collapsible,
  open,
  onToggle,
  children,
}: StepProps) {
  const expanded = !collapsible || open;
  const state = complete ? 'Concluído' : 'Pendente';
  return (
    <section
      className={`step${expanded ? ' step--open' : ''}`}
      aria-labelledby={`${id}-title`}
      data-step={id}
    >
      <h2 className="step__heading" id={`${id}-heading`}>
        {collapsible ? (
          <button
            type="button"
            className="step__toggle"
            aria-expanded={open}
            aria-controls={`${id}-body`}
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-summary`}
            onClick={(event) => {
              // Safari does not focus a tapped button; focus stays on the header everywhere.
              event.currentTarget.focus({ preventScroll: true });
              onToggle();
            }}
          >
            <StepLabel id={id} title={title} summary={summary} state={state} />
            <span className="step__chevron" aria-hidden="true" />
          </button>
        ) : (
          <StepLabel id={id} title={title} summary={summary} state={state} />
        )}
      </h2>
      <div className="step__body" id={`${id}-body`} hidden={!expanded}>
        {children}
      </div>
    </section>
  );
}

function StepLabel({
  id,
  title,
  summary,
  state,
}: {
  id: string;
  title: string;
  summary: string;
  state: string;
}) {
  return (
    <span className="step__label">
      <span className="step__title" id={`${id}-title`}>
        {title}
      </span>
      <span className="step__summary" id={`${id}-summary`}>
        <span className="step__state">{state}</span>
        {summary !== '' && ` · ${summary}`}
      </span>
    </span>
  );
}

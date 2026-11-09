import { useEffect, useRef, useState } from 'react';

interface RestartControlProps {
  /** Discards every choice and input but the note; called only after confirmation. */
  readonly onRestart: () => void;
}

/**
 * "Reiniciar configurações": asks once before clearing everything but the
 * note (D-070), because the text cannot be recovered. Focus moves to "Cancelar", the
 * safe choice, and back to the button when cancelled.
 */
export function RestartControl({ onRestart }: RestartControlProps) {
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (confirming) cancel.current?.focus();
    else if (asked.current) trigger.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <div className="restart">
        <button
          ref={trigger}
          type="button"
          className="button"
          onClick={() => {
            asked.current = true;
            setConfirming(true);
          }}
        >
          Reiniciar configurações
        </button>
      </div>
    );
  }
  return (
    <div className="restart" role="group" aria-labelledby="restart-warning">
      <p className="field__info" id="restart-warning">
        Reiniciar apaga o modelo, o texto, as cores e a posição; a observação é mantida. Deseja
        continuar?
      </p>
      <div className="restart__actions">
        <button type="button" className="button" onClick={onRestart}>
          Sim, reiniciar
        </button>
        <button ref={cancel} type="button" className="button" onClick={() => setConfirming(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

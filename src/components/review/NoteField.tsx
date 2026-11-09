interface NoteFieldProps {
  readonly note: string;
  readonly onNote: (note: string) => void;
}

/**
 * The optional note (D-062), in its own "Observação" section (D-078): stored
 * as typed, sent in the order message, never drawn on the image. The section
 * heading shows the name; the label stays for the field's accessible name.
 */
export function NoteField({ note, onNote }: NoteFieldProps) {
  return (
    <div className="field">
      <label className="visually-hidden" htmlFor="note">
        Observação
      </label>
      <p className="field__info" id="note-hint">
        Opcional. Não aparece na imagem exportada.
      </p>
      <textarea
        id="note"
        className="textarea"
        rows={3}
        value={note}
        aria-describedby="note-hint"
        onChange={(e) => onNote(e.target.value)}
      />
    </div>
  );
}

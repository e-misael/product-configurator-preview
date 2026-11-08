import type { FontFamily } from '../../domain';
import { ChoiceOption } from './ChoiceOption';

interface FontFieldProps {
  readonly fontFamily: FontFamily;
  readonly onChoose: (fontFamily: FontFamily) => void;
}

/** Provisional serif / sans-serif choice (D-042); the real typefaces are pending (P-14). */
export function FontField({ fontFamily, onChoose }: FontFieldProps) {
  return (
    <fieldset className="field">
      <legend className="field__legend">Fonte</legend>
      <div className="field__options">
        <ChoiceOption
          name="font"
          value="sans-serif"
          checked={fontFamily === 'sans-serif'}
          onSelect={() => onChoose('sans-serif')}
        >
          Sem serifa
        </ChoiceOption>
        <ChoiceOption
          name="font"
          value="serif"
          checked={fontFamily === 'serif'}
          onSelect={() => onChoose('serif')}
        >
          Com serifa
        </ChoiceOption>
      </div>
    </fieldset>
  );
}

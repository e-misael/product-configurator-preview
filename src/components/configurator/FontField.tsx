import type { FontFamily } from '../../domain';
import { ChoiceOption } from './ChoiceOption';

interface FontFieldProps {
  readonly fontFamily: FontFamily;
  readonly onChoose: (fontFamily: FontFamily) => void;
}

/**
 * Provisional serif / sans-serif choice (D-042); the real typefaces are pending (P-14).
 * "Sem serifa" is lettered in capitals only (D-068); the hint describes the chosen one.
 */
const FONT_HINTS: Readonly<Record<FontFamily, string>> = {
  'sans-serif': '"Sem serifa" usa somente letras maiúsculas.',
  serif: '"Com serifa" mantém maiúsculas e minúsculas como digitadas.',
};

export function FontField({ fontFamily, onChoose }: FontFieldProps) {
  return (
    <fieldset className="field font-field" aria-describedby="font-hint">
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
      <p className="field__info" id="font-hint">
        {FONT_HINTS[fontFamily]}
      </p>
    </fieldset>
  );
}

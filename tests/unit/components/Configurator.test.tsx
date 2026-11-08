import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/App';
import { testCatalog } from '../domain/fixtures';

function setup() {
  const user = userEvent.setup();
  render(<App catalog={testCatalog} />);
  return { user };
}

const group = (name: string) => screen.getByRole('group', { name });
const plateRadio = (id: string) =>
  within(group('Modelo')).getByRole('radio', { name: new RegExp(`^Test ${id} `) });
const status = () => screen.getByRole('region', { name: 'Situação da configuração' });
const preview = () => screen.getByRole('region', { name: 'Pré-visualização' });
/** "Revisar personalização" holds the summary, the status, the disclaimer, and export (D-058). */
const review = () => screen.getByRole('region', { name: 'Revisar personalização' });
/** The formatting announcement, in the text step next to the field. */
const formattingNotice = () =>
  within(screen.getByRole('region', { name: 'Texto e cores' })).getByRole('status');

describe('Configurator', () => {
  describe('Modelo', () => {
    it('lists only available models, labeled with their size', () => {
      setup();
      const radios = within(group('Modelo')).getAllByRole('radio');

      expect(radios.map((radio) => radio.getAttribute('value'))).toEqual([
        'test-plate-square',
        'test-plate-rectangle',
        'test-plate-circle',
        'test-plate-scalloped',
      ]);
      expect(radios[0]).toHaveAccessibleName('Test test-plate-square — Test size');
    });

    it('shows the fixed ceramic color as read-only information, not a choice', async () => {
      const { user } = setup();
      expect(within(group('Modelo')).queryByText(/Cor da peça/)).not.toBeInTheDocument();

      await user.click(plateRadio('test-plate-rectangle'));

      expect(plateRadio('test-plate-rectangle')).toBeChecked();
      expect(within(group('Modelo')).getByText(/Cor da peça:/)).toHaveTextContent(
        'Cor da peça: Test beige',
      );
      expect(screen.queryByRole('group', { name: /Cor da/ })).not.toBeInTheDocument();
      expect(screen.queryByText(/Formato/)).not.toBeInTheDocument();
    });
  });

  describe('no separate frame (D-046)', () => {
    it('offers no Moldura choice for any model, and the summary has no Moldura row', async () => {
      const { user } = setup();

      for (const id of ['test-plate-square', 'test-plate-rectangle', 'test-plate-circle']) {
        await user.click(plateRadio(id));
        expect(screen.queryByRole('group', { name: /Moldura/ })).not.toBeInTheDocument();
      }
      expect(within(review()).queryByText('Moldura')).not.toBeInTheDocument();
      expect(formattingNotice()).toBeEmptyDOMElement();
    });
  });

  describe('Texto', () => {
    it('stores the text exactly as typed, including line breaks', async () => {
      const { user } = setup();
      const field = screen.getByLabelText('Texto');

      await user.type(field, '  Casa da Ana{Enter}Desde 2024 ');

      expect(field).toHaveValue('  Casa da Ana\nDesde 2024 ');
      expect(field).toHaveAccessibleDescription('As quebras de linha são mantidas.');
      // "Sem serifa" (the default) is lettered in capitals; the stored text is unchanged (D-068).
      expect(field).toHaveClass('textarea--uppercase');
      expect(review().querySelector('.review__text')?.textContent).toBe(
        '  CASA DA ANA\nDESDE 2024 ',
      );
    });

    it('keeps mixed case for "Com serifa" and restores it after "Sem serifa" (D-068)', async () => {
      const { user } = setup();
      const field = screen.getByLabelText('Texto');
      const text = () => review().querySelector('.review__text')?.textContent;
      await user.type(field, 'Ação é já');

      expect(group('Fonte')).toHaveAccessibleDescription(/somente letras maiúsculas/);
      expect(text()).toBe('AÇÃO É JÁ');

      await user.click(within(group('Fonte')).getByRole('radio', { name: 'Com serifa' }));
      expect(field).toHaveValue('Ação é já');
      expect(field).not.toHaveClass('textarea--uppercase');
      expect(text()).toBe('Ação é já');

      await user.click(within(group('Fonte')).getByRole('radio', { name: 'Sem serifa' }));
      expect(text()).toBe('AÇÃO É JÁ');
      await user.click(within(group('Fonte')).getByRole('radio', { name: 'Com serifa' }));
      expect(text()).toBe('Ação é já');
    });

    it('marks blank text as invalid next to the field', async () => {
      const { user } = setup();
      const field = screen.getByLabelText('Texto');

      await user.type(field, '   ');

      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveAccessibleDescription(/O texto não pode ficar em branco\./);
    });
  });

  describe('Fonte e cores do texto', () => {
    const ink = (name: string) =>
      within(group('Cor do texto')).getByRole('radio', { name: `Test ${name}` });
    const secondary = (name: string) =>
      within(group('Segunda cor')).getByRole('radio', { name: `Test ${name}` });
    const disclosure = () => screen.getByRole('button', { name: 'Usar segunda cor' });
    const select = (start: number, end: number) => {
      const field = screen.getByLabelText<HTMLTextAreaElement>('Texto');
      field.setSelectionRange(start, end);
      fireEvent.select(field);
    };
    const apply = () => screen.getByRole('button', { name: 'Aplicar segunda cor à seleção' });
    const unapply = () => screen.getByRole('button', { name: 'Remover segunda cor da seleção' });
    const removeColor = () => screen.getByRole('button', { name: 'Remover segunda cor' });

    /** Text typed, primary ink A chosen, secondary ink B chosen, and the section open. */
    async function withSecondary(text: string) {
      const context = setup();
      await context.user.type(screen.getByLabelText('Texto'), text);
      await context.user.click(ink('ink A'));
      await context.user.click(disclosure());
      await context.user.click(secondary('ink B'));
      return context;
    }

    it('offers a font choice that defaults to sans-serif', async () => {
      const { user } = setup();
      const font = within(group('Fonte'));

      expect(font.getByRole('radio', { name: 'Sem serifa' })).toBeChecked();
      await user.click(font.getByRole('radio', { name: 'Com serifa' }));

      expect(font.getByRole('radio', { name: 'Com serifa' })).toBeChecked();
      expect(within(review()).getByText('Com serifa')).toBeInTheDocument();
    });

    it('shows the primary colors as labeled swatch radios, none preselected', async () => {
      const { user } = setup();

      const radios = within(group('Cor do texto')).getAllByRole('radio');
      expect(radios.map((radio) => radio.getAttribute('value'))).toEqual([
        'test-text-color-a',
        'test-text-color-b',
      ]);
      for (const radio of radios) expect(radio).not.toBeChecked();
      // The chip is decoration; the color is named in text, never by color alone.
      expect(ink('ink A').closest('label')?.querySelector('[aria-hidden="true"]')).toHaveStyle({
        backgroundColor: '#112233',
      });

      await user.click(ink('ink B'));
      expect(ink('ink B')).toBeChecked();
      expect(within(review()).getByText('Test ink B')).toBeInTheDocument();
    });

    it('shows the color name only on the selected chip, keeping every accessible name', async () => {
      const { user } = setup();
      const nameOf = (label: string) =>
        within(group('Cor do texto')).getByText(label, { selector: 'label span' });

      // Nothing selected: chips only; names for assistive technology and as tooltips.
      expect(nameOf('Test ink A')).toHaveClass('visually-hidden');
      expect(nameOf('Test ink B')).toHaveClass('visually-hidden');
      expect(ink('ink A').closest('label')).toHaveAttribute('title', 'Test ink A');

      await user.click(ink('ink B'));
      expect(nameOf('Test ink B')).toHaveClass('swatch-option__name');
      expect(nameOf('Test ink B')).not.toHaveClass('visually-hidden');
      expect(ink('ink B').closest('label')).not.toHaveAttribute('title');
      expect(nameOf('Test ink A')).toHaveClass('visually-hidden');
      expect(ink('ink A')).toHaveAccessibleName('Test ink A');
    });

    it('hides the second color behind "Usar segunda cor" until requested', async () => {
      const { user } = setup();
      await user.type(screen.getByLabelText('Texto'), 'Casa');
      await user.click(ink('ink A'));

      expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('group', { name: 'Segunda cor' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /segunda cor à seleção/ })).toBeNull();

      await user.click(disclosure());

      expect(disclosure()).toHaveAttribute('aria-expanded', 'true');
      expect(document.getElementById(disclosure().getAttribute('aria-controls') ?? '')).toBe(
        group('Segunda cor').parentElement,
      );
      // Range actions appear only once a second color is chosen.
      expect(screen.queryByRole('button', { name: /segunda cor à seleção/ })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Remover segunda cor' })).toBeNull();
    });

    it('applies the second color only to the selection, keeping the text unchanged', async () => {
      const { user } = await withSecondary('Casa da Ana');
      expect(screen.getByText('Nenhum trecho com a segunda cor.')).toBeInTheDocument();

      select(0, 4);
      // The selection is named next to the actions (D-068).
      expect(screen.getByText('Seleção: “CASA”')).toBeInTheDocument();
      await user.click(apply());

      expect(screen.getByLabelText('Texto')).toHaveValue('Casa da Ana');
      expect(screen.getByText('Segunda cor aplicada a “CASA”.')).toBeInTheDocument();
      expect(screen.getByText('1 trecho com a segunda cor.')).toBeInTheDocument();
      expect(within(review()).getByText(/1 trecho/)).toBeInTheDocument();
    });

    it('never disables the actions: without a selection they say what to do (D-068)', async () => {
      const { user } = await withSecondary('Casa da Ana');
      expect(apply()).toBeEnabled();
      expect(apply()).toHaveAccessibleDescription(/Selecione as letras no campo Texto/);

      await user.click(apply());
      expect(screen.getByText(/^Nenhuma letra selecionada\. Selecione no campo Texto/)).toHaveClass(
        'field__error',
      );
      expect(screen.getByText('Nenhum trecho com a segunda cor.')).toBeInTheDocument();

      await user.click(unapply());
      expect(screen.getByText(/^Nenhuma letra selecionada\. Selecione/)).toBeInTheDocument();
    });

    it('applies a selection made before the color, after focus moved away (D-068)', async () => {
      const { user } = setup();
      const field = screen.getByLabelText<HTMLTextAreaElement>('Texto');
      await user.type(field, 'Casa da Ana');
      await user.click(ink('ink A'));
      // Selected without a mouse or key release (as by touch), then focus leaves the field.
      field.focus();
      field.setSelectionRange(8, 11);
      fireEvent(document, new Event('selectionchange'));
      await user.click(disclosure());
      await user.click(secondary('ink B'));
      expect(field).not.toHaveFocus();

      await user.click(apply());
      expect(screen.getByText('Segunda cor aplicada a “ANA”.')).toBeInTheDocument();
      expect(screen.getByText('1 trecho com a segunda cor.')).toBeInTheDocument();
    });

    it('removes the second color from a selection but keeps the chosen color', async () => {
      const { user } = await withSecondary('Casa');
      select(0, 4);
      await user.click(apply());
      expect(unapply()).toBeEnabled();

      select(0, 4);
      await user.click(unapply());

      expect(screen.getByText('Nenhum trecho com a segunda cor.')).toBeInTheDocument();
      expect(secondary('ink B')).toBeChecked();
    });

    it('disables the secondary swatch equal to the primary color', async () => {
      const { user } = setup();
      await user.click(ink('ink A'));
      await user.click(disclosure());

      expect(secondary('ink A')).toBeDisabled();
      expect(secondary('ink B')).toBeEnabled();
    });

    it('keeps the color and its trechos when the section is collapsed', async () => {
      const { user } = await withSecondary('Casa');
      select(1, 3);
      await user.click(apply());

      await user.click(disclosure());

      expect(disclosure()).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('group', { name: 'Segunda cor' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /segunda cor à seleção/ })).toBeNull();
      expect(screen.getByText('Segunda cor em uso: Test ink B (1 trecho).')).toBeInTheDocument();
      expect(within(review()).getByText('Test ink B (1 trecho)')).toBeInTheDocument();

      await user.click(disclosure());
      expect(secondary('ink B')).toBeChecked();
      expect(screen.getByText('1 trecho com a segunda cor.')).toBeInTheDocument();
    });

    it('clears the color and every trecho with "Remover segunda cor"', async () => {
      const { user } = await withSecondary('Casa');
      select(1, 3);
      await user.click(apply());

      await user.click(removeColor());

      expect(secondary('ink B')).not.toBeChecked();
      expect(screen.queryByRole('button', { name: /segunda cor à seleção/ })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Remover segunda cor' })).toBeNull();
      expect(disclosure()).toHaveFocus();
      expect(within(review()).queryByText(/trecho/)).not.toBeInTheDocument();
    });

    it('keeps an equal-to-primary second color visible and invalid until changed', async () => {
      const { user } = await withSecondary('Casa');
      await user.click(disclosure());

      await user.click(ink('ink B'));

      // The section cannot hide an invalid choice (D-030).
      expect(screen.queryByRole('button', { name: 'Usar segunda cor' })).toBeNull();
      expect(group('Segunda cor')).toHaveAccessibleDescription(
        'A segunda cor deve ser diferente da cor do texto.',
      );
      await user.click(removeColor());
      expect(screen.queryByRole('group', { name: 'Segunda cor' })).not.toBeInTheDocument();
    });

    it('keeps the trecho on the same characters when the text is edited', async () => {
      const { user } = await withSecondary('aaaa');
      const field = screen.getByLabelText<HTMLTextAreaElement>('Texto');
      select(0, 4);
      await user.click(apply());

      // The caret after the edit locates it: the last character was deleted.
      // (Ambiguous edits without usable caret data are covered in the hook tests.)
      fireEvent.change(field, { target: { value: 'aaa' } });

      expect(field).toHaveValue('aaa');
      expect(screen.getByText('1 trecho com a segunda cor.')).toBeInTheDocument();
      expect(formattingNotice()).toBeEmptyDOMElement();
    });

    it('shows the approved three-paragraph disclaimer (D-056)', () => {
      setup();

      for (const paragraph of [
        'A pré-visualização é ilustrativa. Como nossas peças são produzidas artesanalmente, o produto final pode apresentar pequenas variações de formato, textura, acabamento, posicionamento das letras e tonalidade das cores em relação à imagem exibida na tela.',
        'As cores também podem variar conforme a iluminação, as características da cerâmica e as configurações de cada dispositivo.',
        'Todas as solicitações de personalização estão sujeitas à análise e aprovação da Taavi.',
      ]) {
        expect(screen.getByText(paragraph).tagName).toBe('P');
      }
    });
  });

  describe('status and preview', () => {
    it('lists missing fields, then reports completion', async () => {
      const { user } = setup();

      expect(status()).toHaveTextContent('Falta escolher: Modelo, Texto, Cor do texto.');

      await user.click(plateRadio('test-plate-square'));
      expect(status()).toHaveTextContent('Falta escolher: Texto, Cor do texto.');

      await user.type(screen.getByLabelText('Texto'), 'Ana');
      expect(status()).toHaveTextContent('Falta escolher: Cor do texto.');

      await user.click(within(group('Cor do texto')).getByRole('radio', { name: 'Test ink A' }));
      expect(status()).toHaveTextContent('Configuração completa.');
    });

    it('shows the selection and what is still needed, without product imagery', async () => {
      const { user } = setup();
      await user.click(plateRadio('test-plate-square'));

      expect(
        within(preview()).getByText('A foto deste modelo ainda não está disponível.'),
      ).toBeInTheDocument();
      // Model and size are separate summary rows (D-057).
      expect(within(review()).getByText('Test test-plate-square')).toBeInTheDocument();
      expect(within(review()).getByText('Test size')).toBeInTheDocument();
      expect(within(review()).getByText('Test beige')).toBeInTheDocument();
      // The test catalog registers no images, so nothing is painted and nothing is substituted.
      expect(preview().querySelector('img, svg, canvas')).toBeNull();
    });
  });

  describe('Observação (D-062)', () => {
    it('is an optional field in the review, before export, kept exactly as typed', async () => {
      const { user } = setup();
      const note = within(review()).getByRole('textbox', { name: 'Observação' });
      const exportButton = within(review()).getByRole('button', { name: 'Exportar imagem' });

      expect(note).toHaveValue('');
      expect(note).toHaveAccessibleDescription('Opcional. Não aparece na imagem exportada.');
      expect(note.compareDocumentPosition(exportButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );

      await user.click(plateRadio('test-plate-square'));
      await user.type(screen.getByLabelText('Texto'), 'Ana');
      await user.click(within(group('Cor do texto')).getByRole('radio', { name: 'Test ink A' }));
      await user.type(note, '  Entregar até sexta\nObrigada ');

      expect(note).toHaveValue('  Entregar até sexta\nObrigada ');
      // Never validated and never required.
      expect(status()).toHaveTextContent('Configuração completa.');
      await user.clear(note);
      expect(status()).toHaveTextContent('Configuração completa.');
    });
  });
});

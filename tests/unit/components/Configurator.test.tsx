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
      within(group('Cor de destaque')).getByRole('radio', { name: `Test ${name}` });
    const highlight = () => screen.getByRole('switch', { name: 'Destacar parte(s) do texto' });
    const words = () => group('Toque nas palavras que deseja destacar');
    const word = (name: string) => within(words()).getByRole('button', { name });
    const pressed = () =>
      within(words())
        .getAllByRole('button')
        .filter((button) => button.getAttribute('aria-pressed') === 'true')
        .map((button) => button.textContent?.replace('✓ ', ''));
    const issuesText = () => status().textContent ?? '';
    const highlightRow = () => within(review()).getByText('Destaque:').nextElementSibling;

    /** Text typed, primary ink A, highlighting on, and highlight ink B. */
    async function withHighlight(text: string) {
      const context = setup();
      await context.user.type(screen.getByLabelText('Texto'), text);
      await context.user.click(ink('ink A'));
      await context.user.click(highlight());
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

    it('shows highlighting as one switch in "Cores do texto", off at first (D-071)', async () => {
      const { user } = setup();
      await user.type(screen.getByLabelText('Texto'), 'Casa');

      expect(group('Cores do texto')).toContainElement(group('Cor do texto'));
      expect(highlight()).not.toBeChecked();
      expect(screen.queryByRole('group', { name: 'Cor de destaque' })).not.toBeInTheDocument();
      expect(screen.queryByText('Toque nas palavras que deseja destacar')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /segunda cor/ })).toBeNull();

      await user.click(highlight());
      expect(highlight()).toBeChecked();
      expect(group('Cor de destaque')).toBeVisible();
      expect(words()).toBeVisible();
    });

    it('shows the name only on the selected highlight color, and disables the primary', async () => {
      await withHighlight('Casa');
      const nameOf = (label: string) =>
        within(group('Cor de destaque')).getByText(label, { selector: 'label span' });

      expect(nameOf('Test ink B')).toHaveClass('swatch-option__name');
      expect(nameOf('Test ink A')).toHaveClass('visually-hidden');
      expect(secondary('ink A')).toBeDisabled();
      expect(secondary('ink A')).toHaveAccessibleName('Test ink A');
    });

    it('highlights several words at once, keeping the text unchanged', async () => {
      const { user } = await withHighlight('Casa da Ana');

      await user.click(word('CASA'));
      await user.click(word('ANA'));

      expect(pressed()).toEqual(['CASA', 'ANA']);
      expect(screen.getByLabelText('Texto')).toHaveValue('Casa da Ana');
      expect(screen.getByText('2 palavras destacadas.')).toBeInTheDocument();
      expect(highlightRow()).toHaveTextContent('Test ink B: CASA, ANA');
    });

    it('selects repeated words independently, by occurrence', async () => {
      const { user } = await withHighlight('Ana e Ana');

      await user.click(word('ANA (2ª de 2)'));

      expect(word('ANA (1ª de 2)')).toHaveAttribute('aria-pressed', 'false');
      expect(word('ANA (2ª de 2)')).toHaveAttribute('aria-pressed', 'true');
      expect(word('E')).toHaveAttribute('aria-pressed', 'false');
    });

    it('restores the primary color when a highlighted word is tapped again', async () => {
      const { user } = await withHighlight('Casa da Ana');
      await user.click(word('DA'));
      await user.click(word('DA'));

      expect(pressed()).toEqual([]);
      expect(screen.getByText('Nenhuma palavra destacada.')).toBeInTheDocument();
      expect(highlightRow()).toHaveTextContent('—');
    });

    it('accepts every word highlighted (D-071)', async () => {
      const { user } = await withHighlight('Casa da Ana');
      await user.click(plateRadio('test-plate-square'));
      for (const name of ['CASA', 'DA', 'ANA']) await user.click(word(name));

      expect(pressed()).toEqual(['CASA', 'DA', 'ANA']);
      expect(issuesText()).not.toMatch(/destaque/i);
    });

    it('stays valid with highlighting on and no word, without a highlight color', async () => {
      const { user } = setup();
      await user.type(screen.getByLabelText('Texto'), 'Casa');
      await user.click(ink('ink A'));
      await user.click(highlight());

      expect(screen.queryByText('Escolha a cor de destaque.')).toBeNull();
      expect(issuesText()).not.toMatch(/destaque/i);

      // A highlighted word needs a highlight color.
      await user.click(word('CASA'));
      expect(screen.getByText('Escolha a cor de destaque.')).toBeInTheDocument();
      expect(issuesText()).toMatch(/Cor de destaque/);
      await user.click(secondary('ink B'));
      expect(screen.queryByText('Escolha a cor de destaque.')).toBeNull();
    });

    it('keeps accented words and punctuation, with punctuation never selectable', async () => {
      const { user } = await withHighlight("Ação, d'água e guarda-chuva!");

      expect(
        within(words())
          .getAllByRole('button')
          .map((b) => b.textContent),
      ).toEqual(['AÇÃO', "D'ÁGUA", 'E', 'GUARDA-CHUVA']);
      expect(within(words()).getByText('!')).toBeInTheDocument();
      await user.click(word('AÇÃO'));
      await user.click(word('GUARDA-CHUVA'));
      expect(highlightRow()).toHaveTextContent('Test ink B: AÇÃO, GUARDA-CHUVA');
    });

    it('keeps the line breaks of the text between the words', async () => {
      const { user } = setup();
      fireEvent.change(screen.getByLabelText('Texto'), { target: { value: 'Ana\nBia' } });
      await user.click(ink('ink A'));
      await user.click(highlight());

      expect(words().querySelectorAll('br')).toHaveLength(1);
    });

    it('turning highlighting off draws one color but keeps the words for later', async () => {
      const { user } = await withHighlight('Casa da Ana');
      await user.click(word('CASA'));

      await user.click(highlight());
      expect(highlight()).not.toBeChecked();
      expect(highlightRow()).toHaveTextContent('—');
      expect(
        screen.getByText('Destaque desativado: 1 palavra em Test ink B ficam guardadas.'),
      ).toBeInTheDocument();

      await user.click(highlight());
      expect(pressed()).toEqual(['CASA']);
      expect(secondary('ink B')).toBeChecked();
      expect(highlightRow()).toHaveTextContent('Test ink B: CASA');
    });

    it('changes the highlight color for every highlighted word', async () => {
      const { user } = setup();
      await user.type(screen.getByLabelText('Texto'), 'Casa da Ana');
      await user.click(ink('ink B'));
      await user.click(highlight());
      await user.click(word('CASA'));
      await user.click(secondary('ink A'));

      expect(highlightRow()).toHaveTextContent('Test ink A: CASA');
    });

    it('swaps the colors when the highlight color is chosen as the text color', async () => {
      const { user } = await withHighlight('Casa da Ana');
      await user.click(word('ANA'));

      await user.click(ink('ink B'));

      expect(ink('ink B')).toBeChecked();
      expect(secondary('ink A')).toBeChecked();
      expect(secondary('ink B')).toBeDisabled();
      expect(pressed()).toEqual(['ANA']);
      expect(
        screen.getByText('As cores foram trocadas: destaque agora em Test ink A.'),
      ).toBeInTheDocument();
      expect(highlightRow()).toHaveTextContent('Test ink A: ANA');
    });

    it('keeps a highlight on an unchanged word when the text is edited', async () => {
      const { user } = await withHighlight('Casa da Ana');
      const field = screen.getByLabelText<HTMLTextAreaElement>('Texto');
      await user.click(word('ANA'));

      // Typed at the end: "Ana" itself is unchanged.
      fireEvent.change(field, { target: { value: 'Casa da Ana!', selectionStart: 12 } });
      expect(pressed()).toEqual(['ANA']);
      expect(formattingNotice()).toBeEmptyDOMElement();

      // Editing the highlighted word removes its highlight, and says so.
      fireEvent.change(field, { target: { value: 'Casa da Anas!', selectionStart: 12 } });
      expect(pressed()).toEqual([]);
      expect(formattingNotice()).toHaveTextContent(/O destaque foi removido/);
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

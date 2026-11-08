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
const frameRadio = (name: string) =>
  within(group('Moldura (opcional)')).getByRole('radio', { name });
const status = () => screen.getByRole('region', { name: 'Situação da configuração' });
const preview = () => screen.getByRole('region', { name: 'Pré-visualização' });

describe('Configurator', () => {
  describe('Modelo', () => {
    it('lists only available models, labeled with their size', () => {
      setup();
      const radios = within(group('Modelo')).getAllByRole('radio');

      expect(radios.map((radio) => radio.getAttribute('value'))).toEqual([
        'test-plate-square',
        'test-plate-rectangle',
        'test-plate-square-b',
        'test-plate-circle',
        'test-plate-scalloped',
        'test-plate-square-frameless',
      ]);
      expect(radios[0]).toHaveAccessibleName('Test test-plate-square (Test size)');
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

  describe('Moldura', () => {
    const frames = () => screen.queryByRole('group', { name: 'Moldura (opcional)' });

    it('is hidden until a model that takes a frame is chosen', async () => {
      const { user } = setup();
      expect(frames()).not.toBeInTheDocument();

      await user.click(plateRadio('test-plate-square-frameless'));
      expect(frames()).not.toBeInTheDocument();

      await user.click(plateRadio('test-plate-circle'));
      expect(frames()).not.toBeInTheDocument();

      await user.click(plateRadio('test-plate-scalloped'));
      expect(frames()).not.toBeInTheDocument();
    });

    it('offers only the frames compatible with the model', async () => {
      const { user } = setup();

      await user.click(plateRadio('test-plate-rectangle'));

      const names = within(group('Moldura (opcional)'))
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value'));
      expect(names).toEqual(['', 'test-frame-any']);
      expect(frameRadio('Sem moldura')).toBeChecked();
    });

    it('clears the frame when switching to a frameless model and announces it', async () => {
      const { user } = setup();

      await user.click(plateRadio('test-plate-square'));
      await user.click(frameRadio('Test frame square and rectangle'));
      await user.click(plateRadio('test-plate-circle'));

      expect(screen.getByRole('status')).toHaveTextContent(
        'A moldura foi removida porque o modelo escolhido não aceita moldura.',
      );
      expect(frames()).not.toBeInTheDocument();
      expect(within(preview()).getByText('Sem moldura')).toBeInTheDocument();

      await user.type(screen.getByLabelText('Texto'), 'A');
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });
  });

  describe('M-1: a frame that becomes incompatible after a model change', () => {
    it.each([
      [
        'restricted to another plate',
        'test-plate-square-b',
        'Test frame square, test-plate-square only',
        'Esta moldura não é compatível com este modelo.',
      ],
      [
        'of another shape',
        'test-plate-rectangle',
        'Test frame square',
        'Esta moldura não serve no formato deste modelo.',
      ],
    ])('stays visible and invalid when %s', async (_label, nextPlate, frameName, message) => {
      const { user } = setup();

      // Start compatible.
      await user.click(plateRadio('test-plate-square'));
      await user.click(frameRadio(frameName));
      expect(frameRadio(frameName)).toBeChecked();
      expect(screen.queryByText('Moldura selecionada (incompatível)')).not.toBeInTheDocument();

      // Switch to a model that supports frames, but not this one.
      await user.click(plateRadio(nextPlate));

      const frames = group('Moldura (opcional)');
      expect(within(frames).getByText('Moldura selecionada (incompatível)')).toBeInTheDocument();
      expect(within(frames).getByText(frameName)).toBeInTheDocument();
      expect(within(frames).getByText(message)).toBeInTheDocument();
      expect(frames).toHaveAccessibleDescription(message);
      expect(frameRadio('Sem moldura')).not.toBeChecked();
      expect(screen.queryByRole('status')).toBeEmptyDOMElement();
      expect(within(status()).getByText(/Há escolhas incompatíveis/)).toBeInTheDocument();
      expect(within(preview()).getByText(frameName)).toBeInTheDocument();
      expect(within(preview()).queryByText('Sem moldura')).not.toBeInTheDocument();
    });

    it('can be removed', async () => {
      const { user } = setup();
      await user.click(plateRadio('test-plate-square'));
      await user.click(frameRadio('Test frame square'));
      await user.click(plateRadio('test-plate-rectangle'));

      await user.click(
        within(group('Moldura (opcional)')).getByRole('button', { name: 'Remover moldura' }),
      );

      expect(screen.queryByText('Moldura selecionada (incompatível)')).not.toBeInTheDocument();
      expect(frameRadio('Sem moldura')).toBeChecked();
      expect(within(preview()).getByText('Sem moldura')).toBeInTheDocument();
    });

    it('can be replaced with a compatible frame', async () => {
      const { user } = setup();
      await user.click(plateRadio('test-plate-square'));
      await user.click(frameRadio('Test frame square'));
      await user.click(plateRadio('test-plate-rectangle'));

      await user.click(frameRadio('Test frame square and rectangle'));

      expect(screen.queryByText('Moldura selecionada (incompatível)')).not.toBeInTheDocument();
      expect(frameRadio('Test frame square and rectangle')).toBeChecked();
      expect(within(status()).queryByText(/Há escolhas incompatíveis/)).not.toBeInTheDocument();
    });
  });

  describe('Texto', () => {
    it('stores the text exactly as typed, including line breaks', async () => {
      const { user } = setup();
      const field = screen.getByLabelText('Texto');

      await user.type(field, '  Casa da Ana{Enter}Desde 2024 ');

      expect(field).toHaveValue('  Casa da Ana\nDesde 2024 ');
      expect(field).toHaveAccessibleDescription('As quebras de linha são mantidas.');
      expect(preview().querySelector('.preview__text')?.textContent).toBe(
        '  Casa da Ana\nDesde 2024 ',
      );
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
      within(group('Segunda cor (opcional)')).getByRole('radio', { name });
    const select = (start: number, end: number) => {
      const field = screen.getByLabelText<HTMLTextAreaElement>('Texto');
      field.setSelectionRange(start, end);
      fireEvent.select(field);
    };
    const apply = () => screen.getByRole('button', { name: 'Aplicar segunda cor à seleção' });
    const remove = () => screen.getByRole('button', { name: 'Remover segunda cor da seleção' });

    it('offers a font choice that defaults to sans-serif', async () => {
      const { user } = setup();
      const font = within(group('Fonte'));

      expect(font.getByRole('radio', { name: 'Sem serifa' })).toBeChecked();
      await user.click(font.getByRole('radio', { name: 'Com serifa' }));

      expect(font.getByRole('radio', { name: 'Com serifa' })).toBeChecked();
      expect(within(preview()).getByText('Com serifa')).toBeInTheDocument();
    });

    it('requires an explicit primary color: none is preselected', () => {
      setup();

      const radios = within(group('Cor do texto')).getAllByRole('radio');
      expect(radios.length).toBeGreaterThan(0);
      for (const radio of radios) expect(radio).not.toBeChecked();
    });

    it('applies the second color only to the selection, keeping the text unchanged', async () => {
      const { user } = setup();
      await user.type(screen.getByLabelText('Texto'), 'Casa da Ana');
      await user.click(ink('ink A'));
      expect(screen.queryByRole('button', { name: /segunda cor à seleção/ })).toBeNull();

      await user.click(secondary('Test ink B'));
      expect(apply()).toBeDisabled();
      expect(screen.getByText('Nenhum trecho com a segunda cor.')).toBeInTheDocument();

      select(0, 4);
      expect(apply()).toBeEnabled();
      await user.click(apply());

      expect(screen.getByLabelText('Texto')).toHaveValue('Casa da Ana');
      expect(screen.getByText('1 trecho com a segunda cor.')).toBeInTheDocument();
      expect(within(preview()).getByText(/1 trecho/)).toBeInTheDocument();
    });

    it('removes the second color from a selection but keeps the chosen color', async () => {
      const { user } = setup();
      await user.type(screen.getByLabelText('Texto'), 'Casa');
      await user.click(ink('ink A'));
      await user.click(secondary('Test ink B'));
      select(0, 4);
      await user.click(apply());
      expect(remove()).toBeEnabled();

      select(0, 4);
      await user.click(remove());

      expect(screen.getByText('Nenhum trecho com a segunda cor.')).toBeInTheDocument();
      expect(secondary('Test ink B')).toBeChecked();
    });

    it('disables the secondary option equal to the primary color', async () => {
      const { user } = setup();
      await user.click(ink('ink A'));

      expect(secondary('Test ink A')).toBeDisabled();
      expect(secondary('Test ink B')).toBeEnabled();
    });

    it('clears the color and its trechos with "Sem segunda cor"', async () => {
      const { user } = setup();
      await user.type(screen.getByLabelText('Texto'), 'Casa');
      await user.click(ink('ink A'));
      await user.click(secondary('Test ink B'));
      select(1, 3);
      await user.click(apply());

      await user.click(secondary('Sem segunda cor'));

      expect(secondary('Sem segunda cor')).toBeChecked();
      expect(screen.queryByRole('button', { name: /segunda cor à seleção/ })).toBeNull();
    });

    it('keeps the trecho on the same characters when the text is edited', async () => {
      const { user } = setup();
      const field = screen.getByLabelText<HTMLTextAreaElement>('Texto');
      await user.type(field, 'aaaa');
      await user.click(ink('ink A'));
      await user.click(secondary('Test ink B'));
      select(0, 4);
      await user.click(apply());

      // The caret after the edit locates it: the last character was deleted.
      // (Ambiguous edits without usable caret data are covered in the hook tests.)
      fireEvent.change(field, { target: { value: 'aaa' } });

      expect(field).toHaveValue('aaa');
      expect(screen.getByText('1 trecho com a segunda cor.')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it('shows the handmade-product disclaimer', () => {
      setup();

      expect(
        screen.getByText(
          'Todas as solicitações de personalização estão sujeitas à análise da Taavi. Como nossas peças são produzidas artesanalmente, podem apresentar pequenas variações de formato, cor, acabamento e posicionamento em relação à pré-visualização.',
        ),
      ).toBeInTheDocument();
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
      expect(within(preview()).getByText('Test test-plate-square (Test size)')).toBeInTheDocument();
      expect(within(preview()).getByText('Test beige')).toBeInTheDocument();
      // The test catalog registers no images, so nothing is painted and nothing is substituted.
      expect(preview().querySelector('img, svg, canvas')).toBeNull();
    });
  });
});

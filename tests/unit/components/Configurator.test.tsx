import { render, screen, within } from '@testing-library/react';
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
  within(group('Placa')).getByRole('radio', { name: new RegExp(`^Test ${id} `) });
const frameRadio = (name: string) => within(group('Quadro')).getByRole('radio', { name });
const status = () => screen.getByRole('region', { name: 'Situação da configuração' });
const preview = () => screen.getByRole('region', { name: 'Pré-visualização' });

describe('Configurator', () => {
  describe('Placa', () => {
    it('lists only available plates', () => {
      setup();
      const names = within(group('Placa'))
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value'));

      expect(names).toEqual([
        'test-plate-square',
        'test-plate-rectangle',
        'test-plate-square-b',
        'test-plate-circle',
        'test-plate-square-frameless',
      ]);
    });

    it('shows the shape derived from the chosen plate', async () => {
      const { user } = setup();

      await user.click(plateRadio('test-plate-rectangle'));

      expect(plateRadio('test-plate-rectangle')).toBeChecked();
      expect(within(group('Placa')).getByText('Formato da placa:')).toHaveTextContent(
        'Formato da placa: Retangular',
      );
    });
  });

  describe('Quadro', () => {
    it('asks for a plate before listing frames', () => {
      setup();
      expect(
        within(group('Quadro')).getByText('Escolha uma placa para ver os quadros disponíveis.'),
      ).toBeInTheDocument();
      expect(within(group('Quadro')).queryByRole('radio')).not.toBeInTheDocument();
    });

    it('offers only the frames compatible with the plate', async () => {
      const { user } = setup();

      await user.click(plateRadio('test-plate-rectangle'));

      const names = within(group('Quadro'))
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value'));
      expect(names).toEqual(['', 'test-frame-any']);
      expect(frameRadio('Sem quadro')).toBeChecked();
    });

    it('explains that a frameless plate does not accept a frame', async () => {
      const { user } = setup();

      await user.click(plateRadio('test-plate-square-frameless'));

      expect(frameRadio('Sem quadro')).toBeChecked();
      expect(frameRadio('Sem quadro')).toBeDisabled();
      expect(
        within(group('Quadro')).getByText('Esta placa não aceita quadro.'),
      ).toBeInTheDocument();
    });

    it('clears the frame when switching to a circular plate and announces it', async () => {
      const { user } = setup();

      await user.click(plateRadio('test-plate-square'));
      await user.click(frameRadio('Test frame square and rectangle'));
      await user.click(plateRadio('test-plate-circle'));

      expect(screen.getByRole('status')).toHaveTextContent(
        'O quadro foi removido porque a placa escolhida não aceita quadro.',
      );
      expect(frameRadio('Sem quadro')).toBeChecked();
      expect(within(preview()).getByText('Sem quadro')).toBeInTheDocument();

      await user.type(screen.getByLabelText('Texto'), 'A');
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });
  });

  describe('M-1: a frame that becomes incompatible after a plate change', () => {
    it.each([
      [
        'restricted to another plate',
        'test-plate-square-b',
        'Test frame square, test-plate-square only',
        'Este quadro não é compatível com esta placa.',
      ],
      [
        'of another shape',
        'test-plate-rectangle',
        'Test frame square',
        'Este quadro não serve no formato desta placa.',
      ],
    ])('stays visible and invalid when %s', async (_label, nextPlate, frameName, message) => {
      const { user } = setup();

      // Start compatible.
      await user.click(plateRadio('test-plate-square'));
      await user.click(frameRadio(frameName));
      expect(frameRadio(frameName)).toBeChecked();
      expect(screen.queryByText('Quadro selecionado (incompatível)')).not.toBeInTheDocument();

      // Switch to a plate that supports frames, but not this one.
      await user.click(plateRadio(nextPlate));

      const frames = group('Quadro');
      expect(within(frames).getByText('Quadro selecionado (incompatível)')).toBeInTheDocument();
      expect(within(frames).getByText(frameName)).toBeInTheDocument();
      expect(within(frames).getByText(message)).toBeInTheDocument();
      expect(frames).toHaveAccessibleDescription(message);
      expect(frameRadio('Sem quadro')).not.toBeChecked();
      expect(screen.queryByRole('status')).toBeEmptyDOMElement();
      expect(within(status()).getByText(/Há escolhas incompatíveis/)).toBeInTheDocument();
      expect(within(preview()).getByText(frameName)).toBeInTheDocument();
      expect(within(preview()).queryByText('Sem quadro')).not.toBeInTheDocument();
    });

    it('can be removed', async () => {
      const { user } = setup();
      await user.click(plateRadio('test-plate-square'));
      await user.click(frameRadio('Test frame square'));
      await user.click(plateRadio('test-plate-rectangle'));

      await user.click(within(group('Quadro')).getByRole('button', { name: 'Remover quadro' }));

      expect(screen.queryByText('Quadro selecionado (incompatível)')).not.toBeInTheDocument();
      expect(frameRadio('Sem quadro')).toBeChecked();
      expect(within(preview()).getByText('Sem quadro')).toBeInTheDocument();
    });

    it('can be replaced with a compatible frame', async () => {
      const { user } = setup();
      await user.click(plateRadio('test-plate-square'));
      await user.click(frameRadio('Test frame square'));
      await user.click(plateRadio('test-plate-rectangle'));

      await user.click(frameRadio('Test frame square and rectangle'));

      expect(screen.queryByText('Quadro selecionado (incompatível)')).not.toBeInTheDocument();
      expect(frameRadio('Test frame square and rectangle')).toBeChecked();
      expect(within(status()).queryByText(/Há escolhas incompatíveis/)).not.toBeInTheDocument();
    });
  });

  describe('Cor da placa', () => {
    it('asks for a plate before listing colors', () => {
      setup();
      expect(
        screen.getByText('Escolha uma placa para ver as cores disponíveis.'),
      ).toBeInTheDocument();
    });

    it('offers the plate categories and their available shades', async () => {
      const { user } = setup();
      await user.click(plateRadio('test-plate-square'));

      await user.click(within(group('Cor da placa')).getByRole('radio', { name: 'Colorida' }));

      const shades = group('Tom específico (opcional)');
      expect(within(shades).getByRole('radio', { name: 'Sem preferência de tom' })).toBeChecked();
      await user.click(within(shades).getByRole('radio', { name: 'Test colored' }));
      expect(within(preview()).getByText('Colorida · Test colored')).toBeInTheDocument();

      await user.click(within(group('Cor da placa')).getByRole('radio', { name: 'Nude' }));
      // Retired shades are not offered.
      expect(
        within(group('Tom específico (opcional)')).queryByRole('radio', { name: 'Test retired' }),
      ).not.toBeInTheDocument();
    });

    it('keeps a shade from another category visible and removable', async () => {
      const { user } = setup();
      await user.click(plateRadio('test-plate-square'));
      await user.click(within(group('Cor da placa')).getByRole('radio', { name: 'Colorida' }));
      await user.click(screen.getByRole('radio', { name: 'Test colored' }));

      await user.click(within(group('Cor da placa')).getByRole('radio', { name: 'Nude' }));

      expect(screen.getByText('Tom selecionado (incompatível)')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Remover tom' }));
      expect(screen.queryByText('Tom selecionado (incompatível)')).not.toBeInTheDocument();
    });

    it('keeps a category the new plate does not support and marks it invalid', async () => {
      const { user } = setup();
      await user.click(plateRadio('test-plate-square'));
      await user.click(within(group('Cor da placa')).getByRole('radio', { name: 'Colorida' }));

      await user.click(plateRadio('test-plate-rectangle'));

      expect(
        screen.getByText('Cor selecionada (indisponível para esta placa)'),
      ).toBeInTheDocument();
      expect(
        within(group('Cor da placa')).queryByRole('radio', { name: 'Colorida' }),
      ).not.toBeInTheDocument();
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

  describe('status and preview', () => {
    it('lists missing fields, then reports completion', async () => {
      const { user } = setup();

      expect(status()).toHaveTextContent('Falta escolher: Placa, Cor da placa, Texto.');

      await user.click(plateRadio('test-plate-square'));
      await user.click(within(group('Cor da placa')).getByRole('radio', { name: 'Nude' }));
      expect(status()).toHaveTextContent('Falta escolher: Texto.');

      await user.type(screen.getByLabelText('Texto'), 'Ana');
      expect(status()).toHaveTextContent('Configuração completa.');
    });

    it('shows a labeled placeholder and the current selection, without product imagery', async () => {
      const { user } = setup();
      await user.click(plateRadio('test-plate-square'));

      expect(
        within(preview()).getByText(
          'Pré-visualização ilustrativa — as imagens reais dos produtos serão exibidas aqui.',
        ),
      ).toBeInTheDocument();
      expect(within(preview()).getByText('Test test-plate-square · Quadrada')).toBeInTheDocument();
      expect(preview().querySelector('img, svg, canvas')).toBeNull();
    });
  });
});

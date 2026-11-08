import { render, screen, within } from '@testing-library/react';
import { App } from '../../src/App';

describe('App shell', () => {
  it('renders the main landmark with the application title', () => {
    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Taavi Configurator' }),
    ).toBeInTheDocument();
  });

  it('lists the four production models without demo data, the Bandejas as one option', () => {
    render(<App />);

    const models = within(screen.getByRole('group', { name: 'Modelo' }));
    // The two Bandeja sizes are one option with a "Tamanho" choice (D-057).
    for (const name of ['Placa cerâmica — 10 × 10 cm', 'Quadro — 20 × 20 cm', 'Bandeja ondulada']) {
      expect(models.getByRole('radio', { name })).toBeInTheDocument();
    }
    expect(models.getAllByRole('radio')).toHaveLength(3);
    expect(screen.queryByText(/demonstração/i)).not.toBeInTheDocument();
  });

  it('offers the four approved lettering colors in order, the second color, and the disclaimer', () => {
    render(<App />);

    const colors = within(screen.getByRole('group', { name: 'Cor do texto' }));
    expect(
      colors.getAllByRole('radio').map((radio) => radio.closest('label')?.textContent),
    ).toEqual(['✓Marrom', '✓Azul', '✓Verde', '✓Vermelho escuro']);
    expect(
      screen.queryByText('As cores do texto ainda não foram definidas.'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar segunda cor' })).toBeInTheDocument();
    expect(screen.getByText(/sujeitas à análise e aprovação da Taavi/)).toBeVisible();
  });

  it('handles an empty catalog', () => {
    render(<App catalog={{ plates: [], textColors: [] }} />);

    expect(screen.getByText('Nenhum modelo disponível no momento.')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('renders a banner when one is provided', () => {
    render(<App banner={<p role="note">Aviso</p>} />);
    expect(screen.getByRole('note')).toHaveTextContent('Aviso');
  });
});

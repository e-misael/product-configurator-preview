import { render, screen, within } from '@testing-library/react';
import { App } from '../../src/App';

describe('App shell', () => {
  it('renders the main landmark with the application title', () => {
    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Crie sua peça com a TAAVI' }),
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

  it('offers the approved lettering colors in order, highlighting, and the disclaimer', () => {
    render(<App />);

    const colors = within(screen.getByRole('group', { name: 'Cor do texto' }));
    expect(
      colors.getAllByRole('radio').map((radio) => radio.closest('label')?.textContent),
    ).toEqual([
      '✓Marrom',
      '✓Azul',
      '✓Verde',
      '✓Vermelho escuro',
      '✓Laranja escuro',
      '✓Amarelo queimado',
      '✓Preto',
    ]);
    expect(
      screen.queryByText('As cores do texto ainda não foram definidas.'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Destacar parte(s) do texto' })).not.toBeChecked();
    expect(screen.getByText(/sujeitas à análise e aprovação da TAAVI/)).toBeVisible();
  });

  it('links to TAAVI’s store in a footer below the page, in a new tab (D-079)', () => {
    render(<App />);

    const footer = screen.getByRole('contentinfo');
    expect(footer).toHaveTextContent('Visite nossa loja: taavi.lojavirtualnuvem.com.br');
    const link = within(footer).getByRole('link', {
      name: 'taavi.lojavirtualnuvem.com.br (abre em nova aba)',
    });
    expect(link).toHaveAttribute('href', 'https://taavi.lojavirtualnuvem.com.br/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    // Outside the page's content and every panel, after it.
    const main = screen.getByRole('main');
    expect(main.contains(footer)).toBe(false);
    expect(main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(footer.closest('section, form')).toBeNull();
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

import { render, screen } from '@testing-library/react';
import { App } from '../../src/App';

describe('App shell', () => {
  it('renders the main landmark with the application title', () => {
    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Taavi Configurator' }),
    ).toBeInTheDocument();
  });

  it('handles the empty production catalog without demo data', () => {
    render(<App />);

    expect(screen.getByText('Nenhuma placa disponível no momento.')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByText(/demonstração/i)).not.toBeInTheDocument();
  });

  it('renders a banner when one is provided', () => {
    render(<App banner={<p role="note">Aviso</p>} />);
    expect(screen.getByRole('note')).toHaveTextContent('Aviso');
  });
});

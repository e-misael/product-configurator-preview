import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/App';
import { FakeImage, installFakeImages } from '../support/fake-image';
import { previewCatalog, previewSizes } from '../preview/fixtures';

/** "Abrir WhatsApp da TAAVI" with the configured number (P-16): no mock of the contact. */

beforeEach(() => {
  installFakeImages(previewSizes);
});

const group = (name: string) => screen.getByRole('group', { name });
const finalize = () => screen.getByRole('region', { name: 'Finalizar personalização' });
const link = () => within(finalize()).getByRole('link', { name: 'Abrir WhatsApp da TAAVI' });

async function setup({ complete = true } = {}) {
  const user = userEvent.setup();
  render(<App catalog={previewCatalog} />);
  await user.click(within(group('Modelo')).getByRole('radio', { name: /^Test plate square / }));
  act(() => FakeImage.loadAll());
  await user.type(screen.getByLabelText('Texto'), 'Casa da Ana');
  if (complete) {
    await user.click(within(group('Cor do texto')).getByRole('radio', { name: 'Test ink A' }));
  }
  await user.type(screen.getByRole('textbox', { name: 'Observação' }), 'Presente');
  return { user };
}

describe('Abrir WhatsApp da TAAVI, configured (P-16)', () => {
  it('opens TAAVI’s official chat with the order message, after the two steps', async () => {
    await setup();

    const url = new URL(link().getAttribute('href') ?? '');
    expect(`${url.origin}${url.pathname}`).toBe('https://wa.me/5561999237316');
    const text = url.searchParams.get('text') ?? '';
    expect(text).toMatch(/^Olá, TAAVI!\n\n/);
    expect(text).toContain('Texto:\nCASA DA ANA\n');
    expect(text).toContain('Observação: Presente\n');
    expect(text).toMatch(/Podem confirmar o valor, a disponibilidade e o prazo de produção\?$/);
    expect(link()).toHaveAttribute('target', '_blank');
    expect(link()).toHaveAttribute('rel', 'noopener noreferrer');

    // The two manual steps, unchanged, describe the link.
    const steps = within(finalize()).getAllByRole('listitem');
    expect(steps.map((step) => step.textContent)).toEqual(
      expect.arrayContaining([
        'Toque em "Baixar imagem" para salvar a imagem no aparelho.',
        'Abra a conversa com a TAAVI e anexe a imagem baixada; os detalhes já vão escritos na mensagem.',
      ]),
    );
    expect(link()).toHaveAccessibleDescription(/Baixar imagem.*anexe a imagem baixada/);
    expect(within(finalize()).getByText('Prefere enviar pelo WhatsApp?')).toBeInTheDocument();
  });

  it('follows a note edit at once', async () => {
    const { user } = await setup();
    const note = screen.getByRole('textbox', { name: 'Observação' });

    await user.clear(note);
    await user.type(note, 'Entregar em maio');

    const text = new URL(link().getAttribute('href') ?? '').searchParams.get('text');
    expect(text).toContain('Observação: Entregar em maio\n');
    expect(text).not.toContain('Presente');
  });

  it('is not a link while the configuration is incomplete', async () => {
    await setup({ complete: false });

    const blocked = link();
    expect(blocked).toHaveAttribute('aria-disabled', 'true');
    expect(blocked).not.toHaveAttribute('href');
    expect(blocked).toHaveAccessibleDescription(/Falta escolher: Cor do texto\./);
  });
});

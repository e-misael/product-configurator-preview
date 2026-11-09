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
const review = () => screen.getByRole('region', { name: 'Revisar personalização' });
const restart = () => screen.getByRole('button', { name: 'Reiniciar configurações' });
const confirmRestart = () => screen.getByRole('button', { name: 'Sim, reiniciar' });
const cancel = () => screen.getByRole('button', { name: 'Cancelar' });
const square = () =>
  within(group('Modelo')).getByRole('radio', { name: /^Test test-plate-square / });
const ink = (name: string) =>
  within(group('Cor do texto')).getByRole('radio', { name: `Test ${name}` });

/** Every kind of input: model, text, font, both colors with a trecho, and the note. */
async function customize(user: ReturnType<typeof userEvent.setup>) {
  await user.click(square());
  await user.type(screen.getByLabelText('Texto'), 'Casa da Ana');
  await user.click(within(group('Fonte')).getByRole('radio', { name: 'Com serifa' }));
  await user.click(ink('ink A'));
  await user.click(screen.getByRole('switch', { name: 'Destacar parte(s) do texto' }));
  await user.click(within(group('Cor de destaque')).getByRole('radio', { name: 'Test ink B' }));
  await user.click(screen.getByRole('button', { name: 'Casa' }));
  await user.type(screen.getByRole('textbox', { name: 'Observação' }), 'Presente');
}

describe('Reiniciar configurações', () => {
  it('ends the review, right under the summary, which holds nothing else (D-078)', () => {
    setup();
    const summary = within(review()).getByText('Alinhamento:');
    expect(
      summary.compareDocumentPosition(restart()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // The reset is the panel's last element: no note, disclaimer, status, or action after it.
    const panel = review().querySelector('.review');
    expect(panel?.lastElementChild?.contains(restart())).toBe(true);
    expect(within(review()).getAllByRole('button')).toEqual([restart()]);
    expect(within(review()).queryByRole('textbox')).toBeNull();
    expect(review()).not.toHaveTextContent(/pré-visualização é ilustrativa|Falta escolher/);
  });

  it('asks for confirmation first, with focus on "Cancelar"', async () => {
    const { user } = setup();
    await user.click(restart());

    expect(
      screen.getByRole('group', {
        name: 'Reiniciar apaga o modelo, o texto, as cores e a posição; a observação é mantida. Deseja continuar?',
      }),
    ).toBeInTheDocument();
    expect(cancel()).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Reiniciar configurações' })).toBeNull();
  });

  it('keeps everything when cancelled and returns focus to the button', async () => {
    const { user } = setup();
    await customize(user);
    await user.click(restart());
    await user.click(cancel());

    expect(restart()).toHaveFocus();
    expect(square()).toBeChecked();
    expect(screen.getByLabelText('Texto')).toHaveValue('Casa da Ana');
    expect(screen.getByRole('textbox', { name: 'Observação' })).toHaveValue('Presente');
  });

  it('resets every field and choice to the initial state, keeping the note', async () => {
    const { user } = setup();
    await customize(user);
    expect(within(review()).getByText('Test ink B: Casa')).toBeInTheDocument();

    await user.click(restart());
    await user.click(confirmRestart());

    for (const radio of within(group('Modelo')).getAllByRole('radio')) {
      expect(radio).not.toBeChecked();
    }
    expect(screen.getByLabelText('Texto')).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Observação' })).toHaveValue('Presente');
    expect(within(group('Fonte')).getByRole('radio', { name: 'Sem serifa' })).toBeChecked();
    for (const radio of within(group('Cor do texto')).getAllByRole('radio')) {
      expect(radio).not.toBeChecked();
    }
    // Highlighting is off again, with no color and no words kept.
    const highlight = screen.getByRole('switch', { name: 'Destacar parte(s) do texto' });
    expect(highlight).not.toBeChecked();
    expect(screen.queryByText(/Destaque desativado/)).toBeNull();
    await user.click(highlight);
    expect(
      within(group('Cor de destaque'))
        .getAllByRole('radio')
        .some((radio) => (radio as HTMLInputElement).checked),
    ).toBe(false);
    expect(screen.getByText('Digite o texto para escolher as palavras.')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Pré-visualização' })).getByText(
        'Selecione um modelo',
      ),
    ).toBeVisible();
  });

  it('announces the reset and focuses the first step', async () => {
    const { user } = setup();
    await customize(user);
    await user.click(restart());
    await user.click(confirmRestart());

    expect(screen.getByText('Configurações reiniciadas.')).toHaveAttribute('role', 'status');
    expect(within(group('Modelo')).getAllByRole('radio')[0]).toHaveFocus();
    // Nothing to confirm any more.
    expect(restart()).toBeInTheDocument();
  });

  it('starts again from the catalog default lettering color (D-064)', async () => {
    const user = userEvent.setup();
    render(<App catalog={{ ...testCatalog, defaultTextColorId: 'test-text-color-b' }} />);
    await user.click(ink('ink A'));
    await user.click(restart());
    await user.click(confirmRestart());

    expect(ink('ink B')).toBeChecked();
    expect(ink('ink A')).not.toBeChecked();
  });
});

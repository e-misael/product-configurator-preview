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
  const field = screen.getByLabelText<HTMLTextAreaElement>('Texto');
  await user.type(field, 'Casa da Ana');
  await user.click(within(group('Fonte')).getByRole('radio', { name: 'Com serifa' }));
  await user.click(ink('ink A'));
  await user.click(screen.getByRole('button', { name: 'Usar segunda cor' }));
  field.setSelectionRange(0, 4);
  fireEvent.select(field);
  await user.click(within(group('Segunda cor')).getByRole('radio', { name: 'Test ink B' }));
  await user.type(screen.getByLabelText('Observação'), 'Presente');
}

describe('Reiniciar configurações', () => {
  it('is offered in the review, under the summary and before export (D-058)', () => {
    setup();
    const summary = within(review()).getByText('Alinhamento:');
    const exportButton = within(review()).getByRole('button', { name: 'Exportar imagem' });
    expect(
      summary.compareDocumentPosition(restart()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      restart().compareDocumentPosition(exportButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('asks for confirmation first, with focus on "Cancelar"', async () => {
    const { user } = setup();
    await user.click(restart());

    expect(
      screen.getByRole('group', {
        name: 'Reiniciar apaga o modelo, o texto, as cores, a posição e a observação. Deseja continuar?',
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
    expect(screen.getByLabelText('Observação')).toHaveValue('Presente');
  });

  it('resets every field and choice to the initial state', async () => {
    const { user } = setup();
    await customize(user);
    expect(within(review()).getByText(/1 trecho/)).toBeInTheDocument();

    await user.click(restart());
    await user.click(confirmRestart());

    for (const radio of within(group('Modelo')).getAllByRole('radio')) {
      expect(radio).not.toBeChecked();
    }
    expect(screen.getByLabelText('Texto')).toHaveValue('');
    expect(screen.getByLabelText('Observação')).toHaveValue('');
    expect(within(group('Fonte')).getByRole('radio', { name: 'Sem serifa' })).toBeChecked();
    for (const radio of within(group('Cor do texto')).getAllByRole('radio')) {
      expect(radio).not.toBeChecked();
    }
    // The second color is closed again, with no color and no trechos.
    expect(screen.getByRole('button', { name: 'Usar segunda cor' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByText(/Segunda cor em uso/)).toBeNull();
    expect(within(review()).queryByText(/trecho/)).toBeNull();
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

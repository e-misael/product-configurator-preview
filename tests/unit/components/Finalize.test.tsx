import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/App';
import type { Catalog } from '../../../src/domain';
import { FakeImage, installFakeImages } from '../support/fake-image';
import { previewCatalog, previewSizes } from '../preview/fixtures';

/**
 * "Finalize seu pedido" (D-080): the order summary with quantity, then the two
 * actions. The number is mocked so each test chooses it; the configured number
 * is tested in WhatsApp.test.tsx.
 */
const contact = vi.hoisted(() => ({ number: '5500000000000' as string | null }));
vi.mock('../../../src/config/contact', () => ({
  get TAAVI_WHATSAPP_NUMBER() {
    return contact.number;
  },
}));

/** Test prices: the square at 98,00 and the circle at 270,00; the others have none. */
const pricedCatalog: Catalog = {
  ...previewCatalog,
  plates: previewCatalog.plates.map((plate) =>
    plate.id === 'test-plate-square'
      ? { ...plate, priceCents: 9800 }
      : plate.id === 'test-plate-circle'
        ? { ...plate, priceCents: 27000 }
        : plate,
  ),
};

let clicked: HTMLAnchorElement[];

beforeEach(() => {
  installFakeImages(previewSizes);
  contact.number = '5500000000000';
  clicked = [];
  // Only the blob methods: the WhatsApp link is still read with `new URL`.
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:export' });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push(this);
  });
});
afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'canShare');
  vi.unstubAllGlobals();
});

const group = (name: string) => screen.getByRole('group', { name });
const finalize = () => screen.getByRole('region', { name: 'Finalize seu pedido' });
const download = () => within(finalize()).getByRole('button', { name: 'Baixar minha criação' });
const whatsApp = () =>
  within(finalize()).queryByRole('link', { name: 'Enviar detalhes para a TAAVI' });
const message = () => new URL(whatsApp()?.getAttribute('href') ?? '').searchParams.get('text');
const quantity = () => within(finalize()).getByRole('textbox', { name: 'Quantidade' });
const more = () => within(finalize()).getByRole('button', { name: 'Aumentar quantidade' });
const less = () => within(finalize()).getByRole('button', { name: 'Diminuir quantidade' });
const total = () => within(finalize()).queryByText('Total estimado')?.parentElement;

async function setup({ complete = true, catalog = pricedCatalog } = {}) {
  const user = userEvent.setup();
  render(<App catalog={catalog} />);
  await user.click(within(group('Modelo')).getByRole('radio', { name: /^Test plate square / }));
  act(() => FakeImage.loadAll());
  await user.type(screen.getByLabelText('Texto'), 'Casa da Ana');
  if (complete) {
    await user.click(within(group('Cor do texto')).getByRole('radio', { name: 'Test ink A' }));
  }
  return { user };
}

describe('Finalize seu pedido: the order (D-080)', () => {
  it('shows the model, unit price, quantity 1, estimated total, and the shipping note', async () => {
    await setup();

    expect(finalize()).toHaveTextContent('Test plate square — Test size');
    expect(within(finalize()).getByText('Valor unitário').parentElement).toHaveTextContent(
      'Valor unitárioR$ 98,00',
    );
    expect(quantity()).toHaveValue('1');
    expect(total()).toHaveTextContent('Total estimadoR$ 98,00');
    expect(
      within(finalize()).getByText('Frete não incluso. Valor sujeito à confirmação da TAAVI.'),
    ).toBeVisible();
    // No second heading inside the section.
    expect(within(finalize()).getAllByRole('heading')).toHaveLength(1);
  });

  it('is not shown while the configuration is incomplete; one concise list of reasons is', async () => {
    await setup({ complete: false });

    expect(within(finalize()).queryByText('Valor unitário')).toBeNull();
    expect(within(finalize()).queryByRole('textbox', { name: 'Quantidade' })).toBeNull();
    expect(finalize()).not.toHaveTextContent(/completa|pronta/i);
    const reasons = finalize().querySelector('#export-reasons');
    expect(reasons).toHaveTextContent('Para finalizar:Falta escolher: Cor do texto.');
    expect(within(finalize()).getAllByText(/Falta escolher/)).toHaveLength(1);
  });

  it('changes the quantity with the buttons, within 1 to 99, and updates the total and message', async () => {
    const { user } = await setup();

    expect(less()).toHaveAttribute('aria-disabled', 'true');
    await user.click(less());
    expect(quantity()).toHaveValue('1');

    await user.click(more());
    expect(quantity()).toHaveValue('2');
    expect(total()).toHaveTextContent('R$ 196,00');
    expect(message()).toContain(
      'Quantidade: 2\nValor unitário: R$ 98,00\nTotal estimado: R$ 196,00\n',
    );
    expect(less()).toHaveAttribute('aria-disabled', 'false');

    await user.clear(quantity());
    await user.type(quantity(), '99');
    expect(more()).toHaveAttribute('aria-disabled', 'true');
    await user.click(more());
    expect(quantity()).toHaveValue('99');
    expect(total()).toHaveTextContent('R$ 9.702,00');
  });

  it('works from the keyboard: typing, the arrow keys, and the focusable buttons', async () => {
    const { user } = await setup();

    await user.click(quantity());
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(quantity()).toHaveValue('3');
    await user.keyboard('{ArrowDown}');
    expect(quantity()).toHaveValue('2');

    await user.tab();
    expect(more()).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(quantity()).toHaveValue('3');
    // Unavailable buttons stay focusable, so focus is not lost at a limit.
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(less()).toHaveFocus();
    await user.keyboard('{Enter}{Enter}{Enter}');
    expect(quantity()).toHaveValue('1');
    expect(less()).toHaveFocus();
  });

  it.each(['0', '-', '2.5', 'a', ''])(
    'keeps the last valid quantity while %j is typed, and restores it on leaving',
    async (typed) => {
      const { user } = await setup();
      await user.click(more());
      await user.clear(quantity());
      if (typed !== '') await user.type(quantity(), typed);

      expect(total()).toHaveTextContent('R$ 196,00');
      expect(message()).toContain('Quantidade: 2\n');
      await user.tab();
      expect(quantity()).toHaveValue('2');
    },
  );

  it('takes no more than two digits', async () => {
    const { user } = await setup();
    await user.clear(quantity());
    await user.type(quantity(), '150');
    expect(quantity()).toHaveValue('15');
    expect(total()).toHaveTextContent('R$ 1.470,00');
  });

  it('keeps the quantity through edits; the price follows a model change', async () => {
    const { user } = await setup();
    await user.click(more());
    await user.click(more());

    await user.type(screen.getByLabelText('Texto'), ' Luz');
    await user.type(screen.getByRole('textbox', { name: 'Observação' }), 'Presente');
    expect(quantity()).toHaveValue('3');

    await user.click(within(group('Modelo')).getByRole('radio', { name: /^Test plate circle / }));
    act(() => FakeImage.loadAll());
    expect(quantity()).toHaveValue('3');
    expect(total()).toHaveTextContent('R$ 810,00');
    expect(message()).toContain(
      'Quantidade: 3\nValor unitário: R$ 270,00\nTotal estimado: R$ 810,00\n',
    );
    expect(message()).toContain('Observação: Presente\n');
  });

  it('keeps the quantity while the configuration is briefly incomplete', async () => {
    const { user } = await setup();
    await user.click(more());

    await user.clear(screen.getByLabelText('Texto'));
    expect(within(finalize()).queryByRole('textbox', { name: 'Quantidade' })).toBeNull();
    await user.type(screen.getByLabelText('Texto'), 'Ana');
    expect(quantity()).toHaveValue('2');
  });

  it('goes back to 1 after "Reiniciar configurações"', async () => {
    const { user } = await setup();
    await user.click(more());

    await user.click(screen.getByRole('button', { name: 'Reiniciar configurações' }));
    await user.click(screen.getByRole('button', { name: 'Sim, reiniciar' }));
    await user.click(within(group('Modelo')).getByRole('radio', { name: /^Test plate square / }));
    act(() => FakeImage.loadAll());
    await user.type(screen.getByLabelText('Texto'), 'Ana');
    await user.click(within(group('Cor do texto')).getByRole('radio', { name: 'Test ink A' }));

    expect(quantity()).toHaveValue('1');
    expect(message()).toContain('Quantidade: 1\n');
  });

  it('leaves the price to TAAVI for a model without one, with no total', async () => {
    await setup({ catalog: previewCatalog });

    expect(within(finalize()).getByText('Valor unitário').parentElement).toHaveTextContent(
      'Valor unitárioa confirmar',
    );
    expect(total()).toBeUndefined();
    expect(message()).toContain('Quantidade: 1\nValor unitário: a confirmar\n\nTexto:');
  });
});

describe('Finalize seu pedido: the two steps (D-080)', () => {
  it('lists download, then WhatsApp, numbered, each with its help', async () => {
    await setup();

    const steps = within(within(finalize()).getByRole('list')).getAllByRole('listitem');
    expect(steps).toHaveLength(2);
    expect(within(steps[0] as HTMLElement).getByRole('button')).toBe(download());
    expect(within(steps[1] as HTMLElement).getByRole('link')).toBe(whatsApp());
    expect(download()).toHaveAccessibleDescription('Salve a imagem da sua peça.');
    expect(whatsApp()).toHaveAccessibleDescription(
      'Abra nosso WhatsApp e anexe a imagem salva. Os detalhes estarão na mensagem.',
    );
  });

  it('emphasizes the download first, then WhatsApp once a download started, without claiming it was saved', async () => {
    const { user } = await setup();
    expect(download()).not.toHaveClass('export__button--secondary');
    expect(whatsApp()).toHaveClass('export__button--secondary');

    await user.click(download());

    expect(
      await within(finalize()).findByText('Download iniciado: taavi-test-plate-square.png'),
    ).toBeInTheDocument();
    expect(clicked.map((link) => link.download)).toEqual(['taavi-test-plate-square.png']);
    expect(finalize()).not.toHaveTextContent(/salva com sucesso|foi salva|imagem salva com/i);
    expect(download()).toHaveClass('export__button--secondary');
    expect(whatsApp()).not.toHaveClass('export__button--secondary');

    // A new image: the download is first again.
    await user.type(screen.getByLabelText('Texto'), ' Luz');
    expect(download()).not.toHaveClass('export__button--secondary');
    expect(whatsApp()).toHaveClass('export__button--secondary');
  });

  it('never re-renders the image for a quantity change', async () => {
    const { user } = await setup();
    await user.click(download());
    await within(finalize()).findByText(/Download iniciado/);
    const encoded = vi.mocked(HTMLCanvasElement.prototype.toBlob).mock.calls.length;

    await user.click(more());
    await user.clear(quantity());
    await user.type(quantity(), '12');

    expect(vi.mocked(HTMLCanvasElement.prototype.toBlob).mock.calls).toHaveLength(encoded);
    // The download still counts for this image.
    expect(whatsApp()).not.toHaveClass('export__button--secondary');
    expect(within(finalize()).getByText(/Download iniciado/)).toBeInTheDocument();
  });

  it('lets WhatsApp open before any download: the customer may have the image', async () => {
    await setup();
    expect(whatsApp()).toHaveAttribute('href', expect.stringMatching(/^https:\/\/wa\.me\//));
    expect(whatsApp()).not.toHaveAttribute('aria-disabled');
    expect(clicked).toHaveLength(0);
  });

  it('blocks both while incomplete, focusable, with the reasons', async () => {
    const { user } = await setup({ complete: false });

    expect(download()).toHaveAttribute('aria-disabled', 'true');
    expect(download()).toHaveAccessibleDescription(/Falta escolher: Cor do texto\./);
    const blocked = whatsApp();
    expect(blocked).toHaveAttribute('aria-disabled', 'true');
    expect(blocked).not.toHaveAttribute('href');
    expect(blocked).toHaveAccessibleDescription(/Falta escolher: Cor do texto\..*Abra nosso/);
    await user.click(download());
    expect(clicked).toHaveLength(0);
  });

  it('offers no share button, even where the browser can share PNG files, and prepares nothing', async () => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn() });
    await setup();
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(within(finalize()).queryByRole('button', { name: /Compartilhar/ })).toBeNull();
    expect(
      within(finalize())
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['−', '+', 'Baixar minha criação']);
    expect(HTMLCanvasElement.prototype.toBlob).not.toHaveBeenCalled();
  });

  it('offers no WhatsApp step without a valid number', async () => {
    contact.number = null;
    await setup();
    expect(whatsApp()).toBeNull();
    expect(within(within(finalize()).getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
  });

  it('offers no WhatsApp step for a malformed number', async () => {
    contact.number = '+55 (00) 0000-0000';
    await setup();
    expect(whatsApp()).toBeNull();
  });
});

describe('disclaimer placement (D-080)', () => {
  it('sits between "Observação" and "Finalize seu pedido", outside both, with its wording', async () => {
    await setup();
    const disclaimer = screen.getByText(/^A pré-visualização é ilustrativa\./).parentElement;
    const note = screen.getByRole('region', { name: 'Observação' });

    expect(disclaimer?.closest('section')).toBeNull();
    expect(note.nextElementSibling).toBe(disclaimer);
    expect(disclaimer?.nextElementSibling).toBe(finalize());
    expect([...(disclaimer?.querySelectorAll('p') ?? [])].map((p) => p.textContent)).toEqual([
      'A pré-visualização é ilustrativa. Como nossas peças são produzidas artesanalmente, o produto final pode apresentar pequenas variações de formato, textura, acabamento, posicionamento das letras e tonalidade das cores em relação à imagem exibida na tela.',
      'As cores também podem variar conforme a iluminação, as características da cerâmica e as configurações de cada dispositivo.',
      'Todas as solicitações de personalização estão sujeitas à análise e aprovação da TAAVI.',
    ]);
    expect(screen.getAllByText(/^A pré-visualização é ilustrativa\./)).toHaveLength(1);
  });
});

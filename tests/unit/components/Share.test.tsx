import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/App';
import { WIDE_LAYOUT_QUERY } from '../../../src/hooks/useWideLayout';
import { FakeImage, installFakeImages } from '../support/fake-image';
import { previewCatalog, previewSizes } from '../preview/fixtures';

/** TAAVI's number is not supplied (P-16): tests set a well-formed, non-existent one. */
const contact = vi.hoisted(() => ({ number: null as string | null }));
vi.mock('../../../src/config/contact', () => ({
  get TAAVI_WHATSAPP_NUMBER() {
    return contact.number;
  },
}));

type Settle = { resolve: () => void; reject: (error: unknown) => void };

/** A share sheet stand-in: records each call and whether it came during a click. */
function installShare({ files = true }: { files?: boolean } = {}) {
  const calls: { data: ShareData; inClick: boolean }[] = [];
  const pending: Settle[] = [];
  let inClick = false;
  document.addEventListener('click', () => (inClick = true), { capture: true });
  document.addEventListener('click', () => queueMicrotask(() => (inClick = false)));
  Object.defineProperty(navigator, 'canShare', {
    configurable: true,
    value: (data: ShareData) => files && (data.files ?? []).every((f) => f.type === 'image/png'),
  });
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: (data: ShareData) => {
      calls.push({ data, inClick });
      return new Promise<void>((resolve, reject) => pending.push({ resolve, reject }));
    },
  });
  return { calls, pending };
}

beforeEach(() => {
  installFakeImages(previewSizes);
  contact.number = null;
});
afterEach(() => {
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'canShare');
  vi.unstubAllGlobals();
});

const group = (name: string) => screen.getByRole('group', { name });
const review = () => screen.getByRole('region', { name: 'Revisar personalização' });
const queryShare = () =>
  within(review()).queryByRole('button', { name: 'Compartilhar personalização' });
const shareButton = () =>
  within(review()).getByRole('button', { name: 'Compartilhar personalização' });
const downloadButton = () => within(review()).getByRole('button', { name: 'Baixar imagem' });
const whatsApp = () => within(review()).queryByRole('link', { name: 'Abrir WhatsApp da TAAVI' });

async function setup({ complete = true } = {}) {
  const user = userEvent.setup();
  render(<App catalog={previewCatalog} />);
  await user.click(within(group('Modelo')).getByRole('radio', { name: /^Test plate square / }));
  act(() => FakeImage.loadAll());
  await user.type(screen.getByLabelText('Texto'), 'Casa da Ana');
  if (complete) {
    await user.click(within(group('Cor do texto')).getByRole('radio', { name: 'Test ink A' }));
  }
  return { user };
}

/** Waits for the PNG prepared in the background (300 ms after the last change). */
async function prepared() {
  await within(review()).findByText('Preparando imagem para compartilhar…');
  await vi.waitFor(() => expect(shareButton()).toHaveAttribute('aria-disabled', 'false'), {
    timeout: 2000,
  });
}

describe('Compartilhar personalização (D-076)', () => {
  it('is not offered without file sharing; download stays the main action', async () => {
    await setup();
    expect(queryShare()).toBeNull();
    expect(downloadButton()).not.toHaveClass('export__button--secondary');
    expect(within(review()).queryByText(/Preparando imagem/)).toBeNull();
  });

  it('is not offered when the browser cannot share PNG files', async () => {
    installShare({ files: false });
    await setup();
    expect(queryShare()).toBeNull();
  });

  it('comes first, then "Baixar imagem" as the secondary action', async () => {
    installShare();
    await setup();
    const buttons = within(review())
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(buttons.slice(-2)).toEqual(['Compartilhar personalização', 'Baixar imagem']);
    expect(downloadButton()).toHaveClass('export__button--secondary');
  });

  it('prepares the image, then shares the PNG and the order message from the tap itself', async () => {
    const { calls } = installShare();
    const { user } = await setup();
    await user.type(screen.getByLabelText('Observação'), 'Presente');
    expect(shareButton()).toHaveAttribute('aria-disabled', 'true');
    await prepared();

    await user.click(shareButton());

    expect(calls).toHaveLength(1);
    expect(calls[0]?.inClick).toBe(true);
    const [file] = calls[0]?.data.files ?? [];
    expect(file?.name).toBe('taavi-test-plate-square.png');
    expect(file?.type).toBe('image/png');
    expect(calls[0]?.data.text).toBe(
      [
        'Olá, TAAVI!',
        '',
        'Gostaria de solicitar uma peça personalizada com estas características:',
        '',
        'Modelo: Test plate square — Test size',
        '',
        'Texto:',
        'CASA DA ANA',
        '',
        'Fonte: Sem serifa',
        'Cor principal: Test ink A',
        'Alinhamento: Centralizado',
        'Posição: Centro',
        'Observação: Presente',
        '',
        'Preparei uma imagem da personalização como referência.',
        '',
        'Podem confirmar o valor, a disponibilidade e o prazo de produção?',
      ].join('\n'),
    );
    // Busy until the sheet closes; a second tap does not open another.
    expect(shareButton()).toHaveAttribute('aria-disabled', 'true');
    await user.click(shareButton());
    expect(calls).toHaveLength(1);
  });

  it('never shares a stale image: a change withdraws it until the new one is ready', async () => {
    const { calls } = installShare();
    const { user } = await setup();
    await prepared();
    const first = calls.length;

    await user.type(screen.getByLabelText('Texto'), ' Luz');
    expect(shareButton()).toHaveAttribute('aria-disabled', 'true');
    await user.click(shareButton());
    expect(calls).toHaveLength(first);

    await prepared();
    await user.click(shareButton());
    expect(calls[0]?.data.text).toContain('Texto:\nCASA DA ANA LUZ\n');
  });

  it('shares the edited note with the cached image: the PNG is reused, the message is not', async () => {
    const { calls, pending } = installShare();
    const { user } = await setup();
    await prepared();
    const encoded = vi.mocked(HTMLCanvasElement.prototype.toBlob).mock.calls.length;
    await user.click(shareButton());
    await act(async () => {
      pending[0]?.resolve();
      await Promise.resolve();
    });

    await user.type(screen.getByLabelText('Observação'), 'Obrigado');
    expect(shareButton()).toHaveAttribute('aria-disabled', 'false');
    await user.click(shareButton());
    await user.clear(screen.getByLabelText('Observação'));
    await user.type(screen.getByLabelText('Observação'), 'Entregar em maio');
    await act(async () => {
      pending[1]?.resolve();
      await Promise.resolve();
    });
    await user.click(shareButton());

    // The same cached File every time.
    expect(calls[1]?.data.files?.[0]).toBe(calls[0]?.data.files?.[0]);
    expect(calls[2]?.data.files?.[0]).toBe(calls[0]?.data.files?.[0]);
    expect(calls[0]?.data.text).not.toContain('Observação');
    expect(calls[1]?.data.text).toContain('Observação: Obrigado\n');
    expect(calls[2]?.data.text).toContain('Observação: Entregar em maio\n');
    expect(calls[2]?.data.text).not.toContain('Obrigado');
    expect(vi.mocked(HTMLCanvasElement.prototype.toBlob).mock.calls).toHaveLength(encoded);
  });

  it.each([
    [
      'completed',
      () => undefined,
      'Confira no WhatsApp se a imagem e os detalhes foram enviados para a TAAVI.',
    ],
    [
      'cancelled',
      new DOMException('dismissed', 'AbortError'),
      'Compartilhamento cancelado. Sua personalização continua aqui.',
    ],
    [
      'refused',
      new DOMException('no activation', 'NotAllowedError'),
      'Não foi possível compartilhar. Você pode baixar a imagem e enviá-la pelo WhatsApp da TAAVI.',
    ],
  ])(
    'when %s, says so without claiming a sent request and keeps the configuration',
    async (_, error, message) => {
      const { calls, pending } = installShare();
      const { user } = await setup();
      await prepared();
      await user.click(shareButton());

      await act(async () => {
        if (typeof error === 'function') pending[0]?.resolve();
        else pending[0]?.reject(error);
        await Promise.resolve();
      });

      expect(await within(review()).findByText(message)).toBeInTheDocument();
      expect(review()).not.toHaveTextContent(/pedido (foi )?(enviado|recebido|confirmado)/i);
      expect(calls).toHaveLength(1);
      expect(screen.getByLabelText('Texto')).toHaveValue('Casa da Ana');
      expect(shareButton()).toHaveAttribute('aria-disabled', 'false');
    },
  );

  it('is blocked with the export reasons, and prepares nothing, while the configuration is incomplete', async () => {
    const { calls } = installShare();
    const { user } = await setup({ complete: false });
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(shareButton()).toHaveAttribute('aria-disabled', 'true');
    expect(shareButton()).toHaveAccessibleDescription(/Falta escolher: Cor do texto\./);
    expect(within(review()).queryByText(/Preparando imagem/)).toBeNull();
    expect(HTMLCanvasElement.prototype.toBlob).not.toHaveBeenCalled();
    await user.click(shareButton());
    expect(calls).toHaveLength(0);
  });

  it('is blocked while the photograph is still loading', async () => {
    installShare();
    const user = userEvent.setup();
    render(<App catalog={previewCatalog} />);
    await user.click(within(group('Modelo')).getByRole('radio', { name: /^Test plate square / }));
    await user.type(screen.getByLabelText('Texto'), 'Ana');
    await user.click(within(group('Cor do texto')).getByRole('radio', { name: 'Test ink A' }));

    expect(shareButton()).toHaveAccessibleDescription(/Carregando imagem…/);
    expect(within(review()).queryByText(/Preparando imagem/)).toBeNull();
  });

  it('prepares only while "Revisar personalização" is open on narrow screens', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query !== WIDE_LAYOUT_QUERY,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    Element.prototype.scrollIntoView = vi.fn();
    installShare();
    const user = userEvent.setup();
    render(<App catalog={previewCatalog} />);
    await user.click(screen.getByRole('radio', { name: /^Test plate square / }));
    act(() => FakeImage.loadAll());
    await user.click(screen.getByRole('button', { name: 'Texto e cores' }));
    await user.type(screen.getByLabelText('Texto'), 'Ana');
    await user.click(screen.getByRole('radio', { name: 'Test ink A' }));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(HTMLCanvasElement.prototype.toBlob).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Revisar personalização' }));
    await prepared();
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledTimes(1);
  });
});

describe('Abrir WhatsApp da TAAVI (D-076)', () => {
  it('is not offered while TAAVI’s number is not configured', async () => {
    await setup();
    expect(whatsApp()).toBeNull();
    expect(within(review()).queryByText('Prefere enviar pelo WhatsApp?')).toBeNull();
  });

  it('is not offered for a malformed number', async () => {
    contact.number = '+55 (00) 0000-0000';
    await setup();
    expect(whatsApp()).toBeNull();
  });

  it('opens the chat with the order message, after the steps to attach the image', async () => {
    contact.number = '5500000000000';
    await setup();

    const link = whatsApp();
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    const url = new URL(link?.getAttribute('href') ?? '');
    expect(`${url.origin}${url.pathname}`).toBe('https://wa.me/5500000000000');
    expect(url.searchParams.get('text')).toMatch(/^Olá, TAAVI!\n\n/);
    expect(url.searchParams.get('text')).toContain('Texto:\nCASA DA ANA\n');
    expect(link).toHaveAccessibleDescription(/Baixar imagem.*anexe a imagem baixada/);
    expect(within(review()).getByText('Prefere enviar pelo WhatsApp?')).toBeInTheDocument();
  });

  it('is not a link while blocked, and names the reasons', async () => {
    contact.number = '5500000000000';
    await setup({ complete: false });

    const blocked = whatsApp();
    expect(blocked).toHaveAttribute('aria-disabled', 'true');
    expect(blocked).not.toHaveAttribute('href');
    expect(blocked).toHaveAccessibleDescription(/Falta escolher: Cor do texto\./);
  });

  it('is offered beside the share sheet, and neither starts the other', async () => {
    contact.number = '5500000000000';
    const { calls } = installShare();
    const open = vi.spyOn(window, 'open');
    const { user } = await setup();
    await prepared();

    await user.click(shareButton());
    expect(calls).toHaveLength(1);
    expect(open).not.toHaveBeenCalled();
    expect(whatsApp()).toBeInTheDocument();
  });
});

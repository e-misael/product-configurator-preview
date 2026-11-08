import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/App';
import { contextOf, installFakeCanvas, strokesOf, type FakeContext } from '../support/fake-canvas';
import { FakeImage, installFakeImages } from '../support/fake-image';
import { previewCatalog, previewSizes } from '../preview/fixtures';

const SQUARE_PLATE = '/catalog/plates/test-plate-square/beige.webp';
const RECTANGLE_PLATE = '/catalog/plates/test-plate-rectangle/beige.webp';

beforeEach(() => {
  installFakeImages(previewSizes);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function setup() {
  const user = userEvent.setup();
  render(<App catalog={previewCatalog} />);
  return { user };
}

const group = (name: string) => screen.getByRole('group', { name });
const preview = () => screen.getByRole('region', { name: 'Pré-visualização' });
const canvas = () => within(preview()).queryByRole('img');
const notices = () => preview().querySelector('[aria-live="polite"]');

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  group_: string,
  name: string | RegExp,
) {
  await user.click(within(group(group_)).getByRole('radio', { name }));
}
const choosePlate = (user: ReturnType<typeof userEvent.setup>, name: RegExp) =>
  choose(user, 'Modelo', name);

function settle() {
  act(() => FakeImage.loadAll());
}

/** What was painted on the displayed canvas, in order, with image file names. */
/** Painted layers: photographs by source, text by content, the deboss shading layer as 'deboss'. */
function painted(ctx: FakeContext) {
  return ctx.drawn.map((call) => {
    if (call.op === 'fillText') return `text:${call.text}`;
    return call.image instanceof HTMLCanvasElement ? 'deboss' : (call.image as { src: string }).src;
  });
}

function currentContext(): FakeContext {
  const element = preview().querySelector('canvas');
  if (!element) throw new Error('No canvas');
  return contextOf(element);
}

describe('Preview', () => {
  describe('before an image can be shown', () => {
    it('asks for a model and shows no image', () => {
      setup();

      expect(
        within(preview()).getByText('Escolha um modelo para ver a pré-visualização.'),
      ).toBeVisible();
      expect(canvas()).not.toBeInTheDocument();
      expect(FakeImage.requestedSources).toEqual([]);
    });
  });

  describe('plate image', () => {
    it('shows loading, then paints the exact image', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);

      expect(within(preview()).getByText('Carregando imagem…')).toBeVisible();
      expect(canvas()).not.toBeInTheDocument();

      settle();

      expect(within(preview()).queryByText('Carregando imagem…')).not.toBeInTheDocument();
      expect(canvas()).toHaveAccessibleName('Square');
      expect(painted(currentContext())).toContain(SQUARE_PLATE);
    });

    it('swaps to the image of the newly chosen model, never reusing the old one', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      settle();

      await choosePlate(user, /^Test plate rectangle /);
      settle();

      const drawn = painted(currentContext());
      expect(drawn).toContain(RECTANGLE_PLATE);
      expect(drawn).not.toContain(SQUARE_PLATE);
    });

    it('says the image is pending, and shows nothing else, for a model without a photograph', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate pending /);
      settle();

      expect(
        within(preview()).getByText('A foto deste modelo ainda não está disponível.'),
      ).toBeVisible();
      expect(canvas()).not.toBeInTheDocument();
      expect(
        within(preview()).queryByText('Não foi possível carregar a imagem do modelo.'),
      ).toBeNull();
    });

    it('distinguishes a file that fails to load from a missing catalog image', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);

      act(() => FakeImage.fail(SQUARE_PLATE));

      expect(
        within(preview()).getByText('Não foi possível carregar a imagem do modelo.'),
      ).toBeVisible();
      expect(
        within(preview()).queryByText('A foto deste modelo ainda não está disponível.'),
      ).toBeNull();
      expect(canvas()).not.toBeInTheDocument();
    });
  });

  describe('text', () => {
    async function squarePlate() {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      settle();
      return { user };
    }

    it('updates the canvas as the user types, one line per line break', async () => {
      const { user } = await squarePlate();

      await user.type(screen.getByLabelText('Texto'), 'Casa{Enter}da Ana');

      const texts = painted(currentContext()).filter((entry) => entry.startsWith('text:'));
      expect(texts).toEqual(['text:Casa', 'text:da Ana']);
    });

    it('says the lettering color is provisional until one is chosen', async () => {
      const { user } = await squarePlate();
      const provisional = /Cor do texto ainda não escolhida: o texto aparece em uma cor provisória/;

      await user.type(screen.getByLabelText('Texto'), 'Ana');
      expect(within(preview()).getByText(provisional)).toBeInTheDocument();
      expect(within(preview()).getByText('Não escolhida')).toBeInTheDocument();

      await choose(user, 'Cor do texto', 'Test ink A');
      expect(within(preview()).queryByText(provisional)).not.toBeInTheDocument();
      expect(within(preview()).getByText('Test ink A')).toBeInTheDocument();
    });

    it('draws the text over the plate, never under it', async () => {
      const { user } = await squarePlate();

      await user.type(screen.getByLabelText('Texto'), 'Ana');

      expect(painted(currentContext())).toEqual([SQUARE_PLATE, 'text:Ana', 'deboss']);
    });

    it('keeps the stored text exactly as typed', async () => {
      const { user } = await squarePlate();
      const field = screen.getByLabelText('Texto');

      await user.type(field, '  Ana{Enter}Maria  ');

      expect(field).toHaveValue('  Ana\nMaria  ');
      expect(preview().querySelector('.preview__text')?.textContent).toBe('  Ana\nMaria  ');
    });

    it('warns instead of clipping when the text does not fit', async () => {
      const { user } = await squarePlate();

      await user.click(screen.getByLabelText('Texto'));
      await user.paste(Array.from({ length: 40 }, (_, i) => `linha ${i}`).join('\n'));

      // Area 160 px tall, 48 px lines: 3 lines fit, 37 are over.
      expect(
        within(preview()).getByText(
          'O texto não cabe na área do modelo: 37 linhas a mais. Reduza o texto ou use menos linhas.',
        ),
      ).toBeVisible();
      const texts = painted(currentContext()).filter((entry) => entry.startsWith('text:'));
      expect(texts).toHaveLength(40);
    });

    it('counts the lines over and outlines the text area only while overflowing (D-057)', async () => {
      const { user } = await squarePlate();
      const field = screen.getByLabelText('Texto');
      const lines = (count: number) =>
        Array.from({ length: count }, (_, i) => `L${i}`).join('{Enter}');

      await user.type(field, lines(3));
      expect(within(preview()).queryByText(/O texto não cabe/)).toBeNull();
      expect(strokesOf(currentContext())).toEqual([]);

      await user.type(field, '{Enter}L3');
      expect(
        within(preview()).getByText(
          'O texto não cabe na área do modelo: 1 linha a mais. Reduza o texto ou use menos linhas.',
        ),
      ).toBeVisible();
      // A light halo, then dark dashes, exactly on the calibrated area (x 80, y 120, 240 × 160).
      const strokes = strokesOf(currentContext());
      expect(strokes.map((call) => call.args)).toEqual([
        [80, 120, 240, 160],
        [80, 120, 240, 160],
      ]);
      expect(strokes[1]?.lineDash).toEqual([6, 4]);
      // All four lines are still drawn at the fixed size, none clipped.
      expect(painted(currentContext()).filter((entry) => entry.startsWith('text:'))).toEqual([
        'text:L0',
        'text:L1',
        'text:L2',
        'text:L3',
      ]);

      await user.type(field, '{Enter}L4');
      expect(within(preview()).getByText(/: 2 linhas a mais\./)).toBeVisible();

      await user.type(field, '{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}');
      expect(within(preview()).queryByText(/O texto não cabe/)).toBeNull();
      expect(strokesOf(currentContext())).toEqual([]);
    });

    it('explains why text is not drawn while the lettering size is pending', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate size pending /);
      settle();

      await user.type(screen.getByLabelText('Texto'), 'Ana');
      await choose(user, 'Cor do texto', 'Test ink A');

      const message =
        'O tamanho das letras deste modelo ainda não foi definido; o texto não aparece na imagem.';
      expect(within(preview()).getByText(message)).toBeVisible();
      expect(painted(currentContext()).some((entry) => entry.startsWith('text:'))).toBe(false);
      expect(preview().querySelector('.preview__text')).toHaveTextContent('Ana');
      // A complete configuration still cannot be exported without an approved size.
      const exportButton = within(preview()).getByRole('button', { name: 'Exportar imagem' });
      expect(exportButton).toHaveAttribute('aria-disabled', 'true');
      expect(preview().querySelector('#export-reasons')).toHaveTextContent(
        'Resolva os avisos da pré-visualização acima.',
      );
    });

    it('explains why text is not drawn when the plate has no calibrated text area', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate rectangle /);
      settle();

      await user.type(screen.getByLabelText('Texto'), 'Ana');

      expect(
        within(preview()).getByText(
          'A área do texto deste modelo ainda não foi calibrada; o texto não aparece na imagem.',
        ),
      ).toBeVisible();
      expect(painted(currentContext()).some((entry) => entry.startsWith('text:'))).toBe(false);
      // The entered text is preserved and still shown in the summary.
      expect(preview().querySelector('.preview__text')).toHaveTextContent('Ana');
    });
  });

  describe('accessibility and fallbacks', () => {
    it('announces preview messages politely', () => {
      setup();
      expect(notices()).toHaveAttribute('aria-live', 'polite');
    });

    it('links the canvas to the text summary', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      settle();
      await user.type(screen.getByLabelText('Texto'), 'Ana');

      expect(canvas()).toHaveAccessibleDescription(/Test plate square.*Ana/s);
    });
  });

  describe('text position (D-044)', () => {
    const positionGroup = () => screen.getByRole('group', { name: 'Posição do texto' });
    const button = (name: string) => within(positionGroup()).getByRole('button', { name });
    /** The one position announcement (D-057). */
    const status = () => within(positionGroup()).getByRole('status');
    /** The first painted line as [x, textAlign]. */
    const firstLine = () => {
      const call = currentContext().drawn.find((entry) => entry.op === 'fillText');
      return [call?.x, call?.textAlign];
    };

    async function withText() {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      settle();
      await user.type(screen.getByLabelText('Texto'), 'Ana');
      // The canvas is displayed at the scene's size (400×400) at the page origin.
      const element = preview().querySelector('canvas');
      if (!element) throw new Error('No canvas');
      element.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 400, height: 400, x: 0, y: 0 }) as DOMRect;
      return { user, element };
    }

    it('is disabled until the text is drawn on the image', async () => {
      const { user } = setup();
      expect(positionGroup()).toBeDisabled();
      expect(
        within(positionGroup()).getByText('Disponível quando o texto aparece na pré-visualização.'),
      ).toBeInTheDocument();

      await choosePlate(user, /^Test plate square /);
      settle();
      expect(positionGroup()).toBeDisabled();

      await user.type(screen.getByLabelText('Texto'), 'Ana');
      expect(positionGroup()).toBeEnabled();
      expect(button('Centro')).toHaveAttribute('aria-pressed', 'true');
      expect(status()).toHaveTextContent('Posição: Centro.');
      expect(button('Redefinir posição')).toBeDisabled();
      // One section: the groups are named for assistive technology, without visible captions.
      expect(within(positionGroup()).getAllByRole('status')).toHaveLength(1);
      expect(screen.getByRole('group', { name: 'Posições predefinidas' })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: 'Ajuste fino' })).toHaveAccessibleDescription(
        'Setas do teclado: 2% por passo, 10% com Shift.',
      );
      expect(within(positionGroup()).queryByText('Posições predefinidas')).toBeNull();
      expect(within(positionGroup()).queryByText('Ajuste fino')).toBeNull();
    });

    it('applies a preset to alignment and position together', async () => {
      const { user } = await withText();

      await user.click(button('Superior à esquerda'));

      expect(button('Superior à esquerda')).toHaveAttribute('aria-pressed', 'true');
      expect(button('Centro')).toHaveAttribute('aria-pressed', 'false');
      expect(status()).toHaveTextContent('Posição: Superior à esquerda.');
      // Area x 80–320: the left-aligned block starts at the area's left edge.
      expect(firstLine()).toEqual([80, 'left']);
    });

    it('has no separate line alignment control: the preset column aligns the lines (D-047)', async () => {
      const { user } = await withText();
      expect(screen.queryByRole('group', { name: 'Alinhamento das linhas' })).toBeNull();
      expect(within(positionGroup()).queryAllByRole('radio')).toEqual([]);

      await user.click(button('Inferior à direita'));

      expect(status()).toHaveTextContent('Posição: Inferior à direita.');
      // Area x 80–320: the right-aligned block ends at the area's right edge.
      expect(firstLine()).toEqual([320, 'right']);
      await user.click(button('Centro'));
      expect(firstLine()).toEqual([200, 'center']);
    });

    it('marks exactly one preset as selected, with a visible text equivalent', async () => {
      const { user } = await withText();
      const presets = within(
        screen.getByRole('group', { name: 'Posições predefinidas' }),
      ).getAllByRole('button');
      expect(presets).toHaveLength(9);

      await user.click(button('Meio à direita'));

      expect(presets.filter((preset) => preset.getAttribute('aria-pressed') === 'true')).toEqual([
        button('Meio à direita'),
      ]);
      expect(status()).toHaveTextContent('Posição: Meio à direita.');

      await user.click(button('Mover para cima'));
      expect(presets.every((preset) => preset.getAttribute('aria-pressed') === 'false')).toBe(true);
      expect(status()).toHaveTextContent('Posição personalizada: horizontal 100%, vertical 48%.');
    });

    it('moves by 2% per button or arrow key, 10% with Shift', async () => {
      const { user } = await withText();
      await user.click(button('Superior à esquerda'));

      await user.click(button('Mover para a direita'));
      expect(status()).toHaveTextContent('Posição personalizada: horizontal 2%, vertical 0%.');

      await user.keyboard('{Shift>}');
      await user.click(button('Mover para baixo'));
      await user.keyboard('{/Shift}');
      expect(status()).toHaveTextContent('Posição personalizada: horizontal 2%, vertical 10%.');

      button('Mover para a direita').focus();
      await user.keyboard('{ArrowRight}{ArrowRight}{Shift>}{ArrowDown}{/Shift}{ArrowUp}');
      expect(status()).toHaveTextContent('Posição personalizada: horizontal 6%, vertical 18%.');
      // Moving never changes the line alignment the preset set.
      expect(firstLine()[1]).toBe('left');
    });

    it('resets alignment and position to the catalog default', async () => {
      const { user } = await withText();
      await user.click(button('Inferior à direita'));

      await user.click(button('Redefinir posição'));

      expect(button('Centro')).toHaveAttribute('aria-pressed', 'true');
      expect(status()).toHaveTextContent('Posição: Centro.');
      expect(button('Redefinir posição')).toBeDisabled();
      expect(firstLine()).toEqual([200, 'center']);
    });

    it('drags the text with a mouse, changing only its position', async () => {
      const { user, element } = await withText();
      await user.click(button('Superior à esquerda'));
      // Block "Ana" at x 80–140, y 120–168; free space x 180, y 112.

      fireEvent.pointerDown(element, {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 100,
        clientY: 140,
      });
      fireEvent.pointerMove(element, {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 145,
        clientY: 168,
      });
      fireEvent.pointerUp(element, {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 145,
        clientY: 168,
      });

      expect(status()).toHaveTextContent('Posição personalizada: horizontal 25%, vertical 25%.');
      expect(firstLine()).toEqual([125, 'left']);
    });

    it('ignores a press outside the text', async () => {
      const { element } = await withText();

      fireEvent.pointerDown(element, {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 10,
        clientY: 10,
      });
      fireEvent.pointerMove(element, {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 60,
        clientY: 60,
      });

      expect(status()).toHaveTextContent('Posição: Centro.');
    });

    it('drags with touch only in "Mover texto" mode, so the page scrolls otherwise', async () => {
      const { user, element } = await withText();
      const touchDrag = () => {
        fireEvent.pointerDown(element, {
          pointerId: 2,
          pointerType: 'touch',
          clientX: 200,
          clientY: 200,
        });
        fireEvent.pointerMove(element, {
          pointerId: 2,
          pointerType: 'touch',
          clientX: 245,
          clientY: 200,
        });
        fireEvent.pointerUp(element, {
          pointerId: 2,
          pointerType: 'touch',
          clientX: 245,
          clientY: 200,
        });
      };

      expect(element.style.touchAction).toBe('auto');
      touchDrag();
      expect(status()).toHaveTextContent('Posição: Centro.');

      await user.click(button('Mover texto'));
      expect(button('Mover texto')).toHaveAttribute('aria-pressed', 'true');
      expect(element.style.touchAction).toBe('none');
      touchDrag();
      expect(status()).toHaveTextContent('Posição personalizada: horizontal 75%, vertical 50%.');
    });

    it('keeps the position when the model changes', async () => {
      const { user } = await withText();
      await user.click(button('Inferior à direita'));

      await choosePlate(user, /^Test plate circle /);
      settle();

      expect(button('Inferior à direita')).toHaveAttribute('aria-pressed', 'true');
      expect(status()).toHaveTextContent('Posição: Inferior à direita.');
    });
  });

  describe('export (D-008)', () => {
    const exportButton = () => within(preview()).getByRole('button', { name: 'Exportar imagem' });
    const reasons = () => preview().querySelector('#export-reasons');
    let clicked: HTMLAnchorElement[];

    beforeEach(() => {
      clicked = [];
      vi.stubGlobal(
        'URL',
        Object.assign(Object.create(URL) as typeof URL, {
          createObjectURL: () => 'blob:export',
          revokeObjectURL: () => undefined,
        }),
      );
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        clicked.push(this);
      });
    });

    async function ready() {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      settle();
      await user.type(screen.getByLabelText('Texto'), 'Ana');
      await choose(user, 'Cor do texto', 'Test ink A');
      return { user };
    }

    it('is blocked, but focusable, with the reasons listed, and does nothing when activated', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      settle();

      expect(exportButton()).toHaveAttribute('aria-disabled', 'true');
      expect(exportButton()).not.toBeDisabled();
      expect(reasons()).toHaveTextContent('Para exportar a imagem:');
      expect(reasons()).toHaveTextContent('Falta escolher: Texto.');
      expect(reasons()).toHaveTextContent('Falta escolher: Cor do texto.');

      await user.click(exportButton());
      exportButton().focus();
      await user.keyboard('{Enter} ');
      expect(clicked).toHaveLength(0);
    });

    it('points to the preview notices when the preview is incomplete', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      await user.type(screen.getByLabelText('Texto'), 'Ana');
      await choose(user, 'Cor do texto', 'Test ink A');
      // Images still loading.
      expect(reasons()).toHaveTextContent('Resolva os avisos da pré-visualização acima.');
      expect(exportButton()).toHaveAccessibleDescription(/Carregando imagem…/);
    });

    it('downloads taavi-{plateId}.png and confirms it', async () => {
      const { user } = await ready();

      await user.click(exportButton());

      expect(
        await within(preview()).findByText('Imagem exportada: taavi-test-plate-square.png'),
      ).toBeInTheDocument();
      expect(clicked.map((link) => link.download)).toEqual(['taavi-test-plate-square.png']);
      expect(reasons()).toBeNull();
    });

    it('shows a pt-BR error when encoding fails and stays usable', async () => {
      const { user } = await ready();
      const toBlob = vi
        .spyOn(HTMLCanvasElement.prototype, 'toBlob')
        .mockImplementation((callback: BlobCallback) => callback(null));

      await user.click(exportButton());

      expect(await within(preview()).findByRole('alert')).toHaveTextContent(
        'Não foi possível gerar a imagem. Tente novamente.',
      );
      expect(exportButton()).toHaveAttribute('aria-disabled', 'false');
      toBlob.mockRestore();
      installFakeCanvas();
      await user.click(exportButton());
      expect(await within(preview()).findByText(/Imagem exportada:/)).toBeInTheDocument();
      expect(within(preview()).queryByRole('alert')).toBeNull();
    });

    it('shows an error when the download cannot start', async () => {
      const { user } = await ready();
      vi.stubGlobal(
        'URL',
        Object.assign(Object.create(URL) as typeof URL, {
          createObjectURL: () => {
            throw new Error('blocked');
          },
        }),
      );

      await user.click(exportButton());

      expect(await within(preview()).findByRole('alert')).toHaveTextContent(
        'Não foi possível gerar a imagem. Tente novamente.',
      );
      expect(clicked).toHaveLength(0);
    });
  });

  describe('blocked-axis positioning', () => {
    it('does not change the coordinate of an axis without free space', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      settle();
      const field = screen.getByLabelText('Texto');
      await user.type(field, 'Ana');
      const group = screen.getByRole('group', { name: 'Posição do texto' });
      const status = () => within(group).getByRole('status');
      await user.click(within(group).getByRole('button', { name: 'Superior à esquerda' }));
      // Overflowing lines: no vertical free space; horizontal free space remains.
      await user.clear(field);
      await user.type(field, Array.from({ length: 30 }, () => 'ab').join('{Enter}'));
      expect(status()).toHaveTextContent('Posição: Superior à esquerda.');
      expect(within(group).getByRole('button', { name: 'Mover para baixo' })).toBeDisabled();

      within(group).getByRole('button', { name: 'Mover para a direita' }).focus();
      await user.keyboard('{ArrowDown}{Shift>}{ArrowDown}{/Shift}{ArrowRight}');
      expect(status()).toHaveTextContent(
        'Posição personalizada: horizontal 2%, vertical sem espaço livre.',
      );

      // Back to short text: y is still exactly where the preset put it; x moved 2%.
      await user.clear(field);
      await user.type(field, 'Ana');
      expect(status()).toHaveTextContent('Posição personalizada: horizontal 2%, vertical 0%.');
    });
  });
});

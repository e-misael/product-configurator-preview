import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/App';
import {
  contextOf,
  fontSizeOf,
  installFakeCanvas,
  strokesOf,
  type FakeContext,
} from '../support/fake-canvas';
import { FakeImage, installFakeImages } from '../support/fake-image';
import { WATERMARK_SRC } from '../../../src/preview/watermark';
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
/** "Revisar personalização" (D-058, D-078): the summary and the reset. */
const review = () => screen.getByRole('region', { name: 'Revisar personalização' });
/** "Finalizar personalização" (D-078): the disclaimer, the status, and export. */
const finalize = () => screen.getByRole('region', { name: 'Finalizar personalização' });
const summaryText = () => review().querySelector('.review__text');

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

/**
 * Painted layers: photographs by source, text by content, the deboss shading
 * layer as 'deboss', and the Taavi signature (mark and "© TAAVI") as 'signature'.
 */
function painted(ctx: FakeContext) {
  return ctx.drawn.map((call) => {
    if (call.op === 'fillText') return call.text === '© TAAVI' ? 'signature' : `text:${call.text}`;
    if (call.image instanceof HTMLCanvasElement) return 'deboss';
    const { src } = call.image as { src: string };
    return src === WATERMARK_SRC ? 'signature' : src;
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

      expect(within(preview()).getByText('Selecione um modelo')).toBeVisible();
      expect(
        within(preview()).queryByText('Escolha um modelo para ver a pré-visualização.'),
      ).not.toBeInTheDocument();
      expect(within(preview()).queryByText('Sem imagem para exibir')).not.toBeInTheDocument();
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
      // "Sem serifa" (the default) is lettered in capitals (D-068).
      expect(texts).toEqual(['text:CASA', 'text:DA ANA']);
    });

    it('says the lettering color is provisional until one is chosen', async () => {
      const { user } = await squarePlate();
      const provisional = /Cor do texto ainda não escolhida: o texto aparece em uma cor provisória/;

      await user.type(screen.getByLabelText('Texto'), 'Ana');
      expect(within(preview()).getByText(provisional)).toBeInTheDocument();
      expect(within(review()).getByText('Não escolhida')).toBeInTheDocument();

      await choose(user, 'Cor do texto', 'Test ink A');
      expect(within(preview()).queryByText(provisional)).not.toBeInTheDocument();
      expect(within(review()).getByText('Test ink A')).toBeInTheDocument();
    });

    it('draws the text over the plate, never under it', async () => {
      const { user } = await squarePlate();

      await user.type(screen.getByLabelText('Texto'), 'Ana');

      // The signature is painted last, over everything (D-060).
      expect(painted(currentContext())).toEqual([
        SQUARE_PLATE,
        'text:ANA',
        'deboss',
        'signature',
        'signature',
      ]);
    });

    it('keeps the stored text exactly as typed', async () => {
      const { user } = await squarePlate();
      const field = screen.getByLabelText('Texto');

      await user.type(field, '  Ana{Enter}Maria  ');

      expect(field).toHaveValue('  Ana\nMaria  ');
      // Shown as lettered; the stored text keeps its case (D-068).
      expect(summaryText()?.textContent).toBe('  ANA\nMARIA  ');
    });

    describe('line limit (D-063)', () => {
      const field = () => screen.getByLabelText<HTMLTextAreaElement>('Texto');
      const limitNote = () => document.getElementById('text-line-limit');
      const LIMIT = 'Este modelo comporta no máximo 3 linhas.';

      it('refuses a line break past the 3 lines the area holds, keeping text and caret', async () => {
        const { user } = await squarePlate();

        await user.type(field(), 'L0{Enter}L1{Enter}L2');
        expect(limitNote()).toBeEmptyDOMElement();

        await user.type(field(), '{Enter}');
        expect(field()).toHaveValue('L0\nL1\nL2');
        expect(field().selectionStart).toBe(8);
        expect(limitNote()).toHaveTextContent(LIMIT);
        expect(field()).toHaveAccessibleDescription(new RegExp(LIMIT));
        expect(within(preview()).queryByText(/O texto não cabe/)).toBeNull();

        // Any accepted edit clears the note.
        await user.type(field(), 'x');
        expect(field()).toHaveValue('L0\nL1\nL2x');
        expect(limitNote()).toBeEmptyDOMElement();
      });

      it('refuses pasted lines past the area, also into an empty field', async () => {
        const { user } = await squarePlate();

        await user.click(field());
        await user.paste('a\nb\nc\nd');
        expect(field()).toHaveValue('');
        expect(limitNote()).toHaveTextContent(LIMIT);

        await user.paste('a\nb\nc');
        expect(field()).toHaveValue('a\nb\nc');
      });

      it('shows text that wraps past the area as an error beside the field and among the export reasons', async () => {
        const { user } = await squarePlate();
        await choose(user, 'Cor do texto', 'Test ink A');

        // Sem serifa: at most 10 spaced capitals per 240 px line (D-072), so the word wraps.
        await user.type(field(), 'L0{Enter}L1{Enter}L2 abcdefgh');

        const message =
          'O texto não cabe na área do modelo: 1 linha a mais. Reduza o texto ou use menos linhas.';
        expect(field()).toHaveAttribute('aria-invalid', 'true');
        expect(field()).toHaveAccessibleDescription(new RegExp(message.replace(/\./g, '\\.')));
        expect(document.getElementById('text-overflow')).toHaveClass('field__error--alert');
        expect(within(preview()).getByText(message)).toHaveClass('preview__notice--error');
        expect(finalize().querySelector('#export-reasons')).toHaveTextContent(message);
        expect(within(finalize()).getByRole('button', { name: 'Baixar imagem' })).toHaveAttribute(
          'aria-disabled',
          'true',
        );

        await user.type(field(), '{Backspace}'.repeat(9));
        expect(field()).not.toHaveAttribute('aria-invalid');
        expect(document.getElementById('text-overflow')).toBeNull();
      });

      it('applies no limit while the model has no approved lettering size', async () => {
        const { user } = setup();
        await choosePlate(user, /^Test plate size pending /);
        settle();

        await user.type(field(), 'a{Enter}b{Enter}c{Enter}d{Enter}e');
        expect(field()).toHaveValue('a\nb\nc\nd\ne');
        expect(limitNote()).toBeEmptyDOMElement();
      });
    });

    it('warns instead of clipping when the text does not fit', async () => {
      const { user } = await squarePlate();

      await user.click(screen.getByLabelText('Texto'));
      // No line breaks (those are refused past the area, D-063): 40 words that wrap one per line.
      await user.paste(Array.from({ length: 40 }, (_, i) => `linha${i}`).join(' '));

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

      // A word that wraps onto a fourth line (240 px wide: at most 10 spaced capitals, D-072).
      await user.type(field, ' abcdefgh');
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
        'text:ABCDEFGH',
      ]);

      await user.type(field, ' abcdefgh');
      expect(within(preview()).getByText(/: 2 linhas a mais\./)).toBeVisible();

      await user.type(field, '{Backspace}'.repeat(18));
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
      expect(summaryText()).toHaveTextContent('ANA');
      // A complete configuration still cannot be exported without an approved size.
      const exportButton = within(finalize()).getByRole('button', { name: 'Baixar imagem' });
      expect(exportButton).toHaveAttribute('aria-disabled', 'true');
      // The reason is named in the export list, not only in the preview (D-063).
      expect(finalize().querySelector('#export-reasons')).toHaveTextContent(message);
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
      expect(summaryText()).toHaveTextContent('ANA');
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

      expect(canvas()).toHaveAccessibleDescription(/Test plate square.*ANA/s);
    });
  });

  describe('text position (D-044)', () => {
    const positionGroup = () => screen.getByRole('group', { name: 'Posição do texto' });
    const button = (name: string) => within(positionGroup()).getByRole('button', { name });
    const alignment = (name: string) => within(positionGroup()).getByRole('radio', { name });
    /** The one position announcement (D-057). */
    const status = () => within(positionGroup()).getByRole('status');
    /**
     * Each painted lettering line as [left, right]: runs are drawn left-aligned
     * (D-072); the fake measures half the font size per character.
     */
    const lineEdges = () =>
      currentContext()
        .drawn.filter((entry) => entry.op === 'fillText' && entry.text !== '© TAAVI')
        .map((entry) => {
          if (entry.op !== 'fillText') return [];
          const width = [...entry.text].length * fontSizeOf(entry.font) * 0.5;
          return [entry.x, entry.x + width];
        });
    const firstLine = () => lineEdges()[0];

    async function withText() {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      settle();
      // Com serifa: no letter spacing and the catalog size, 20 px per character (D-072).
      await choose(user, 'Fonte', 'Com serifa');
      await user.type(screen.getByLabelText('Texto'), 'Ana');
      // The canvas is displayed at the scene's size (400×400) at the page origin.
      const element = preview().querySelector('canvas');
      if (!element) throw new Error('No canvas');
      element.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 400, height: 400, x: 0, y: 0 }) as DOMRect;
      return { user, element };
    }

    it('shows only a hint until the text is drawn on the image (D-058)', async () => {
      const { user } = setup();
      const step = () => screen.getByRole('region', { name: 'Posição do texto' });
      const hint =
        'Disponível quando o texto aparece na pré-visualização: escolha o modelo e digite o texto.';
      expect(within(step()).getByText(hint)).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Posição do texto' })).toBeNull();

      await choosePlate(user, /^Test plate square /);
      settle();
      expect(within(step()).getByText(hint)).toBeInTheDocument();

      await user.type(screen.getByLabelText('Texto'), 'Ana');
      expect(within(step()).queryByText(hint)).toBeNull();
      expect(button('Centro')).toHaveAttribute('aria-pressed', 'true');
      expect(alignment('Centralizar texto')).toBeChecked();
      expect(status()).toHaveTextContent('Posição: Centro.');
      expect(button('Redefinir posição')).toBeDisabled();
      // One section: the groups are named for assistive technology, without visible captions.
      expect(within(positionGroup()).getAllByRole('status')).toHaveLength(1);
      // The nine presets with a short explanation; no manual mode, arrows, or dragging (D-068).
      expect(
        screen.getByRole('group', { name: 'Posições predefinidas' }),
      ).toHaveAccessibleDescription('Escolha onde o bloco de texto fica na peça.');
      expect(within(positionGroup()).queryByText('Posições predefinidas')).toBeNull();
      expect(
        within(positionGroup()).queryByRole('radio', { name: 'Ajustar manualmente' }),
      ).toBeNull();
      expect(within(positionGroup()).queryByRole('radio', { name: 'Escolher posição' })).toBeNull();
      expect(within(positionGroup()).queryByRole('button', { name: /^Mover/ })).toBeNull();
      expect(within(positionGroup()).queryByText(/arraste/i)).toBeNull();
      expect(canvas()?.style.touchAction).toBe('');
    });

    it('offers icon-only alignment options, named for assistive technology', async () => {
      await withText();
      const options = within(
        screen.getByRole('group', { name: 'Alinhamento das linhas' }),
      ).getAllByRole('radio');

      expect(options.map((option) => option.getAttribute('aria-label'))).toEqual([
        'Alinhar à esquerda',
        'Centralizar texto',
        'Alinhar à direita',
      ]);
      // No visible text in the options: only the icons.
      for (const option of options) expect(option.closest('label')).toHaveTextContent(/^$/);
    });

    it('applies a preset to the position only, keeping the line alignment (D-059)', async () => {
      const { user } = await withText();

      await user.click(button('Superior à esquerda'));

      expect(button('Superior à esquerda')).toHaveAttribute('aria-pressed', 'true');
      expect(button('Centro')).toHaveAttribute('aria-pressed', 'false');
      expect(status()).toHaveTextContent('Posição: Superior à esquerda.');
      // Area x 80–320: the block ("Ana", 60 wide) starts at the left edge.
      expect(firstLine()).toEqual([80, 140]);
      expect(alignment('Centralizar texto')).toBeChecked();
    });

    it('aligns the lines with three options, without moving the block (D-059)', async () => {
      const { user } = await withText();
      const radios = within(
        screen.getByRole('group', { name: 'Alinhamento das linhas' }),
      ).getAllByRole('radio');
      expect(radios.map((radio) => radio.getAttribute('value'))).toEqual([
        'left',
        'center',
        'right',
      ]);
      await user.clear(screen.getByLabelText('Texto'));
      await user.type(screen.getByLabelText('Texto'), 'Ana{Enter}Casa da Ana');
      // Block 220 wide (the longer line), centered in the area: x 90–310.
      expect(lineEdges()).toEqual([
        [170, 230],
        [90, 310],
      ]);
      await user.click(alignment('Alinhar à direita'));
      expect(lineEdges()).toEqual([
        [250, 310],
        [90, 310],
      ]);
      expect(button('Centro')).toHaveAttribute('aria-pressed', 'true');
      expect(status()).toHaveTextContent('Posição: Centro.');
      await user.click(alignment('Alinhar à esquerda'));
      expect(lineEdges()).toEqual([
        [90, 150],
        [90, 310],
      ]);

      // A preset then moves the block and keeps the left alignment.
      await user.click(button('Inferior à direita'));
      expect(lineEdges()).toEqual([
        [100, 160],
        [100, 320],
      ]);
      expect(alignment('Alinhar à esquerda')).toBeChecked();
      const summary = within(review()).getByText('Alinhamento:', { selector: 'dt' });
      expect(summary.nextElementSibling).toHaveTextContent('À esquerda');
    });

    it('changes the alignment with the arrow keys, as one radio group', async () => {
      const { user } = await withText();
      alignment('Centralizar texto').focus();

      await user.keyboard('{ArrowRight}');
      expect(alignment('Alinhar à direita')).toBeChecked();
      expect(alignment('Alinhar à direita')).toHaveFocus();
      // One line: the block is the line, so it stays at x 170–230.
      expect(firstLine()).toEqual([170, 230]);
      await user.keyboard('{ArrowLeft}{ArrowLeft}');
      expect(alignment('Alinhar à esquerda')).toBeChecked();
      expect(firstLine()).toEqual([170, 230]);
      expect(status()).toHaveTextContent('Posição: Centro.');
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
      const summary = within(review()).getByText('Posição:', { selector: 'dt' });
      expect(summary.nextElementSibling).toHaveTextContent('Meio à direita');
    });

    it('resets the position to the catalog default, keeping the chosen alignment', async () => {
      const { user } = await withText();
      await user.click(alignment('Alinhar à direita'));
      expect(button('Redefinir posição')).toBeDisabled();
      await user.click(button('Inferior à direita'));

      await user.click(button('Redefinir posição'));

      expect(button('Centro')).toHaveAttribute('aria-pressed', 'true');
      expect(status()).toHaveTextContent('Posição: Centro.');
      expect(button('Redefinir posição')).toBeDisabled();
      // Block "Ana" centered (x 170–230), its line right-aligned.
      expect(firstLine()).toEqual([170, 230]);
      expect(alignment('Alinhar à direita')).toBeChecked();
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
    const exportButton = () => within(finalize()).getByRole('button', { name: 'Baixar imagem' });
    const reasons = () => finalize().querySelector('#export-reasons');
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
      expect(reasons()).toHaveTextContent('Falta escolher: Texto, Cor do texto.');

      await user.click(exportButton());
      exportButton().focus();
      await user.keyboard('{Enter} ');
      expect(clicked).toHaveLength(0);
    });

    it('names each preview problem among the reasons (D-063)', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      await user.type(screen.getByLabelText('Texto'), 'Ana');
      await choose(user, 'Cor do texto', 'Test ink A');
      // Images still loading.
      expect(reasons()).toHaveTextContent('Carregando imagem…');
      expect(exportButton()).toHaveAccessibleDescription(/Carregando imagem…/);
    });

    it('downloads taavi-{plateId}.png and confirms it', async () => {
      const { user } = await ready();

      await user.click(exportButton());

      expect(
        await within(finalize()).findByText('Imagem exportada: taavi-test-plate-square.png'),
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

      expect(await within(finalize()).findByRole('alert')).toHaveTextContent(
        'Não foi possível gerar a imagem. Tente novamente.',
      );
      expect(exportButton()).toHaveAttribute('aria-disabled', 'false');
      toBlob.mockRestore();
      installFakeCanvas();
      await user.click(exportButton());
      expect(await within(finalize()).findByText(/Imagem exportada:/)).toBeInTheDocument();
      expect(within(finalize()).queryByRole('alert')).toBeNull();
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

      expect(await within(finalize()).findByRole('alert')).toHaveTextContent(
        'Não foi possível gerar a imagem. Tente novamente.',
      );
      expect(clicked).toHaveLength(0);
    });
  });

  describe('overflowing text keeps its preset (D-044)', () => {
    it('names the preset while an axis has no free space, and after the text fits again', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      settle();
      const field = screen.getByLabelText('Texto');
      await user.type(field, 'Ana');
      // The controls are replaced by a hint while the field is empty: always query afresh.
      const group = () => screen.getByRole('group', { name: 'Posição do texto' });
      const status = () => within(group()).getByRole('status');
      await user.click(within(group()).getByRole('button', { name: 'Superior à esquerda' }));
      await user.clear(field);
      // Words that wrap one per line (line breaks past the area are refused, D-063).
      await user.type(field, Array.from({ length: 30 }, () => 'abcdefghij').join(' '));
      expect(status()).toHaveTextContent('Posição: Superior à esquerda.');

      await user.clear(field);
      await user.type(field, 'Ana');
      expect(status()).toHaveTextContent('Posição: Superior à esquerda.');
    });
  });
});

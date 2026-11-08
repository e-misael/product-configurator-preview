import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/App';
import { contextOf, type FakeContext } from '../support/fake-canvas';
import { FakeImage, installFakeImages } from '../support/fake-image';
import { previewCatalog, previewSizes } from '../preview/fixtures';

const SQUARE_PLATE = '/catalog/plates/test-plate-square/beige.webp';
const RECTANGLE_PLATE = '/catalog/plates/test-plate-rectangle/beige.webp';
const SQUARE_BACK = '/catalog/frames/test-frame-any/square-back.webp';
const SQUARE_FRONT = '/catalog/frames/test-frame-any/square-front.webp';

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
function painted(ctx: FakeContext) {
  return ctx.drawn.map((call) =>
    call.op === 'fillText' ? `text:${call.text}` : (call.image as { src: string }).src,
  );
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

  describe('frame', () => {
    async function squareWithFrame() {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      await choose(user, 'Moldura (opcional)', 'Test frame any');
      return { user };
    }

    it('layers frame back, plate, then frame front', async () => {
      await squareWithFrame();
      settle();

      expect(painted(currentContext())).toEqual([SQUARE_BACK, SQUARE_PLATE, SQUARE_FRONT]);
      expect(canvas()).toHaveAccessibleName('Frame, square; Square');
    });

    it('puts the text between the plate and the frame front', async () => {
      const { user } = await squareWithFrame();
      settle();

      await user.type(screen.getByLabelText('Texto'), 'Ana');

      expect(painted(currentContext())).toEqual([
        SQUARE_BACK,
        SQUARE_PLATE,
        'text:Ana',
        SQUARE_FRONT,
      ]);
    });

    it('does not paint a frame that became incompatible, and says so', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      await choose(user, 'Moldura (opcional)', 'Test frame any');
      settle();
      expect(painted(currentContext())).toEqual([SQUARE_BACK, SQUARE_PLATE, SQUARE_FRONT]);

      // Compatible with squares only, so the rectangular model cannot take it.
      await choose(user, 'Moldura (opcional)', 'Test frame square');
      await choosePlate(user, /^Test plate rectangle /);
      settle();

      expect(
        within(preview()).getByText('A moldura selecionada é incompatível e não é exibida.'),
      ).toBeVisible();
      expect(painted(currentContext())).toEqual([RECTANGLE_PLATE]);
    });

    it('shows the plate alone, with a message, when the frame is not calibrated', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate rectangle /);
      await choose(user, 'Moldura (opcional)', 'Test frame any');
      settle();

      expect(
        within(preview()).getByText(
          'A posição do modelo nesta moldura ainda não foi calibrada; a moldura não é exibida.',
        ),
      ).toBeVisible();
      expect(painted(currentContext())).toEqual([RECTANGLE_PLATE]);
    });

    it('shows the plate alone when a frame file fails to load', async () => {
      await squareWithFrame();

      act(() => {
        FakeImage.load(SQUARE_PLATE);
        FakeImage.load(SQUARE_BACK);
        FakeImage.fail(SQUARE_FRONT);
      });

      expect(
        within(preview()).getByText(
          'Não foi possível carregar a imagem da moldura; a moldura não é exibida.',
        ),
      ).toBeVisible();
      expect(painted(currentContext())).toEqual([SQUARE_PLATE]);
    });

    it('says the frame image is pending when none is registered for the plate', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      await choose(user, 'Moldura (opcional)', 'Test frame square');
      settle();

      expect(
        within(preview()).getByText(
          'A imagem desta moldura para este modelo ainda não está disponível; a moldura não é exibida.',
        ),
      ).toBeVisible();
      expect(painted(currentContext())).toEqual([SQUARE_PLATE]);
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

    it('draws the text over the plate, never under it', async () => {
      const { user } = await squarePlate();

      await user.type(screen.getByLabelText('Texto'), 'Ana');

      expect(painted(currentContext())).toEqual([SQUARE_PLATE, 'text:Ana']);
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

      expect(
        within(preview()).getByText(
          'O texto não cabe na área do modelo, mesmo no tamanho mínimo. Reduza o texto.',
        ),
      ).toBeVisible();
      const texts = painted(currentContext()).filter((entry) => entry.startsWith('text:'));
      expect(texts).toHaveLength(40);
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
});

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/App';
import { contextOf, type FakeContext } from '../support/fake-canvas';
import { FakeImage, installFakeImages } from '../support/fake-image';
import { previewCatalog, previewSizes } from '../preview/fixtures';

const SQUARE_NUDE = '/catalog/plates/test-plate-square/nude.webp';
const SQUARE_COLORED = '/catalog/plates/test-plate-square/colored.webp';
const SQUARE_SHADE = '/catalog/plates/test-plate-square/test-color-colored.webp';
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
  choose(user, 'Placa', name);

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
    it('asks for a plate and shows no image', () => {
      setup();

      expect(
        within(preview()).getByText('Escolha uma placa para ver a pré-visualização.'),
      ).toBeVisible();
      expect(canvas()).not.toBeInTheDocument();
      expect(FakeImage.requestedSources).toEqual([]);
    });

    it('asks for a color once a plate is chosen', async () => {
      const { user } = setup();

      await choosePlate(user, /^Test plate square /);

      expect(within(preview()).getByText('Escolha a cor da placa para ver a foto.')).toBeVisible();
      expect(canvas()).not.toBeInTheDocument();
    });
  });

  describe('plate image', () => {
    it('shows loading, then paints the exact image', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      await choose(user, 'Cor da placa', 'Nude');

      expect(within(preview()).getByText('Carregando imagem…')).toBeVisible();
      expect(canvas()).not.toBeInTheDocument();

      settle();

      expect(within(preview()).queryByText('Carregando imagem…')).not.toBeInTheDocument();
      expect(canvas()).toHaveAccessibleName('Square, nude');
      expect(painted(currentContext())).toContain(SQUARE_NUDE);
    });

    it('swaps to the photograph of the newly chosen color, never reusing the old one', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      await choose(user, 'Cor da placa', 'Nude');
      settle();

      await choose(user, 'Cor da placa', 'Colorida');
      settle();

      const drawn = painted(currentContext());
      expect(drawn).toContain(SQUARE_COLORED);
      expect(drawn).not.toContain(SQUARE_NUDE);
    });

    it('uses the photograph of the exact shade', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      await choose(user, 'Cor da placa', 'Colorida');
      await choose(user, 'Tom específico (opcional)', 'Test colored');
      settle();

      expect(painted(currentContext())).toEqual([SQUARE_SHADE]);
    });

    it('says the image is pending, and shows nothing else, when the shade has no photograph', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      await choose(user, 'Cor da placa', 'Nude');
      settle();

      await choose(user, 'Tom específico (opcional)', 'Test nude');
      settle();

      expect(
        within(preview()).getByText('A foto desta placa nesta cor ainda não está disponível.'),
      ).toBeVisible();
      expect(canvas()).not.toBeInTheDocument();
      expect(
        within(preview()).queryByText('Não foi possível carregar a imagem da placa.'),
      ).toBeNull();
    });

    it('distinguishes a file that fails to load from a missing catalog image', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      await choose(user, 'Cor da placa', 'Nude');

      act(() => FakeImage.fail(SQUARE_NUDE));

      expect(
        within(preview()).getByText('Não foi possível carregar a imagem da placa.'),
      ).toBeVisible();
      expect(
        within(preview()).queryByText('A foto desta placa nesta cor ainda não está disponível.'),
      ).toBeNull();
      expect(canvas()).not.toBeInTheDocument();
    });

    it('shows nothing for a color that conflicts with the plate', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      await choose(user, 'Cor da placa', 'Colorida');
      settle();

      await choosePlate(user, /^Test plate rectangle /);

      expect(
        within(preview()).getByText(
          'A cor escolhida não é válida para esta placa; a foto não é exibida.',
        ),
      ).toBeVisible();
      expect(canvas()).not.toBeInTheDocument();
    });
  });

  describe('frame', () => {
    async function squareWithFrame() {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      await choose(user, 'Cor da placa', 'Nude');
      await choose(user, 'Quadro', 'Test frame any');
      return { user };
    }

    it('layers frame back, plate, then frame front', async () => {
      await squareWithFrame();
      settle();

      expect(painted(currentContext())).toEqual([SQUARE_BACK, SQUARE_NUDE, SQUARE_FRONT]);
      expect(canvas()).toHaveAccessibleName('Frame, square; Square, nude');
    });

    it('puts the text between the plate and the frame front', async () => {
      const { user } = await squareWithFrame();
      settle();

      await user.type(screen.getByLabelText('Texto'), 'Ana');

      expect(painted(currentContext())).toEqual([
        SQUARE_BACK,
        SQUARE_NUDE,
        'text:Ana',
        SQUARE_FRONT,
      ]);
    });

    it('does not paint a frame that became incompatible, and says so', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      await choose(user, 'Cor da placa', 'Nude');
      await choose(user, 'Quadro', 'Test frame any');
      settle();
      expect(painted(currentContext())).toEqual([SQUARE_BACK, SQUARE_NUDE, SQUARE_FRONT]);

      // Compatible with squares only, so the rectangular plate cannot take it.
      await choose(user, 'Quadro', 'Test frame square');
      await choosePlate(user, /^Test plate rectangle /);
      await choose(user, 'Cor da placa', 'Nude');
      settle();

      expect(
        within(preview()).getByText('O quadro selecionado é incompatível e não é exibido.'),
      ).toBeVisible();
      expect(painted(currentContext())).toEqual(['/catalog/plates/test-plate-rectangle/nude.webp']);
    });

    it('shows the plate alone, with a message, when the frame is not calibrated', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate rectangle /);
      await choose(user, 'Cor da placa', 'Nude');
      await choose(user, 'Quadro', 'Test frame any');
      settle();

      expect(
        within(preview()).getByText(
          'A posição da placa neste quadro ainda não foi calibrada; o quadro não é exibido.',
        ),
      ).toBeVisible();
      expect(painted(currentContext())).toEqual(['/catalog/plates/test-plate-rectangle/nude.webp']);
    });

    it('shows the plate alone when a frame file fails to load', async () => {
      await squareWithFrame();

      act(() => {
        FakeImage.load(SQUARE_NUDE);
        FakeImage.load(SQUARE_BACK);
        FakeImage.fail(SQUARE_FRONT);
      });

      expect(
        within(preview()).getByText(
          'Não foi possível carregar a imagem do quadro; o quadro não é exibido.',
        ),
      ).toBeVisible();
      expect(painted(currentContext())).toEqual([SQUARE_NUDE]);
    });

    it('says the frame image is pending when none is registered for the plate', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      await choose(user, 'Cor da placa', 'Nude');
      await choose(user, 'Quadro', 'Test frame square');
      settle();

      expect(
        within(preview()).getByText(
          'A imagem deste quadro para esta placa ainda não está disponível; o quadro não é exibido.',
        ),
      ).toBeVisible();
      expect(painted(currentContext())).toEqual([SQUARE_NUDE]);
    });
  });

  describe('text', () => {
    async function squareNude() {
      const { user } = setup();
      await choosePlate(user, /^Test plate square /);
      await choose(user, 'Cor da placa', 'Nude');
      settle();
      return { user };
    }

    it('updates the canvas as the user types, one line per line break', async () => {
      const { user } = await squareNude();

      await user.type(screen.getByLabelText('Texto'), 'Casa{Enter}da Ana');

      const texts = painted(currentContext()).filter((entry) => entry.startsWith('text:'));
      expect(texts).toEqual(['text:Casa', 'text:da Ana']);
    });

    it('draws the text over the plate, never under it', async () => {
      const { user } = await squareNude();

      await user.type(screen.getByLabelText('Texto'), 'Ana');

      expect(painted(currentContext())).toEqual([SQUARE_NUDE, 'text:Ana']);
    });

    it('keeps the stored text exactly as typed', async () => {
      const { user } = await squareNude();
      const field = screen.getByLabelText('Texto');

      await user.type(field, '  Ana{Enter}Maria  ');

      expect(field).toHaveValue('  Ana\nMaria  ');
      expect(preview().querySelector('.preview__text')?.textContent).toBe('  Ana\nMaria  ');
    });

    it('warns instead of clipping when the text does not fit', async () => {
      const { user } = await squareNude();

      await user.click(screen.getByLabelText('Texto'));
      await user.paste(Array.from({ length: 40 }, (_, i) => `linha ${i}`).join('\n'));

      expect(
        within(preview()).getByText(
          'O texto não cabe na área da placa, mesmo no tamanho mínimo. Reduza o texto.',
        ),
      ).toBeVisible();
      const texts = painted(currentContext()).filter((entry) => entry.startsWith('text:'));
      expect(texts).toHaveLength(40);
    });

    it('explains why text is not drawn when the plate has no calibrated text area', async () => {
      const { user } = setup();
      await choosePlate(user, /^Test plate rectangle /);
      await choose(user, 'Cor da placa', 'Nude');
      settle();

      await user.type(screen.getByLabelText('Texto'), 'Ana');

      expect(
        within(preview()).getByText(
          'A área do texto desta placa ainda não foi calibrada; o texto não aparece na imagem.',
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
      await choose(user, 'Cor da placa', 'Nude');
      settle();
      await user.type(screen.getByLabelText('Texto'), 'Ana');

      expect(canvas()).toHaveAccessibleDescription(/Test plate square.*Nude.*Ana/s);
    });
  });
});

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../src/App';
import { getCatalog } from '../../../src/catalog';
import {
  groupOf,
  MODEL_GROUPS,
  modelChoices,
  sizeLabel,
} from '../../../src/components/configurator/model-groups';
import { demoCatalog, demoModelGroups } from '../../../src/demo/demo-catalog';
import type { Catalog } from '../../../src/domain';
import { WATERMARK_SRC } from '../../../src/preview/watermark';
import { contextOf, type FakeContext } from '../support/fake-canvas';
import { FakeImage, installFakeImages } from '../support/fake-image';

/** Bandeja ondulada M and G grouped as one option with a "Tamanho" choice (D-057). */

const M = 'bandeja-ondulada-m-8';
const G = 'bandeja-ondulada-g-11';

beforeEach(() => {
  const sizes = Object.fromEntries(
    getCatalog().plates.flatMap((plate) =>
      plate.image ? [[plate.image.image.src, { width: 1060, height: 1060 }]] : [],
    ),
  );
  installFakeImages({ ...sizes, [WATERMARK_SRC]: { width: 1262, height: 1246 } });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function setup() {
  const user = userEvent.setup();
  render(<App />);
  return { user };
}

const group = (name: string) => screen.getByRole('group', { name });
const models = () => within(group('Modelo'));
const sizes = () => screen.queryByRole('group', { name: 'Tamanho' });
const preview = () => screen.getByRole('region', { name: 'Pré-visualização' });
const review = () => screen.getByRole('region', { name: 'Revisar personalização' });
const configStatus = () => screen.getByRole('region', { name: 'Situação da configuração' });
const exportButton = () => screen.getByRole('button', { name: 'Exportar imagem' });
/** The summary value for a term, e.g. "Modelo". */
const summary = (term: string) =>
  within(review()).getByText(`${term}:`, { selector: 'dt' }).nextElementSibling?.textContent;
const settle = () => act(() => FakeImage.loadAll());

/** Photographs (by file) and text runs painted on the preview canvas, without the signature. */
function painted(): string[] {
  const element = preview().querySelector('canvas');
  if (!element) return [];
  const ctx: FakeContext = contextOf(element);
  return ctx.drawn.flatMap((call) => {
    if (call.op === 'fillText') return call.text === '© Taavi' ? [] : [`text:${call.font}`];
    const { src } = call.image as { src?: string };
    return src?.startsWith('/catalog/') ? [src] : [];
  });
}

describe('illustrative tray preview before the size (M4.6)', () => {
  const PHOTO_M = '/catalog/plates/bandeja-ondulada-m-8/bege.jpg';
  const PHOTO_G = '/catalog/plates/bandeja-ondulada-g-11/bege.jpg';
  const notice = 'Selecione o tamanho para visualizar a personalização.';

  it('shows the shared photograph at once, without lettering, and blocks export', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Texto'), 'Ana');
    await user.click(within(group('Cor do texto')).getByRole('radio', { name: 'Azul' }));

    await user.click(models().getByRole('radio', { name: 'Bandeja ondulada' }));
    settle();

    expect(painted()).toEqual([PHOTO_M]);
    expect(within(preview()).getByRole('img')).toHaveAccessibleName(
      'Bandeja ondulada bege, sem texto',
    );
    expect(within(preview()).getByText(notice)).toBeInTheDocument();
    // No size is chosen or stored, and the size choice stays required.
    expect(within(group('Tamanho')).queryByRole('radio', { checked: true })).toBeNull();
    expect(summary('Tamanho')).toBe('Não escolhido');
    expect(configStatus()).toHaveTextContent('Falta escolher: Tamanho.');
    expect(exportButton()).toHaveAttribute('aria-disabled', 'true');
    expect(exportButton()).toHaveAccessibleDescription(/Falta escolher: Tamanho/);
    // Without lettering there is nothing to position yet.
    expect(screen.queryByRole('group', { name: 'Posição do texto' })).toBeNull();
  });

  it('draws the lettering at the chosen size once M or G is selected, and switches with it', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Texto'), 'Ana');
    await user.click(within(group('Cor do texto')).getByRole('radio', { name: 'Azul' }));
    await user.click(models().getByRole('radio', { name: 'Bandeja ondulada' }));
    settle();

    await user.click(within(group('Tamanho')).getByRole('radio', { name: 'G — 11 × 11 cm' }));
    settle();
    // G: 0.0851 of the 1060 px photograph; M: 0.117; both × 0.7046 / 0.7 for Quicksand (D-072).
    expect(painted()).toEqual([
      PHOTO_G,
      expect.stringMatching(/^text:700 90\.79\d*px "Taavi Lettering Sans"/),
    ]);
    expect(within(preview()).queryByText(notice)).toBeNull();
    expect(exportButton()).toHaveAttribute('aria-disabled', 'false');

    await user.click(within(group('Tamanho')).getByRole('radio', { name: 'M — 8 × 8 cm' }));
    settle();
    expect(painted()).toEqual([
      PHOTO_M,
      expect.stringMatching(/^text:700 124\.83\d*px "Taavi Lettering Sans"/),
    ]);
    expect(exportButton()).toHaveAttribute('aria-disabled', 'false');
  });

  it('loads each photograph once: no reload when going back to a size', async () => {
    const { user } = setup();
    await user.click(models().getByRole('radio', { name: 'Bandeja ondulada' }));
    settle();
    // The illustration is M's photograph: choosing M requests nothing new.
    await user.click(within(group('Tamanho')).getByRole('radio', { name: 'M — 8 × 8 cm' }));
    expect(FakeImage.requestedSources).not.toContain(PHOTO_M);
    expect(painted()[0]).toBe(PHOTO_M);

    await user.click(within(group('Tamanho')).getByRole('radio', { name: 'G — 11 × 11 cm' }));
    expect(FakeImage.requestedSources).toContain(PHOTO_G);
    settle();
    // Back to M: the loaded photograph is reused, without a new request.
    await user.click(within(group('Tamanho')).getByRole('radio', { name: 'M — 8 × 8 cm' }));
    expect(FakeImage.requestedSources).toEqual([]);
    expect(painted()[0]).toBe(PHOTO_M);
  });

  it('keeps the other models as they were: no illustration, their own lettering', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Texto'), 'Ana');
    await user.click(models().getByRole('radio', { name: 'Placa cerâmica — 10 × 10 cm' }));
    settle();

    expect(painted()).toHaveLength(2);
    expect(within(preview()).queryByText(notice)).toBeNull();
  });
});

describe('model groups (D-057)', () => {
  describe('grouping table', () => {
    it('groups the two Bandeja models by their real IDs', () => {
      const catalog = getCatalog();
      expect(MODEL_GROUPS).toHaveLength(1);
      for (const size of MODEL_GROUPS[0]?.sizes ?? []) {
        expect(catalog.plates.some((plate) => plate.id === size.plateId)).toBe(true);
      }
      expect(groupOf(MODEL_GROUPS, M)?.name).toBe('Bandeja ondulada');
      expect(groupOf(MODEL_GROUPS, G)?.name).toBe('Bandeja ondulada');
      expect(groupOf(MODEL_GROUPS, 'placa-ceramica-10')).toBeUndefined();
      expect(groupOf(MODEL_GROUPS, null)).toBeUndefined();
    });

    it('labels sizes with the letter and the supplied size label', () => {
      const catalog = getCatalog();
      const label = (id: string) => {
        const plate = catalog.plates.find((candidate) => candidate.id === id);
        return plate && sizeLabel(MODEL_GROUPS, plate);
      };
      expect(label(M)).toBe('M — 8 × 8 cm');
      expect(label(G)).toBe('G — 11 × 11 cm');
      expect(label('quadro-20')).toBe('20 × 20 cm');
    });

    it('keeps catalog order and offers only available sizes', () => {
      const catalog = getCatalog();
      expect(
        modelChoices(catalog, MODEL_GROUPS).map((choice) =>
          choice.kind === 'plate' ? choice.plate.id : choice.group.id,
        ),
      ).toEqual(['placa-ceramica-10', 'quadro-20', 'bandeja-ondulada']);

      const onlyG: Catalog = {
        ...catalog,
        plates: catalog.plates.map((plate) =>
          plate.id === M ? { ...plate, available: false } : plate,
        ),
      };
      const [, , bandeja] = modelChoices(onlyG, MODEL_GROUPS);
      expect(bandeja?.kind === 'group' && bandeja.plates.map((plate) => plate.id)).toEqual([G]);

      const none: Catalog = {
        ...catalog,
        plates: catalog.plates.map((plate) =>
          groupOf(MODEL_GROUPS, plate.id) ? { ...plate, available: false } : plate,
        ),
      };
      expect(modelChoices(none, MODEL_GROUPS)).toHaveLength(2);
    });
  });

  describe('Modelo and Tamanho', () => {
    it('offers one Bandeja ondulada option, described, without a size preselected', async () => {
      const { user } = setup();

      expect(
        models()
          .getAllByRole('radio')
          .map((radio) => radio.getAttribute('value')),
      ).toEqual(['placa-ceramica-10', 'quadro-20', 'bandeja-ondulada']);
      const bandeja = models().getByRole('radio', { name: 'Bandeja ondulada' });
      expect(bandeja).toHaveAccessibleDescription('Disponível em dois tamanhos');
      expect(sizes()).toBeNull();

      await user.click(bandeja);

      expect(bandeja).toBeChecked();
      const size = within(group('Tamanho'));
      expect(size.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
        M,
        G,
      ]);
      expect(size.getByRole('radio', { name: 'M — 8 × 8 cm' })).not.toBeChecked();
      expect(size.getByRole('radio', { name: 'G — 11 × 11 cm' })).not.toBeChecked();
    });

    it('requires the size: status, export reasons, preview, and summary say so', async () => {
      const { user } = setup();
      await user.click(models().getByRole('radio', { name: 'Bandeja ondulada' }));

      // Marrom is the default lettering color (D-064).
      expect(configStatus()).toHaveTextContent('Falta escolher: Tamanho, Texto.');
      expect(exportButton()).toHaveAttribute('aria-disabled', 'true');
      expect(within(review()).getByText('Falta escolher: Tamanho.')).toBeInTheDocument();
      expect(
        within(preview()).getByText('Selecione o tamanho para visualizar a personalização.'),
      ).toBeInTheDocument();
      expect(summary('Modelo')).toBe('Bandeja ondulada');
      expect(summary('Tamanho')).toBe('Não escolhido');

      await user.click(within(group('Tamanho')).getByRole('radio', { name: 'M — 8 × 8 cm' }));

      expect(configStatus()).toHaveTextContent('Falta escolher: Texto.');
      expect(within(review()).queryByText('Falta escolher: Tamanho.')).toBeNull();
      expect(summary('Modelo')).toBe('Bandeja ondulada');
      expect(summary('Tamanho')).toBe('M — 8 × 8 cm');
    });

    it('shows ungrouped models with their own size row and no size choice', async () => {
      const { user } = setup();
      await user.click(models().getByRole('radio', { name: 'Placa cerâmica — 10 × 10 cm' }));

      expect(sizes()).toBeNull();
      expect(summary('Modelo')).toBe('Placa cerâmica');
      expect(summary('Tamanho')).toBe('10 × 10 cm');
      expect(configStatus()).toHaveTextContent('Falta escolher: Texto.');
    });

    it('clears the model when switching to the group, and the size when leaving it', async () => {
      const { user } = setup();
      await user.click(models().getByRole('radio', { name: 'Quadro — 20 × 20 cm' }));
      await user.click(models().getByRole('radio', { name: 'Bandeja ondulada' }));

      // No size is carried over or preselected.
      expect(within(group('Tamanho')).queryByRole('radio', { checked: true })).toBeNull();
      expect(summary('Tamanho')).toBe('Não escolhido');

      await user.click(within(group('Tamanho')).getByRole('radio', { name: 'G — 11 × 11 cm' }));
      await user.click(models().getByRole('radio', { name: 'Placa cerâmica — 10 × 10 cm' }));

      expect(sizes()).toBeNull();
      expect(summary('Modelo')).toBe('Placa cerâmica');

      await user.click(models().getByRole('radio', { name: 'Bandeja ondulada' }));
      expect(within(group('Tamanho')).queryByRole('radio', { checked: true })).toBeNull();
    });

    it('keeps text and colors when the size changes, and revalidates overflow', async () => {
      const { user } = setup();
      await user.click(models().getByRole('radio', { name: 'Bandeja ondulada' }));
      await user.click(within(group('Tamanho')).getByRole('radio', { name: 'G — 11 × 11 cm' }));
      settle();
      // G holds 4 lines at its fixed size; M holds 3.
      await user.type(screen.getByLabelText('Texto'), 'Ana{Enter}Luz{Enter}Casa{Enter}Mar');
      await user.click(within(group('Cor do texto')).getByRole('radio', { name: /Azul/ }));
      expect(within(preview()).queryByText(/O texto não cabe/)).toBeNull();
      expect(configStatus()).toHaveTextContent('Configuração completa.');

      await user.click(within(group('Tamanho')).getByRole('radio', { name: 'M — 8 × 8 cm' }));
      settle();

      expect(screen.getByLabelText('Texto')).toHaveValue('Ana\nLuz\nCasa\nMar');
      expect(within(group('Cor do texto')).getByRole('radio', { name: /Azul/ })).toBeChecked();
      expect(
        within(preview()).getByText(
          'O texto não cabe na área do modelo: 1 linha a mais. Reduza o texto ou use menos linhas.',
        ),
      ).toBeInTheDocument();
      expect(exportButton()).toHaveAttribute('aria-disabled', 'true');

      await user.click(within(group('Tamanho')).getByRole('radio', { name: 'G — 11 × 11 cm' }));
      settle();
      expect(within(preview()).queryByText(/O texto não cabe/)).toBeNull();
      expect(exportButton()).not.toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('tray lettering is always centered (D-068)', () => {
    it('hides every position and alignment control, before and after the size', async () => {
      const { user } = setup();
      await user.click(models().getByRole('radio', { name: 'Bandeja ondulada' }));
      const hint = 'Nas bandejas, o texto fica sempre centralizado.';

      // Before the size: the note beside the size and in place of the position controls.
      expect(group('Tamanho')).toHaveAccessibleDescription(hint);
      expect(screen.getAllByText(hint)).toHaveLength(2);
      expect(screen.queryByRole('group', { name: 'Posições predefinidas' })).toBeNull();

      for (const size of ['M — 8 × 8 cm', 'G — 11 × 11 cm']) {
        await user.click(within(group('Tamanho')).getByRole('radio', { name: size }));
        settle();
        await user.type(screen.getByLabelText('Texto'), 'Ana');
        expect(screen.queryByRole('group', { name: 'Posições predefinidas' })).toBeNull();
        expect(screen.queryByRole('radio', { name: 'Alinhar à esquerda' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Redefinir posição' })).toBeNull();
        expect(screen.getAllByText(hint).length).toBeGreaterThan(0);
        expect(summary('Alinhamento')).toBe('Centralizado');
        expect(summary('Posição')).toBe('Centro');
        await user.clear(screen.getByLabelText('Texto'));
      }
    });

    it("keeps another model's position and alignment for when it comes back", async () => {
      const { user } = setup();
      await user.click(models().getByRole('radio', { name: 'Placa cerâmica — 10 × 10 cm' }));
      settle();
      await user.type(screen.getByLabelText('Texto'), 'Ana');
      await user.click(screen.getByRole('button', { name: 'Superior à direita' }));
      await user.click(screen.getByRole('radio', { name: 'Alinhar à direita' }));
      expect(summary('Posição')).toBe('Superior à direita');
      expect(summary('Alinhamento')).toBe('À direita');

      await user.click(models().getByRole('radio', { name: 'Bandeja ondulada' }));
      await user.click(within(group('Tamanho')).getByRole('radio', { name: 'M — 8 × 8 cm' }));
      settle();
      expect(summary('Posição')).toBe('Centro');
      expect(summary('Alinhamento')).toBe('Centralizado');

      await user.click(models().getByRole('radio', { name: 'Placa cerâmica — 10 × 10 cm' }));
      settle();
      expect(summary('Posição')).toBe('Superior à direita');
      expect(summary('Alinhamento')).toBe('À direita');
      expect(screen.getByRole('button', { name: 'Superior à direita' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });

  describe('demo mode uses the same grouping over its own IDs', () => {
    const DEMO_M = 'demo-bandeja-ondulada-m-8';
    const DEMO_G = 'demo-bandeja-ondulada-g-11';

    it('groups only existing demo models, and production groups no demo model', () => {
      const ids = demoCatalog.plates.map((plate) => plate.id);
      for (const size of demoModelGroups.flatMap((entry) => entry.sizes)) {
        expect(ids).toContain(size.plateId);
      }
      expect(Object.isFrozen(demoModelGroups[0])).toBe(true);
      expect(groupOf(MODEL_GROUPS, DEMO_M)).toBeUndefined();
      expect(groupOf(demoModelGroups, M)).toBeUndefined();
    });

    it('offers one option with a required, unselected M/G size', async () => {
      const user = userEvent.setup();
      render(<App catalog={demoCatalog} modelGroups={demoModelGroups} />);

      const bandeja = models().getByRole('radio', { name: '(demonstração) Bandeja ondulada' });
      expect(bandeja).toHaveAccessibleDescription('Disponível em dois tamanhos');
      expect(
        models()
          .getAllByRole('radio')
          .map((radio) => radio.getAttribute('value')),
      ).toEqual(['demo-placa-ceramica', 'demo-quadro', 'demo-bandeja-ondulada']);
      expect(sizes()).toBeNull();

      await user.click(bandeja);
      const size = within(group('Tamanho'));
      expect(size.getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
        DEMO_M,
        DEMO_G,
      ]);
      expect(size.queryByRole('radio', { checked: true })).toBeNull();
      expect(configStatus()).toHaveTextContent('Falta escolher: Tamanho, Texto, Cor do texto.');

      await user.click(size.getByRole('radio', { name: 'G — 11 × 11 cm' }));
      expect(summary('Modelo')).toBe('(demonstração) Bandeja ondulada');
      expect(summary('Tamanho')).toBe('G — 11 × 11 cm');
      expect(configStatus()).toHaveTextContent('Falta escolher: Texto, Cor do texto.');
    });
  });
});

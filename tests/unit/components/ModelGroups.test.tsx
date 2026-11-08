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
  installFakeImages(sizes);
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
const configStatus = () => screen.getByRole('region', { name: 'Situação da configuração' });
const exportButton = () => screen.getByRole('button', { name: 'Exportar imagem' });
/** The summary value for a term, e.g. "Modelo". */
const summary = (term: string) =>
  within(preview()).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
const settle = () => act(() => FakeImage.loadAll());

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

      expect(configStatus()).toHaveTextContent('Falta escolher: Tamanho, Texto, Cor do texto.');
      expect(exportButton()).toHaveAttribute('aria-disabled', 'true');
      expect(within(preview()).getByText('Falta escolher: Tamanho.')).toBeInTheDocument();
      expect(
        within(preview()).getByText('Escolha o tamanho para ver a pré-visualização.'),
      ).toBeInTheDocument();
      expect(summary('Modelo')).toBe('Bandeja ondulada');
      expect(summary('Tamanho')).toBe('Não escolhido');

      await user.click(within(group('Tamanho')).getByRole('radio', { name: 'M — 8 × 8 cm' }));

      expect(configStatus()).toHaveTextContent('Falta escolher: Texto, Cor do texto.');
      expect(within(preview()).queryByText('Falta escolher: Tamanho.')).toBeNull();
      expect(summary('Modelo')).toBe('Bandeja ondulada');
      expect(summary('Tamanho')).toBe('M — 8 × 8 cm');
    });

    it('shows ungrouped models with their own size row and no size choice', async () => {
      const { user } = setup();
      await user.click(models().getByRole('radio', { name: 'Placa cerâmica — 10 × 10 cm' }));

      expect(sizes()).toBeNull();
      expect(summary('Modelo')).toBe('Placa cerâmica');
      expect(summary('Tamanho')).toBe('10 × 10 cm');
      expect(configStatus()).toHaveTextContent('Falta escolher: Texto, Cor do texto.');
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

    it('keeps text, colors, and position when the size changes, and revalidates overflow', async () => {
      const { user } = setup();
      await user.click(models().getByRole('radio', { name: 'Bandeja ondulada' }));
      await user.click(within(group('Tamanho')).getByRole('radio', { name: 'G — 11 × 11 cm' }));
      settle();
      // G holds 4 lines at its fixed size; M holds 3.
      await user.type(screen.getByLabelText('Texto'), 'Ana{Enter}Luz{Enter}Casa{Enter}Mar');
      await user.click(within(group('Cor do texto')).getByRole('radio', { name: /Azul/ }));
      await user.click(screen.getByRole('button', { name: 'Superior à esquerda' }));
      expect(within(preview()).queryByText(/O texto não cabe/)).toBeNull();
      expect(configStatus()).toHaveTextContent('Configuração completa.');

      await user.click(within(group('Tamanho')).getByRole('radio', { name: 'M — 8 × 8 cm' }));
      settle();

      expect(screen.getByLabelText('Texto')).toHaveValue('Ana\nLuz\nCasa\nMar');
      expect(within(group('Cor do texto')).getByRole('radio', { name: /Azul/ })).toBeChecked();
      expect(screen.getByRole('button', { name: 'Superior à esquerda' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
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

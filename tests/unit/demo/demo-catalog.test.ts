import { validateCatalog, type AssetRef, type Catalog } from '../../../src/domain';
import { demoCatalog } from '../../../src/demo/demo-catalog';

const entries = [...demoCatalog.plates, ...demoCatalog.textColors];

describe('demo catalog (D-028)', () => {
  it('passes catalog validation', () => {
    expect(validateCatalog(demoCatalog)).toEqual({ status: 'valid' });
  });

  it('is deep-frozen', () => {
    expect(Object.isFrozen(demoCatalog)).toBe(true);
    expect(Object.isFrozen(demoCatalog.plates)).toBe(true);
    for (const entry of entries) expect(Object.isFrozen(entry)).toBe(true);
  });

  it.each(entries.map((entry) => [entry.id, entry] as const))(
    '%s is clearly labeled as demonstration data',
    (id, entry) => {
      expect(id.startsWith('demo-')).toBe(true);
      expect(entry.displayName).toContain('(demonstração)');
    },
  );

  it('invents no dimensions or color values', () => {
    for (const plate of demoCatalog.plates) {
      expect(plate.dimensions).toEqual({ status: 'pending' });
      expect(plate.ceramicColor).toBe('Bege');
      expect(plate).not.toHaveProperty('hex');
    }
  });

  it('mirrors the four production models by size label and shape', () => {
    expect(demoCatalog.plates.map(({ sizeLabel, shape }) => [sizeLabel, shape])).toEqual([
      ['10 × 10 cm', 'square'],
      ['20 × 20 cm', 'square'],
      ['Aprox. 8 cm', 'scalloped'],
      ['Aprox. 11 cm', 'scalloped'],
    ]);
  });

  it('offers at least two labeled lettering colors, so a secondary color can differ', () => {
    expect(demoCatalog.textColors.length).toBeGreaterThanOrEqual(2);
    for (const color of demoCatalog.textColors) {
      expect(color.id.startsWith('demo-letra')).toBe(true);
      expect(color.hex).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('mirrors the production model IDs with a demo- prefix (D-046)', () => {
    expect(demoCatalog.plates.map((plate) => plate.id)).toEqual([
      'demo-placa-ceramica',
      'demo-quadro',
      'demo-bandeja-ondulada-m-8',
      'demo-bandeja-ondulada-g-11',
    ]);
  });

  describe('synthetic imagery (D-036)', () => {
    /** The demo PNGs as data URLs, keyed by served path (`/catalog/...`). */
    const files = new Map(
      Object.entries(
        import.meta.glob<string>('/src/demo/public/catalog/**/*', {
          query: '?inline',
          import: 'default',
          eager: true,
        }),
      ).map(([file, url]) => [file.slice('/src/demo/public'.length), url]),
    );

    function assets(catalog: Catalog): { path: string; asset: AssetRef }[] {
      return catalog.plates.flatMap((plate, i) =>
        plate.image ? [{ path: `plates[${i}].image.image`, asset: plate.image.image }] : [],
      );
    }

    function bytesOf(src: string): Uint8Array {
      const url = files.get(src);
      if (url === undefined) throw new Error(`Missing demo file: ${src}`);
      return Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), (c) => c.charCodeAt(0));
    }

    it('references only files that exist, and every file is referenced', () => {
      const referenced = new Set(assets(demoCatalog).map(({ asset }) => asset.src));

      expect([...referenced].filter((src) => !files.has(src))).toEqual([]);
      expect([...files.keys()].filter((src) => !referenced.has(src))).toEqual([]);
    });

    it('declares dimensions that match the PNG files', () => {
      for (const { path, asset } of assets(demoCatalog)) {
        const bytes = bytesOf(asset.src);
        const view = new DataView(bytes.buffer);
        // PNG signature, then the IHDR chunk: width and height at bytes 16 and 20.
        expect(Array.from(bytes.slice(1, 4)), path).toEqual([0x50, 0x4e, 0x47]);
        expect([view.getUint32(16), view.getUint32(20)], path).toEqual([
          asset.widthPx,
          asset.heightPx,
        ]);
      }
    });

    it('embeds a synthetic-image marker in every file', () => {
      for (const src of files.keys()) {
        const text = String.fromCharCode(...bytesOf(src));
        expect(text, src).toContain(
          'Synthetic demonstration image - not a Taavi product photograph',
        );
      }
    });

    it('labels every described image as a demonstration', () => {
      for (const { path, asset } of assets(demoCatalog)) {
        if (asset.alt !== undefined) expect(asset.alt, path).toContain('demonstração');
      }
    });

    it('gives every model one image and no frame layers (D-046)', () => {
      expect(demoCatalog.plates.every((plate) => plate.image !== undefined)).toBe(true);
      expect([...files.keys()].every((src) => src.startsWith('/catalog/plates/'))).toBe(true);
    });
  });
});

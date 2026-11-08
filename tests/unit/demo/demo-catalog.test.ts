import { validateCatalog, type AssetRef, type Catalog } from '../../../src/domain';
import { demoCatalog } from '../../../src/demo/demo-catalog';

const entries = [...demoCatalog.plates, ...demoCatalog.frames, ...demoCatalog.colors];

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

  it('invents no dimensions, swatches, or colors', () => {
    for (const plate of demoCatalog.plates) {
      expect(plate.dimensions).toEqual({ status: 'pending' });
    }
    for (const color of demoCatalog.colors) {
      expect(color.swatch).toBeUndefined();
      expect(color).not.toHaveProperty('hex');
    }
  });

  it('covers a frameless circular plate and a frame restricted by shape', () => {
    expect(demoCatalog.plates.some((p) => p.shape === 'circle' && !p.supportsFrame)).toBe(true);
    expect(demoCatalog.frames.some((f) => f.compatibility.shapes.length === 1)).toBe(true);
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
      return [
        ...catalog.plates.flatMap((plate, i) =>
          (plate.images ?? []).map((entry, j) => ({
            path: `plates[${i}].images[${j}].image`,
            asset: entry.image,
          })),
        ),
        ...catalog.frames.flatMap((frame, i) =>
          (frame.images ?? []).flatMap((entry, j) => [
            { path: `frames[${i}].images[${j}].back`, asset: entry.back },
            ...(entry.front
              ? [{ path: `frames[${i}].images[${j}].front`, asset: entry.front }]
              : []),
          ]),
        ),
      ];
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

    it('covers square, rectangular, and circular plates and a frame composition', () => {
      const shapesWithImages = demoCatalog.plates
        .filter((plate) => (plate.images?.length ?? 0) > 0)
        .map((plate) => plate.shape);

      expect(shapesWithImages.sort()).toEqual(['circle', 'rectangle', 'square']);
      expect(demoCatalog.frames.some((frame) => (frame.images?.length ?? 0) > 0)).toBe(true);
      for (const frame of demoCatalog.frames) {
        for (const entry of frame.images ?? []) {
          expect(entry.platePlacement).toBeDefined();
          expect(entry.front).toBeDefined();
        }
      }
    });

    it('leaves one shade without a photograph to exercise the pending state', () => {
      const square = demoCatalog.plates.find((plate) => plate.id === 'demo-placa-quadrada');
      const shades = (square?.images ?? []).map((entry) => entry.colorId);

      expect(shades).toContain('demo-cor-colorida');
      expect(shades).not.toContain('demo-cor-nude');
    });
  });
});

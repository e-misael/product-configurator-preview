import { getCatalog } from '../../../src/catalog';
import type { AssetRef, Catalog } from '../../../src/domain';
import { buildImageCatalog } from '../domain/catalog-fixtures';

/**
 * Files present under public/catalog/, as served paths (`/catalog/...`).
 * Listed by Vite at test time; nothing is fetched.
 */
const publicFiles = new Set(
  Object.keys(import.meta.glob('/public/catalog/**/*')).map((file) => file.slice('/public'.length)),
);

/** PNG files under public/catalog/ as data URLs, keyed by served path. */
const pngFiles = new Map(
  Object.entries(
    import.meta.glob<string>('/public/catalog/**/*.png', {
      query: '?inline',
      import: 'default',
      eager: true,
    }),
  ).map(([file, url]) => [file.slice('/public'.length), url]),
);

/** Width and height from a PNG's IHDR chunk. */
function pngSize(url: string): [number, number] {
  const bytes = Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  expect(Array.from(bytes.slice(1, 4))).toEqual([0x50, 0x4e, 0x47]);
  return [view.getUint32(16), view.getUint32(20)];
}

/** Every asset reference in the catalog, with its location for diagnostics. */
function listAssets(catalog: Catalog): { path: string; asset: AssetRef }[] {
  const refs: { path: string; asset: AssetRef }[] = [];
  catalog.plates.forEach((plate, i) => {
    if (plate.image) refs.push({ path: `plates[${i}].image.image`, asset: plate.image.image });
  });
  return refs;
}

function missingFiles(catalog: Catalog, files: ReadonlySet<string>): string[] {
  return listAssets(catalog)
    .filter(({ asset }) => !files.has(asset.src))
    .map(({ path, asset }) => `${path}: ${asset.src}`);
}

/**
 * Asset gate: every image the production catalog references must exist under
 * `public/`. Checked on disk at test time, never fetched at runtime.
 * Declared `widthPx`/`heightPx` must match each file (M1.3b).
 */
describe('production catalog assets', () => {
  it('keeps demonstration images out of the production public directory (D-036)', () => {
    expect([...publicFiles].filter((file) => file.includes('demo-'))).toEqual([]);
  });

  it('accepts files that exist', () => {
    expect(
      missingFiles(buildImageCatalog(), new Set(['/catalog/plates/test-plate-a/beige.webp'])),
    ).toEqual([]);
  });

  it('references only files that exist under public/', () => {
    expect(missingFiles(getCatalog(), publicFiles)).toEqual([]);
  });

  it('declares sizes that match the image files', () => {
    for (const { path, asset } of listAssets(getCatalog())) {
      const url = pngFiles.get(asset.src);
      if (url === undefined) throw new Error(`${path}: only PNG sizes are checked: ${asset.src}`);
      expect(pngSize(url), path).toEqual([asset.widthPx, asset.heightPx]);
    }
  });

  it('detects missing files (synthetic catalog, no files on disk)', () => {
    expect(missingFiles(buildImageCatalog(), new Set())).toEqual([
      'plates[0].image.image: /catalog/plates/test-plate-a/beige.webp',
    ]);
  });
});

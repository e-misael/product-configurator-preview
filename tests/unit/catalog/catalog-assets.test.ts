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
 * M1.3b adds the check that declared `widthPx`/`heightPx` match each file.
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

  it('detects missing files (synthetic catalog, no files on disk)', () => {
    expect(missingFiles(buildImageCatalog(), new Set())).toEqual([
      'plates[0].image.image: /catalog/plates/test-plate-a/beige.webp',
    ]);
  });
});

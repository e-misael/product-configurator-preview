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
  catalog.colors.forEach((color, i) => {
    if (color.swatch) refs.push({ path: `colors[${i}].swatch`, asset: color.swatch });
  });
  catalog.plates.forEach((plate, i) => {
    plate.images?.forEach((entry, j) => {
      refs.push({ path: `plates[${i}].images[${j}].image`, asset: entry.image });
    });
  });
  catalog.frames.forEach((frame, i) => {
    frame.images?.forEach((entry, j) => {
      refs.push({ path: `frames[${i}].images[${j}].back`, asset: entry.back });
      if (entry.front) refs.push({ path: `frames[${i}].images[${j}].front`, asset: entry.front });
    });
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
  it('accepts files that exist', () => {
    expect(
      missingFiles(buildImageCatalog(), new Set(['/catalog/colors/test-color-nude/swatch.png'])),
    ).toHaveLength(4);
  });

  it('references only files that exist under public/', () => {
    expect(missingFiles(getCatalog(), publicFiles)).toEqual([]);
  });

  it('detects missing files (synthetic catalog, no files on disk)', () => {
    expect(missingFiles(buildImageCatalog(), new Set())).toEqual([
      'colors[0].swatch: /catalog/colors/test-color-nude/swatch.png',
      'plates[0].images[0].image: /catalog/plates/test-plate-a/nude.webp',
      'plates[0].images[1].image: /catalog/plates/test-plate-a/test-color-colored.png',
      'frames[0].images[0].back: /catalog/frames/test-frame-any/test-plate-b-back.webp',
      'frames[0].images[0].front: /catalog/frames/test-frame-any/test-plate-b-front.png',
    ]);
  });
});

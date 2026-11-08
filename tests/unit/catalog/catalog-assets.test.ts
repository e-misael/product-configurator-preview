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

/** PNG and JPEG files under public/catalog/ as data URLs, keyed by served path. */
const imageFiles = new Map(
  Object.entries(
    import.meta.glob<string>('/public/catalog/**/*.{png,jpg}', {
      query: '?inline',
      import: 'default',
      eager: true,
    }),
  ).map(([file, url]) => [file.slice('/public'.length), url]),
);

function bytesOf(url: string): Uint8Array {
  return Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), (c) => c.charCodeAt(0));
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: Uint8Array): [number, number] {
  const view = new DataView(bytes.buffer);
  expect(Array.from(bytes.slice(1, 4))).toEqual([0x50, 0x4e, 0x47]);
  return [view.getUint32(16), view.getUint32(20)];
}

/** Width and height from a JPEG's start-of-frame segment (baseline or progressive). */
function jpegSize(bytes: Uint8Array): [number, number] {
  const view = new DataView(bytes.buffer);
  expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8]);
  let offset = 2;
  while (offset + 9 < bytes.length) {
    const marker = view.getUint16(offset);
    const length = view.getUint16(offset + 2);
    // SOF0–SOF15, except DHT (C4), JPG (C8), and DAC (CC).
    if (marker >= 0xffc0 && marker <= 0xffcf && ![0xffc4, 0xffc8, 0xffcc].includes(marker)) {
      return [view.getUint16(offset + 7), view.getUint16(offset + 5)];
    }
    offset += 2 + length;
  }
  throw new Error('No JPEG start-of-frame segment');
}

function imageSize(src: string, url: string): [number, number] {
  const bytes = bytesOf(url);
  return src.endsWith('.png') ? pngSize(bytes) : jpegSize(bytes);
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
 * Declared `widthPx`/`heightPx` must match each file, PNG or JPEG (M1.3b).
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
      const url = imageFiles.get(asset.src);
      if (url === undefined)
        throw new Error(`${path}: only PNG and JPEG sizes are checked: ${asset.src}`);
      expect(imageSize(asset.src, url), path).toEqual([asset.widthPx, asset.heightPx]);
    }
  });

  it('reads the size of every catalog image, PNG and JPEG', () => {
    const sizes = Object.fromEntries(
      [...imageFiles].map(([src, url]) => [src, imageSize(src, url)]),
    );
    expect(sizes).toEqual({
      '/catalog/plates/bandeja-ondulada-g-11/bege.jpg': [1060, 1060],
      '/catalog/plates/bandeja-ondulada-m-8/bege.jpg': [1060, 1060],
      '/catalog/plates/placa-ceramica-10/bege.png': [640, 640],
      '/catalog/plates/quadro-20/bege.jpg': [660, 660],
    });
  });

  it('detects missing files (synthetic catalog, no files on disk)', () => {
    expect(missingFiles(buildImageCatalog(), new Set())).toEqual([
      'plates[0].image.image: /catalog/plates/test-plate-a/beige.webp',
    ]);
  });
});

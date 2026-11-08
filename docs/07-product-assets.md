# 07 — Product Assets

How Taavi's real product photographs become catalog imagery (FR-08, D-027, D-031–D-034). This guide covers **M1.3a** (conventions and catalog contract, implemented) and the steps for **M1.3b** (registering real assets, pending until photographs and measurements arrive).

> No production photographs exist in the repository yet. Nothing here describes a working photographic preview; the renderer is M3 and export is M4.

## Provenance and originals

- **Originals stay outside the Git repository**, in Taavi's source archive. The repository holds only processed, web-ready files under `public/catalog/`.
- For every processed file, record its provenance in the M1.3b registration notes (pull request description or a note next to the catalog entry): original file name in the archive, date, and the processing applied (crop, background removal, perspective correction, resize, export settings).
- Processed files are always exported **from the original**, never from a previously processed file, to avoid cumulative recompression.

## Reference photographs are not assets

The lifestyle photographs shared so far are **visual references only**. They contain lettering, backgrounds, shadows, and product combinations, so they cannot be used as compositing layers. In particular:

- the wooden shadowbox-style frame holding a smaller square ceramic plaque shows a frame–plate combination, not separate clean layers;
- the standalone square plaque with lettering is not a blank plate image;
- the scalloped ceramic dish is **not** classified as the circular plaque model. Which product is the circular plate must be confirmed by the store.

## Expected source photographs (M1.3b inputs)

1. Square plate without lettering.
2. Rectangular plate without lettering.
3. Circular plate without lettering.
4. Empty wooden frames, photographed independently (and, where needed, a front layer such as the rim around the opening).
5. Separate photographs of every real color/finish variation of each plate model.

Recommended capture: consistent lighting, camera height, and angle across variations of the same model; the object fully visible and as frontal as possible; high resolution relative to the intended display size; no lettering, props, or busy backgrounds. These are recommendations, not invented requirements: exact resolutions are decided with the real files (P-08).

## Directory and naming conventions (D-031)

```text
public/catalog/
├── plates/{plate-id}/{name}.{webp|png|jpg}    # Plate.images[].image
├── frames/{frame-id}/{name}.{webp|png|jpg}    # Frame.images[].back / .front
└── colors/{color-id}/{name}.{webp|png|jpg}    # PlateColor.swatch (UI thumbnail only)
```

- Catalog `src` values are served paths: `/catalog/plates/placa-quadrada/nude.webp`.
- The folder name is the owner's stable catalog ID; catalog integrity rejects a file in another owner's folder.
- File names are lowercase kebab-case. Suggested names: `{color-category}` or `{color-id}` for plate photographs (`nude.webp`, `cor-terracota.webp`), `{plate-id}-back` / `{plate-id}-front` for frame layers.
- One folder level per owner; no nested folders.
- A file used by several entries (e.g. one frame layer calibrated for two plates) is stored once and referenced by each entry; do not copy it.
- The folder is created by M1.3b together with the first real file. `public/` contents ship in the production build, so demo or test images never go there.

## Formats and transparency

| Format | Use                                                                                           |
| ------ | --------------------------------------------------------------------------------------------- |
| WebP   | Preferred. Lossy or lossless, with alpha. Good size/quality for photographs.                  |
| PNG    | Lossless with alpha, when WebP artifacts are visible on edges or masks.                       |
| JPEG   | Opaque images only (no transparency), e.g. a frame back layer that fills its whole rectangle. |

- **Transparent** (alpha required): plate cut-outs composed over a frame or background; frame `front` overlays (the opening must be transparent).
- **Opaque** acceptable: a frame `back` layer that covers the full composition.
- SVG and other formats are rejected by catalog integrity: product imagery is photographic.

## Catalog association (D-032, D-033)

- **Plate photographs** — `Plate.images[]`, one entry per real variation: `{ colorCategory, colorId?, image, objectBounds?, text? }`.
  - `colorId` omitted: the photograph shown for the category when the customer has not chosen a specific shade.
  - `colorId` set: the photograph of that exact shade, which must be one of the plate's `supportedColorIds` in that category.
  - Lookup (`findPlateImage`) is an **exact match**. No color category selected → pending; a shade without its own photograph → pending. There is no fallback to another shade, to the category photograph, or to another plate.
- **Frame imagery** — `Frame.images[]`, one entry per compatible plate model: `{ plateId, back, front?, platePlacement? }`. Placement depends on the plate model, so one photograph is never assumed to fit every compatible geometry. Entries are allowed only for plate/frame pairs that configuration validation accepts (`isFrameCompatible`).
- **Swatches** — `PlateColor.swatch` is an optional UI thumbnail. It is never used to tint a plate photograph.

## Replacing an image

Product identity is the catalog ID, never the file. To replace a photograph, overwrite the file at the same path (preferred) or point `src` to the new file in the same owner folder; the plate, frame, or color ID never changes. Update `widthPx`/`heightPx` and recalibrate placement, because a new photograph changes the coordinates.

## Intrinsic size

`AssetRef.widthPx` / `heightPx` are optional and declared together as positive integers. They let the renderer know the aspect ratio before the image loads and document the source resolution for export (P-05, P-08). **M1.3b** adds a check that declared values match the actual files.

## Placement metadata and calibration (D-034)

All placement values are `NormalizedBox`es — `{ x, y, width, height }` as fractions (0–1) of the image they belong to, origin top-left. Screen pixels and physical millimeters are never used.

| Field                       | In image   | Meaning                                                       |
| --------------------------- | ---------- | ------------------------------------------------------------- |
| `PlateImage.objectBounds`   | plate      | Bounding box of the ceramic object in the photograph.         |
| `PlateImage.text.area`      | plate      | Text safe area; must lie inside `objectBounds` when both set. |
| `PlateImage.text.align`     | —          | `left`, `center`, or `right`.                                 |
| `FrameImage.platePlacement` | frame back | Where the plate's `objectBounds` go inside the frame.         |

- Every placement field is **optional** and stays omitted until it is measured from the real processed file. Never estimate it.
- The center of a photograph is not assumed to be the center of the object; `objectBounds` records where the object actually is.
- **Calibration (M1.3b):** open the final processed file at full resolution, measure the pixel rectangle of the object, the usable lettering area (agreed with the store against real stamped pieces), and the frame opening; divide by the image width/height; then check the result visually against the original photograph and a real product.
- A bounding box is **positioning metadata only**. It cannot describe the exact outline of a circular, scalloped, or irregular object, nor the shape of a frame opening. Precise clipping/masking (alpha in the file, the plate's `shape`, or a separate mask asset) is an **M3 decision**.

## Text boundary

| Layer                 | Owner                     | Status                                                                                                    |
| --------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| Raw personalized text | `Configuration.text`      | Implemented (stored exactly as typed).                                                                    |
| Text layout           | Catalog `PlateImage.text` | Contract only (area, alignment).                                                                          |
| Typography            | —                         | Pending (P-04); no fonts or limits invented.                                                              |
| Material effect       | Renderer (M3+)            | Not modeled. The real lettering is stamped, pressed, or raised; plain text will not reproduce it exactly. |

## Missing and broken images

| State                         | Detected by                                                            | Behavior                                                                 |
| ----------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Image available               | `findPlateImage` / `findFrameImage` → `available`                      | Rendered (M3).                                                           |
| Image pending                 | Lookup → `pending`                                                     | Visible "imagem indisponível" state (M3); never another product's photo. |
| Reference exists, file broken | Asset gate test (missing file); renderer `error` event at runtime (M3) | Same visible unavailable state; never substituted.                       |

Configuration validity never depends on any of these states.

## Fidelity limitations

- A composited preview is an approximation of the handmade piece: glaze variation, texture, and stamped lettering differ piece to piece.
- Declared frame compatibility and calibrated placement are not proof of physical fit (D-014); real dimensions remain pending (P-01, P-03).

## M1.3b checklist

- [ ] Receive clean photographs; archive originals outside the repository.
- [ ] Process (crop, background removal/masking, perspective correction) and export from the originals.
- [ ] Register real plates, frames, and colors in `src/catalog/data.ts` with store-confirmed data.
- [ ] Add files under `public/catalog/` following this guide.
- [ ] Declare `widthPx`/`heightPx` and add the check that they match the files.
- [ ] Calibrate `objectBounds`, `text`, and `platePlacement`; verify visually against the originals.
- [ ] Record provenance for each file.

---
name: product-domain
description: Taavi Configurator domain rules for plates (Placa), frames (Quadro), colors, shapes, text, catalog data, and configuration validation. Use when changing src/domain, src/catalog, catalog assets, validation, or anything that decides what a valid configuration is.
---

# Product domain rules

Code of record: `src/domain/types.ts`, `src/domain/validation.ts`, `src/domain/catalog-validation.ts`, `src/catalog/` (`data.ts` definitions, `index.ts` → `getCatalog()`). Explanation: `docs/04-data-model.md`.

## The catalog is the source of truth

- Only components present in the catalog can be selected. App code reads it only via `getCatalog()`.
- The catalog is deep-frozen. UI code must never mutate it or keep modified copies.
- Every catalog change must keep `validateCatalog(getCatalog())` valid (test gate, D-021). Fix the data; never weaken or bypass the check.
- IDs are lowercase kebab-case and unique across colors, plates, and frames (D-019).
- A frame's `plateIds` may list only plates that support frames and whose shape is in the frame's shapes (`unreachable-compatibility`, D-022).
- Each plate model has one fixed `shape` (D-023). Frame support is the explicit `supportsFrame` capability (D-024): never test `shape === 'circle'` outside catalog integrity.
- Configuration (`Configuration`) stores **IDs and raw user input only** — never copies of catalog objects.

## Never invent product information

Before adding any value, ask: "Did the store provide this?" If not, do not add it.

- Dimensions unknown → `{ status: 'pending' }`. Never placeholder numbers.
- No invented plate/frame models, color names, HEX values, textures, finishes, typography, or asset files.
- Do not choose a rectangle aspect ratio.
- Test data belongs in `tests/` with `test-`-prefixed IDs, never in `src/catalog`.
- No generated or invented product photographs. Product imagery is resolved from catalog `AssetRef`s at composition time; `Configuration` stores no image data and validation never depends on image availability (D-027).

## Stable identifiers

- IDs are explicit strings, never array indices or generated at runtime.
- Never rename an existing ID without a migration note in `docs/06-decisions.md`.

## Required vs optional selections

| Selection      | Rule                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Plate          | Required; must exist and be available.                                                                                                    |
| Shape          | Not a selection: derived from the selected plate (`getPlateShape`, D-023).                                                                |
| Color category | Required; must be in the plate's `supportedColorCategories`.                                                                              |
| Specific color | Optional; if set: must exist, be available, match the category, be in `supportedColorIds`.                                                |
| Frame          | Optional; `null` = "no frame" (valid). If set: must exist, be available, the plate must support frames, and the frame must be compatible. |
| Text           | Required; `''` → incomplete; only whitespace/invisible characters → invalid (`blank`); stored exactly as typed.                           |

## Validation results

- `valid`, `incomplete` (only missing fields), `invalid` (any conflict; takes precedence).
- Every field is evaluated; each field reports **at most one issue**, using the fixed precedence in `docs/04-data-model.md` (D-016). Keep that order when adding rules, and update the doc and tests.
- Plate-dependent rules run whenever the plate is known, even if other selections are still missing.
- **Never auto-replace a selection.** If a later feature needs to clear or adjust a selection (e.g. frame becomes incompatible after a shape change), that behavior must be explicit, visible to the user, tested, and recorded in `docs/06-decisions.md`. The only such behavior today is `selectPlate` clearing a frame on a frameless plate (D-026); use it rather than clearing frames elsewhere.

## Compatibility

- Every frame declares `compatibility.shapes`; `plateIds` optionally restricts plates. No implicit "fits all".
- Declared compatibility is necessary, not sufficient: physical fit needs real dimensions and mounting data (pending). Do not claim production compatibility from shape alone.
- Variant-level availability (e.g. colors per plate model) is anticipated; extend `Plate` with an optional field rather than changing `Configuration`.

## Preview/export consistency

- Preview and export must derive from the same configuration and catalog data.
- Neither may substitute a different component, color, or shape than the one selected. Missing assets are shown as missing, not swapped.

## When changing the domain

1. Update types in `src/domain/types.ts`.
2. Update validation and add unit tests covering valid, incomplete, and invalid cases.
3. Update `docs/04-data-model.md` and, if a rule changed, `docs/06-decisions.md`.

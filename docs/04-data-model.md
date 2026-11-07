# 04 — Data Model

Source of truth: [`src/domain/types.ts`](../src/domain/types.ts). This document explains intent; if they disagree, the code wins and this document must be fixed.

## Entities

### Enumerations

| Type            | Values                          | Notes                                                                                                |
| --------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `PlateShape`    | `square`, `rectangle`, `circle` | Fixed per plate model. No aspect ratio implied. `circle` never supports frames (`FRAMELESS_SHAPES`). |
| `ColorCategory` | `nude`, `colored`               | Categories, not physical color values.                                                               |

### `Dimensions`

```ts
type Dimensions = { status: 'pending' } | { status: 'defined'; widthMm: number; heightMm: number };
```

Unknown dimensions must be `pending`. Never invent numbers to satisfy types.

### `AssetRef`

| Field | Required | Notes                         |
| ----- | -------- | ----------------------------- |
| `src` | yes      | Path under `public/catalog/`. |
| `alt` | no       | Accessible description.       |

Assets may be missing at runtime; consumers must handle that gracefully.

### Common component fields

| Field         | Required | Notes                                          |
| ------------- | -------- | ---------------------------------------------- |
| `id`          | yes      | Stable kebab-case; unique across the catalog.  |
| `displayName` | yes      | User-facing (pt-BR).                           |
| `available`   | no       | Omitted = available; `false` = not selectable. |

### `PlateColor` (`type: 'color'`)

| Field      | Required | Notes                      |
| ---------- | -------- | -------------------------- |
| `category` | yes      | `ColorCategory`.           |
| `swatch`   | no       | `AssetRef`, when provided. |

### `Plate` (`type: 'plate'`)

A physical plate model. Square, rectangular, and circular plates are separate models with their own IDs (D-023).

| Field                      | Required | Notes                                                              |
| -------------------------- | -------- | ------------------------------------------------------------------ |
| `shape`                    | yes      | The model's single, fixed `PlateShape`.                            |
| `supportsFrame`            | yes      | Explicit capability; `false` for every circle (D-024). No default. |
| `supportedColorCategories` | yes      | Categories the plate can be made in.                               |
| `supportedColorIds`        | yes      | Specific colors; may be empty while colors are pending.            |
| `dimensions`               | yes      | `Dimensions` (may be `pending`).                                   |
| `asset`                    | no       | `AssetRef`.                                                        |

### `Frame` (`type: 'frame'`)

| Field           | Required | Notes                                         |
| --------------- | -------- | --------------------------------------------- |
| `compatibility` | yes      | `FrameCompatibility`. No implicit "fits all". |
| `assets`        | no       | Per-shape `AssetRef`.                         |

### `FrameCompatibility`

| Field      | Required | Notes                                    |
| ---------- | -------- | ---------------------------------------- |
| `shapes`   | yes      | Shapes the frame is declared to fit.     |
| `plateIds` | no       | When present, restricts to these plates. |

> Declared compatibility is a **necessary condition only**. Matching shapes is not proof of physical fit. Real plate/frame dimensions and mounting constraints are required before production use.

### `Catalog`

`{ plates, frames, colors }` — readonly arrays, deep-frozen at runtime, obtained via `getCatalog()`. The only source of available components. Must pass `validateCatalog` (see [Catalog integrity rules](#catalog-integrity-rules)).

### `Configuration`

| Field           | Type                    | Required | Notes                             |
| --------------- | ----------------------- | -------- | --------------------------------- |
| `plateId`       | `string \| null`        | yes      | References `Plate.id`.            |
| `frameId`       | `string \| null`        | no       | `null` = explicit "no frame".     |
| `colorCategory` | `ColorCategory \| null` | yes      |                                   |
| `colorId`       | `string \| null`        | no       | References `PlateColor.id`.       |
| `text`          | `string`                | yes      | Raw, never trimmed or normalized. |

Serializable as plain JSON. Contains only IDs and user input — never copies of catalog objects. There is no `shape` field: the shape is derived from the selected plate (`getPlateShape`).

## Relationships

```text
Configuration.plateId ──► Plate.id            (shape derived from Plate.shape)
Configuration.frameId ──► Frame.id            (optional)
Configuration.colorId ──► PlateColor.id       (optional)
Plate.supportedColorIds ──► PlateColor.id
Frame.compatibility.plateIds ──► Plate.id     (optional restriction)
```

## Validation rules

Implemented in [`src/domain/validation.ts`](../src/domain/validation.ts) (D-005, D-016, D-017).

### Per-field contract

Every field is evaluated. Each field reports **at most one issue**: the first failing rule in the order below. Later rules for the same field are not reported until the earlier issue is resolved.

| Field           | Precedence (first failure wins)                                                                                                                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plateId`       | 1. `null` → missing · 2. not in catalog → `unknown-reference` · 3. `available: false` → `unavailable`                                                                                                                                                                                          |
| `colorCategory` | 1. `null` → missing · 2. not in plate's `supportedColorCategories` → `unsupported-by-plate`                                                                                                                                                                                                    |
| `colorId`       | Optional (`null` is fine). 1. not in catalog → `unknown-reference` · 2. unavailable → `unavailable` · 3. category differs → `category-mismatch` · 4. not in plate's `supportedColorIds` → `unsupported-by-plate`                                                                               |
| `frameId`       | Optional (`null` = no frame). 1. not in catalog → `unknown-reference` · 2. unavailable → `unavailable` · 3. plate has `supportsFrame: false` → `frame-not-supported` · 4. plate's `shape` not in the frame's shapes → `incompatible-shape` · 5. plate not in `plateIds` → `incompatible-plate` |
| `text`          | 1. `''` → missing · 2. only whitespace/invisible characters → `blank`                                                                                                                                                                                                                          |

Conditional rules:

- Plate-dependent rules (color category, `colorId` step 4, frame steps 3–5) run only when the plate exists in the catalog. An unavailable plate still runs them. When the plate is missing or unknown, only that `plateId` issue is reported.
- `category-mismatch` runs only when a color category is selected.

### Blank text

Non-empty text is `blank` (invalid) when every character is either Unicode `White_Space` (spaces, tabs, line breaks, no-break spaces such as U+00A0 and U+202F) or one of: U+200B ZERO WIDTH SPACE, U+200C ZERO WIDTH NON-JOINER, U+200D ZERO WIDTH JOINER, U+2060 WORD JOINER, U+FEFF ZERO WIDTH NO-BREAK SPACE (BOM). Any other character (letters, accents, combining marks, emoji, emoji sequences containing U+200D) makes the text non-blank. The check never modifies the stored text.

### Selection transitions

Implemented in [`src/domain/selection.ts`](../src/domain/selection.ts) (D-026).

- `selectPlate(config, plateId, catalog)` → `{ config, cleared }`. Sets `plateId`. If the plate has `supportsFrame: false` and a frame is selected, `frameId` becomes `null` and `cleared` is `['frameId']`. Nothing else changes; an incompatible frame on a plate that supports frames, or an unknown plate, is left for validation to report. The input is never mutated.
- `getFrameOptions(catalog, plateId)` → available frames compatible with the plate (`isFrameCompatible`); empty for unknown or frameless plates.

### Result status

Any invalid issue → `invalid`; otherwise any missing issue → `incomplete`; otherwise `valid`. Issues are listed in field order: `plateId`, `colorCategory`, `colorId`, `frameId`, `text`.

## Catalog integrity rules

Implemented in [`src/domain/catalog-validation.ts`](../src/domain/catalog-validation.ts) (D-018, D-019).

```ts
type CatalogValidationResult =
  { status: 'valid' } | { status: 'invalid'; issues: readonly CatalogIssue[] };

interface CatalogIssue {
  code: CatalogIssueCode;
  path: string; // e.g. "plates[2].dimensions.rectangle.widthMm"
  id?: string; // owning component ID
  relatedPath?: string; // e.g. first occurrence of a duplicate
}
```

Unlike configuration validation, **every** issue is reported. Order is deterministic: `colors`, then `plates`, then `frames`; within a component, fields in definition order. Array indices in paths are diagnostic only. Data is never repaired or filtered.

| Code                        | Rule violated                                                                                                                                            | Paths                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `invalid-id`                | ID must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` (non-empty, lowercase kebab-case)                                                                             | `<collection>[i].id`                                                                              |
| `duplicate-id`              | IDs unique across colors, plates, and frames; reported at each repeat, `relatedPath` = first occurrence                                                  | `<collection>[i].id`                                                                              |
| `duplicate-entry`           | No repeated value in a list; `relatedPath` = first occurrence                                                                                            | `supportedColorCategories`, `supportedColorIds`, `compatibility.shapes`, `compatibility.plateIds` |
| `unknown-reference`         | Referenced ID exists in the right collection                                                                                                             | `plates[i].supportedColorIds[j]` → colors; `frames[i].compatibility.plateIds[j]` → plates         |
| `unreachable-compatibility` | Each plate in a frame's `plateIds` has `supportsFrame: true` and its `shape` is in the frame's `compatibility.shapes`; `relatedPath` = the plate (D-022) | `frames[i].compatibility.plateIds[j]`                                                             |
| `empty-list`                | Required list is non-empty; `plateIds`, when present, is non-empty (omit it for "no restriction")                                                        | `supportedColorCategories`, `compatibility.shapes`, `compatibility.plateIds`                      |
| `unsupported-shape-key`     | Frame `assets` keys ⊆ `compatibility.shapes`                                                                                                             | `frames[i].assets.<shape>`                                                                        |
| `frame-capability-conflict` | A plate whose shape is in `FRAMELESS_SHAPES` (`circle`) has `supportsFrame: false` (D-024)                                                               | `plates[i].supportsFrame`                                                                         |
| `unsupported-frame-shape`   | A frame's `compatibility.shapes` contains no shape in `FRAMELESS_SHAPES` (`circle`) (D-024)                                                              | `frames[i].compatibility.shapes[j]`                                                               |
| `color-category-mismatch`   | A referenced color's category is in the plate's `supportedColorCategories`                                                                               | `plates[i].supportedColorIds[j]`                                                                  |
| `invalid-dimension`         | Defined `widthMm` and `heightMm` are finite and > 0 (each reported separately)                                                                           | `plates[i].dimensions.widthMm` / `.heightMm`                                                      |
| `invalid-asset`             | `src` is not empty or whitespace-only                                                                                                                    | `plates[i].asset.src`, `frames[i].assets.<shape>.src`, `colors[i].swatch.src`                     |

Allowed (not issues): an empty catalog; `pending` dimensions; no plate `asset`; a square or rectangular plate with `supportsFrame: false`; empty `supportedColorIds` (colors pending); omitted `compatibility.plateIds`. Equal sides for squares and circles are not checked until real measurements exist.

A component whose ID is renamed or removed also produces `unknown-reference` at every place that referenced it.

Additional semantics:

- **Duplicates resolve to the first occurrence.** Reference checks (`unknown-reference`, `color-category-mismatch`, `unreachable-compatibility`) use the first component with a given ID, matching `relatedPath` and configuration lookups. Later duplicates never overwrite it.
- **Non-string IDs** (possible only when data bypasses the types) are reported as `invalid-id` without coercion; such issues omit `id`.
- **`unreachable-compatibility`** evaluates each `plateIds` entry independently (repeated entries are each reported). A plate without frame support is always reported. The shape comparison is skipped when the frame's `compatibility.shapes` is empty, since `empty-list` already reports the cause. A shared shape is still only a necessary condition, not proof of physical fit (D-014). Unrestricted frames are not checked against the plates that exist.

## Compatibility considerations

- **Variant-level availability** (e.g. plate model X unavailable in a specific color) is anticipated. It can be added as an optional `variants` list on `Plate` without changing `Configuration` or the validation result shape.
- **Physical compatibility** will require defined `Dimensions` on both plates and frames plus mounting data; the model will be extended when that data exists.

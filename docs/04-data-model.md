# 04 — Data Model

Source of truth: [`src/domain/types.ts`](../src/domain/types.ts). This document explains intent; if they disagree, the code wins and this document must be fixed.

Vocabulary: the customer-facing word for a product is **Modelo**; the code keeps the type name `Plate`. The optional frame is **Moldura** (`Frame`). "Quadro" is the name of one product model (Quadro, 20 cm x 20 cm), not of the optional frame (D-040).

## Entities

### Enumerations

| Type         | Values                                       | Notes                                                                                                                                                                                                       |
| ------------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlateShape` | `square`, `rectangle`, `circle`, `scalloped` | Classification of the model, fixed per model (D-023, D-040). Implies no geometry or aspect ratio; `scalloped` (the wavy trays) is classification only. `circle` never supports frames (`FRAMELESS_SHAPES`). |

### `Dimensions`

```ts
type Dimensions = { status: 'pending' } | { status: 'defined'; widthMm: number; heightMm: number };
```

Unknown dimensions must be `pending`. Never invent numbers to satisfy types. A model's `sizeLabel` ("10 cm x 10 cm", "~ 8 cm") is display text as supplied, not a measurement.

### `AssetRef`

| Field                  | Required | Notes                                                                   |
| ---------------------- | -------- | ----------------------------------------------------------------------- |
| `src`                  | yes      | `/catalog/{plates\|frames}/{owner-id}/{name}.{webp\|png\|jpg}` (D-031). |
| `alt`                  | no       | Accessible description.                                                 |
| `widthPx` / `heightPx` | no       | Intrinsic pixel size; both or neither; positive integers.               |

Assets may be missing at runtime; consumers must handle that gracefully. Conventions: [07-product-assets.md](07-product-assets.md).

### `NormalizedBox`

`{ x, y, width, height }` as fractions (0–1) of the image it belongs to, origin top-left (D-034). Positioning metadata only; it does not describe exact outlines.

### `PlateImage`

| Field          | Required | Notes                                                                                    |
| -------------- | -------- | ---------------------------------------------------------------------------------------- |
| `image`        | yes      | `AssetRef` in `/catalog/plates/{plate-id}/`.                                             |
| `objectBounds` | no       | Bounding box of the ceramic object in the photograph. Pending = omit.                    |
| `text`         | no       | `TextLayout`: `area` (`NormalizedBox`) and optional `align` (`left`, `center`, `right`). |

Each model has at most one photograph: its ceramic color is fixed, so there are no color variations (D-041).

### `FrameImage`

| Field            | Required | Notes                                                          |
| ---------------- | -------- | -------------------------------------------------------------- |
| `plateId`        | yes      | Model this imagery is calibrated for; must be compatible.      |
| `back`           | yes      | `AssetRef`, drawn behind the plate.                            |
| `front`          | no       | `AssetRef` overlay drawn above plate and text.                 |
| `platePlacement` | no       | Where the plate's `objectBounds` go in `back`. Pending = omit. |

### Common component fields

| Field         | Required | Notes                                          |
| ------------- | -------- | ---------------------------------------------- |
| `id`          | yes      | Stable kebab-case; unique across the catalog.  |
| `displayName` | yes      | User-facing (pt-BR).                           |
| `available`   | no       | Omitted = available; `false` = not selectable. |

### `Plate` (`type: 'plate'`)

A product model. Placa cerâmica, Quadro (20 cm x 20 cm), and the two Bandejas onduladas M are separate models with their own IDs (D-023, D-040).

| Field           | Required | Notes                                                                                                                   |
| --------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| `shape`         | yes      | The model's single, fixed `PlateShape` classification.                                                                  |
| `sizeLabel`     | yes      | Customer-facing size exactly as supplied, e.g. `10 cm x 10 cm` or `~ 8 cm` (approximation kept). Display only.          |
| `ceramicColor`  | yes      | Fixed color of the piece, e.g. `Bege`. Shown read-only as "Cor da peça"; the customer never chooses it (D-041).         |
| `supportsFrame` | yes      | Explicit capability; `false` for every circle (D-024). No default. `false` for all four current models until confirmed. |
| `dimensions`    | yes      | `Dimensions` (may be `pending`).                                                                                        |
| `image`         | no       | `PlateImage`; omitted while the photograph is pending.                                                                  |

The option label shown to customers is `displayName (sizeLabel)`, e.g. "Bandeja ondulada M (~ 8 cm)".

The current production IDs are **provisional** until Taavi confirms them: `placa-ceramica-10`, `quadro-20`, `bandeja-ondulada-m-8`, `bandeja-ondulada-m-11`. Once confirmed, an ID must not be renamed without a migration note in [06-decisions.md](06-decisions.md).

### `Frame` (`type: 'frame'`)

| Field           | Required | Notes                                         |
| --------------- | -------- | --------------------------------------------- |
| `compatibility` | yes      | `FrameCompatibility`. No implicit "fits all". |
| `images`        | no       | `FrameImage[]`, one per model (D-033).        |

### `FrameCompatibility`

| Field      | Required | Notes                                    |
| ---------- | -------- | ---------------------------------------- |
| `shapes`   | yes      | Shapes the frame is declared to fit.     |
| `plateIds` | no       | When present, restricts to these models. |

> Declared compatibility is a **necessary condition only**. Matching shapes is not proof of physical fit. Real dimensions and mounting constraints are required before production use. No current production model is declared to take a frame.

### `Catalog`

`{ plates, frames }` — readonly arrays, deep-frozen at runtime, obtained via `getCatalog()`. The only source of available components. Must pass `validateCatalog` (see [Catalog integrity rules](#catalog-integrity-rules)). The production catalog registers the four supplied models and no frames.

### `Configuration`

| Field     | Type             | Required | Notes                             |
| --------- | ---------------- | -------- | --------------------------------- |
| `plateId` | `string \| null` | yes      | References `Plate.id`.            |
| `frameId` | `string \| null` | no       | `null` = explicit "no frame".     |
| `text`    | `string`         | yes      | Raw, never trimmed or normalized. |

Serializable as plain JSON. Contains only IDs and user input — never copies of catalog objects. There is no `shape` and no color field: the shape is derived from the selected model (`getPlateShape`) and the ceramic color is a catalog property of the model. No customer configuration is persisted anywhere, so removing the former color fields needs no data migration.

Planned (M4.1b, not implemented): font family, a lettering color and an optional second color with character ranges, and text position. See [05-backlog.md](05-backlog.md).

## Relationships

```text
Configuration.plateId ──► Plate.id            (shape derived from Plate.shape)
Configuration.frameId ──► Frame.id            (optional)
Frame.compatibility.plateIds ──► Plate.id     (optional restriction)
Frame.images[].plateId ──► Plate.id           (compatible models only)
```

### Image lookup

`findPlateImage(plate)` and `findFrameImage(frame, plateId)` return `{ status: 'available', image }` or `{ status: 'pending' }`. Exact match only: a model without a photograph → pending; a frame without imagery for the model → pending; never another model's image (D-033, D-041). A file that fails to load is detected by the renderer, not the domain. Configuration validation never consults images.

## Validation rules

Implemented in [`src/domain/validation.ts`](../src/domain/validation.ts) (D-005, D-016, D-017).

### Per-field contract

Every field is evaluated. Each field reports **at most one issue**: the first failing rule in the order below. Later rules for the same field are not reported until the earlier issue is resolved.

| Field     | Precedence (first failure wins)                                                                                                                                                                                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plateId` | 1. `null` → missing · 2. not in catalog → `unknown-reference` · 3. `available: false` → `unavailable`                                                                                                                                                                                          |
| `frameId` | Optional (`null` = no frame). 1. not in catalog → `unknown-reference` · 2. unavailable → `unavailable` · 3. model has `supportsFrame: false` → `frame-not-supported` · 4. model's `shape` not in the frame's shapes → `incompatible-shape` · 5. model not in `plateIds` → `incompatible-plate` |
| `text`    | 1. `''` → missing · 2. only whitespace/invisible characters → `blank`                                                                                                                                                                                                                          |

Conditional rules:

- Model-dependent rules (frame steps 3–5) run only when the model exists in the catalog. An unavailable model still runs them. When the model is missing or unknown, only that `plateId` issue is reported.
- There is no color rule: the ceramic color is a fixed catalog property (D-041).

### Blank text

Non-empty text is `blank` (invalid) when every character is either Unicode `White_Space` (spaces, tabs, line breaks, no-break spaces such as U+00A0 and U+202F) or one of: U+200B ZERO WIDTH SPACE, U+200C ZERO WIDTH NON-JOINER, U+200D ZERO WIDTH JOINER, U+2060 WORD JOINER, U+FEFF ZERO WIDTH NO-BREAK SPACE (BOM). Any other character (letters, accents, combining marks, emoji, emoji sequences containing U+200D) makes the text non-blank. The check never modifies the stored text.

### Selection transitions

Implemented in [`src/domain/selection.ts`](../src/domain/selection.ts) (D-026).

- `selectPlate(config, plateId, catalog)` → `{ config, cleared }`. Sets `plateId`. If the model has `supportsFrame: false` and a frame is selected, `frameId` becomes `null` and `cleared` is `['frameId']`. Nothing else changes; an incompatible frame on a model that supports frames, or an unknown model, is left for validation to report. The input is never mutated.
- `getFrameOptions(catalog, plateId)` → available frames compatible with the model (`isFrameCompatible`); empty for unknown or frameless models.

### Result status

Any invalid issue → `invalid`; otherwise any missing issue → `incomplete`; otherwise `valid`. Issues are listed in field order: `plateId`, `frameId`, `text`.

## Catalog integrity rules

Implemented in [`src/domain/catalog-validation.ts`](../src/domain/catalog-validation.ts) (D-018, D-019).

```ts
type CatalogValidationResult =
  { status: 'valid' } | { status: 'invalid'; issues: readonly CatalogIssue[] };

interface CatalogIssue {
  code: CatalogIssueCode;
  path: string; // e.g. "plates[2].dimensions.widthMm"
  id?: string; // owning component ID
  relatedPath?: string; // e.g. first occurrence of a duplicate
}
```

Unlike configuration validation, **every** issue is reported. Order is deterministic: `plates`, then `frames`; within a component, fields in definition order. Array indices in paths are diagnostic only. Data is never repaired or filtered.

| Code                        | Rule violated                                                                                                                                                                                | Paths                                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `invalid-id`                | ID must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` (non-empty, lowercase kebab-case)                                                                                                                 | `<collection>[i].id`                                                                                                              |
| `duplicate-id`              | IDs unique across plates and frames; reported at each repeat, `relatedPath` = first occurrence                                                                                               | `<collection>[i].id`                                                                                                              |
| `duplicate-entry`           | No repeated value in a list; `relatedPath` = first occurrence                                                                                                                                | `compatibility.shapes`, `compatibility.plateIds`                                                                                  |
| `unknown-reference`         | Referenced ID exists in the right collection                                                                                                                                                 | `frames[i].compatibility.plateIds[j]` → plates; `frames[i].images[j].plateId` → plates                                            |
| `unreachable-compatibility` | Each model in a frame's `plateIds` (and each model with frame imagery) has `supportsFrame: true` and its `shape` is in the frame's `compatibility.shapes`; `relatedPath` = the model (D-022) | `frames[i].compatibility.plateIds[j]`, `frames[i].images[j].plateId`                                                              |
| `empty-list`                | Required list is non-empty; `plateIds`, when present, is non-empty (omit it for "no restriction")                                                                                            | `compatibility.shapes`, `compatibility.plateIds`                                                                                  |
| `empty-label`               | A model's `sizeLabel` and `ceramicColor` are non-blank strings (D-040, D-041)                                                                                                                | `plates[i].sizeLabel`, `plates[i].ceramicColor`                                                                                   |
| `frame-capability-conflict` | A model whose shape is in `FRAMELESS_SHAPES` (`circle`) has `supportsFrame: false` (D-024)                                                                                                   | `plates[i].supportsFrame`                                                                                                         |
| `unsupported-frame-shape`   | A frame's `compatibility.shapes` contains no shape in `FRAMELESS_SHAPES` (`circle`) (D-024)                                                                                                  | `frames[i].compatibility.shapes[j]`                                                                                               |
| `invalid-dimension`         | Defined `widthMm` and `heightMm` are finite and > 0 (each reported separately)                                                                                                               | `plates[i].dimensions.widthMm` / `.heightMm`                                                                                      |
| `invalid-asset`             | `src` matches the asset path allowlist in the owner's folder (D-031); `widthPx`/`heightPx` both present and positive integers when either is (each side reported)                            | `<asset>.src`, `<asset>.widthPx` / `.heightPx`, where `<asset>` is `plates[i].image.image`, `frames[i].images[j].back` / `.front` |
| `duplicate-variation`       | One frame image per `plateId`; `relatedPath` = first occurrence                                                                                                                              | `frames[i].images[j]`                                                                                                             |
| `invalid-placement`         | Boxes have finite values, `x, y ≥ 0`, `width, height > 0`, and fit in the image; `text.align` is known; `text.area` lies inside `objectBounds` when both set (`relatedPath`)                 | `plates[i].image.objectBounds` / `.text.area` / `.text.align`, `frames[i].images[j].platePlacement`                               |

Allowed (not issues): an empty catalog; `pending` dimensions; no `image`, intrinsic sizes, or placement metadata; one file referenced by several entries; any non-circular model with `supportsFrame: false`; a `scalloped` model with either capability (the shape is classification only); omitted `compatibility.plateIds`. Equal sides for squares and circles are not checked until real measurements exist.

A component whose ID is renamed or removed also produces `unknown-reference` at every place that referenced it.

Additional semantics:

- **Duplicates resolve to the first occurrence.** Reference checks (`unknown-reference`, `unreachable-compatibility`) use the first component with a given ID, matching `relatedPath` and configuration lookups. Later duplicates never overwrite it.
- **Non-string IDs and labels** (possible only when data bypasses the types) are reported as `invalid-id` / `empty-label` without coercion; invalid-id issues for them omit `id`.
- **`unreachable-compatibility`** evaluates each `plateIds` entry independently (repeated entries are each reported). A model without frame support is always reported. The shape comparison is skipped when the frame's `compatibility.shapes` is empty, since `empty-list` already reports the cause. A shared shape is still only a necessary condition, not proof of physical fit (D-014). Unrestricted frames are not checked against the models that exist.

## Compatibility considerations

- **Frame support for the four current models** is not confirmed; all are `supportsFrame: false`. If Taavi confirms that a model takes an optional frame, set the capability and add frames with calibrated imagery; nothing else changes.
- **Physical compatibility** will require defined `Dimensions` on both models and frames plus mounting data; the model will be extended when that data exists.
- **Variant-level availability** is not needed now that color is fixed per model; a future per-model option can be added as an optional field on `Plate` without changing `Configuration` or the validation result shape.

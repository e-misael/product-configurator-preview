# 04 — Data Model

Source of truth: [`src/domain/types.ts`](../src/domain/types.ts). This document explains intent; if they disagree, the code wins and this document must be fixed.

## Entities

### Enumerations

| Type            | Values                | Notes                                  |
| --------------- | --------------------- | -------------------------------------- |
| `PlateShape`    | `square`, `rectangle` | No aspect ratio implied.               |
| `ColorCategory` | `nude`, `colored`     | Categories, not physical color values. |

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
| `id`          | yes      | Stable; never derived from array position.     |
| `displayName` | yes      | User-facing (pt-BR).                           |
| `available`   | no       | Omitted = available; `false` = not selectable. |

### `PlateColor` (`type: 'color'`)

| Field      | Required | Notes                      |
| ---------- | -------- | -------------------------- |
| `category` | yes      | `ColorCategory`.           |
| `swatch`   | no       | `AssetRef`, when provided. |

### `Plate` (`type: 'plate'`)

| Field                      | Required | Notes                                                   |
| -------------------------- | -------- | ------------------------------------------------------- |
| `supportedShapes`          | yes      | Shapes the plate can be made in.                        |
| `supportedColorCategories` | yes      | Categories the plate can be made in.                    |
| `supportedColorIds`        | yes      | Specific colors; may be empty while colors are pending. |
| `dimensions`               | yes      | Per shape; each `Dimensions` (may be `pending`).        |
| `assets`                   | no       | Per-shape `AssetRef`.                                   |

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

`{ plates, frames, colors }` — readonly arrays, frozen at runtime. The only source of available components.

### `Configuration`

| Field           | Type                    | Required | Notes                             |
| --------------- | ----------------------- | -------- | --------------------------------- |
| `plateId`       | `string \| null`        | yes      | References `Plate.id`.            |
| `frameId`       | `string \| null`        | no       | `null` = explicit "no frame".     |
| `colorCategory` | `ColorCategory \| null` | yes      |                                   |
| `colorId`       | `string \| null`        | no       | References `PlateColor.id`.       |
| `shape`         | `PlateShape \| null`    | yes      |                                   |
| `text`          | `string`                | yes      | Raw, never trimmed or normalized. |

Serializable as plain JSON. Contains only IDs and user input — never copies of catalog objects.

## Relationships

```text
Configuration.plateId ──► Plate.id
Configuration.frameId ──► Frame.id            (optional)
Configuration.colorId ──► PlateColor.id       (optional)
Plate.supportedColorIds ──► PlateColor.id
Frame.compatibility.plateIds ──► Plate.id     (optional restriction)
```

## Validation rules

Implemented in [`src/domain/validation.ts`](../src/domain/validation.ts) (D-005, D-016, D-017).

### Per-field contract

Every field is evaluated. Each field reports **at most one issue**: the first failing rule in the order below. Later rules for the same field are not reported until the earlier issue is resolved.

| Field           | Precedence (first failure wins)                                                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plateId`       | 1. `null` → missing · 2. not in catalog → `unknown-reference` · 3. `available: false` → `unavailable`                                                                                                                            |
| `shape`         | 1. `null` → missing · 2. not in plate's `supportedShapes` → `unsupported-by-plate`                                                                                                                                               |
| `colorCategory` | 1. `null` → missing · 2. not in plate's `supportedColorCategories` → `unsupported-by-plate`                                                                                                                                      |
| `colorId`       | Optional (`null` is fine). 1. not in catalog → `unknown-reference` · 2. unavailable → `unavailable` · 3. category differs → `category-mismatch` · 4. not in plate's `supportedColorIds` → `unsupported-by-plate`                 |
| `frameId`       | Optional (`null` = no frame). 1. not in catalog → `unknown-reference` · 2. unavailable → `unavailable` · 3. shape selected and not declared → `incompatible-shape` · 4. plate known and not in `plateIds` → `incompatible-plate` |
| `text`          | 1. `''` → missing · 2. only whitespace/invisible characters → `blank`                                                                                                                                                            |

Conditional rules:

- Plate-dependent rules (shape, color category, `colorId` step 4, frame step 4) run only when the plate exists in the catalog. An unavailable plate still runs them.
- `category-mismatch` runs only when a color category is selected.
- `incompatible-shape` runs only when a shape is selected. `incompatible-plate` does **not** depend on shape: it is reported whenever the plate is known.

### Blank text

Non-empty text is `blank` (invalid) when every character is either Unicode `White_Space` (spaces, tabs, line breaks, no-break spaces such as U+00A0 and U+202F) or one of: U+200B ZERO WIDTH SPACE, U+200C ZERO WIDTH NON-JOINER, U+200D ZERO WIDTH JOINER, U+2060 WORD JOINER, U+FEFF ZERO WIDTH NO-BREAK SPACE (BOM). Any other character (letters, accents, combining marks, emoji, emoji sequences containing U+200D) makes the text non-blank. The check never modifies the stored text.

### Result status

Any invalid issue → `invalid`; otherwise any missing issue → `incomplete`; otherwise `valid`. Issues are listed in field order: `plateId`, `shape`, `colorCategory`, `colorId`, `frameId`, `text`.

## Compatibility considerations

- **Variant-level availability** (e.g. plate X unavailable in rectangle + colored) is anticipated. It can be added as an optional `variants` list on `Plate` without changing `Configuration` or the validation result shape.
- **Physical compatibility** will require defined `Dimensions` on both plates and frames plus mounting data; the model will be extended when that data exists.
- **Catalog integrity** checks (deep freeze, duplicate IDs, dangling references, internal consistency) are planned for M1.1, before real products are added.

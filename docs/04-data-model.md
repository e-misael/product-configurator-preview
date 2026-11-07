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

Implemented in [`src/domain/validation.ts`](../src/domain/validation.ts).

| Field           | Missing → _incomplete_ | Invalid → _invalid_ (code)                                                                                                                             |
| --------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `plateId`       | `null`                 | not in catalog (`unknown-reference`); `available: false` (`unavailable`)                                                                               |
| `shape`         | `null`                 | not in plate's `supportedShapes` (`unsupported-by-plate`)                                                                                              |
| `colorCategory` | `null`                 | not in plate's `supportedColorCategories` (`unsupported-by-plate`)                                                                                     |
| `colorId`       | — (optional)           | not in catalog (`unknown-reference`); unavailable; category differs (`category-mismatch`); not in plate's `supportedColorIds` (`unsupported-by-plate`) |
| `frameId`       | — (optional)           | not in catalog; unavailable; shape not declared (`incompatible-shape`); plate not in `plateIds` (`incompatible-plate`)                                 |
| `text`          | `''`                   | whitespace only (`whitespace-only`)                                                                                                                    |

Result precedence: any invalid issue → `invalid`; otherwise any missing → `incomplete`; otherwise `valid`. All issues are reported, not only the first. Plate-dependent checks are skipped when the plate is unknown (the plate issue is reported instead).

## Compatibility considerations

- **Variant-level availability** (e.g. plate X unavailable in rectangle + colored) is anticipated. It can be added as an optional `variants` list on `Plate` without changing `Configuration` or the validation result shape.
- **Physical compatibility** will require defined `Dimensions` on both plates and frames plus mounting data; the model will be extended when that data exists.
- **Catalog integrity** checks (duplicate IDs, dangling references) are planned for M1 with catalog loading.

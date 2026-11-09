# 04 — Data Model

Source of truth: [`src/domain/types.ts`](../src/domain/types.ts). This document explains intent; if they disagree, the code wins and this document must be fixed.

Vocabulary: the customer-facing word for a product is **Modelo**; the code keeps the type name `Plate`. "Quadro" is the name of one complete product model (ceramic plate in a wooden frame, 20 × 20 cm), photographed assembled. There is no separate frame entity or choice (D-046).

## Entities

### Enumerations

| Type         | Values                                       | Notes                                                                                                                                                  |
| ------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PlateShape` | `square`, `rectangle`, `circle`, `scalloped` | Classification of the model, fixed per model (D-023, D-040). Implies no geometry or aspect ratio; `scalloped` (the wavy trays) is classification only. |
| `FontFamily` | `serif`, `sans-serif`                        | "Com serifa" / "Sem serifa" (`FONT_FAMILIES`). Drawn with Quicksand Bold (spaced) and Gelasio Regular, self-hosted (D-072).                            |

### `Dimensions`

```ts
type Dimensions = { status: 'pending' } | { status: 'defined'; widthMm: number; heightMm: number };
```

Unknown dimensions must be `pending`. Never invent numbers to satisfy types. The four current models have confirmed outer dimensions (P-01); the Quadro's is its frame, with a 100 × 100 mm ceramic inside. A model's `sizeLabel` ("10 × 10 cm", "8 × 8 cm") is display text as supplied, not a measurement.

### `AssetRef`

| Field                  | Required | Notes                                                                |
| ---------------------- | -------- | -------------------------------------------------------------------- |
| `src`                  | yes      | `/catalog/plates/{owner-id}/{name}.{webp\|png\|jpg}` (D-031, D-046). |
| `alt`                  | no       | Accessible description.                                              |
| `widthPx` / `heightPx` | no       | Intrinsic pixel size; both or neither; positive integers.            |

Assets may be missing at runtime; consumers must handle that gracefully. Conventions: [07-product-assets.md](07-product-assets.md).

### `NormalizedBox`

`{ x, y, width, height }` as fractions (0–1) of the image it belongs to, origin top-left (D-034). Positioning metadata only; it does not describe exact outlines.

### `PlateImage`

| Field          | Required | Notes                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`        | yes      | `AssetRef` in `/catalog/plates/{plate-id}/`.                                                                                                                                                                                                                                                                                                                                                                      |
| `objectBounds` | no       | Bounding box of the product in the photograph (the Quadro's includes its frame). Pending = omit.                                                                                                                                                                                                                                                                                                                  |
| `text`         | no       | `TextLayout`: `area` (`NormalizedBox`), optional `align` (`left`, `center`, `right`), optional `fontSize` (fixed lettering size, fraction of the image width, in (0, 1]; omitted while pending, D-055), optional `fixedPlacement` (`true`: the text is always at the default center position and alignment, and the configuration's `textLayout` is ignored for this model but kept; production Bandejas, D-068). |

Each model has at most one photograph: its ceramic color is fixed, so there are no color variations (D-041). The Quadro's photograph shows it assembled with its frame, and its `text.area` lies inside the ceramic, clear of the frame (D-046).

### Common component fields

| Field         | Required | Notes                                          |
| ------------- | -------- | ---------------------------------------------- |
| `id`          | yes      | Stable kebab-case; unique across the catalog.  |
| `displayName` | yes      | User-facing (pt-BR).                           |
| `available`   | no       | Omitted = available; `false` = not selectable. |

### `Plate` (`type: 'plate'`)

A product model. Placa cerâmica, Quadro, Bandeja ondulada M, and Bandeja ondulada G are separate models with their own IDs (D-023, D-040, D-046).

| Field          | Required | Notes                                                                                                                    |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `shape`        | yes      | The model's single, fixed `PlateShape` classification.                                                                   |
| `sizeLabel`    | yes      | Customer-facing size exactly as supplied, e.g. `10 × 10 cm` or `8 × 8 cm` (nominal; handmade pieces vary). Display only. |
| `ceramicColor` | yes      | Fixed color of the piece, e.g. `Bege`. Shown read-only as "Cor da peça"; the customer never chooses it (D-041).          |
| `dimensions`   | yes      | `Dimensions` (may be `pending`).                                                                                         |
| `image`        | no       | `PlateImage`; omitted while the photograph is pending.                                                                   |

The option label shown to customers is `displayName — sizeLabel`, e.g. "Bandeja ondulada M — 8 × 8 cm" (D-046).

The current production IDs are **provisional** until Taavi confirms them: `placa-ceramica-10`, `quadro-20`, `bandeja-ondulada-m-8`, `bandeja-ondulada-g-11`. An ID must not be renamed without a migration note in [06-decisions.md](06-decisions.md); `bandeja-ondulada-m-11` → `bandeja-ondulada-g-11` is recorded in D-046 (nothing persisted the old ID).

### `TextColor` (`type: 'text-color'`)

A lettering color offered for the text. Common component fields plus:

| Field | Required | Notes                                                    |
| ----- | -------- | -------------------------------------------------------- |
| `hex` | yes      | `#rrggbb`, as supplied by Taavi. Never derived or tuned. |

The production palette is empty until Taavi supplies it (P-02); the demo catalog has three clearly labeled synthetic colors (`demo-letra-*`).

### `TextRange`

`{ start, end }` — a half-open range of UTF-16 offsets into `Configuration.text`. Valid ranges (`areValidRanges`) are non-empty, inside the text, on grapheme boundaries (`Intl.Segmenter`), contain no `\r`/`\n`, and are sorted, non-overlapping, and non-adjacent (normalized). Helpers in [`src/domain/text-ranges.ts`](../src/domain/text-ranges.ts): `snapSelection`, `addRange`, `removeRange`, `normalizeRanges`, `remapRanges` (D-043).

### `Catalog`

`{ plates, textColors }` — readonly arrays, deep-frozen at runtime, obtained via `getCatalog()`. The only source of available components. Must pass `validateCatalog` (see [Catalog integrity rules](#catalog-integrity-rules)). The production catalog registers the four supplied models and no lettering colors.

### `Configuration`

| Field              | Type                    | Required | Notes                                                             |
| ------------------ | ----------------------- | -------- | ----------------------------------------------------------------- |
| `plateId`          | `string \| null`        | yes      | References `Plate.id`.                                            |
| `text`             | `string`                | yes      | Raw, never trimmed or normalized.                                 |
| `fontFamily`       | `FontFamily`            | yes      | Default `sans-serif` ("Sem serifa").                              |
| `textColorId`      | `string \| null`        | yes      | References `TextColor.id`. Starts at the catalog default (D-064). |
| `highlightEnabled` | `boolean`               | yes      | "Destacar parte(s) do texto"; off by default (D-071).             |
| `secondaryColorId` | `string \| null`        | no       | Highlight color; kept while highlighting is off.                  |
| `secondaryRanges`  | `readonly TextRange[]`  | no       | Highlighted word occurrences, one range each, in order (D-071).   |
| `textLayout`       | `TextPlacement \| null` | no       | `null` = catalog default alignment and position (D-044).          |
| `note`             | `string`                | no       | "Observação", exactly as typed; never validated or drawn (D-062). |

Serializable as plain JSON. Contains only IDs and user input — never copies of catalog objects. There is no `shape` and no color field: the shape is derived from the selected model (`getPlateShape`) and the ceramic color is a catalog property of the model. No customer configuration is persisted anywhere, so removing the former color fields and `frameId` (D-046) needs no data migration.

### `TextPlacement`

`{ align, x, y }` — the customer's text placement (D-044). `align` (`left`/`center`/`right`) aligns the lines inside the text block. `x` and `y` (0–1) place the block as fractions of the free space around it inside the calibrated text area: `left = area.x + x × (area.width − blockWidth)`, likewise for `y`. Any valid value therefore keeps the block inside the area, on every model. `null` resolves to the catalog default: the photograph's `text.align` (default `center`), `x` = that alignment's anchor (0, 0.5, 1), `y` = 0.5. Presets set all three properties; moves and drags keep `align`. There is no alignment-only control (D-047). Helpers in [`src/domain/text-placement.ts`](../src/domain/text-placement.ts).

## Relationships

```text
Configuration.plateId ──► Plate.id            (shape derived from Plate.shape)
Configuration.textColorId ──► TextColor.id
Configuration.secondaryColorId ──► TextColor.id (optional)
Configuration.secondaryRanges ──► offsets into Configuration.text
```

### Image lookup

`findPlateImage(plate)` returns `{ status: 'available', image }` or `{ status: 'pending' }`. Exact match only: a model without a photograph → pending; never another model's image (D-041). A file that fails to load is detected by the renderer, not the domain. Configuration validation never consults images.

## Validation rules

Implemented in [`src/domain/validation.ts`](../src/domain/validation.ts) (D-005, D-016, D-017).

### Per-field contract

Every field is evaluated. Each field reports **at most one issue**: the first failing rule in the order below. Later rules for the same field are not reported until the earlier issue is resolved.

| Field              | Precedence (first failure wins)                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `plateId`          | 1. `null` → missing · 2. not in catalog → `unknown-reference` · 3. `available: false` → `unavailable`                                                                                                              |
| `text`             | 1. `''` → missing · 2. only whitespace/invisible characters → `blank`                                                                                                                                              |
| `fontFamily`       | not `serif`/`sans-serif` → `unsupported-font`                                                                                                                                                                      |
| `textColorId`      | 1. `null` → missing · 2. not in catalog → `unknown-reference` · 3. unavailable → `unavailable`                                                                                                                     |
| `secondaryColorId` | Only while `highlightEnabled` and `secondaryRanges` is non-empty. 1. `null` → missing · 2. not in catalog → `unknown-reference` · 3. unavailable → `unavailable` · 4. same ID as `textColorId` → `same-as-primary` |
| `secondaryRanges`  | Only while `highlightEnabled` and non-empty: each range must be a whole word occurrence of the text (`wordsOf`), distinct and in order → otherwise `invalid-ranges`                                                |
| `textLayout`       | Optional. Not `null` and not a placement with a known `align` and finite `x`/`y` in 0–1 → `invalid-layout` (never clamped; drawn at the catalog default)                                                           |

Conditional rules:

- There is no ceramic color rule: the ceramic color is a fixed catalog property (D-041). The lettering color rules above concern the text only.
- Highlighting off, or on with no word, is a valid one-color configuration whatever `secondaryColorId` holds; the color and words are kept for when it is turned on again (D-071). Choosing the highlight color as the primary swaps the two.

### Blank text

Non-empty text is `blank` (invalid) when every character is either Unicode `White_Space` (spaces, tabs, line breaks, no-break spaces such as U+00A0 and U+202F) or one of: U+200B ZERO WIDTH SPACE, U+200C ZERO WIDTH NON-JOINER, U+200D ZERO WIDTH JOINER, U+2060 WORD JOINER, U+FEFF ZERO WIDTH NO-BREAK SPACE (BOM). Any other character (letters, accents, combining marks, emoji, emoji sequences containing U+200D) makes the text non-blank. The check never modifies the stored text.

### Selection transitions

Choosing a model only sets `plateId`; nothing else in the configuration changes (the former `selectPlate` frame clearing was removed with frames, D-046). The only automatic change is formatting removed after an edit that cannot be located (D-042).

### Result status

Any invalid issue → `invalid`; otherwise any missing issue → `incomplete`; otherwise `valid`. Issues are listed in field order: `plateId`, `text`, `fontFamily`, `textColorId`, `highlightEnabled` (never reported), `secondaryColorId`, `secondaryRanges`, `textLayout` (`note` is never validated).

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

Unlike configuration validation, **every** issue is reported. Order is deterministic: `plates`, then `textColors`; within a component, fields in definition order. Array indices in paths are diagnostic only. Data is never repaired or filtered.

| Code                | Rule violated                                                                                                                                                                | Paths                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `invalid-id`        | ID must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` (non-empty, lowercase kebab-case)                                                                                                 | `<collection>[i].id`                                                         |
| `duplicate-id`      | IDs unique across plates and text colors; reported at each repeat, `relatedPath` = first occurrence                                                                          | `<collection>[i].id`                                                         |
| `empty-label`       | A model's `sizeLabel` and `ceramicColor` are non-blank strings (D-040, D-041); a text color's `displayName` is non-blank                                                     | `plates[i].sizeLabel`, `plates[i].ceramicColor`, `textColors[i].displayName` |
| `invalid-color`     | A text color's `hex` is `#rrggbb` (D-043)                                                                                                                                    | `textColors[i].hex`                                                          |
| `unknown-reference` | `defaultTextColorId`, when set, names an available text color (D-064)                                                                                                        | `defaultTextColorId`                                                         |
| `invalid-dimension` | Defined `widthMm` and `heightMm` are finite and > 0 (each reported separately)                                                                                               | `plates[i].dimensions.widthMm` / `.heightMm`                                 |
| `invalid-asset`     | `src` matches the asset path allowlist in the owner's folder (D-031); `widthPx`/`heightPx` both present and positive integers when either is (each side reported)            | `plates[i].image.image.src`, `.widthPx` / `.heightPx`                        |
| `invalid-placement` | Boxes have finite values, `x, y ≥ 0`, `width, height > 0`, and fit in the image; `text.align` is known; `text.area` lies inside `objectBounds` when both set (`relatedPath`) | `plates[i].image.objectBounds` / `.text.area` / `.text.align`                |

Allowed (not issues): an empty catalog; `pending` dimensions; no `image`, intrinsic sizes, or placement metadata; one file referenced by several entries; any shape classification. Equal sides for squares and circles are not checked until real measurements exist.

Frame-only codes (`duplicate-entry`, `unknown-reference`, `unreachable-compatibility`, `empty-list`, `frame-capability-conflict`, `unsupported-frame-shape`, `duplicate-variation`) were removed with frames (D-046).

Additional semantics:

- **Duplicates resolve to the first occurrence** for `relatedPath`, matching configuration lookups.
- **Non-string IDs and labels** (possible only when data bypasses the types) are reported as `invalid-id` / `empty-label` without coercion; invalid-id issues for them omit `id`.

## Compatibility considerations

- **Frames:** no model takes a separate frame (D-046). The Quadro's frame is part of the product and of its photograph. A future product with a choosable frame would need a new decision, not a revival of the removed model.
- **Variant-level availability** is not needed now that color is fixed per model; a future per-model option can be added as an optional field on `Plate` without changing `Configuration` or the validation result shape.

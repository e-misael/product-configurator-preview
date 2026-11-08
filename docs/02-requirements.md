# 02 — Requirements

Requirement IDs are stable. Do not renumber; deprecate instead.

Status values: **Pending** (not implemented), **Foundation** (domain types/validation exist, no UI), **Done** (implemented and validated with evidence).

## MVP functional requirements

### FR-01 — Plate selection (Placa)

Required. The user selects a plate from the catalog.

Acceptance criteria:

1. Only plates present in the catalog can be selected.
2. Each plate has a stable ID independent of list position.
3. A configuration without a plate is _incomplete_.
4. A configuration referencing an unknown or unavailable plate is _invalid_.
5. An empty catalog is a supported state; no plate data is invented.
6. Square, rectangular, and circular plates are separate plate models with their own IDs; each model has exactly one fixed shape (D-023).

Status: Foundation.

### FR-02 — Frame selection (Quadro)

Optional. The user selects a frame or explicitly chooses no frame.

Acceptance criteria:

1. "No frame" is a valid choice.
2. A selected frame must exist in the catalog and be available.
3. Each plate declares `supportsFrame`. Circular plates never support frames; square and rectangular plates may, subject to catalog compatibility (D-024).
4. A frame on a plate without frame support makes the configuration _invalid_ (`frame-not-supported`).
5. Each frame declares compatible shapes and may restrict compatible plates. A frame incompatible with the plate's shape or not allowed for the plate makes the configuration _invalid_.
6. Selecting a plate without frame support clears a previously selected frame, and the UI tells the user it was removed (D-026). Other incompatibilities are not cleared automatically; they are reported by validation.
7. Declared compatibility is not proof of physical fit; real dimensions and mounting constraints are required before production use.

Status: Foundation (domain, selection transition; no UI).

### FR-03 — Plate color (Cor da placa)

Required. Categories: **Nude**, **Colored**. A specific color within the category is optional until the catalog defines real colors.

Acceptance criteria:

1. A configuration without a color category is _incomplete_.
2. The category must be supported by the selected plate.
3. When a specific color ID is provided, it must exist, be available, belong to the selected category, and be supported by the selected plate.
4. No HEX values, color names, textures, or finishes are invented.

Status: Foundation.

### FR-04 — Plate shape (Formato da placa)

Shapes: **Square**, **Rectangle**, **Circle**. The shape is a fixed property of the plate model, not a separate user selection (D-023).

Acceptance criteria:

1. The configuration does not store a shape; it is derived from the selected plate.
2. The UI displays the shape of the selected plate (it may group plates by shape, but grouping is not stored).
3. Dimensions and aspect ratios come from catalog data, not rendering code; unknown values are marked `pending`.

Status: Foundation.

### FR-05 — Custom text (Texto)

Required.

Acceptance criteria:

1. Empty text makes the configuration _incomplete_.
2. Text consisting only of whitespace or invisible formatting characters makes the configuration _invalid_ (`blank`, see D-017). Legitimate Unicode text (accents, combining marks, emoji) is valid.
3. The text is stored exactly as entered (no trimming or normalization).
4. Line breaks are preserved.
5. (Preview, M3) Multi-line, wrapping, alignment, long text, and overflow are handled without silent clipping.

Typography and positioning controls are not approved MVP inputs.

Status: Foundation (validation only).

### FR-06 — Real-time preview

Acceptance criteria:

1. The preview reflects plate (including its shape), color, optional frame, and text.
2. The preview updates on every relevant change.
3. The preview never silently shows a configuration different from the user's selection.
4. Missing assets are handled gracefully and visibly.
5. The final preview is composed from real product images (FR-08); generic vector shapes are acceptable only as temporary, clearly marked demonstration output.

Status: Pending (M3).

### FR-07 — Image export

Acceptance criteria:

1. The user can export the current composition as an image.
2. The exported image visually matches the preview.
3. Format (PNG proposed), resolution, transparency, background, and file naming are confirmed during M4 before implementation.

Status: Pending (M4).

### FR-08 — Real product imagery

Approved product requirement (D-027). The final configurator represents plates and frames with **real product image assets** supplied by the store.

Acceptance criteria:

1. Square, rectangular, and circular plates are shown with real images of the selected plate model.
2. Compatible frames are shown with real frame images, composed with the plate.
3. Actual color and finish variations are represented with images (or other store-approved visual data) of that variation. A CSS tint, filter, or blend over a photograph is **not** accepted as an accurate representation of a ceramic color.
4. The composition is layered: plate image, optional frame image, and personalized text, with accurate scaling, alignment, and positioning defined by catalog data, not hard-coded in rendering code.
5. The live preview and the exported image are produced from the same composition and the same image sources (FR-07.2).
6. No production product photographs are generated, invented, or substituted. Synthetic demonstration assets may be used temporarily to exercise the workflow; they live outside the production catalog, are labeled as demonstration content, and never ship as product imagery.
7. Product imagery is independent of configuration state and domain validation: `Configuration` stores no image data, and validation does not depend on whether an image exists.

Status: Pending — interface prepared in M2, rendering in M3, real assets in M1.3.

## Non-functional requirements

| ID     | Requirement                                                                            |
| ------ | -------------------------------------------------------------------------------------- |
| NFR-01 | Mobile-first; no unexpected horizontal scrolling.                                      |
| NFR-02 | Accessible form controls (labels, keyboard operation, visible focus).                  |
| NFR-03 | User-facing interface in Brazilian Portuguese (pt-BR); "Placa" and "Quadro" preserved. |
| NFR-04 | Runs as a static frontend; no backend services.                                        |
| NFR-05 | Domain logic is pure and unit-tested.                                                  |

## Future ideas (not MVP)

- Typography and text positioning controls.
- Variant-level availability (e.g. a specific color unavailable for one plate model).
- Nuvemshop integration, pricing, and order workflows.

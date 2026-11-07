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

Status: Foundation.

### FR-02 — Frame selection (Quadro)

Optional. The user selects a frame or explicitly chooses no frame.

Acceptance criteria:

1. "No frame" is a valid choice.
2. A selected frame must exist in the catalog and be available.
3. Each frame declares compatible shapes and may restrict compatible plates.
4. A frame incompatible with the selected shape or plate makes the configuration _invalid_.
5. Declared compatibility is not proof of physical fit; real dimensions and mounting constraints are required before production use.

Status: Foundation.

### FR-03 — Plate color (Cor da placa)

Required. Categories: **Nude**, **Colored**. A specific color within the category is optional until the catalog defines real colors.

Acceptance criteria:

1. A configuration without a color category is _incomplete_.
2. The category must be supported by the selected plate.
3. When a specific color ID is provided, it must exist, be available, belong to the selected category, and be supported by the selected plate.
4. No HEX values, color names, textures, or finishes are invented.

Status: Foundation.

### FR-04 — Plate shape (Formato da placa)

Required. Shapes: **Square**, **Rectangle**.

Acceptance criteria:

1. A configuration without a shape is _incomplete_.
2. The shape must be supported by the selected plate.
3. Dimensions and aspect ratios come from catalog data, not rendering code; unknown values are marked `pending`.

Status: Foundation.

### FR-05 — Custom text (Texto)

Required.

Acceptance criteria:

1. Empty text makes the configuration _incomplete_.
2. Whitespace-only text makes the configuration _invalid_.
3. The text is stored exactly as entered (no trimming or normalization).
4. Line breaks are preserved.
5. (Preview, M3) Multi-line, wrapping, alignment, long text, and overflow are handled without silent clipping.

Typography and positioning controls are not approved MVP inputs.

Status: Foundation (validation only).

### FR-06 — Real-time preview

Acceptance criteria:

1. The preview reflects plate, color, shape, optional frame, and text.
2. The preview updates on every relevant change.
3. The preview never silently shows a configuration different from the user's selection.
4. Missing assets are handled gracefully and visibly.

Status: Pending (M3).

### FR-07 — Image export

Acceptance criteria:

1. The user can export the current composition as an image.
2. The exported image visually matches the preview.
3. Format (PNG proposed), resolution, transparency, background, and file naming are confirmed during M4 before implementation.

Status: Pending (M4).

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
- Variant-level availability (e.g. a specific shape × color combination unavailable for a plate).
- Nuvemshop integration, pricing, and order workflows.

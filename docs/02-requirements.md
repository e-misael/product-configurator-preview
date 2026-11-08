# 02 — Requirements

Requirement IDs are stable. Do not renumber; deprecate instead.

Status values: **Pending** (not implemented), **Foundation** (domain types/validation exist, no UI), **UI** (domain plus working interface, validated against the demo catalog; awaiting real catalog data), **Done** (implemented and validated with real product data).

## MVP functional requirements

### FR-01 — Model selection (Modelo)

Required. The customer selects a model from the catalog: Placa cerâmica (10 cm x 10 cm), Quadro (20 cm x 20 cm), Bandeja ondulada M (~ 8 cm), or Bandeja ondulada M (~ 11 cm). In code a model is a `Plate`.

Acceptance criteria:

1. Only models present in the catalog can be selected.
2. Each model has a stable ID independent of list position (the four production IDs are provisional until confirmed, D-040).
3. A configuration without a model is _incomplete_.
4. A configuration referencing an unknown or unavailable model is _invalid_.
5. An empty catalog is a supported state; no model data is invented.
6. Each model has exactly one fixed shape classification (`square`, `rectangle`, `circle`, `scalloped`); the Quadro is a model, not a frame (D-023, D-040).
7. Only available models are offered. A selected model that is unknown or unavailable stays visible and marked invalid (D-030).
8. Options show the supplied name and size label as given, approximations included ("Bandeja ondulada M (~ 8 cm)"); physical dimensions stay `pending`.

Status: UI (M2, revised by M4.1a).

### FR-02 — Frame selection (Moldura)

Optional. The customer selects a frame or explicitly chooses no frame, on models that take one. No production model is currently declared to take a frame (P-13), so the field is hidden there.

Acceptance criteria:

1. "No frame" is a valid choice.
2. A selected frame must exist in the catalog and be available.
3. Each model declares `supportsFrame`. Circular models never support frames; other models may, subject to catalog compatibility (D-024). No model is assumed to support a frame until confirmed.
4. A frame on a model without frame support makes the configuration _invalid_ (`frame-not-supported`).
5. Each frame declares compatible shapes and may restrict compatible models. A frame incompatible with the model's shape or not allowed for the model makes the configuration _invalid_.
6. Selecting a model without frame support clears a previously selected frame, and the UI tells the user it was removed (D-026). Other incompatibilities are not cleared automatically; they are reported by validation.
7. Declared compatibility is not proof of physical fit; real dimensions and mounting constraints are required before production use.
8. A selected frame that becomes incompatible after a model change stays visible, is marked invalid with its validation message, and can be removed or replaced. "Sem moldura" is never shown as selected while a frame is selected (D-030).
9. The frame field is shown only when the model offers frames or an invalid frame is still selected.

Status: UI (M2, revised by M4.1a).

### FR-03 — Piece color (Cor da peça)

Superseded by D-041. The ceramic color is not a customer choice.

Acceptance criteria:

1. Each model carries its fixed ceramic color in the catalog (currently "Bege" for all four models).
2. The UI shows it as read-only information labeled "Cor da peça" next to the selected model; there is no color control.
3. Configuration validation has no color rule, and `Configuration` stores no color.
4. No HEX values, textures, or finishes are invented.

Status: UI (M4.1a).

### FR-04 — Model shape

Shape is a fixed classification of the model, not a user selection and no longer shown in the UI (D-023, D-040).

Acceptance criteria:

1. The configuration does not store a shape; it is derived from the selected model.
2. `scalloped` classifies the wavy trays only; no geometry is inferred from it.
3. Dimensions and aspect ratios come from catalog data, not rendering code; unknown values are marked `pending`. The size label is display text, not a measurement.

Status: UI (M4.1a).

### FR-05 — Custom text (Texto)

Required.

Acceptance criteria:

1. Empty text makes the configuration _incomplete_.
2. Text consisting only of whitespace or invisible formatting characters makes the configuration _invalid_ (`blank`, see D-017). Legitimate Unicode text (accents, combining marks, emoji) is valid.
3. The text is stored exactly as entered (no trimming or normalization).
4. Line breaks are preserved.
5. (Preview, M3) Multi-line, wrapping, alignment, long text, and overflow are handled without silent clipping.

Typography, lettering color, and positioning controls are planned as M4.1b (D-042) and are not implemented.

Status: UI (M2) for criteria 1–4; criterion 5 pending (M3).

### FR-06 — Real-time preview

Acceptance criteria:

1. The preview reflects the model, optional frame, and text; the ceramic color is that of the model's photograph.
2. The preview updates on every relevant change.
3. The preview never silently shows a configuration different from the user's selection.
4. Missing assets are handled gracefully and visibly.
5. The final preview is composed from real product images (FR-08); generic vector shapes are acceptable only as temporary, clearly marked demonstration output.
6. Layers are painted in this order: frame back, plate, personalized text, frame foreground (D-037).
7. Each reason an image is not shown — model not selected or invalid, image not yet registered, loading, file failed to load, frame invalid or not calibrated, text area not calibrated, text too long — is stated in text and distinct from the others; nothing else is substituted.
8. Text keeps its line breaks, is never altered, truncated, or silently clipped, and shrinks only to a documented minimum before a visible warning (D-038).

Status: UI (M3.1) — implemented and verified with synthetic demonstration images only. Real product images and calibration (M1.3b) and masking of non-rectangular outlines are pending (M3.2).

### FR-07 — Image export

Acceptance criteria:

1. The user can export the current composition as an image.
2. The exported image visually matches the preview.
3. Format (PNG proposed), resolution, transparency, background, and file naming are confirmed during M4 before implementation.
4. Once M4.1b exists, the exported image renders the same font family, lettering colors, and text position as the preview, from the same scene (D-039).

Status: Pending (M4).

### FR-08 — Real product imagery

Approved product requirement (D-027). The final configurator represents plates and frames with **real product image assets** supplied by the store.

Acceptance criteria:

1. Each model is shown with a real image of that model.
2. Compatible frames are shown with real frame images, composed with the plate.
3. The model's actual color and finish are represented by its own photograph. A CSS tint, filter, or blend over a photograph is **not** accepted as an accurate representation of a ceramic color.
4. The composition is layered: plate image, optional frame image, and personalized text, with accurate scaling, alignment, and positioning defined by catalog data, not hard-coded in rendering code.
5. The live preview and the exported image are produced from the same composition and the same image sources (FR-07.2).
6. No production product photographs are generated, invented, or substituted. Synthetic demonstration assets may be used temporarily to exercise the workflow; they live outside the production catalog, are labeled as demonstration content, and never ship as product imagery.
7. Product imagery is independent of configuration state and domain validation: `Configuration` stores no image data, and validation does not depend on whether an image exists.

8. Each image is a same-origin file under `/catalog/`, in its owner's folder; catalog integrity rejects any other path (D-031).
9. A model uses only its own photograph; with none registered, the image is pending — never another model's image (D-041).

Status: Pending. M2: preview slot. M1.3a: catalog contract (image variations, frame layers per plate, optional placement, path rules, integrity checks) — done. M3.1: Canvas preview of catalog imagery, verified with synthetic demonstration images only — done. M1.3b: real assets and calibration — blocked on photographs.

## Non-functional requirements

| ID     | Requirement                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-01 | Mobile-first; no unexpected horizontal scrolling.                                                                                                                   |
| NFR-02 | Accessible form controls (labels, keyboard operation, visible focus).                                                                                               |
| NFR-03 | User-facing interface in Brazilian Portuguese (pt-BR); product names such as "Placa cerâmica" and "Quadro" preserved; "Modelo" and "Moldura" are the generic terms. |
| NFR-04 | Runs as a static frontend; no backend services.                                                                                                                     |
| NFR-05 | Domain logic is pure and unit-tested.                                                                                                                               |

## Future ideas (not MVP)

- Advanced text customization (font family, up to two lettering colors, positioning): planned as M4.1b, not implemented (D-042).
- Handmade-product disclaimer near the controls (copy in D-042) and a per-line text-length limit: planned, not implemented.
- Nuvemshop integration, pricing, and order workflows.

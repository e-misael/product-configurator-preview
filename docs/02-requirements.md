# 02 — Requirements

Requirement IDs are stable. Do not renumber; deprecate instead.

Status values: **Pending** (not implemented), **Foundation** (domain types/validation exist, no UI), **UI** (domain plus working interface, validated against the demo catalog; awaiting real catalog data), **Done** (implemented and validated with real product data).

## MVP functional requirements

### FR-01 — Model selection (Modelo)

Required. The customer selects a model from the catalog: "Placa cerâmica — 10 × 10 cm", "Quadro — 20 × 20 cm", "Bandeja ondulada M — 8 × 8 cm", or "Bandeja ondulada G — 11 × 11 cm" (D-046). In code a model is a `Plate`. The Quadro is one complete product (ceramic plate in a wooden frame), not a plate plus a chosen frame.

Acceptance criteria:

1. Only models present in the catalog can be selected.
2. Each model has a stable ID independent of list position (the four production IDs are provisional until confirmed, D-040; `bandeja-ondulada-m-11` was renamed `bandeja-ondulada-g-11` with a migration note in D-046).
3. A configuration without a model is _incomplete_.
4. A configuration referencing an unknown or unavailable model is _invalid_.
5. An empty catalog is a supported state; no model data is invented.
6. Each model has exactly one fixed shape classification (`square`, `rectangle`, `circle`, `scalloped`); the Quadro is a model that includes its frame (D-023, D-046).
7. Only available models are offered. A selected model that is unknown or unavailable stays visible and marked invalid (D-030).
8. Options show the supplied name and size label as given, as `displayName — sizeLabel` ("Placa cerâmica — 10 × 10 cm"). Size labels are nominal product dimensions; handmade pieces vary, as the disclaimer says. Physical dimensions are recorded only as confirmed by Taavi (P-01).
9. Bandeja ondulada M and G are one option, "Bandeja ondulada" ("Disponível em dois tamanhos"), with a required "Tamanho" choice, "M — 8 × 8 cm" or "G — 11 × 11 cm", never preselected (D-057). The configuration stores the chosen size's own model ID. Until a size is chosen no model is selected, and the status and export reasons say "Falta escolher: Tamanho.". Changing the size keeps the text, colors, and position.
10. The summary shows "Modelo" and "Tamanho" as separate rows.

Status: UI (M2, revised by M4.1a, M4.2, and M4.5).

### FR-02 — Frame selection (Moldura)

Superseded by D-046 (M4.2). There is no separate frame choice: the Quadro is sold and photographed assembled with its wooden frame, and no other model takes a frame. The former criteria (frame compatibility, `supportsFrame`, clearing on model change, kept-but-invalid frames, frame layers) were removed with the frame concept; see D-014, D-022, D-024, D-026, D-033 for the history.

Acceptance criteria:

1. No "Moldura" field, option, or summary row is shown for any model.
2. `Configuration` stores no frame, and the catalog has no frames.

Status: Superseded (M4.2).

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

Typography and lettering colors (M4.1b-1, D-042, D-043):

6. The font is "Sem serifa" (default) or "Com serifa"; the preview uses provisional system font stacks (P-14). "Sem serifa" letters in capitals only: the preview, the summary, the line limit, and the PNG use the pt-BR uppercase form of each character (accents kept: "ação" → "AÇÃO"; a character whose capital would change the text's length, such as "ß", is kept as typed). The text is still stored exactly as typed, so "Com serifa" shows it again in mixed case; the field displays capitals while "Sem serifa" is chosen. A hint beside the font choice states the rule (D-068).
7. A lettering color ("Cor do texto") is required; the catalog may name a default that starts selected (production: Marrom, D-064), which the customer can change. Without one (no default, or a catalog without it) the configuration is _incomplete_. The production palette is Marrom, Azul, Verde, Vermelho escuro, Laranja escuro, Amarelo queimado, Preto (D-056, D-067); an empty palette would say so in the UI. Until one is chosen, the preview draws the text in a provisional neutral color and says so ("Cor do texto ainda não escolhida…"); the summary shows "Não escolhida".
8. Any available color may be the second color (D-056). An optional second color is applied by tapping it (D-069, superseding the "Aplicar segunda cor à seleção" button): the tap reads the "Texto" field's selection at that moment (mouse, keyboard, or touch handles, also after focus left the field), colors those characters, and confirms it ("Azul aplicado a “CASA”."); tapping the chosen color again applies it to a new selection. Without a selection the tap only chooses the color and says what to do next. A help line ("Selecione as letras no campo Texto e toque em uma cor para destacá-las.") and a "Seleção: “…”" indicator ("Nenhuma letra selecionada.") come before the colors. The colored trechos are listed with the second color's chip and a "Remover" button each (accessible name "Remover segunda cor de “…”"); there is one second color per piece, so choosing another one recolors every trecho, which the list states when there are several. Ranges never split a grapheme or include a line break; the text itself is never changed by formatting. A second color equal to the first is _invalid_ (`same-as-primary`) and its swatch is disabled.
9. Editing the text moves the colored ranges with the edit, using the textarea caret when available; when the edit cannot be located the affected formatting is removed and a notice says so. Removing the last range keeps the chosen second color; only "Remover segunda cor" clears the color and its ranges.
10. The handmade-product disclaimer is shown below the controls, in three paragraphs (copy in D-056).

Lettering-color controls (M4.2, D-047):

20. Lettering colors are labeled swatches with native radio semantics: the selected swatch shows a check mark, a heavier border, and its color name as visible text, so the choice never depends on color alone. In "Cor do texto" and "Segunda cor" only the selected swatch shows its name; the others are color chips whose name stays their accessible name and tooltip (M4.6, D-069). They are keyboard-operable with a visible focus ring.
21. The second color is behind a "Usar segunda cor" button (`aria-expanded`, `aria-controls`). Its swatches appear only when expanded; the list of trechos and "Remover segunda cor" appear only when a second color is chosen and the section is open.
22. Collapsing the section never changes the configuration: the color and its trechos stay, shown as "Segunda cor em uso: {cor} ({n} trechos)." and in the summary. "Remover segunda cor" clears the color and every trecho and returns focus to "Usar segunda cor".
23. An invalid second color (unavailable or equal to the primary) keeps the section open, without the toggle, with its message, until it is replaced or removed (D-030).
24. A line break that would take the text past the lines the model's calibrated area holds (at its fixed lettering size) is refused: the text and caret stay as they were and "Este modelo comporta no máximo N linhas." is announced. Typing or pasting without new breaks, and deletions, are never refused, so text that wraps past the area still overflows. While it overflows, the warning is also shown as an error under the "Texto" field (which is marked invalid) and in the error style in the preview (D-063).

Text alignment and position (M4.1b-2, D-044):

11. "Posição do texto" offers nine presets (Superior/Meio/Inferior × à esquerda/ao centro/à direita; the middle one is "Centro") under the help "Escolha onde o bloco de texto fica na peça." (D-068). A preset sets only the block position (columns x = 0, 0.5, 1; rows y = 0, 0.5, 1) and keeps the line alignment. Each preset shows a glyph of aligned lines placed where the text will go; the selected one is inverted (`aria-pressed`) and named in the section's one status line ("Posição: Superior à esquerda." or, for any other position, "Posição personalizada: horizontal 34%, vertical 50%."; D-057).
12. "Alinhamento das linhas" (D-059, superseding D-047): three icon-only radios, "Alinhar à esquerda", "Centralizar texto", "Alinhar à direita", default the catalog alignment. They align the lines inside the block (left edges, centers, or right edges together) and never move the block; nothing else changes the alignment.
13. The block position is a fraction of the free space around the block inside the calibrated text area, so the text never leaves that area. The font size does not depend on the position, and the text is not enlarged to fill the area; with free space, every preset gives a different position.
14. There is no manual positioning (D-068, superseding D-059's "Ajustar manualmente"): no drag on the preview, no directional buttons or arrow keys; touch on the preview always scrolls the page. A position saved earlier that matches no preset is kept and shown as "Personalizada".
15. Bandeja ondulada M and G letter only at the center (`fixedPlacement`, D-068): horizontal center, vertical center, lines centered. They show no presets and no alignment, only "Nas bandejas, o texto fica sempre centralizado." (also beside the size choice); the summary says "Alinhamento: Centralizado" and "Posição: Centro". The position chosen for another model is kept and applies again when switching back. The presets group is named "Posições predefinidas" for assistive technology (D-057).
16. "Redefinir posição" restores the catalog default position and keeps the chosen alignment (D-059).
17. The position is kept across model changes and applies to the destination model's calibrated text area (except on the trays, criterion 15). The summary shows "Alinhamento:" and "Posição:" (the preset name, or "Personalizada (horizontal X%, vertical Y%)").
18. Text that cannot fit keeps the established overflow warning and placement. Export of overflowing text is blocked (FR-07.6).
19. While no text is drawn on the image (no photograph, no calibrated text area, no size chosen, or no text), only a hint is shown: "Disponível quando o texto aparece na pré-visualização: escolha o modelo e digite o texto." (D-058).

Status: UI (M2) for criteria 1–4; criterion 5 (M3.1); criteria 6–10 (M4.1b-1); criteria 11–19 (M4.1b-2, criteria 11, 12, and 15 revised by M4.2 and M4.5; 11, 12, 14–16, and 19 revised by M4.6); criteria 20–23 (M4.2); criterion 24 (M4.6, D-063); criteria 6, 8, 11, 14, 15, and 17 revised by M4.7 (D-068); criteria 8, 20, and 21 revised by M4.7b (D-069).

### FR-06 — Real-time preview

Acceptance criteria:

1. The preview reflects the model and the text; the ceramic color (and, for the Quadro, its frame) is that of the model's photograph.
2. The preview updates on every relevant change.
3. The preview never silently shows a configuration different from the user's selection.
4. Missing assets are handled gracefully and visibly.
5. The final preview is composed from real product images (FR-08); generic vector shapes are acceptable only as temporary, clearly marked demonstration output.
6. Layers are painted in this order: the model's photograph, then the personalized text (D-037, revised by D-046).
7. Each reason an image is not shown — model not selected or invalid, image not yet registered, loading, file failed to load, text area not calibrated, lettering size not yet defined, text too long — is stated in text and distinct from the others; nothing else is substituted. With no model chosen, the empty preview says only "Selecione um modelo" (no separate notice).
8. Text keeps its line breaks, is never altered, truncated, or silently clipped, and is drawn at the model's fixed lettering size whatever its length, wrapping, alignment, or position (D-055); text that does not fit shows a visible warning and cannot be exported. While it overflows, the preview (never the export) outlines the calibrated text area with a dashed line, and for vertical overflow the warning states how many lines are over ("1 linha a mais", "2 linhas a mais"; D-057). A model without an approved lettering size shows no text on the image, says so, and cannot be exported with text.

9. Every composition ends with the Taavi signature at the bottom-right (D-060), identical in the preview and the export: the arch and "© Taavi" with no background, 0.0825 of the shorter side high (D-065).
10. Before a model group's size is chosen, the group's shared photograph is shown without lettering, with "Selecione o tamanho para visualizar a personalização." (D-061).
11. On phones the preview comes first and stays at the top once a model is chosen, compact, reduced while editing text, and larger while positioning text (D-058).

Status: UI (M3.1) — implemented and verified with synthetic demonstration images only. Real product images and calibration (M1.3b) and masking of non-rectangular outlines are pending (M3.2).

### FR-07 — Image export

Acceptance criteria:

1. "Exportar imagem" downloads the current composition as a PNG.
2. The exported image is the preview's own scene painted by the same `drawScene` (D-008, D-009): same images, font, colored ranges, alignment, and position.
3. Size: the model photograph's native pixel size, never upscaled, longest edge capped at 4000 px, aspect ratio preserved; unusable dimensions are reported, not allocated. Background: opaque white (`#ffffff`), the same as the live preview. Filename: `taavi-{plateId}.png`, reduced to `[a-z0-9-]` and at most 60 ID characters; never the customer's text.
4. The exported image renders the same font family, lettering colors (M4.1b-1), and text alignment and position (M4.1b-2) as the preview, from the same scene (D-039).
5. Export is offered only for a _valid_ configuration; in particular, a valid primary lettering color is required (the preview's provisional color is never exported, D-043).
6. Export is blocked while the scene reports any preview notice: an image pending, loading, or failed; a pending text area; the provisional text color; or `text-overflow` (D-044). Selected elements are never silently left out.
7. While blocked, the button stays focusable (`aria-disabled="true"`) and click or keyboard activation does nothing; the reasons are listed above it ("Para exportar a imagem:") and form the button's accessible description. Every reason is named, preview problems in the preview's own words (e.g. "O texto não cabe na área do modelo: 1 linha a mais…"); notices that only restate a missing choice are not repeated (D-063). The blocked button looks inactive (dashed border, muted text).
8. Failures (canvas allocation, 2D context, drawing, encoding, object URL, download start) show "Não foi possível gerar a imagem. Tente novamente." (or the dimension message) and leave the button usable; success announces "Imagem exportada: {filename}".
9. "Exportar imagem" is the last action of "Revisar personalização", after the summary, the status, and the disclaimer (D-058). Export is also blocked while the Taavi signature cannot be loaded, and no PNG is ever written without it (D-060), or while a model group's size is not chosen (D-061).
10. An optional "Observação" textarea sits just before "Exportar imagem". It is stored exactly as typed, never validated, never required, and never drawn on the preview or the PNG; its hint says so ("Opcional. Não aparece na imagem exportada.", D-062).

Status: Done (M4), verified with synthetic demonstration images and the four production photographs. Production export is available with the approved palette (D-056), verified end to end in Chromium and mobile WebKit.

### FR-08 — Real product imagery

Approved product requirement (D-027). The final configurator represents each model with **real product image assets** supplied by the store; the Quadro's photograph shows it assembled with its frame (D-046).

Acceptance criteria:

1. Each model is shown with a real image of that model.
2. Superseded by D-046: there are no separate frame images; the Quadro's own photograph includes its frame.
3. The model's actual color and finish are represented by its own photograph. A CSS tint, filter, or blend over a photograph is **not** accepted as an accurate representation of a ceramic color.
4. The composition is layered: the model photograph and the personalized text, with accurate scaling, alignment, and positioning defined by catalog data, not hard-coded in rendering code.
5. The live preview and the exported image are produced from the same composition and the same image sources (FR-07.2).
6. No production product photographs are generated, invented, or substituted. Synthetic demonstration assets may be used temporarily to exercise the workflow; they live outside the production catalog, are labeled as demonstration content, and never ship as product imagery.
7. Product imagery is independent of configuration state and domain validation: `Configuration` stores no image data, and validation does not depend on whether an image exists.

8. Each image is a same-origin file under `/catalog/`, in its owner's folder; catalog integrity rejects any other path (D-031).
9. A model uses only its own photograph; with none registered, the image is pending — never another model's image (D-041).

Status: Pending. M2: preview slot. M1.3a: catalog contract (one image per model, optional placement, path rules, integrity checks; frame layers removed in M4.2) — done. M3.1: Canvas preview of catalog imagery, verified with synthetic demonstration images only — done. M1.3b: real assets and calibration — blocked on photographs.

### FR-09 — Curated imagery; no customer uploads

Approved product requirement (clarification of existing scope, 2026-11-08). All product photographs and visual assets are curated, prepared, and registered exclusively by Taavi through the version-controlled catalog.

Acceptance criteria:

1. Customers can only select an available model, enter and format the text, choose approved lettering colors, adjust alignment and position, preview, and export the PNG.
2. There is no customer-facing image upload: no file picker, no drag-and-drop of images, no paste of images, and no field for an image URL.
3. There is no customer image storage and no image upload API.
4. Images are only same-origin catalog assets (FR-08.8, D-031); arbitrary external image URLs are never loaded.

Status: Done — enforced by the catalog-driven image architecture and asset-path integrity; nothing in the UI accepts images.

## Non-functional requirements

| ID     | Requirement                                                                                                                                         |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-01 | Mobile-first; no unexpected horizontal scrolling.                                                                                                   |
| NFR-02 | Accessible form controls (labels, keyboard operation, visible focus).                                                                               |
| NFR-03 | User-facing interface in Brazilian Portuguese (pt-BR); product names such as "Placa cerâmica" and "Quadro" preserved; "Modelo" is the generic term. |
| NFR-04 | Runs as a static frontend; no backend services.                                                                                                     |
| NFR-05 | Domain logic is pure and unit-tested.                                                                                                               |

## Future ideas (not MVP)

- Per-line text-length limit: future rule, no limit defined (P-14).
- Handmade-product disclaimer near the controls (copy in D-042) and a per-line text-length limit: planned, not implemented.
- Nuvemshop integration, pricing, and order workflows.

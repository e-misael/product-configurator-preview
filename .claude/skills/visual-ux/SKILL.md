---
name: visual-ux
description: Visual and UX guidelines for the Taavi Configurator — minimalist editorial style, mobile-first layout, accessible pt-BR form controls, responsive preview, text readability and overflow, and preview/export consistency. Use when building or reviewing UI, layout, the preview, or export output.
---

# Visual and UX guidelines

Visual accuracy is a functional requirement: the preview must show exactly what the user selected.

## Visual language

- Minimalist, clean, editorial. Generous whitespace, restrained palette, clear typographic hierarchy.
- The product preview is the focal point; controls stay quiet.
- No decorative animation. Transitions only when they clarify a state change, and respect `prefers-reduced-motion`.
- Use CSS custom properties from `src/index.css`; do not hard-code ad hoc colors.
- UI chrome colors are not product colors. Never invent product colors to style the preview.
- The final preview uses **real product images** (D-027). Never tint, filter, or blend a photograph to simulate a ceramic color; show a visible "image unavailable" state instead. Vector shapes and synthetic images are demonstration-only and must be labeled as such.

## Layout

- Design for ~360px width first, then enhance for larger screens.
- **No horizontal scrolling** at any viewport. Use `min-width: 0` on flex/grid children, wrap long content.
- On mobile, keep the preview visible while editing (e.g. preview above controls).
- Preview scales to its container while keeping the configured aspect ratio — never stretch or crop the model image.

## Form controls (pt-BR)

- Labels: "Modelo", "Moldura (opcional)", "Texto"; "Sem moldura" for no frame. Product names such as "Placa cerâmica" and "Quadro" are kept as supplied; options read `displayName (sizeLabel)`.
- The shape is internal and not shown (D-040). The fixed ceramic color is shown read-only as "Cor da peça: Bege" inside the Modelo field; never offer it as a control (D-041).
- "Moldura (opcional)" offers only `getFrameOptions(...)` and is hidden when the model takes no frame and none is selected. A selected frame that is not among the options stays visible, marked invalid with its validation message, with "Remover moldura" and the compatible options as replacements; never show "Sem moldura" as selected while a frame is selected (D-030).
- When `selectPlate` reports `cleared: ['frameId']`, announce it visibly and via `aria-live="polite"` (e.g. "A moldura foi removida porque o modelo escolhido não aceita moldura.").
- Use native elements: `<fieldset>`/`<legend>` + radio inputs for choice groups, `<textarea>` for text.
- Every control has a visible, associated label.
- Touch targets ≥ 44×44 px.
- Full keyboard operation; visible `:focus-visible` outline; logical tab order.
- Communicate incomplete/invalid state in text (not color alone), linked with `aria-describedby`.
- Announce relevant preview/validation changes politely (`aria-live="polite"`) without being noisy.

## Text in the preview

- Preserve user line breaks.
- Wrap within the model's safe area; never let text silently overflow or clip.
- If text does not fit, show a clear indication rather than hiding content.
- Typography and positioning rules are **pending** (P-04). Do not invent production typography; use clearly marked provisional values only when approved.

## Preview behavior

- Update on every relevant change.
- The preview is a Canvas 2D composition of catalog images (D-035): `composePreview` → `buildScene` → `drawScene` in `src/preview/`. Keep product rules and per-product coordinates out of it; positions come from catalog `NormalizedBox` data. Layer order: frame back → plate → text → frame front (D-037).
- Image not registered, loading, and failed to load are three different states with three different messages; never substitute another product's or finish's image, and never draw a frame that is invalid or uncalibrated.
- Text is drawn only in the catalog's text area, never altered, never silently clipped; overflow is a visible warning (D-038).
- Demo images are synthetic, labeled, and live in `src/demo/public/`, served only in demo mode (D-036). Never put them in `public/`.
- Incomplete configuration → show what is known and indicate what's missing.

## Preview/export consistency

- Export must use the same composition as the preview (D-009, proposed).
- Any difference between preview and export (size, background) must be intentional and documented.

## Review checklist

- [ ] Works at 360px, 768px, 1280px without horizontal scroll.
- [ ] All controls labeled, keyboard operable, focus visible.
- [ ] Touch targets ≥ 44px.
- [ ] UI text in pt-BR; "Modelo"/"Moldura" used, product names preserved.
- [ ] Long and multi-line text handled.
- [ ] Preview matches the selected configuration.

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

## Layout

- Design for ~360px width first, then enhance for larger screens.
- **No horizontal scrolling** at any viewport. Use `min-width: 0` on flex/grid children, wrap long content.
- On mobile, keep the preview visible while editing (e.g. preview above controls).
- Preview scales to its container while keeping the configured aspect ratio — never stretch or crop the plate.

## Form controls (pt-BR)

- Labels: "Placa", "Quadro", "Cor da placa", "Formato da placa", "Texto". "Sem quadro" for no frame.
- Use native elements: `<fieldset>`/`<legend>` + radio inputs for choice groups, `<textarea>` for text.
- Every control has a visible, associated label.
- Touch targets ≥ 44×44 px.
- Full keyboard operation; visible `:focus-visible` outline; logical tab order.
- Communicate incomplete/invalid state in text (not color alone), linked with `aria-describedby`.
- Announce relevant preview/validation changes politely (`aria-live="polite"`) without being noisy.

## Text in the preview

- Preserve user line breaks.
- Wrap within the plate's safe area; never let text silently overflow or clip.
- If text does not fit, show a clear indication rather than hiding content.
- Typography and positioning rules are **pending** (P-04). Do not invent production typography; use clearly marked provisional values only when approved.

## Preview behavior

- Update on every relevant change.
- Missing asset → visible neutral placeholder with a text explanation; never substitute another product's asset.
- Incomplete configuration → show what is known and indicate what's missing.

## Preview/export consistency

- Export must use the same composition as the preview (D-009, proposed).
- Any difference between preview and export (size, background) must be intentional and documented.

## Review checklist

- [ ] Works at 360px, 768px, 1280px without horizontal scroll.
- [ ] All controls labeled, keyboard operable, focus visible.
- [ ] Touch targets ≥ 44px.
- [ ] UI text in pt-BR; "Placa"/"Quadro" preserved.
- [ ] Long and multi-line text handled.
- [ ] Preview matches the selected configuration.

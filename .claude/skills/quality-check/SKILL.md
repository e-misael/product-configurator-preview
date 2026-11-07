---
name: quality-check
description: Run and honestly report the Taavi Configurator validation checks — typecheck, lint, format, Vitest, Playwright, plus domain, accessibility, responsive, preview, and export checks. Use before reporting any change as done or when asked to verify the project.
---

# Quality check

**Only report a check as passed if you executed it and saw it pass.** Distinguish clearly between passed, failed, and skipped.

## 1. Automated checks

Run each and record the result:

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:e2e
```

- `npm run check` runs the first four together; still report each individually.
- `test:e2e` builds and serves the app on port 4173. If browsers are missing, run `npx playwright install chromium webkit` (ask first if network access is a concern). If it cannot run, mark it **skipped** with the reason.
- CI runs everything except Playwright; local Playwright runs are still required for UI changes.

On failure: show the relevant output, fix if caused by the current change, and re-run. Do not suppress lint rules or loosen TypeScript settings to make checks pass without approval.

## 2. Domain coverage

For every domain rule added or changed, confirm tests exist for:

- [ ] valid case
- [ ] incomplete case (missing required selection)
- [ ] invalid case (bad reference / incompatibility)
- [ ] selection is not mutated or replaced

## 3. Accessibility (UI changes)

- [ ] `npm run lint` passes jsx-a11y rules.
- [ ] Controls queried by role/label in RTL tests.
- [ ] Keyboard-only path verified (Playwright or manual — state which).

## 4. Responsive behavior (UI changes)

- [ ] Playwright `mobile-chromium` and `mobile-webkit` smoke pass.
- [ ] No horizontal overflow (`scrollWidth <= clientWidth`).

## 5. Preview rendering (M3+)

- [ ] Preview reflects each configuration field.
- [ ] Regression checks (DOM or screenshot) updated intentionally, not blindly.

## 6. Export consistency (M4+)

- [ ] Exported image derives from the same composition as the preview.
- [ ] A test compares export output against the preview composition.

## Report format

| Check     | Result                             | Notes             |
| --------- | ---------------------------------- | ----------------- |
| typecheck | ✅ passed / ❌ failed / ⏭️ skipped | reason or summary |
| ...       |                                    |                   |

Mark not-applicable sections as "N/A" with a reason (e.g. "no UI changes").

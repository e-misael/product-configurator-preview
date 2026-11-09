# Deployment — Cloudflare Pages (M5.2, D-077)

The pilot site is the production build in `dist/`, uploaded to Cloudflare Pages by Wrangler's Direct Upload. There is no Git integration, no backend, no authentication, and no change to the Nuvemshop store.

| Item               | Value                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare account | Owned or controlled by TAAVI                                                                                               |
| Project            | `crie-com-a-taavi`                                                                                                         |
| Production branch  | `main` → `https://crie-com-a-taavi.pages.dev` (subject to availability, step A3)                                           |
| Beta branch        | `beta` → `https://beta.crie-com-a-taavi.pages.dev`                                                                         |
| Wrangler           | `wrangler@4.153.0`, pinned; always run through `npx --yes wrangler@4.153.0`                                                |
| Node               | 24 (`.nvmrc`, `engines`)                                                                                                   |
| Headers            | `public/_headers`: `X-Robots-Tag: noindex, nofollow` on every path, `nosniff`, referrer policy, long cache for `/assets/*` |

**Who does what.** Steps marked **[Product owner]** need TAAVI's account, browser, phone, or approval. Everything else can be prepared and run by Claude Code without credentials, and nothing is created, deployed, tagged, or pushed without the owner's explicit approval at that step. Never paste passwords, API tokens, or Wrangler's stored login into a chat, a file, or a commit.

## A. One-time setup

1. **[Product owner] Cloudflare account.** Create or choose the Cloudflare account TAAVI controls (the free plan is enough) and turn on two-factor authentication. The QR Code will depend on this account, so it must not be a personal or temporary one.
2. **[Product owner] Log Wrangler in, in the browser.** In this project's folder, run in the Claude Code prompt:

   ```bash
   ! npx --yes wrangler@4.153.0 login
   ```

   A browser window opens; sign in to TAAVI's account and allow access. The token stays in Wrangler's local configuration. Then Claude Code checks the account (name and ID only, no secrets):

   ```bash
   npx --yes wrangler@4.153.0 whoami
   ```

3. **[Product owner authorizes; Claude Code runs] Create the project and confirm the address.**

   ```bash
   npx --yes wrangler@4.153.0 pages project create crie-com-a-taavi --production-branch=main
   npx --yes wrangler@4.153.0 pages project list
   ```

   The list shows the project's `*.pages.dev` address. **[Product owner] Confirm it is exactly `crie-com-a-taavi.pages.dev`.** If Cloudflare added a suffix because the name is taken elsewhere, stop: choose between the suffixed address, another name, or a TAAVI subdomain, before anything is printed or deployed.

## B. Release candidate (Claude Code)

1. Start from the commit to release, with a clean working tree (`git status` shows nothing).
2. Install exactly the locked dependencies and run every gate:

   ```bash
   npm ci
   npm run release:verify
   ```

   `release:verify` runs typecheck, lint, format check, unit tests, the full Playwright suite (Chromium and WebKit), the production build, the demo-isolation check, and the release check (`scripts/check-release-build.js`: page, bundles, all four photographs, `_headers` with noindex, no source maps). It records the build's commit and fingerprint in `.release-build.json` (not committed). Any failure stops the release.

3. Record the commit and the **build fingerprint** in the log (section H).
4. **[Product owner approves]** Tag the candidate locally: `git tag rc-YYYY-MM-DD` (tags are pushed only with approval).

## C. Beta

1. **[Product owner] Authorize the beta deployment.** Then:

   ```bash
   npm run deploy:beta
   ```

   The script refuses a dirty tree, re-runs the demo-isolation and release checks, refuses a `dist/` that changed or was built from another commit (the stamp), and uploads `dist/` to branch `beta`. It prints the build fingerprint and the deployment URL.

2. Record the deployment ID and URL:

   ```bash
   npx --yes wrangler@4.153.0 pages deployment list --project-name=crie-com-a-taavi --environment=preview
   ```

3. Claude Code verifies the beta address from outside:

   ```bash
   curl -sI https://beta.crie-com-a-taavi.pages.dev/ | grep -iE '^HTTP|x-robots-tag|x-content-type-options'
   curl -s https://beta.crie-com-a-taavi.pages.dev/ | grep -o '<title>[^<]*</title>'
   curl -sI https://beta.crie-com-a-taavi.pages.dev/catalog/plates/placa-ceramica-10/bege.png | grep -iE '^HTTP|content-type'
   ```

   Expected: `200`, `x-robots-tag: noindex`, `nosniff`, `<title>TAAVI Configurator</title>`, `image/png`.

4. **[Product owner] Real-device acceptance** on the beta address (section G). The beta address is for testing only: never print it or put it in a QR Code.

## D. Production

1. **[Product owner] Approve the beta results and authorize production.**
2. Deploy **the same `dist/`** (no rebuild in between):

   ```bash
   npm run deploy:production -- --confirm-production
   ```

   Its build fingerprint must equal the beta's (section H); if it differs, stop.

3. Record the deployment ID (`… pages deployment list --project-name=crie-com-a-taavi --environment=production`) and verify `https://crie-com-a-taavi.pages.dev/` with the commands of C3.
4. **[Product owner approves]** Tag the release: `git tag pilot-YYYY-MM-DD`.
5. **[Product owner] Approve the production address for the QR Code**, after opening it on both phones.
6. Only then is the QR Code prepared, pointing to `https://crie-com-a-taavi.pages.dev/` (never the beta address), with:
   - Title: **Crie sua peça com a TAAVI**
   - Subtitle: **Escaneie, personalize e envie sua criação pelo WhatsApp.**

   **[Product owner]** Scan the printed proof with both phones before printing in quantity.

## E. Rollback

- **Fastest, any time [Product owner or anyone with access to the account]:** Cloudflare dashboard → Workers & Pages → `crie-com-a-taavi` → Deployments → choose the previous production deployment → ⋯ → **Rollback to this deployment**. The production address, and so the QR Code, serves it at once. Record it in the log.
- **From a tag [Product owner authorizes; Claude Code runs]:**

  ```bash
  git checkout pilot-YYYY-MM-DD        # the last good release
  npm ci
  npm run release:verify
  npm run deploy:production -- --confirm-production
  git checkout main
  ```

- **Pause the pilot:** roll back to a known-good deployment, or deploy a page saying the service is temporarily unavailable to the same address. Do not delete the project: that would free the `pages.dev` name and break the QR Code.
- Beta deployments never change production.

## F. TAAVI's WhatsApp number (P-16)

**[Product owner]** Supply the official number (country code first, digits only). Claude Code then sets `TAAVI_WHATSAPP_NUMBER` in `src/config/contact.ts`, adds the checks, and the change goes through sections B–D as a new release. Until then, "Abrir WhatsApp da TAAVI" is not shown and sharing and download work without it.

## G. Real-device acceptance checklist

**[Product owner]** On the beta address, over HTTPS, on an **iPhone with Safari** and an **Android phone with Chrome**. Use a WhatsApp test conversation run by TAAVI staff, not a customer. Record for each phone: model, OS version, browser version, WhatsApp version, date, tester.

| #   | Check                      | Steps                                                                                                                                         | Pass when                                                                                                                                                                             | iPhone | Android |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------- |
| 1   | Load and fonts             | Open the address; type "Casa da Ana" in "Sem serifa", then "Com serifa".                                                                      | Rounded capitals (Quicksand) for "Sem serifa"; serif mixed case (Gelasio) for "Com serifa"; no font error notice.                                                                     |        |         |
| 2   | Native sharing             | Placa, two-line text, a highlighted word, a note; open "Revisar personalização"; wait for the button; tap "Compartilhar personalização".      | The share sheet opens at the first tap; WhatsApp is offered.                                                                                                                          |        |         |
| 3   | Order text in WhatsApp     | Choose WhatsApp and the test chat; send.                                                                                                      | Record: text as the photo caption, as a separate message, or missing. Line breaks, accents, "×", "—", and the note intact.                                                            |        |         |
| 4   | Shared image               | Share again to "Save Image" / Files; open the file.                                                                                           | PNG at the photograph's size (Placa 640, Quadro 660, Bandejas 1060 px), lettering as previewed, "© TAAVI" at the bottom right.                                                        |        |         |
| 5   | Cancellation               | Open the share sheet and dismiss it.                                                                                                          | "Compartilhamento cancelado. Sua personalização continua aqui."; the configuration is unchanged.                                                                                      |        |         |
| 6   | Failure                    | Tap "Compartilhar personalização" right after changing the text.                                                                              | The button does nothing while "Preparando imagem para compartilhar…" shows; no error, no stale image. A real failure, if seen, shows the failure message and keeps the configuration. |        |         |
| 7   | No stale image             | Share; change the text; share again.                                                                                                          | The second image and message show the new text.                                                                                                                                       |        |         |
| 8   | Manual WhatsApp attachment | "Baixar imagem"; find the file (iPhone: Files → Downloads; Android: Downloads); open the test chat; attach it as a photo, then as a document. | Both work; note the steps a customer needs. With P-16 configured: "Abrir WhatsApp da TAAVI" opens the app with the message typed in and no image.                                     |        |         |
| 9   | Image quality in WhatsApp  | Compare the received photo (normal and HD) and document with the downloaded PNG.                                                              | Lettering and signature legible; record the received size.                                                                                                                            |        |         |
| 10  | Physical lettering size    | Print each model's PNG to scale (Placa: plate 539 px wide = 100 mm); measure a capital; lay the print beside the real piece.                  | Capitals about Placa 6.3 mm, Quadro 7 mm, Bandeja M 4.8 mm, Bandeja G 4.4 mm; "AMIZADES" one row on the M, "PROSPERIDADE" one row on the G; 8 lines fit on the Placa.                 |        |         |
| 11  | Layout                     | Go through all steps.                                                                                                                         | Readable tip, spacing, buttons in order (share, download), nothing cut off.                                                                                                           |        |         |

Production is approved only when checks 1–5 and 7–11 pass on both phones (check 8's link part once P-16 is configured). Open findings go to the backlog.

## H. Deployment log

One row per deployment or rollback. The fingerprint comes from `release:verify` and from each deploy run; the deployment ID from `pages deployment list`.

| Date | Environment | Commit | Build fingerprint | Deployment ID | URL | Authorized by | Verified by | Notes |
| ---- | ----------- | ------ | ----------------- | ------------- | --- | ------------- | ----------- | ----- |
|      |             |        |                   |               |     |               |             |       |

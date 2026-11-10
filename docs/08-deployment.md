# Deployment — Cloudflare Pages (M5.2, D-077)

The pilot site is the production build in `dist/`, uploaded to Cloudflare Pages by Wrangler's Direct Upload. There is no Git integration, no backend, no authentication, and no change to the Nuvemshop store.

| Item               | Value                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare account | Owned or controlled by TAAVI                                                                                               |
| Project            | `crie-com-a-taavi`, classic Pages, no Git provider (created 2026-11-09, see A3)                                            |
| Production branch  | `main` → `https://crie-com-a-taavi.pages.dev` (confirmed 2026-11-09)                                                       |
| Beta branch        | `beta` → `https://beta.crie-com-a-taavi.pages.dev`                                                                         |
| Wrangler           | `wrangler@4.153.0`, pinned; always run through `npx --yes wrangler@4.153.0`                                                |
| Node               | 24 (`.nvmrc`, `engines`)                                                                                                   |
| Headers            | `public/_headers`: `X-Robots-Tag: noindex, nofollow` on every path, `nosniff`, referrer policy, long cache for `/assets/*` |

**Current production (pilot).**

| Item            | Value                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Address         | `https://crie-com-a-taavi.pages.dev` (approved by the product owner for the QR Code, 2026-11-09)           |
| Release commit  | `f692f3ef319800e569c65fdc851a454982337d39`, tag `pilot-2026-11-09`                                         |
| Fingerprint     | `e88653c9adb5dac36fcfe98cfd6209ce5a228f4a6eaa4f6cef896fc74ccac8e3` (21 files)                              |
| Deployment      | `5e11fb8b-42e1-4309-b407-ae4cc88b4d52`, the first production deployment; the same build as beta `b8faef05` |
| Indexing policy | `noindex, nofollow` kept on production for the initial pilot (product owner, 2026-11-09)                   |

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
   npx --yes wrangler@4.153.0 pages project create crie-com-a-taavi --production-branch=main --force
   npx --yes wrangler@4.153.0 pages project list
   ```

   **`--force` is required when Claude Code (or any AI agent) runs the create.** Wrangler 4.153.0 detects agent sessions and, for a project that does not exist yet, hands `pages project create` over to Cloudflare Workers (Static Assets) instead: it deploys a Worker and rewrites the repository for Workers. The hidden `--force` flag (not shown in `--help`; confirmed in Wrangler's source) skips that hand-over and makes a single API call that creates an empty Pages project, uploading nothing. Once the project exists, `pages deploy` is not handed over, so the deploy script needs no `--force`.

   The list shows the project's `*.pages.dev` address. **[Product owner] Confirm it is exactly `crie-com-a-taavi.pages.dev`.** If Cloudflare added a suffix because the name is taken elsewhere, stop: choose between the suffixed address, another name, or a TAAVI subdomain, before anything is printed or deployed.

**Done (2026-11-09).** Pages project `crie-com-a-taavi` exists on the TAAVI account, production branch `main`, address `https://crie-com-a-taavi.pages.dev` (no suffix), no Git provider, no deployment yet.

**Setup incident (2026-11-09, resolved).** The first create, run without `--force`, was handed over to Workers: it published a Worker `crie-com-a-taavi` (one version, a 0.34 KiB upload serving an HTML page, at `https://crie-com-a-taavi.taavi-configurator.workers.dev`; the account's `taavi-configurator.workers.dev` subdomain dates from the same run, and its name matches the generated `wrangler.jsonc`), and changed the repository (`@cloudflare/vite-plugin` in `vite.config.ts`, Wrangler and the plugin in `package.json` and `package-lock.json`, `preview` and `deploy` scripts, `.gitignore` lines, a new `wrangler.jsonc`), with no app files uploaded. With the owner's authorization: the Worker was identified and deleted (`wrangler delete`, without `--force`; Cloudflare now reports it does not exist), the Pages project was created with `--force`, and the five files were restored from the last commit (`git restore`, `wrangler.jsonc` removed, `npm ci`). Afterwards `npm run check` and Playwright passed, and the production build's fingerprint equals the one before the incident. The `taavi-configurator.workers.dev` subdomain was left in place.

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

   Expected: `200`, `x-robots-tag: noindex`, `nosniff`, `<title>Crie sua peça com a TAAVI</title>`, `image/png`.

   > **Stale beta alias.** Verify the unique deployment URL (`https://<id>.crie-com-a-taavi.pages.dev`) first, then confirm that `beta.crie-com-a-taavi.pages.dev` serves the same build (title and bundle names, or byte comparison with `dist/`). On 2026-11-09 the second beta deployment (`66f1e93c`) completed successfully and the Pages API already listed the `beta` alias on it, yet the alias served the previous build (`b48e89d2`) for about 10 minutes; it resolved without intervention. Treat about 15 minutes as the point to start investigating (the deployment's `aliases` in the Pages API), not as a guaranteed propagation time. Do not redeploy automatically because the alias is temporarily stale.

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

7. **QR Code (pilot).** Encodes exactly `https://crie-com-a-taavi.pages.dev` (no query parameters, no tracking or redirect service); phones open it as `…pages.dev/`. Version 3, error correction M, a 4-module quiet zone, dark modules (`#302a26`) on white, nothing over the modules. Generated outside the repository with a temporary tool; the configurator has no QR dependency. A draft signage proof (A5) carries a "RASCUNHO" band until accepted.
   - Files, kept in the repository (outside the app; Vite builds only `index.html`, its imports, and `public/`, so none of them reaches `dist/` or the site):
     - `assets/print/qr-code/taavi-pilot-qr.svg`: the standalone vector QR Code (80 mm).
     - `assets/print/qr-code/taavi-pilot-signage-draft.svg`: the A5 signage proof, with the "RASCUNHO — NÃO IMPRIMIR NEM DISTRIBUIR" band.
     - `assets/print/qr-code/taavi-pilot-signage-draft.pdf`: the same proof as PDF, for printing the test copy.
     - `assets/print/qr-code/taavi-pilot-signage-final.svg`: **the final A5 signage**: the draft SVG with the warning band removed and the TAAVI arch mark enlarged by 75% (18 → 31.5 mm box, same centre).
     - `assets/print/qr-code/taavi-pilot-signage-final.pdf`: **the final print file**: exported from the final SVG (fonts embedded, the QR Code as vector paths; the only raster is the TAAVI arch mark), page exactly A5 (419.53 × 595.28 pt), for printing at 100% (no "fit to page").
   - The draft files are kept unchanged for reference; never print them.
   - Automated check (2026-11-09, repeated on the repository copies): the standalone SVG, the signage SVG, and the PDF rasterized by macOS all decode to exactly `https://crie-com-a-taavi.pages.dev`.
   - **The draft band stays until the physical scan below passes on both phones.** Removing it, or producing the final printable file, needs the product owner's approval after that scan; never print or distribute the draft.
   - **[Product owner] Acceptance: passed** on iPhone and Android, as confirmed by the product owner on 2026-11-09. Procedure: print the proof at its final size; scan it with the iPhone camera and the Android camera (and Google Lens) at arm's length and in the store's lighting; each opens the production configurator, not beta. Details **pending** (not supplied; never to be filled in without the tester's records): phone models, OS and camera app versions, scan date, tester, distance, lighting.
   - **Final signage (2026-11-09):** printing the final A5 signage is approved by the product owner. Checks on the final files: both the SVG and the PDF decode to exactly `https://crie-com-a-taavi.pages.dev`; neither contains the warning text; at 300 dpi the final matches the draft pixel for pixel outside the removed band (QR Code, quiet zone, text, and mark unchanged), apart from the page's outer edge, where the draft's sub-millimetre white hairline is now the page background.

## E. Rollback

**Pilot limitation.** `5e11fb8b` is the first production deployment: until a second one exists, the dashboard's "Rollback to this deployment" has no earlier production deployment to return to. To stop serving the pilot before then, deploy a temporary "unavailable" page to the production address (with approval); never delete the project. After the next release, either option below applies, and `pilot-2026-11-09` is the known-good tag.

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

Done (2026-11-09): the product owner supplied +55 61 99923-7316, set as `TAAVI_WHATSAPP_NUMBER = '5561999237316'` in `src/config/contact.ts`, with tests for the `https://wa.me/5561999237316?text=…` link and its order message. The change goes through sections B–D as a new release; "Abrir WhatsApp da TAAVI" appears in "Finalizar personalização" (since D-080, "Enviar detalhes para a TAAVI" in "Finalize seu pedido").

## G. Real-device acceptance checklist

**[Product owner]** On the beta address, over HTTPS, on an **iPhone with Safari** and an **Android phone with Chrome**. Use a WhatsApp test conversation run by TAAVI staff, not a customer. Record for each phone: model, OS version, browser version, WhatsApp version, date, tester.

| #   | Check                      | Steps                                                                                                                                             | Pass when                                                                                                                                                                                | iPhone | Android |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------- |
| 1   | Load and fonts             | Open the address; type "Casa da Ana" in "Sem serifa", then "Com serifa".                                                                          | Rounded capitals (Quicksand) for "Sem serifa"; serif mixed case (Gelasio) for "Com serifa"; no font error notice.                                                                        |        |         |
| 2   | Prices                     | Look at the model options; choose "Bandeja ondulada", then M and G.                                                                               | Placa R$ 98,00, Quadro R$ 270,00, M R$ 100,00, G R$ 110,00, each beside its option (D-080).                                                                                              |        |         |
| 3   | Quantity by touch          | Complete a Placa; in "Finalize seu pedido" tap + and −; type 12; clear the field and leave it.                                                    | Easy to tap; never below 1 or above 99; the total follows at once (2 → R$ 196,00); an empty field returns to the last quantity; the numeric keypad opens.                                |        |         |
| 4   | Download                   | Placa, two-line text, a highlighted word, a note; tap "Baixar minha criação"; open the file.                                                      | "Download iniciado: …" (no claim it was saved); PNG at the photograph's size (Placa 640, Quadro 660, Bandejas 1060 px), lettering as previewed, "© TAAVI" at the bottom right.           |        |         |
| 5   | Emphasis                   | Before and after the download.                                                                                                                    | "Baixar minha criação" filled first; after the download "Enviar detalhes para a TAAVI" is filled. Changing the text makes the download the main action again.                            |        |         |
| 6   | WhatsApp message           | Quantity 2; tap "Enviar detalhes para a TAAVI"; do not send unless the test chat expects it.                                                      | TAAVI's chat opens in the app with the message typed in: model, "Quantidade: 2", unit price, "Total estimado: R$ 196,00", text, details, note; line breaks and accents intact; no image. |        |         |
| 7   | Incomplete                 | Restart; choose a model only.                                                                                                                     | No prices or quantity; one "Para finalizar:" list; both actions inactive; nothing opens. After restart the quantity is 1 again.                                                          |        |         |
| 8   | Manual WhatsApp attachment | Find the downloaded file (iPhone: Files → Downloads or Photos; Android: Downloads); in the opened chat, attach it as a photo, then as a document. | Both work; note the steps a customer needs.                                                                                                                                              |        |         |
| 9   | Image quality in WhatsApp  | Compare the received photo (normal and HD) and document with the downloaded PNG.                                                                  | Lettering and signature legible; record the received size.                                                                                                                               |        |         |
| 10  | Physical lettering size    | Print each model's PNG to scale (Placa: plate 539 px wide = 100 mm); measure a capital; lay the print beside the real piece.                      | Capitals about Placa 6.3 mm, Quadro 7 mm, Bandeja M 4.8 mm, Bandeja G 4.4 mm; "AMIZADES" one row on the M, "PROSPERIDADE" one row on the G; 8 lines fit on the Placa.                    |        |         |
| 11  | Layout                     | Go through all steps.                                                                                                                             | Disclaimer just before "Finalize seu pedido"; steps 1 and 2 in order, numbered; nothing cut off.                                                                                         |        |         |

**Results for `f692f3e` (beta `b8faef05`):** reported as passed by the product owner on 2026-11-09. Per-phone details are **pending** and must not be filled in without the tester's records: iPhone (model, iOS, Safari, WhatsApp versions, date, tester): pending; Android (model, Android, Chrome, WhatsApp versions, date, tester): pending; attachment steps, received image size and quality (checks 8–9): pending.

Production is approved only when checks 1–11 pass on both phones. Native Share is no longer shown (D-080), so its former checks are dropped. Open findings go to the backlog.

## H. Deployment log

One row per deployment or rollback. Dates are local (UTC−3); times in the notes say which zone. The fingerprint comes from `release:verify` and from each deploy run; the deployment ID from `pages deployment list`.

| Date       | Environment         | Commit    | Build fingerprint                                                  | Deployment ID                                         | URL                                                                                       | Authorized by                           | Verified by | Notes                                                                                                                                                                                                                                                                                                            |
| ---------- | ------------------- | --------- | ------------------------------------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-09 | Worker (unintended) | —         | —                                                                  | Worker version `99896dff-b4be-4213-97c9-fad8bf680c8d` | `https://crie-com-a-taavi.taavi-configurator.workers.dev`                                 | Not intended (create without `--force`) | Claude Code | 0.34 KiB upload, no app files; Worker deleted the same day (A3)                                                                                                                                                                                                                                                  |
| 2026-11-09 | Preview (beta)      | `5833361` | `f6406cb618e604f57058f4d5120d11effb3e805fa35ebede58cf489dd48c071c` | `b48e89d2-4b21-4ce5-95ef-d26d4a2c4c17`                | `https://beta.crie-com-a-taavi.pages.dev` (`https://b48e89d2.crie-com-a-taavi.pages.dev`) | Product owner                           | Claude Code | First attempt stopped before upload: stale `.wrangler/deploy/config.json` from the accidental Worker setup; `.wrangler/deploy` and `.wrangler/tmp` removed with approval; single retry OK, 18 files + `_headers`. Not promoted (heading changed).                                                                |
| 2026-11-09 | Preview (beta)      | `8e3f9fa` | `4684013dab4b4b9a97261edf71d0b71dfc73b00b6fb2acd35b4e7ce7932fc383` | `66f1e93c-5b76-4716-a74e-99230de49f0c`                | `https://beta.crie-com-a-taavi.pages.dev` (`https://66f1e93c.crie-com-a-taavi.pages.dev`) | Product owner                           | Claude Code | Heading and subtitle. Unique URL identical to `dist/`; the alias served `b48e89d2` until at least 16:11:08Z and this build by 16:15:06Z (UTC), self-resolved, no redeploy (section C note).                                                                                                                      |
| 2026-11-09 | Preview (beta)      | `651abd1` | `4476028a6b6c9aca92560200cd39a117928e0675c853024a03127a09d949b4d4` | `8c176994-8faf-4e09-ab7a-dbc7ddb298dc`                | `https://beta.crie-com-a-taavi.pages.dev` (`https://8c176994.crie-com-a-taavi.pages.dev`) | Product owner                           | Claude Code | Word selector and three-group finalization (D-078); 2 files uploaded + `_headers`; both URLs identical to `dist/` within about 1 minute.                                                                                                                                                                         |
| 2026-11-09 | Preview (beta)      | `fa83fc6` | `8d07e422d97bc90b4a7d286f5f7172a53c70c3affb0c35ed47f23c104f09d347` | `a687c28e-961b-46d9-9020-cee928a2a263`                | `https://beta.crie-com-a-taavi.pages.dev` (`https://a687c28e.crie-com-a-taavi.pages.dev`) | Product owner                           | Claude Code | WhatsApp number (P-16) and store footer (D-079); `ac0a169` alone never deployed; 3 files + `_headers`; both URLs identical to `dist/`, no alias lag.                                                                                                                                                             |
| 2026-11-09 | Preview (beta)      | `f692f3e` | `e88653c9adb5dac36fcfe98cfd6209ce5a228f4a6eaa4f6cef896fc74ccac8e3` | `b8faef05-2541-467c-b730-5fb3ac84766f`                | `https://beta.crie-com-a-taavi.pages.dev` (`https://b8faef05.crie-com-a-taavi.pages.dev`) | Product owner                           | Claude Code | Prices, quantity, two-step finalization (D-080); `33c0c6a` alone never deployed; 5 files + `_headers` at 00:33 UTC (21:33 local); both URLs identical to `dist/` by 00:33:53Z; real-device checks reported passed, details pending (G).                                                                          |
| 2026-11-09 | Production          | `f692f3e` | `e88653c9adb5dac36fcfe98cfd6209ce5a228f4a6eaa4f6cef896fc74ccac8e3` | `5e11fb8b-42e1-4309-b407-ae4cc88b4d52`                | `https://crie-com-a-taavi.pages.dev` (`https://5e11fb8b.crie-com-a-taavi.pages.dev`)      | Product owner                           | Claude Code | The beta build unchanged (same fingerprint); 0 files uploaded (all present) + `_headers` at about 00:40 UTC (21:40 local); production, unique URL, and beta identical to `dist/` by 00:41:11Z; browser checks passed (prices, quantity, two steps, WhatsApp link, disclaimer placement). Tag `pilot-2026-11-09`. |
|            |                     |           |                                                                    |                                                       |                                                                                           |                                         |             |                                                                                                                                                                                                                                                                                                                  |

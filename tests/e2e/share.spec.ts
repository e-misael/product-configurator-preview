import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { chooseModel, openStep, textField } from './support/steps';

/**
 * Sharing against the demo build (D-076). Playwright cannot open a real share
 * sheet, so `navigator.share` is replaced before the page loads: it records
 * the shared PNG (as base64), the text, and whether the call came with user
 * activation, then resolves or fails as each test asks. Real devices are
 * checked by hand (docs/05-backlog.md, M5.1).
 */

interface Shared {
  name: string;
  type: string;
  text: string | undefined;
  /** `navigator.userActivation.isActive` at the call; null where the API is missing. */
  active: boolean | null;
  png: string;
}

type Mode =
  { supported: false } | { supported: true; outcome: 'resolve' | 'AbortError' | 'NotAllowedError' };

async function installShare(page: Page, mode: Mode) {
  await page.addInitScript((mode: Mode) => {
    const record = window as unknown as { __shares: Shared[] };
    record.__shares = [];
    const proto = Navigator.prototype as unknown as Record<string, unknown>;
    if (!mode.supported) {
      delete proto.share;
      delete proto.canShare;
      return;
    }
    Object.defineProperty(Navigator.prototype, 'canShare', {
      configurable: true,
      value: (data: ShareData) => (data.files ?? []).every((file) => file.type === 'image/png'),
    });
    Object.defineProperty(Navigator.prototype, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        const activation = (navigator as { userActivation?: { isActive: boolean } }).userActivation;
        const active = activation ? activation.isActive : null;
        const file = data.files?.[0];
        if (!file) throw new TypeError('no file');
        let binary = '';
        for (const byte of new Uint8Array(await file.arrayBuffer()))
          binary += String.fromCharCode(byte);
        record.__shares.push({
          name: file.name,
          type: file.type,
          text: data.text,
          active,
          png: btoa(binary),
        });
        if (mode.outcome !== 'resolve') throw new DOMException('stub', mode.outcome);
      },
    });
  }, mode);
}

const shares = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shares: Shared[] }).__shares);
const review = (page: Page) => page.getByRole('region', { name: 'Revisar personalização' });
const shareButton = (page: Page) =>
  review(page).getByRole('button', { name: 'Compartilhar personalização' });
const downloadButton = (page: Page) => review(page).getByRole('button', { name: 'Baixar imagem' });

async function ready(page: Page, text = 'Casa da Ana') {
  await chooseModel(page, /Placa cerâmica/);
  await (await textField(page)).fill(text);
  await page
    .getByRole('group', { name: 'Cor do texto' })
    .getByRole('radio', { name: /Letra grafite/ })
    .check();
  await openStep(page, 'Revisar personalização');
}

async function download(page: Page) {
  const [file] = await Promise.all([page.waitForEvent('download'), downloadButton(page).click()]);
  return (await readFile(await file.path())).toString('base64');
}

test.describe('Compartilhar personalização (D-076)', () => {
  test('shares, from the tap, the same PNG "Baixar imagem" saves, with the order message @smoke', async ({
    page,
  }) => {
    await installShare(page, { supported: true, outcome: 'resolve' });
    await page.goto('/');
    await ready(page);
    await expect(shareButton(page)).toHaveAttribute('aria-disabled', 'false');

    await shareButton(page).click();
    await expect.poll(async () => (await shares(page)).length).toBe(1);
    const [shared] = await shares(page);
    expect(shared?.name).toBe('taavi-demo-placa-ceramica.png');
    expect(shared?.type).toBe('image/png');
    // Called while the tap's activation lasts (where the browser exposes it).
    test.info().annotations.push({ type: 'user-activation', description: String(shared?.active) });
    expect(shared?.active).not.toBe(false);
    expect(shared?.text).toMatch(
      /^Olá, TAAVI!\n\nGostaria de solicitar uma peça personalizada com estas características:\n\nModelo: .+\n\nTexto:\nCASA DA ANA\n\nFonte: Sem serifa\nCor principal: \(demonstração\) Letra grafite\n/,
    );
    expect(shared?.text).toMatch(
      /\n\nPodem confirmar o valor, a disponibilidade e o prazo de produção\?$/,
    );
    await expect(review(page)).toContainText(
      'Confira no WhatsApp se a imagem e os detalhes foram enviados para a TAAVI.',
    );

    expect(shared?.png).toBe(await download(page));
  });

  test('never shares a stale image after a change', async ({ page }) => {
    await installShare(page, { supported: true, outcome: 'resolve' });
    await page.goto('/');
    await ready(page);
    await expect(shareButton(page)).toHaveAttribute('aria-disabled', 'false');
    await shareButton(page).click();
    await expect.poll(async () => (await shares(page)).length).toBe(1);

    await (await textField(page)).fill('Casa da Bia');
    await openStep(page, 'Revisar personalização');
    await expect(shareButton(page)).toHaveAttribute('aria-disabled', 'false');
    await shareButton(page).click();
    await expect.poll(async () => (await shares(page)).length).toBe(2);

    const [first, second] = await shares(page);
    expect(second?.text).toContain('Texto:\nCASA DA BIA\n');
    expect(second?.png).not.toBe(first?.png);
    expect(second?.png).toBe(await download(page));
  });

  for (const [outcome, message] of [
    ['AbortError', 'Compartilhamento cancelado. Sua personalização continua aqui.'],
    [
      'NotAllowedError',
      'Não foi possível compartilhar. Você pode baixar a imagem e enviá-la pelo WhatsApp da TAAVI.',
    ],
  ] as const) {
    test(`keeps the configuration when the share ends in ${outcome}`, async ({ page }) => {
      await installShare(page, { supported: true, outcome });
      await page.goto('/');
      await ready(page);
      await expect(shareButton(page)).toHaveAttribute('aria-disabled', 'false');
      await shareButton(page).click();

      await expect(review(page)).toContainText(message);
      expect(await shares(page)).toHaveLength(1);
      await expect(shareButton(page)).toHaveAttribute('aria-disabled', 'false');
      await expect(await textField(page)).toHaveValue('Casa da Ana');
    });
  }

  test('is not offered without file sharing; download remains', async ({ page }) => {
    await installShare(page, { supported: false });
    await page.goto('/');
    await ready(page);

    await expect(downloadButton(page)).toHaveAttribute('aria-disabled', 'false');
    await expect(shareButton(page)).toHaveCount(0);
    await expect(review(page)).not.toContainText('Preparando imagem');
  });

  test('is blocked while the photograph is loading, and prepares nothing', async ({ page }) => {
    await installShare(page, { supported: true, outcome: 'resolve' });
    // The photograph never arrives.
    await page.route('**/catalog/plates/demo-placa-ceramica/**', () => undefined);
    await page.goto('/');
    await ready(page);

    await expect(shareButton(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(shareButton(page)).toHaveAccessibleDescription(/Carregando imagem…/);
    await expect(review(page)).not.toContainText('Preparando imagem');
    await shareButton(page).click({ force: true });
    expect(await shares(page)).toHaveLength(0);
  });
});

test('offers no WhatsApp link while TAAVI’s number is not configured (P-16)', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await expect(downloadButton(page)).toHaveAttribute('aria-disabled', 'false');
  await expect(review(page).getByRole('link', { name: 'Abrir WhatsApp da TAAVI' })).toHaveCount(0);
  await expect(review(page)).not.toContainText('Prefere enviar pelo WhatsApp?');
});

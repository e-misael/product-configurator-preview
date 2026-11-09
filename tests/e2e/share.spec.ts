import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { chooseModel, finalize, openStep, textField } from './support/steps';

/**
 * "Finalize seu pedido" against the demo build (D-080): download, then the
 * WhatsApp link, with the quantity in the message. The demo models have no
 * price (D-028), so the unit price is "a confirmar"; prices are checked on
 * the production build (production.spec.ts). The WhatsApp chat itself is
 * never opened: the tests read the link.
 */

const downloadButton = (page: Page) =>
  finalize(page).getByRole('button', { name: 'Baixar minha criação' });
const whatsApp = (page: Page) =>
  finalize(page).getByRole('link', { name: 'Enviar detalhes para a TAAVI' });
const quantity = (page: Page) => finalize(page).getByRole('textbox', { name: 'Quantidade' });

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

async function message(page: Page) {
  const url = new URL((await whatsApp(page).getAttribute('href')) ?? '');
  return { url, text: url.searchParams.get('text') ?? '' };
}

test.describe('Finalize seu pedido (D-080)', () => {
  test('downloads first, then emphasizes WhatsApp, whose message follows the quantity @smoke', async ({
    page,
  }) => {
    await page.goto('/');
    await ready(page);
    await expect(downloadButton(page)).not.toHaveClass(/export__button--secondary/);
    await expect(whatsApp(page)).toHaveClass(/export__button--secondary/);

    const png = await download(page);
    await expect(finalize(page)).toContainText('Download iniciado: taavi-demo-placa-ceramica.png');
    await expect(finalize(page)).not.toContainText(/salva com sucesso|foi salva/i);
    await expect(whatsApp(page)).not.toHaveClass(/export__button--secondary/);
    await expect(downloadButton(page)).toHaveClass(/export__button--secondary/);

    await finalize(page).getByRole('button', { name: 'Aumentar quantidade' }).click();
    await expect(quantity(page)).toHaveValue('2');
    const { text } = await message(page);
    expect(text).toMatch(
      /^Olá, TAAVI!\n\nGostaria de solicitar uma peça personalizada com estas características:\n\nModelo: .+\nQuantidade: 2\nValor unitário: a confirmar\n\nTexto:\nCASA DA ANA\n\nFonte: Sem serifa\nCor principal: \(demonstração\) Letra grafite\n/,
    );
    expect(text).toMatch(
      /\n\nPreparei uma imagem da personalização como referência e vou anexá-la nesta conversa\.\n\nPodem confirmar a disponibilidade, o valor final e o prazo de produção\?$/,
    );

    // The quantity is not in the image: the same PNG as before.
    expect(await download(page)).toBe(png);
  });

  test('keeps the quantity through edits and resets it with "Reiniciar configurações"', async ({
    page,
  }) => {
    await page.goto('/');
    await ready(page);
    await quantity(page).fill('12');
    await (await textField(page)).fill('Casa da Bia');
    await openStep(page, 'Revisar personalização');
    await expect(quantity(page)).toHaveValue('12');
    expect((await message(page)).text).toContain('Quantidade: 12\n');
    expect((await message(page)).text).toContain('Texto:\nCASA DA BIA\n');

    await page.getByRole('button', { name: 'Reiniciar configurações' }).click();
    await page.getByRole('button', { name: 'Sim, reiniciar' }).click();
    await ready(page);
    await expect(quantity(page)).toHaveValue('1');
  });

  test('refuses an invalid quantity, keeping the last valid one', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    await quantity(page).fill('3');
    for (const typed of ['0', '', '-2', 'x']) {
      await quantity(page).fill(typed);
      expect((await message(page)).text).toContain('Quantidade: 3\n');
    }
    await quantity(page).blur();
    await expect(quantity(page)).toHaveValue('3');
  });

  test('blocks both actions while incomplete, with one list of reasons', async ({ page }) => {
    await page.goto('/');
    await chooseModel(page, /Placa cerâmica/);
    await (await textField(page)).fill('Ana');

    await expect(downloadButton(page)).toHaveAttribute('aria-disabled', 'true');
    const blocked = finalize(page).getByRole('link', { name: 'Enviar detalhes para a TAAVI' });
    await expect(blocked).toHaveAttribute('aria-disabled', 'true');
    await expect(blocked).not.toHaveAttribute('href');
    await expect(finalize(page)).toContainText('Para finalizar:');
    await expect(finalize(page).getByText(/Falta escolher/)).toHaveCount(1);
    await expect(quantity(page)).toHaveCount(0);
    await expect(finalize(page)).not.toContainText(/Valor unitário|Total estimado/);
  });

  test('offers no share button, even where the browser can share PNG files', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'canShare', {
        configurable: true,
        value: () => true,
      });
      Object.defineProperty(Navigator.prototype, 'share', {
        configurable: true,
        value: async () => undefined,
      });
    });
    await page.goto('/');
    await ready(page);

    await expect(finalize(page).getByRole('button', { name: /Compartilhar/ })).toHaveCount(0);
    await expect(finalize(page)).not.toContainText(/Preparando imagem|Prefere enviar/);
    await expect(downloadButton(page)).toHaveAttribute('aria-disabled', 'false');
  });

  test('works from the keyboard: quantity, download, then WhatsApp', async ({ page }) => {
    await page.goto('/');
    await ready(page);
    await quantity(page).focus();
    await page.keyboard.press('ArrowUp');
    await expect(quantity(page)).toHaveValue('2');
    await page.keyboard.press('Tab');
    await expect(finalize(page).getByRole('button', { name: 'Aumentar quantidade' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(downloadButton(page)).toBeFocused();
    const [file] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
    expect(file.suggestedFilename()).toBe('taavi-demo-placa-ceramica.png');
    await page.keyboard.press('Tab');
    await expect(whatsApp(page)).toBeFocused();
  });
});

test('links to TAAVI’s official WhatsApp with the order message (P-16)', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  // Usable before any download: the customer may already have the image.
  const { url, text } = await message(page);
  expect(`${url.origin}${url.pathname}`).toBe('https://wa.me/5561999237316');
  expect(text).toMatch(/^Olá, TAAVI!\n\n/);
  expect(text).toContain('Quantidade: 1\n');
  expect(text).toContain('Texto:\nCASA DA ANA\n');
  await expect(whatsApp(page)).toHaveAttribute('target', '_blank');
  await expect(whatsApp(page)).toHaveAccessibleDescription(
    'Abra nosso WhatsApp e anexe a imagem salva. Os detalhes estarão na mensagem.',
  );
});

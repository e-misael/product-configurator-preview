import { expect, test, type Page } from '@playwright/test';

/** Functional flows against the demo build's synthetic catalog (D-028). */

const model = (page: Page, name: RegExp) =>
  page.getByRole('group', { name: 'Modelo' }).getByRole('radio', { name });
const frames = (page: Page) => page.getByRole('group', { name: 'Moldura (opcional)' });

const CERAMIC_PLATE = /Placa cerâmica \(10 cm x 10 cm\)/;
const QUADRO = /Quadro \(20 cm x 20 cm\)/;
const TRAY_8 = /Bandeja ondulada M \(~ 8 cm\)/;
const TRAY_11 = /Bandeja ondulada M \(~ 11 cm\)/;

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Modo demonstração/)).toBeVisible();
});

test('lists the four models and no color choice', async ({ page }) => {
  const group = page.getByRole('group', { name: 'Modelo' });
  await expect(group.getByRole('radio')).toHaveCount(4);
  for (const name of [CERAMIC_PLATE, QUADRO, TRAY_8, TRAY_11]) {
    await expect(model(page, name)).toBeVisible();
  }
  await expect(page.getByRole('group', { name: /Cor/ })).toHaveCount(0);
  await expect(frames(page)).toHaveCount(0);
});

test('completes a configuration @smoke', async ({ page }) => {
  await model(page, CERAMIC_PLATE).check();
  await expect(page.getByRole('group', { name: 'Modelo' })).toContainText('Cor da peça: Bege');

  await frames(page)
    .getByRole('radio', { name: /Moldura clara/ })
    .check();
  await page.getByLabel('Texto').fill('Casa da Ana\nDesde 2024');

  await expect(page.getByText('Configuração completa.')).toBeVisible();
  const preview = page.getByRole('region', { name: 'Pré-visualização' });
  await expect(preview).toContainText('Casa da Ana');
  await expect(preview).toContainText('Bege');
  await expect(preview.getByRole('img')).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('switching to a frameless tray clears the frame and says so', async ({ page }) => {
  await model(page, CERAMIC_PLATE).check();
  await frames(page)
    .getByRole('radio', { name: /Moldura clara/ })
    .check();

  await model(page, TRAY_8).check();

  await expect(page.getByRole('status')).toHaveText(
    'A moldura foi removida porque o modelo escolhido não aceita moldura.',
  );
  await expect(frames(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Pré-visualização' })).toContainText('Sem moldura');
});

test('the Quadro (20 cm x 20 cm) is its own model, not a frame', async ({ page }) => {
  await model(page, QUADRO).check();

  await expect(model(page, QUADRO)).toBeChecked();
  await expect(page.getByRole('region', { name: 'Pré-visualização' })).toContainText(
    'Quadro (20 cm x 20 cm)',
  );
});

test('keeps an incompatible frame visible after a model change (M-1)', async ({ page }) => {
  // Start with a frame compatible with the original model...
  await model(page, CERAMIC_PLATE).check();
  const darkFrame = frames(page).getByRole('radio', { name: /Moldura escura/ });
  await darkFrame.check();
  await expect(darkFrame).toBeChecked();

  // ...then switch to a model that supports frames, but not this one.
  await model(page, QUADRO).check();

  await expect(frames(page)).toContainText('Moldura selecionada (incompatível)');
  await expect(frames(page)).toContainText('Moldura escura');
  await expect(frames(page)).toContainText('Esta moldura não é compatível com este modelo.');
  await expect(frames(page).getByRole('radio', { name: 'Sem moldura' })).not.toBeChecked();
  await expect(page.getByText('Há escolhas incompatíveis — veja os avisos acima.')).toBeVisible();

  // Replace it with a compatible frame.
  await frames(page)
    .getByRole('radio', { name: /Moldura clara/ })
    .check();
  await expect(frames(page)).not.toContainText('Moldura selecionada (incompatível)');

  // Or remove it: repeat the conflict and use the remove action.
  await model(page, CERAMIC_PLATE).check();
  await darkFrame.check();
  await model(page, QUADRO).check();
  await frames(page).getByRole('button', { name: 'Remover moldura' }).click();
  await expect(frames(page).getByRole('radio', { name: 'Sem moldura' })).toBeChecked();
});

test('is operable with the keyboard', async ({ page }) => {
  await model(page, CERAMIC_PLATE).focus();
  await page.keyboard.press('Space');
  await expect(model(page, CERAMIC_PLATE)).toBeChecked();
  await page.keyboard.press('ArrowDown');
  await expect(model(page, QUADRO)).toBeChecked();
});

import { expect, test, type Page } from '@playwright/test';

/** Functional flows against the demo build's synthetic catalog (D-028). */

const plate = (page: Page, name: RegExp) =>
  page.getByRole('group', { name: 'Placa' }).getByRole('radio', { name });
const frames = (page: Page) => page.getByRole('group', { name: 'Quadro' });

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

test('completes a configuration @smoke', async ({ page }) => {
  await plate(page, /Placa quadrada/).check();
  await expect(page.getByText('Formato da placa:')).toContainText('Quadrada');

  await frames(page)
    .getByRole('radio', { name: /Quadro quadrado e retangular/ })
    .check();
  await page
    .getByRole('group', { name: 'Cor da placa' })
    .getByRole('radio', { name: 'Nude' })
    .check();
  await page.getByLabel('Texto').fill('Casa da Ana\nDesde 2024');

  await expect(page.getByText('Configuração completa.')).toBeVisible();
  const preview = page.getByRole('region', { name: 'Pré-visualização' });
  await expect(preview).toContainText('Pré-visualização ilustrativa');
  await expect(preview).toContainText('Casa da Ana');
  await expect(preview.locator('img, svg, canvas')).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

test('switching to a circular plate clears the frame and says so', async ({ page }) => {
  await plate(page, /Placa quadrada/).check();
  await frames(page)
    .getByRole('radio', { name: /Quadro quadrado e retangular/ })
    .check();

  await plate(page, /Placa redonda/).check();

  await expect(page.getByRole('status')).toHaveText(
    'O quadro foi removido porque a placa escolhida não aceita quadro.',
  );
  await expect(frames(page).getByRole('radio', { name: 'Sem quadro' })).toBeChecked();
  await expect(frames(page)).toContainText('Esta placa não aceita quadro.');
});

test('keeps an incompatible frame visible after a plate change (M-1)', async ({ page }) => {
  // Start with a frame compatible with the original plate...
  await plate(page, /Placa quadrada/).check();
  const squareOnly = frames(page).getByRole('radio', { name: /Quadro só para placas quadradas/ });
  await squareOnly.check();
  await expect(squareOnly).toBeChecked();

  // ...then switch to a plate that supports frames but not this one.
  await plate(page, /Placa retangular/).check();

  await expect(frames(page)).toContainText('Quadro selecionado (incompatível)');
  await expect(frames(page)).toContainText('Quadro só para placas quadradas');
  await expect(frames(page)).toContainText('Este quadro não serve no formato desta placa.');
  await expect(frames(page).getByRole('radio', { name: 'Sem quadro' })).not.toBeChecked();
  await expect(page.getByText('Há escolhas incompatíveis — veja os avisos acima.')).toBeVisible();

  // Replace it with a compatible frame.
  await frames(page)
    .getByRole('radio', { name: /Quadro quadrado e retangular/ })
    .check();
  await expect(frames(page)).not.toContainText('Quadro selecionado (incompatível)');

  // Or remove it: repeat the conflict and use the remove action.
  await plate(page, /Placa quadrada/).check();
  await squareOnly.check();
  await plate(page, /Placa retangular/).check();
  await frames(page).getByRole('button', { name: 'Remover quadro' }).click();
  await expect(frames(page).getByRole('radio', { name: 'Sem quadro' })).toBeChecked();
});

test('is operable with the keyboard', async ({ page }) => {
  await plate(page, /Placa quadrada/).focus();
  await page.keyboard.press('Space');
  await expect(plate(page, /Placa quadrada/)).toBeChecked();
  await page.keyboard.press('ArrowDown');
  await expect(plate(page, /Placa retangular/)).toBeChecked();
});

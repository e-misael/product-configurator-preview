import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

const MODELS = [
  'Placa cerâmica (10 cm x 10 cm)',
  'Quadro (20 cm x 20 cm)',
  'Bandeja ondulada M (~ 8 cm)',
  'Bandeja ondulada M (~ 11 cm)',
];

test.describe('Production build @smoke', () => {
  test('lists the four models, with no demo data and no photos yet', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Taavi Configurator');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('heading', { level: 1, name: 'Taavi Configurator' })).toBeVisible();

    const group = page.getByRole('group', { name: 'Modelo' });
    await expect(group.getByRole('radio')).toHaveCount(MODELS.length);
    for (const name of MODELS) await expect(group.getByRole('radio', { name })).toBeVisible();
    await expect(page.getByRole('group', { name: /Cor/ })).toHaveCount(0);
    await expect(page.getByRole('group', { name: /Moldura/ })).toHaveCount(0);

    await group.getByRole('radio', { name: 'Placa cerâmica (10 cm x 10 cm)' }).check();
    await expect(group).toContainText('Cor da peça: Bege');
    const preview = page.getByRole('region', { name: 'Pré-visualização' });
    await expect(preview).toContainText('A foto deste modelo ainda não está disponível.');
    await expect(preview.locator('canvas')).toHaveCount(0);

    await expect(page.getByText(/demonstração/i)).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test('does not request demonstration chunks', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    await page.goto('/');
    await expect(page.getByRole('group', { name: 'Modelo' })).toBeVisible();

    expect(requests.filter((url) => /demo/i.test(url))).toEqual([]);
  });

  test('serves no demonstration images', async ({ page, request }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));

    await page.goto('/');
    await expect(page.getByRole('group', { name: 'Modelo' })).toBeVisible();
    expect(requests.filter((url) => url.includes('/catalog/'))).toEqual([]);

    // The demo image paths do not exist in the production build.
    for (const path of [
      '/catalog/plates/demo-placa-ceramica/bege.png',
      '/catalog/frames/demo-moldura-clara/back.png',
    ]) {
      const response = await request.get(path);
      expect(response.headers()['content-type'] ?? '').not.toContain('image/');
    }
  });
});

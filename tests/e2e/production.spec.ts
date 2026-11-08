import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

const MODELS = [
  'Placa cerâmica — 10 × 10 cm',
  'Quadro — 20 × 20 cm',
  'Bandeja ondulada M — Aprox. 8 cm',
  'Bandeja ondulada G — Aprox. 11 cm',
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
    await expect(page.getByRole('group', { name: /Cor da/ })).toHaveCount(0);
    await expect(page.getByRole('group', { name: /Moldura/ })).toHaveCount(0);

    await group.getByRole('radio', { name: 'Placa cerâmica — 10 × 10 cm' }).check();
    await expect(group).toContainText('Cor da peça: Bege');
    const preview = page.getByRole('region', { name: 'Pré-visualização' });
    await expect(preview).toContainText('A foto deste modelo ainda não está disponível.');
    await expect(preview.locator('canvas')).toHaveCount(0);

    await expect(page.getByText(/demonstração/i)).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test('defines no lettering colors yet and shows the disclaimer', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('group', { name: 'Fonte' })).toBeVisible();
    await expect(page.getByText('As cores do texto ainda não foram definidas.')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Cor do texto' }).getByRole('radio')).toHaveCount(
      0,
    );
    await expect(page.getByRole('group', { name: /Segunda cor/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Usar segunda cor' })).toHaveCount(0);
    await expect(page.getByText(/sujeitas à análise da Taavi/)).toBeVisible();
  });

  test('offers "Exportar imagem" but blocks it, explaining why', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('group', { name: 'Modelo' })
      .getByRole('radio', { name: 'Placa cerâmica — 10 × 10 cm' })
      .check();
    await page.getByLabel('Texto', { exact: true }).fill('Ana');

    const preview = page.getByRole('region', { name: 'Pré-visualização' });
    const button = preview.getByRole('button', { name: 'Exportar imagem' });
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(preview).toContainText('Falta escolher: Cor do texto.');
    await expect(button).toHaveAccessibleDescription(
      /A foto deste modelo ainda não está disponível/,
    );
    let downloads = 0;
    page.on('download', () => (downloads += 1));
    // Playwright waits for `aria-disabled` buttons to become enabled; force the real click.
    await button.click({ force: true });
    await page.waitForTimeout(300);
    expect(downloads).toBe(0);
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
      '/catalog/plates/demo-quadro/bege.png',
    ]) {
      const response = await request.get(path);
      expect(response.headers()['content-type'] ?? '').not.toContain('image/');
    }
  });
});

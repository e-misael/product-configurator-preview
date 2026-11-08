import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('Production build @smoke', () => {
  test('loads with the empty production catalog and no demo data', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Taavi Configurator');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('heading', { level: 1, name: 'Taavi Configurator' })).toBeVisible();
    await expect(page.getByText('Nenhuma placa disponível no momento.')).toBeVisible();

    await expect(page.getByText(/demonstração/i)).toHaveCount(0);
    await expect(page.getByRole('radio')).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test('does not request demonstration chunks', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    await page.goto('/');
    await expect(page.getByText('Nenhuma placa disponível no momento.')).toBeVisible();

    expect(requests.filter((url) => /demo/i.test(url))).toEqual([]);
  });
});

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
  test('lists the four models, with no demo data, each with its photograph', async ({ page }) => {
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
    await expect(preview.getByRole('img')).toBeVisible();
    await expect(preview).not.toContainText('A foto deste modelo ainda não está disponível.');

    for (const name of MODELS.slice(1)) {
      await group.getByRole('radio', { name }).check();
      await expect(preview.getByRole('img')).toBeVisible();
      await expect(preview).not.toContainText('A foto deste modelo ainda não está disponível.');
    }

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
    await expect(button).toHaveAccessibleDescription(/Falta escolher: Cor do texto/);
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

test.describe('Quadro and Bandeja photographs (M1.3b-2)', () => {
  for (const [name, path] of [
    ['Quadro — 20 × 20 cm', 'quadro-20'],
    ['Bandeja ondulada M — Aprox. 8 cm', 'bandeja-ondulada-m-8'],
    ['Bandeja ondulada G — Aprox. 11 cm', 'bandeja-ondulada-g-11'],
  ] as const) {
    test(`serves the ${path} JPEG and draws the lettering on it`, async ({ page }) => {
      const photo = page.waitForResponse(`**/catalog/plates/${path}/bege.jpg`);
      await page.goto('/');
      await page.getByRole('group', { name: 'Modelo' }).getByRole('radio', { name }).check();
      const response = await photo;
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/jpeg');

      const preview = page.getByRole('region', { name: 'Pré-visualização' });
      const canvas = preview.locator('canvas');
      const pixels = () =>
        canvas.evaluate((element: HTMLCanvasElement) => {
          const ctx = element.getContext('2d');
          if (!ctx) return '';
          const { data } = ctx.getImageData(0, 0, element.width, element.height);
          let sum = 0;
          for (let i = 0; i < data.length; i += 97) sum += data[i] ?? 0;
          return `${element.width}x${element.height}:${sum}`;
        });
      await expect.poll(pixels).not.toBe('');
      const plain = await pixels();
      await page.getByLabel('Texto', { exact: true }).fill('Ana');
      await expect.poll(pixels).not.toBe(plain);
      await expect(preview).not.toContainText('O texto não cabe');
      await expect(preview).not.toContainText('ainda não foi definido');
      await expectNoHorizontalScroll(page);
    });
  }

  test('keeps the fixed size on the Bandeja M: long text warns instead of shrinking', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('group', { name: 'Modelo' })
      .getByRole('radio', { name: 'Bandeja ondulada M — Aprox. 8 cm' })
      .check();
    const preview = page.getByRole('region', { name: 'Pré-visualização' });
    await expect(preview.getByRole('img')).toBeVisible();
    await page.getByLabel('Texto', { exact: true }).fill('Ana\nLuz\nLeo\nBia');

    await expect(preview).toContainText(
      'O texto não cabe na área do modelo. Reduza o texto ou use menos linhas.',
    );
  });
});

test.describe('Placa photograph with debossed lettering (M1.3b-1)', () => {
  test('serves the real photograph and draws the lettering on it', async ({ page }) => {
    const photo = page.waitForResponse('**/catalog/plates/placa-ceramica-10/bege.png');
    await page.goto('/');
    await page
      .getByRole('group', { name: 'Modelo' })
      .getByRole('radio', { name: 'Placa cerâmica — 10 × 10 cm' })
      .check();
    const response = await photo;
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');

    const canvas = page.getByRole('region', { name: 'Pré-visualização' }).locator('canvas');
    const pixels = () =>
      canvas.evaluate((element: HTMLCanvasElement) => {
        const ctx = element.getContext('2d');
        if (!ctx) return '';
        const { data } = ctx.getImageData(0, 0, element.width, element.height);
        let sum = 0;
        for (let i = 0; i < data.length; i += 97) sum += data[i] ?? 0;
        return `${element.width}x${element.height}:${sum}`;
      });
    await expect.poll(pixels).not.toBe('');
    const plain = await pixels();
    await page.getByLabel('Texto', { exact: true }).fill('Casa da Ana');
    await expect.poll(pixels).not.toBe(plain);
    // The backing store never exceeds the 640 px photograph.
    expect(Number(plain.split('x')[0])).toBeLessThanOrEqual(640);
    await expectNoHorizontalScroll(page);
  });

  test('stays responsive while dragging and typing on a phone-sized canvas', async ({
    page,
    browserName,
    isMobile,
  }) => {
    test.skip(browserName !== 'chromium' || isMobile, 'CPU throttling needs desktop Chromium.');
    await page.setViewportSize({ width: 390, height: 844 });
    const cdp = await page.context().newCDPSession(page);
    // A mid-range phone: four times slower than this machine.
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/');
    await page
      .getByRole('group', { name: 'Modelo' })
      .getByRole('radio', { name: 'Placa cerâmica — 10 × 10 cm' })
      .check();
    const field = page.getByLabel('Texto', { exact: true });
    await field.fill('Casa da Ana');
    const canvas = page.getByRole('region', { name: 'Pré-visualização' }).locator('canvas');
    await canvas.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const w = window as unknown as { longTasks: number[] };
      w.longTasks = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) w.longTasks.push(entry.duration);
      }).observe({ type: 'longtask', buffered: false });
    });

    const box = await canvas.boundingBox();
    if (!box) throw new Error('No canvas box');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const steps = 60;
    const dragStart = Date.now();
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i += 1) {
      await page.mouse.move(x + i, y + i / 2);
    }
    await page.mouse.up();
    const dragMs = (Date.now() - dragStart) / steps;
    // The drag really moved the text, so every step repainted the scene.
    await expect(page.getByText('Posição personalizada.')).toBeVisible();

    const typeStart = Date.now();
    await field.press('End');
    await field.pressSequentially(' e família', { delay: 0 });
    const typeMs = (Date.now() - typeStart) / ' e família'.length;

    const longTasks = await page.evaluate(
      () => (window as unknown as { longTasks: number[] }).longTasks,
    );
    const worst = Math.max(0, ...longTasks);
    test.info().annotations.push({
      type: 'performance (4× CPU throttling, 390 px viewport)',
      description: JSON.stringify({
        msPerDragStep: Math.round(dragMs),
        msPerTypedCharacter: Math.round(typeMs),
        longTasks: longTasks.length,
        worstLongTaskMs: Math.round(worst),
      }),
    });
    // Generous bounds: an interaction that blocks for a quarter second is noticeable.
    expect(worst).toBeLessThan(250);
    expect(dragMs).toBeLessThan(100);
  });
});

import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** The approved production palette, in display order (D-056). */
const COLORS = [
  ['Marrom', [0x4a, 0x2a, 0x14]],
  ['Azul', [0x2b, 0x4a, 0x7a]],
  ['Verde', [0x2f, 0x4a, 0x36]],
  ['Vermelho escuro', [0x7a, 0x1f, 0x1f]],
] as const;
type Rgb = readonly [number, number, number];

const DISCLAIMER = [
  'A pré-visualização é ilustrativa. Como nossas peças são produzidas artesanalmente, o produto final pode apresentar pequenas variações de formato, textura, acabamento, posicionamento das letras e tonalidade das cores em relação à imagem exibida na tela.',
  'As cores também podem variar conforme a iluminação, as características da cerâmica e as configurações de cada dispositivo.',
  'Todas as solicitações de personalização estão sujeitas à análise e aprovação da Taavi.',
];

/** The Placa's calibrated text area, as fractions of the image. */
const PLACA_AREA = { x0: 0.145, y0: 0.155, x1: 0.855, y1: 0.845 };

/**
 * Pixels within a small tolerance of each color inside the Placa text area, on
 * the preview canvas or a decoded PNG (base64). The debossed shading leaves
 * the stroke centers in the lettering color (D-052), so they are counted.
 */
async function colorCounts(
  page: Page,
  source: 'preview' | { png: string },
  colors: readonly Rgb[],
): Promise<{ width: number; height: number; counts: number[] }> {
  return page.evaluate(
    async ({ png, colors, area }) => {
      let canvas: HTMLCanvasElement;
      if (png === null) {
        const element = document.querySelector('.preview__canvas');
        if (!(element instanceof HTMLCanvasElement)) throw new Error('No preview canvas');
        canvas = element;
      } else {
        const image = new Image();
        image.src = `data:image/png;base64,${png}`;
        await image.decode();
        canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext('2d')?.drawImage(image, 0, 0);
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2D context');
      const { width, height } = canvas;
      const x0 = Math.floor(area.x0 * width);
      const y0 = Math.floor(area.y0 * height);
      const w = Math.floor((area.x1 - area.x0) * width);
      const h = Math.floor((area.y1 - area.y0) * height);
      const { data } = ctx.getImageData(x0, y0, w, h);
      const counts = colors.map(() => 0);
      for (let i = 0; i < data.length; i += 4) {
        colors.forEach((color, c) => {
          if (
            Math.abs((data[i] ?? 0) - color[0]) <= 12 &&
            Math.abs((data[i + 1] ?? 0) - color[1]) <= 12 &&
            Math.abs((data[i + 2] ?? 0) - color[2]) <= 12
          ) {
            counts[c] = (counts[c] ?? 0) + 1;
          }
        });
      }
      return { width, height, counts };
    },
    { png: source === 'preview' ? null : source.png, colors, area: PLACA_AREA },
  );
}

const MODELS = [
  'Placa cerâmica — 10 × 10 cm',
  'Quadro — 20 × 20 cm',
  'Bandeja ondulada M — 8 × 8 cm',
  'Bandeja ondulada G — 11 × 11 cm',
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

  test('offers the four approved lettering colors, and shows the disclaimer', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('group', { name: 'Fonte' })).toBeVisible();
    const group = page.getByRole('group', { name: 'Cor do texto' });
    await expect(group.getByRole('radio')).toHaveCount(COLORS.length);
    const labels = group.locator('label.swatch-option');
    for (const [index, [name, rgb]] of COLORS.entries()) {
      const label = labels.nth(index);
      await expect(label).toHaveText(new RegExp(`${name}$`));
      await expect(label.getByRole('radio', { name })).not.toBeChecked();
      await expect(label.locator('.swatch-option__chip')).toHaveCSS(
        'background-color',
        `rgb(${rgb.join(', ')})`,
      );
    }
    await expect(page.getByText('As cores do texto ainda não foram definidas.')).toHaveCount(0);
    await expect(page.getByText(/amarelo|laranja|demonstração|proposta/i)).toHaveCount(0);
    // The second color stays behind its disclosure until asked for.
    await expect(page.getByRole('button', { name: 'Usar segunda cor' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(page.getByRole('group', { name: 'Segunda cor' })).toBeHidden();
    for (const paragraph of DISCLAIMER) await expect(page.getByText(paragraph)).toBeVisible();
  });

  test('requires a lettering color before export', async ({ page }) => {
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

    await page
      .getByRole('group', { name: 'Cor do texto' })
      .getByRole('radio', { name: 'Marrom' })
      .check();
    await expect(button).toHaveAttribute('aria-disabled', 'false');
  });

  test('paints each approved color in the preview', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('group', { name: 'Modelo' })
      .getByRole('radio', { name: 'Placa cerâmica — 10 × 10 cm' })
      .check();
    await page.getByLabel('Texto', { exact: true }).fill('HHH');
    const group = page.getByRole('group', { name: 'Cor do texto' });
    const rgbs = COLORS.map(([, rgb]) => rgb);
    for (const [index, [name]] of COLORS.entries()) {
      await group.getByRole('radio', { name }).check();
      await expect(group.getByRole('radio', { name })).toBeChecked();
      await expect
        .poll(async () => (await colorCounts(page, 'preview', rgbs)).counts[index])
        .toBeGreaterThan(30);
    }
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

test.describe('Production customization to PNG export (D-056)', () => {
  test('two colors, preview, and export agree; removing the second color', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('group', { name: 'Modelo' })
      .getByRole('radio', { name: 'Placa cerâmica — 10 × 10 cm' })
      .check();
    const field = page.getByLabel('Texto', { exact: true });
    await field.fill('Ação\nJoão');
    await page
      .getByRole('group', { name: 'Cor do texto' })
      .getByRole('radio', { name: 'Verde' })
      .check();

    // Second color: every color except the primary one.
    const toggle = page.getByRole('button', { name: 'Usar segunda cor' });
    await toggle.click();
    const secondary = page.getByRole('group', { name: 'Segunda cor' });
    await expect(secondary.getByRole('radio')).toHaveCount(COLORS.length);
    await expect(secondary.getByRole('radio', { name: 'Verde' })).toBeDisabled();
    for (const name of ['Marrom', 'Azul', 'Vermelho escuro']) {
      await expect(secondary.getByRole('radio', { name })).toBeEnabled();
    }
    await secondary.getByRole('radio', { name: 'Vermelho escuro' }).check();

    // "Ação" (accented) in the second color.
    await field.focus();
    // Caret at the start (Home is not portable across platforms), then select by keyboard.
    await field.evaluate((element) => (element as HTMLTextAreaElement).setSelectionRange(0, 0));
    for (let i = 0; i < 4; i += 1) await field.press('Shift+ArrowRight');
    const apply = page.getByRole('button', { name: 'Aplicar segunda cor à seleção' });
    await expect(apply).toBeEnabled();
    await apply.click();
    await expect(field).toHaveValue('Ação\nJoão');
    await expect(page.getByText('1 trecho com a segunda cor.')).toBeVisible();

    const green = COLORS[2][1];
    const red = COLORS[3][1];
    await expect
      .poll(async () =>
        (await colorCounts(page, 'preview', [green, red])).counts.every((n) => n > 30),
      )
      .toBe(true);
    const shown = await colorCounts(page, 'preview', [green, red]);

    const preview = page.getByRole('region', { name: 'Pré-visualização' });
    const button = preview.getByRole('button', { name: 'Exportar imagem' });
    await expect(button).toHaveAttribute('aria-disabled', 'false');
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    expect(download.suggestedFilename()).toBe('taavi-placa-ceramica-10.png');
    const bytes = await readFile(await download.path());
    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const exported = await colorCounts(page, { png: bytes.toString('base64') }, [green, red]);
    // Native size, both colors, in about the same proportion as the preview.
    expect([exported.width, exported.height]).toEqual([640, 640]);
    expect(exported.counts.every((n) => n > 30)).toBe(true);
    const ratio = (counts: number[]) => (counts[0] ?? 0) / Math.max(1, counts[1] ?? 0);
    expect(ratio(exported.counts)).toBeGreaterThan(ratio(shown.counts) * 0.6);
    expect(ratio(exported.counts)).toBeLessThan(ratio(shown.counts) / 0.6);

    await page.getByRole('button', { name: 'Remover segunda cor', exact: true }).click();
    await expect(
      page.getByRole('group', { name: 'Segunda cor' }).getByRole('radio', { checked: true }),
    ).toHaveCount(0);
    await expect(preview).not.toContainText('trecho');
    await expect
      .poll(async () => (await colorCounts(page, 'preview', [green, red])).counts)
      .toEqual([expect.any(Number), 0]);
    expect((await colorCounts(page, 'preview', [green, red])).counts[0]).toBeGreaterThan(30);
    await expectNoHorizontalScroll(page);
  });
});

test.describe('Quadro and Bandeja photographs (M1.3b-2)', () => {
  for (const [name, path] of [
    ['Quadro — 20 × 20 cm', 'quadro-20'],
    ['Bandeja ondulada M — 8 × 8 cm', 'bandeja-ondulada-m-8'],
    ['Bandeja ondulada G — 11 × 11 cm', 'bandeja-ondulada-g-11'],
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
      .getByRole('radio', { name: 'Bandeja ondulada M — 8 × 8 cm' })
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

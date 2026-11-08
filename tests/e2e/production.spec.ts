import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { openStep, step, textField } from './support/steps';

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** The approved production palette, in display order (D-056). */
const COLORS = [
  ['Marrom', [0x80, 0x2b, 0x00]],
  ['Azul', [0x00, 0x2b, 0x80]],
  ['Verde', [0x00, 0x66, 0x00]],
  ['Vermelho escuro', [0x7a, 0x1f, 0x1f]],
  ['Laranja escuro', [0xb2, 0x59, 0x00]],
  ['Amarelo queimado', [0xb3, 0x8f, 0x00]],
  ['Preto', [0x00, 0x00, 0x00]],
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

/**
 * Chooses one of `MODELS`. The two Bandeja sizes are one "Bandeja ondulada"
 * option with a "Tamanho" choice (D-057).
 */
async function chooseModel(page: Page, name: string) {
  await openStep(page, 'Modelo e tamanho');
  const size = /^Bandeja ondulada ([MG]) — (.+)$/.exec(name);
  const models = page.getByRole('group', { name: 'Modelo' });
  if (size === null) {
    await models.getByRole('radio', { name }).check();
    return;
  }
  await models.getByRole('radio', { name: 'Bandeja ondulada' }).check();
  await page
    .getByRole('group', { name: 'Tamanho' })
    .getByRole('radio', { name: `${size[1]} — ${size[2]}` })
    .check();
}

test.describe('Production build @smoke', () => {
  test('lists the four models, with no demo data, each with its photograph', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Taavi Configurator');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('heading', { level: 1, name: 'Taavi Configurator' })).toBeVisible();

    const group = page.getByRole('group', { name: 'Modelo' });
    const options = ['Placa cerâmica — 10 × 10 cm', 'Quadro — 20 × 20 cm', 'Bandeja ondulada'];
    await expect(group.getByRole('radio')).toHaveCount(options.length);
    for (const name of options) await expect(group.getByRole('radio', { name })).toBeVisible();
    await expect(page.getByRole('group', { name: /Cor da/ })).toHaveCount(0);
    await expect(page.getByRole('group', { name: /Moldura/ })).toHaveCount(0);

    await group.getByRole('radio', { name: 'Placa cerâmica — 10 × 10 cm' }).check();
    await expect(group).toContainText('Cor da peça: Bege');
    const preview = page.getByRole('region', { name: 'Pré-visualização' });
    await expect(preview.getByRole('img')).toBeVisible();
    await expect(preview).not.toContainText('A foto deste modelo ainda não está disponível.');

    for (const name of MODELS.slice(1)) {
      await chooseModel(page, name);
      await expect(preview.getByRole('img')).toBeVisible();
      await expect(preview).not.toContainText('A foto deste modelo ainda não está disponível.');
    }

    await expect(page.getByText(/demonstração/i)).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test('offers the approved lettering colors, and shows the disclaimer', async ({ page }) => {
    await page.goto('/');
    await openStep(page, 'Texto e cores');

    await expect(page.getByRole('group', { name: 'Fonte' })).toBeVisible();
    const group = page.getByRole('group', { name: 'Cor do texto' });
    await expect(group.getByRole('radio')).toHaveCount(COLORS.length);
    const labels = group.locator('label.swatch-option');
    for (const [index, [name, rgb]] of COLORS.entries()) {
      const label = labels.nth(index);
      await expect(label).toHaveText(new RegExp(`${name}$`));
      // Marrom, the first, is selected from the start (D-064).
      if (index === 0) await expect(label.getByRole('radio', { name })).toBeChecked();
      else await expect(label.getByRole('radio', { name })).not.toBeChecked();
      await expect(label.locator('.swatch-option__chip')).toHaveCSS(
        'background-color',
        `rgb(${rgb.join(', ')})`,
      );
    }
    await expect(page.getByText('As cores do texto ainda não foram definidas.')).toHaveCount(0);
    await expect(page.getByText(/demonstração|proposta/i)).toHaveCount(0);
    // The second color stays behind its disclosure until asked for.
    await expect(page.getByRole('button', { name: 'Usar segunda cor' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(page.getByRole('group', { name: 'Segunda cor' })).toBeHidden();
    // The disclaimer is part of the review, before export (D-058).
    const review = await step(page, 'Revisar personalização');
    for (const paragraph of DISCLAIMER) await expect(review.getByText(paragraph)).toBeVisible();
  });

  test('starts with Marrom; export waits only for the text (D-064)', async ({ page }) => {
    await page.goto('/');
    await chooseModel(page, 'Placa cerâmica — 10 × 10 cm');

    const review = await step(page, 'Revisar personalização');
    const button = review.getByRole('button', { name: 'Exportar imagem' });
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(review).toContainText('Falta escolher: Texto.');
    await expect(review).not.toContainText('Cor do texto.');
    await expect(review).toContainText('Cor do texto:Marrom');
    await expect(button).toHaveAccessibleDescription(/Falta escolher: Texto/);
    let downloads = 0;
    page.on('download', () => (downloads += 1));
    // Playwright waits for `aria-disabled` buttons to become enabled; force the real click.
    await button.click({ force: true });
    await page.waitForTimeout(300);
    expect(downloads).toBe(0);

    await (await textField(page)).fill('Ana');
    await openStep(page, 'Revisar personalização');
    await expect(button).toHaveAttribute('aria-disabled', 'false');
  });

  test('paints each approved color in the preview', async ({ page }) => {
    await page.goto('/');
    await chooseModel(page, 'Placa cerâmica — 10 × 10 cm');
    await (await textField(page)).fill('HHH');
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
    await chooseModel(page, 'Placa cerâmica — 10 × 10 cm');
    const field = await textField(page);
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

    const review = await step(page, 'Revisar personalização');
    const button = review.getByRole('button', { name: 'Exportar imagem' });
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

    await openStep(page, 'Texto e cores');
    await page.getByRole('button', { name: 'Remover segunda cor', exact: true }).click();
    await expect(
      page.getByRole('group', { name: 'Segunda cor' }).getByRole('radio', { checked: true }),
    ).toHaveCount(0);
    await expect(review).not.toContainText('trecho');
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
      await chooseModel(page, name);
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
      await (await textField(page)).fill('Ana');
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
    await chooseModel(page, 'Bandeja ondulada M — 8 × 8 cm');
    const preview = page.getByRole('region', { name: 'Pré-visualização' });
    await expect(preview.getByRole('img')).toBeVisible();
    const field = await textField(page);
    // A fourth line break is refused (D-063); a long last line still wraps past the area.
    await field.fill('Ana\nLuz\nLeo\nBia');
    await expect(field).toHaveValue('');
    await expect(page.locator('#text-line-limit')).toHaveText(
      'Este modelo comporta no máximo 3 linhas.',
    );
    await field.fill('Ana\nLuz\nLeo');
    await field.fill('Ana\nLuz\nLeo Bia Mar Sol Lua Céu Rio');

    await expect(preview).toContainText(/O texto não cabe na área do modelo: \d+ linhas? a mais\./);
  });
});

test.describe('Placa photograph with debossed lettering (M1.3b-1)', () => {
  test('serves the real photograph and draws the lettering on it', async ({ page }) => {
    const photo = page.waitForResponse('**/catalog/plates/placa-ceramica-10/bege.png');
    await page.goto('/');
    await chooseModel(page, 'Placa cerâmica — 10 × 10 cm');
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
    await (await textField(page)).fill('Casa da Ana');
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
    await chooseModel(page, 'Placa cerâmica — 10 × 10 cm');
    const field = await textField(page);
    await field.fill('Casa da Ana');
    // Dragging is part of "Ajustar manualmente" (D-058).
    await openStep(page, 'Posição do texto');
    await page.getByRole('radio', { name: 'Ajustar manualmente' }).check();
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
    await openStep(page, 'Posição do texto');
    await expect(page.getByText(/^Posição personalizada:/)).toBeVisible();
    await openStep(page, 'Texto e cores');

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

test.describe('Bandeja ondulada sizes (D-057)', () => {
  test('one option, a required size, kept choices on size change, export by real ID', async ({
    page,
  }) => {
    await page.goto('/');
    const models = page.getByRole('group', { name: 'Modelo' });
    const preview = page.getByRole('region', { name: 'Pré-visualização' });
    const review = page.getByRole('region', { name: 'Revisar personalização' });
    const button = review.getByRole('button', { name: 'Exportar imagem' });
    const summary = (term: string) => review.locator('dt', { hasText: term }).locator('+ dd');
    const bandeja = models.getByRole('radio', { name: 'Bandeja ondulada' });
    await expect(bandeja).toHaveAccessibleDescription('Disponível em dois tamanhos');
    await expect(page.getByRole('group', { name: 'Tamanho' })).toHaveCount(0);

    await (await textField(page)).fill('Ana\nLuz\nCasa\nMar');
    await page
      .getByRole('group', { name: 'Cor do texto' })
      .getByRole('radio', { name: 'Azul' })
      .check();
    await openStep(page, 'Modelo e tamanho');
    await bandeja.check();
    const sizes = page.getByRole('group', { name: 'Tamanho' });
    await expect(sizes.getByRole('radio')).toHaveCount(2);
    await expect(sizes.getByRole('radio', { checked: true })).toHaveCount(0);
    // The shared photograph is shown at once, without lettering, until a size is chosen.
    await expect(preview).toContainText('Selecione o tamanho para visualizar a personalização.');
    await expect(preview.getByRole('img')).toHaveAccessibleName('Bandeja ondulada bege, sem texto');
    await openStep(page, 'Revisar personalização');
    await expect(review).toContainText('Falta escolher: Tamanho.');
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(summary('Modelo')).toHaveText('Bandeja ondulada');
    await expect(summary('Tamanho')).toHaveText('Não escolhido');

    // G holds the four lines; M holds three at its fixed size.
    await openStep(page, 'Modelo e tamanho');
    await sizes.getByRole('radio', { name: 'G — 11 × 11 cm' }).check();
    await expect(preview.getByRole('img')).toBeVisible();
    await openStep(page, 'Posição do texto');
    await page
      .getByRole('group', { name: 'Posição do texto' })
      .getByRole('button', { name: 'Superior à esquerda', exact: true })
      .click();
    await expect(preview).not.toContainText('O texto não cabe');
    await openStep(page, 'Revisar personalização');
    await expect(summary('Tamanho')).toHaveText('G — 11 × 11 cm');
    await expect(button).toHaveAttribute('aria-disabled', 'false');

    await openStep(page, 'Modelo e tamanho');
    await sizes.getByRole('radio', { name: 'M — 8 × 8 cm' }).check();
    await expect(preview).toContainText(
      'O texto não cabe na área do modelo: 1 linha a mais. Reduza o texto ou use menos linhas.',
    );
    await expect(await textField(page)).toHaveValue('Ana\nLuz\nCasa\nMar');
    await expect(
      page.getByRole('group', { name: 'Cor do texto' }).getByRole('radio', { name: 'Azul' }),
    ).toBeChecked();
    await openStep(page, 'Posição do texto');
    await expect(
      page.getByRole('button', { name: 'Superior à esquerda', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await openStep(page, 'Revisar personalização');
    await expect(button).toHaveAttribute('aria-disabled', 'true');

    await openStep(page, 'Modelo e tamanho');
    await sizes.getByRole('radio', { name: 'G — 11 × 11 cm' }).check();
    await expect(preview).not.toContainText('O texto não cabe');
    await openStep(page, 'Revisar personalização');
    await expect(button).toHaveAttribute('aria-disabled', 'false');
    const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
    expect(download.suggestedFilename()).toBe('taavi-bandeja-ondulada-g-11.png');
    await expectNoHorizontalScroll(page);
  });
});

test.describe('Bandeja ondulada before its size (M4.6)', () => {
  test('shows the photograph at once, letters only after M or G, export after the size', async ({
    page,
  }) => {
    const photos: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/catalog/')) photos.push(new URL(request.url()).pathname);
    });
    await page.goto('/');
    await (await textField(page)).fill('Ana');
    await page
      .getByRole('group', { name: 'Cor do texto' })
      .getByRole('radio', { name: 'Azul' })
      .check();
    await chooseModel(page, 'Placa cerâmica — 10 × 10 cm');
    await openStep(page, 'Modelo e tamanho');
    await page
      .getByRole('group', { name: 'Modelo' })
      .getByRole('radio', { name: 'Bandeja ondulada' })
      .check();

    const preview = page.getByRole('region', { name: 'Pré-visualização' });
    const canvas = preview.locator('canvas');
    const notice = 'Selecione o tamanho para visualizar a personalização.';
    /** Blue lettering pixels inside the tray's text area (x 0.28–0.71, y 0.265–0.695). */
    const lettering = () =>
      canvas.evaluate((element: HTMLCanvasElement) => {
        const ctx = element.getContext('2d');
        if (!ctx) return -1;
        const { width: W, height: H } = element;
        const { data } = ctx.getImageData(0.28 * W, 0.265 * H, 0.43 * W, 0.43 * H);
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const [r = 0, g = 0, b = 0] = [data[i], data[i + 1], data[i + 2]];
          if (Math.abs(r - 0x00) < 14 && Math.abs(g - 0x2b) < 14 && Math.abs(b - 0x80) < 14) {
            count += 1;
          }
        }
        return count;
      });

    // Illustrative: the shared photograph, no lettering, a required size, export blocked.
    await expect(preview).toContainText(notice);
    await expect(canvas).toHaveAccessibleName('Bandeja ondulada bege, sem texto');
    await expect.poll(lettering).toBe(0);
    await expect(
      page.getByRole('group', { name: 'Tamanho' }).getByRole('radio', { checked: true }),
    ).toHaveCount(0);
    const review = await step(page, 'Revisar personalização');
    const button = review.getByRole('button', { name: 'Exportar imagem' });
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(review).toContainText('Falta escolher: Tamanho.');
    await expect(button).toHaveAccessibleDescription(/Falta escolher: Tamanho/);

    // G: its own scale; then M: larger letters on the same photograph.
    await chooseModel(page, 'Bandeja ondulada G — 11 × 11 cm');
    await expect(preview).not.toContainText(notice);
    await expect.poll(lettering).toBeGreaterThan(50);
    const g = await lettering();
    await chooseModel(page, 'Bandeja ondulada M — 8 × 8 cm');
    await expect.poll(lettering).toBeGreaterThan(g * 1.3);
    await openStep(page, 'Revisar personalização');
    await expect(button).toHaveAttribute('aria-disabled', 'false');

    // Each file once: the illustration's photograph is M's, reused when M is chosen.
    await chooseModel(page, 'Bandeja ondulada G — 11 × 11 cm');
    await expect.poll(lettering).toBeLessThan(g * 1.15);
    expect(photos.filter((path) => path.includes('bandeja-ondulada-m-8'))).toHaveLength(1);
    expect(photos.filter((path) => path.includes('bandeja-ondulada-g-11'))).toHaveLength(1);
  });
});

/** Text areas as fractions of each photograph (src/catalog/data.ts). */
const AREAS = {
  'Placa cerâmica — 10 × 10 cm': { x: 0.145, y: 0.155, width: 0.71, height: 0.69, lines: 6 },
  'Quadro — 20 × 20 cm': { x: 0.3009, y: 0.3494, width: 0.3589, height: 0.3589, lines: 7 },
  'Bandeja ondulada M — 8 × 8 cm': { x: 0.28, y: 0.265, width: 0.43, height: 0.43, lines: 3 },
  'Bandeja ondulada G — 11 × 11 cm': { x: 0.28, y: 0.265, width: 0.43, height: 0.43, lines: 4 },
} as const;
type Area = (typeof AREAS)[keyof typeof AREAS];

/**
 * Dark outline pixels along the left edge of the text area on the preview
 * canvas: a 5 px column centered on the edge, over the area's height.
 */
async function outlinePixels(page: Page, area: Area): Promise<number> {
  return page.evaluate((box) => {
    const canvas = document.querySelector('.preview__canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return -1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return -1;
    const x = Math.round(box.x * canvas.width) - 2;
    const y = Math.round(box.y * canvas.height);
    const { data } = ctx.getImageData(x, y, 5, Math.round(box.height * canvas.height));
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i] ?? 255) < 60 && (data[i + 1] ?? 255) < 60 && (data[i + 2] ?? 255) < 60) {
        dark += 1;
      }
    }
    return dark;
  }, area);
}

test.describe('Overflow at the fixed lettering size (D-057)', () => {
  const lines = (count: number) => Array.from({ length: count }, () => 'Ana').join('\n');

  for (const [name, area] of Object.entries(AREAS)) {
    test(`${name}: ${area.lines} lines fit, more are counted and outlined`, async ({ page }) => {
      await page.goto('/');
      await chooseModel(page, name);
      const field = await textField(page);
      await page
        .getByRole('group', { name: 'Cor do texto' })
        .getByRole('radio', { name: 'Marrom' })
        .check();
      const preview = page.getByRole('region', { name: 'Pré-visualização' });
      // Export state is read from the button's attributes, whether its step is open or not.
      const button = page
        .getByRole('region', { name: 'Revisar personalização' })
        .getByRole('button', { name: 'Exportar imagem', includeHidden: true });
      await expect(preview.getByRole('img')).toBeVisible();

      await field.fill(lines(area.lines));
      await expect(preview).not.toContainText('O texto não cabe');
      await expect(button).toHaveAttribute('aria-disabled', 'false');
      // The photograph's own dark specks along the edge, without an outline.
      const base = await outlinePixels(page, area);

      // One more line break is refused, at the line count of the real calibration (D-063).
      await field.fill(lines(area.lines + 1));
      await expect(field).toHaveValue(lines(area.lines));
      await expect(page.locator('#text-line-limit')).toHaveText(
        `Este modelo comporta no máximo ${area.lines} linhas.`,
      );
      await expect(preview).not.toContainText('O texto não cabe');

      // Wrapping still overflows: the shortest run of "m" on the last line that wraps onto one more line.
      const last = (count: number) => `${lines(area.lines - 1)}\n${'m'.repeat(count)}`;
      let wraps = 0;
      for (let count = 1; count < 80 && wraps === 0; count += 1) {
        await field.fill(last(count));
        const overflowing = await page.evaluate(
          () => document.getElementById('text-overflow') !== null,
        );
        if (overflowing) wraps = count;
      }
      expect(wraps).toBeGreaterThan(1);
      await expect(preview).toContainText(
        'O texto não cabe na área do modelo: 1 linha a mais. Reduza o texto ou use menos linhas.',
      );
      await expect(button).toHaveAttribute('aria-disabled', 'true');
      await expect(button).toHaveAccessibleDescription(/1 linha a mais/);
      await expect.poll(() => outlinePixels(page, area)).toBeGreaterThan(base + 20);

      // Twice the line's capacity plus one character: two lines over.
      await field.fill(last(2 * wraps - 1));
      await expect(preview).toContainText('O texto não cabe na área do modelo: 2 linhas a mais.');

      await field.fill(lines(area.lines));
      await expect(preview).not.toContainText('O texto não cabe');
      await expect.poll(() => outlinePixels(page, area)).toBeLessThanOrEqual(base + 2);
      await expect(button).toHaveAttribute('aria-disabled', 'false');
    });
  }

  test('revalidates when the font changes the wrapping', async ({ page }) => {
    await page.goto('/');
    const name = 'Placa cerâmica — 10 × 10 cm';
    const area = AREAS[name];
    await chooseModel(page, name);
    const preview = page.getByRole('region', { name: 'Pré-visualização' });
    await expect(preview.getByRole('img')).toBeVisible();
    // A word that fits one line in one family and wraps in the other, at the
    // Placa's fixed 53.568 px (0.0837 × 640) in its 454.4 px wide area.
    const word = await page.evaluate(() => {
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) return null;
      const width = (family: string, text: string) => {
        ctx.font = `53.568px ${family}`;
        return ctx.measureText(text).width;
      };
      const sans = 'system-ui, -apple-system, "Segoe UI", sans-serif';
      const serif = 'Georgia, "Times New Roman", Times, serif';
      for (let n = 1; n < 40; n += 1) {
        const text = 'm'.repeat(n);
        const fitsSans = width(sans, text) <= 454.4;
        const fitsSerif = width(serif, text) <= 454.4;
        if (fitsSans !== fitsSerif) return { text, narrow: fitsSans ? 'sans' : 'serif' };
      }
      return null;
    });
    // Reported as skipped, never as passed, where the system fonts give no such word.
    test.skip(
      word === null,
      'No word wraps differently in the two font stacks here: font-change revalidation not covered.',
    );
    if (word === null) return;
    test.info().annotations.push({
      type: 'font-wrap',
      description: `"${word.text}" (${word.text.length} chars) fits in ${word.narrow} only`,
    });

    const fonts = page.getByRole('group', { name: 'Fonte' });
    const wide = word.narrow === 'sans' ? 'Com serifa' : 'Sem serifa';
    const narrow = word.narrow === 'sans' ? 'Sem serifa' : 'Com serifa';
    await (await textField(page)).fill(`${lines(area.lines - 1)}\n${word.text}`);
    await fonts.getByRole('radio', { name: narrow }).check();
    await expect(preview).not.toContainText('O texto não cabe');
    const base = await outlinePixels(page, area);

    await fonts.getByRole('radio', { name: wide }).check();
    await expect(preview).toContainText('O texto não cabe na área do modelo: 1 linha a mais.');
    await expect.poll(() => outlinePixels(page, area)).toBeGreaterThan(base + 20);

    await fonts.getByRole('radio', { name: narrow }).check();
    await expect(preview).not.toContainText('O texto não cabe');
  });
});

test.describe('Text position section (D-057)', () => {
  test('one status line, no visible group captions, named groups', async ({ page }) => {
    await page.goto('/');
    await chooseModel(page, 'Placa cerâmica — 10 × 10 cm');
    await (await textField(page)).fill('Ana');
    await openStep(page, 'Posição do texto');
    const position = page.getByRole('group', { name: 'Posição do texto' });
    await expect(
      position.getByRole('group', { name: 'Alinhamento das linhas' }).getByRole('radio'),
    ).toHaveCount(3);
    // One set of controls at a time: the presets, or the arrow pad (D-058).
    await expect(position.getByRole('group', { name: 'Posições predefinidas' })).toBeVisible();
    await expect(position.getByRole('group', { name: 'Ajuste fino' })).toHaveCount(0);
    await expect(position.getByText('Posições predefinidas')).toHaveCount(0);
    await expect(
      position.getByRole('group', { name: 'Posições predefinidas' }).getByRole('button'),
    ).toHaveCount(9);
    const status = position.getByRole('status');
    await expect(status).toHaveCount(1);
    await expect(status).toHaveText('Posição: Centro.');

    await position.getByRole('radio', { name: 'Ajustar manualmente' }).check();
    await expect(position.getByRole('group', { name: 'Posições predefinidas' })).toHaveCount(0);
    await expect(
      position.getByRole('group', { name: 'Ajuste fino' }).getByRole('button'),
    ).toHaveCount(4);
    // Keyboard instructions are not shown; they describe the arrow pad.
    await expect(position.getByText(/Setas do teclado/)).toHaveClass('visually-hidden');
    await expect(position.getByRole('group', { name: 'Ajuste fino' })).toHaveAccessibleDescription(
      /Setas do teclado/,
    );
    await position.getByRole('button', { name: 'Mover para a direita' }).click();
    await expect(status).toHaveText('Posição personalizada: horizontal 52%, vertical 50%.');
    await position.getByRole('button', { name: 'Redefinir posição' }).click();
    await expect(status).toHaveText('Posição: Centro.');
    await expectNoHorizontalScroll(page);
  });
});

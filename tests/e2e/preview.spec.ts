import { expect, test, type Locator, type Page } from '@playwright/test';
import { chooseModel, openStep, step, textField } from './support/steps';

/**
 * Preview checks against the demo build's synthetic images (D-036). Pixels are
 * read from the canvas at fractions of its size, at points the demo images
 * keep flat (scripts/generate-demo-assets.js), so they hold at any scale.
 */

type Rgba = readonly [number, number, number, number];

const BEGE: Rgba = [226, 208, 186, 255];
const WHITE: Rgba = [255, 255, 255, 255];
const WOOD: readonly Rgba[] = [
  [150, 118, 84, 255],
  [132, 102, 70, 255],
];

const canvas = (page: Page) => page.locator('.preview__canvas');
const preview = (page: Page) => page.getByRole('region', { name: 'Pré-visualização' });

const CERAMIC_PLATE = /Placa cerâmica/;
const QUADRO = /Quadro — 20/;

/** Chooses a demo Bandeja size under its grouped option (D-057). */
async function chooseTray(page: Page, size: 'M' | 'G') {
  await chooseModel(page, /Bandeja ondulada$/, new RegExp(`^${size} — `));
}

async function sample(page: Page, x: number, y: number): Promise<Rgba> {
  return canvas(page).evaluate(
    (element, [fx, fy]) => {
      if (!(element instanceof HTMLCanvasElement)) throw new Error('Not a canvas');
      const ctx = element.getContext('2d');
      if (!ctx) throw new Error('No 2D context');
      const data = ctx.getImageData(
        Math.min(element.width - 1, Math.floor((fx ?? 0) * element.width)),
        Math.min(element.height - 1, Math.floor((fy ?? 0) * element.height)),
        1,
        1,
      ).data;
      return [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, data[3] ?? 0] as const;
    },
    [x, y],
  );
}

const near = (actual: Rgba, expected: Rgba, tolerance = 4) =>
  actual.every((channel, i) => Math.abs(channel - (expected[i] ?? 0)) <= tolerance);

/** Polls until the sampled pixel matches one of `expected`. */
async function expectPixel(page: Page, x: number, y: number, expected: Rgba | readonly Rgba[]) {
  const options = (Array.isArray(expected[0]) ? expected : [expected]) as readonly Rgba[];
  await expect
    .poll(
      async () => {
        const pixel = await sample(page, x, y);
        return options.some((option) => near(pixel, option));
      },
      { message: `pixel at (${x}, ${y})` },
    )
    .toBe(true);
}

/** Rows (in canvas pixels) inside the text area that contain dark text pixels, as contiguous runs. */
async function textRuns(page: Page): Promise<{ runs: number; left: number; right: number }> {
  return canvas(page).evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Not a canvas');
    const ctx = element.getContext('2d');
    if (!ctx) throw new Error('No 2D context');
    // Demo text area of the standalone 400×400 plates: x 0.2–0.8, y 0.3–0.7.
    const x0 = Math.ceil(0.2 * element.width) + 3;
    const x1 = Math.floor(0.8 * element.width) - 3;
    const y0 = Math.ceil(0.3 * element.height) + 3;
    const y1 = Math.floor(0.7 * element.height) - 3;
    const { data, width } = ctx.getImageData(0, 0, element.width, element.height);
    let runs = 0;
    let inRun = false;
    let left = Infinity;
    let right = -Infinity;
    for (let y = y0; y < y1; y += 1) {
      let dark = false;
      for (let x = x0; x < x1; x += 1) {
        if ((data[(y * width + x) * 4] ?? 255) < 110) {
          dark = true;
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
      }
      if (dark && !inRun) runs += 1;
      inRun = dark;
    }
    return { runs, left: left / element.width, right: right / element.width };
  });
}

/** Text-area pixels within `tolerance` of `rgb`, or the dark-pixel signature when `rgb` is omitted. */
async function textPixels(page: Page, rgb?: readonly [number, number, number], tolerance = 12) {
  return canvas(page).evaluate(
    (element, [target, tol]) => {
      if (!(element instanceof HTMLCanvasElement)) throw new Error('Not a canvas');
      const ctx = element.getContext('2d');
      if (!ctx) throw new Error('No 2D context');
      const x0 = Math.ceil(0.2 * element.width);
      const y0 = Math.ceil(0.3 * element.height);
      const w = Math.floor(0.6 * element.width);
      const h = Math.floor(0.4 * element.height);
      const { data } = ctx.getImageData(x0, y0, w, h);
      let count = 0;
      let signature = 0;
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
        if (target) {
          const t = target as readonly number[];
          if (
            Math.abs(r - (t[0] ?? 0)) <= (tol as number) &&
            Math.abs(g - (t[1] ?? 0)) <= (tol as number) &&
            Math.abs(b - (t[2] ?? 0)) <= (tol as number)
          ) {
            count += 1;
          }
        } else if (r < 110) {
          count += 1;
          signature = (signature * 31 + i) % 1_000_000_007;
        }
      }
      return target ? count : signature;
    },
    [rgb ?? null, tolerance] as const,
  );
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Element has no bounding box');
  return box;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/imagens sintéticos/)).toBeVisible();
});

test.describe('exact image selection', () => {
  test('paints the image of the chosen model @smoke', async ({ page }) => {
    await expect(canvas(page)).toHaveCount(0);

    await chooseModel(page, CERAMIC_PLATE);
    await expectPixel(page, 0.5, 0.8, BEGE);
    await expect(canvas(page)).toHaveAttribute('aria-label', /Placa cerâmica 10 × 10 cm/);

    await chooseModel(page, QUADRO);
    await expectPixel(page, 0.5, 0.75, BEGE);
    await expect(canvas(page)).toHaveAttribute('aria-label', /Quadro 20 × 20 cm/);

    await chooseTray(page, 'M');
    await expectPixel(page, 0.5, 0.8, BEGE);
    await expect(canvas(page)).toHaveAttribute('aria-label', /Bandeja ondulada M 8 × 8 cm/);

    await chooseTray(page, 'G');
    await expect(canvas(page)).toHaveAttribute('aria-label', /Bandeja ondulada G 11 × 11 cm/);
  });

  test('labels the demonstration images for assistive technology', async ({ page }) => {
    await chooseModel(page, CERAMIC_PLATE);

    await expect(canvas(page)).toHaveAttribute('aria-label', /imagem sintética de demonstração/);
  });
});

test.describe('model shapes', () => {
  test('keeps the Quadro square', async ({ page }) => {
    await chooseModel(page, QUADRO);
    await expectPixel(page, 0.5, 0.75, BEGE);

    const box = await boxOf(canvas(page));
    expect(box.width / box.height).toBeCloseTo(1, 1);
  });

  test('keeps a scalloped tray free of any frame, on white outside its outline', async ({
    page,
  }) => {
    await chooseTray(page, 'G');

    await expectPixel(page, 0.5, 0.8, BEGE);
    // The corner of the image is outside the tray: only the opaque white background.
    await expectPixel(page, 0.03, 0.03, WHITE);
    await expect(page.getByRole('group', { name: /Moldura/ })).toHaveCount(0);
  });
});

test.describe('assembled Quadro (D-046)', () => {
  test('paints the Quadro from its one photograph, frame included, with no extra layers', async ({
    page,
  }) => {
    const requested: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/catalog/')) requested.push(new URL(request.url()).pathname);
    });
    await chooseModel(page, QUADRO);

    // The wooden frame is part of the photograph; the ceramic sits inside it.
    await expectPixel(page, 0.14, 0.5, WOOD);
    await expectPixel(page, 0.5, 0.75, BEGE);
    await expectPixel(page, 0.03, 0.03, WHITE);
    expect(requested).toEqual(['/catalog/plates/demo-quadro/bege.png']);
  });

  test('keeps the Quadro text inside the ceramic, clear of the frame', async ({ page }) => {
    await chooseModel(page, QUADRO);
    await (await textField(page)).fill('HHHHHHHHHHHH');
    await openStep(page, 'Posição do texto');
    await page
      .getByRole('group', { name: 'Posição do texto' })
      .getByRole('button', { name: 'Superior à esquerda', exact: true })
      .click();

    // The frame band and the ceramic margin keep their own colors.
    await expectPixel(page, 0.14, 0.4, WOOD);
    await expectPixel(page, 0.22, 0.4, BEGE);
  });
});

test.describe('personalized text', () => {
  test('draws the typed text inside the plate text area, one line per line break', async ({
    page,
  }) => {
    await chooseModel(page, CERAMIC_PLATE);
    await expectPixel(page, 0.5, 0.8, BEGE);
    await expect.poll(async () => (await textRuns(page)).runs).toBe(0);

    await (await textField(page)).fill('HHH');
    await expect.poll(async () => (await textRuns(page)).runs).toBe(1);

    await (await textField(page)).fill('HHH\nHHH');
    await expect.poll(async () => (await textRuns(page)).runs).toBe(2);

    // Centered within the area (0.2–0.8) and not spilling past it.
    const { left, right } = await textRuns(page);
    expect(left).toBeGreaterThanOrEqual(0.2);
    expect(right).toBeLessThanOrEqual(0.8);
    expect((left + right) / 2).toBeCloseTo(0.5, 1);
  });

  test('paints the chosen lettering color and font', async ({ page }) => {
    await chooseModel(page, CERAMIC_PLATE);
    await (await textField(page)).fill('HHH');
    const BLUE = [0x1f, 0x4e, 0x8c] as const;
    await expect.poll(() => textPixels(page, BLUE)).toBe(0);
    const provisional = preview(page).getByText(/cor provisória/);
    await expect(provisional).toBeVisible();

    await page
      .getByRole('group', { name: 'Cor do texto' })
      .getByRole('radio', { name: /Letra azul/ })
      .check();
    await expect.poll(() => textPixels(page, BLUE)).toBeGreaterThan(20);
    await expect(provisional).toHaveCount(0);

    const sans = await textPixels(page);
    await page
      .getByRole('group', { name: 'Fonte' })
      .getByRole('radio', { name: 'Com serifa' })
      .check();
    await expect.poll(() => textPixels(page)).not.toBe(sans);
  });

  test('paints the selected characters in the second color', async ({ page }) => {
    await chooseModel(page, CERAMIC_PLATE);
    const field = await textField(page);
    await field.fill('HHHH');
    await page
      .getByRole('group', { name: 'Cor do texto' })
      .getByRole('radio', { name: /Letra azul/ })
      .check();
    await page.getByRole('button', { name: 'Usar segunda cor' }).click();
    await page
      .getByRole('group', { name: 'Segunda cor' })
      .getByRole('radio', { name: /Letra vinho/ })
      .check();
    const WINE = [0x8c, 0x1f, 0x3d] as const;
    const BLUE = [0x1f, 0x4e, 0x8c] as const;
    await expect.poll(() => textPixels(page, WINE)).toBe(0);

    await field.focus();
    await field.press('End');
    for (let i = 0; i < 2; i += 1) await field.press('Shift+ArrowLeft');
    await page.getByRole('button', { name: 'Aplicar segunda cor à seleção' }).click();

    await expect.poll(() => textPixels(page, WINE)).toBeGreaterThan(20);
    expect(await textPixels(page, BLUE)).toBeGreaterThan(20);
  });

  test('warns about text that does not fit instead of clipping it', async ({ page }) => {
    await chooseModel(page, CERAMIC_PLATE);

    await (
      await textField(page)
    ).fill(Array.from({ length: 40 }, (_, i) => `linha ${i}`).join(' '));

    await expect(preview(page)).toContainText('O texto não cabe na área do modelo');
    // The full text is still kept and summarized in the review.
    const review = await step(page, 'Revisar personalização');
    await expect(review.locator('.review__text')).toContainText('linha 39');
  });
});

test.describe('text position (D-044)', () => {
  /** Calibrated demo text areas, as canvas fractions (standalone 400×400 images). */
  const SQUARE_AREA = { x0: 0.2, y0: 0.3, x1: 0.8, y1: 0.7 };
  const TRAY_AREA = { x0: 0.25, y0: 0.35, x1: 0.75, y1: 0.65 };
  type Area = typeof SQUARE_AREA;
  interface Box {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }

  /** Bounding box of each line of dark text pixels inside `area`, top to bottom. */
  async function textLines(page: Page, area: Area = SQUARE_AREA): Promise<Box[]> {
    return canvas(page).evaluate((element, a) => {
      if (!(element instanceof HTMLCanvasElement)) throw new Error('Not a canvas');
      const ctx = element.getContext('2d');
      if (!ctx) throw new Error('No 2D context');
      const W = element.width;
      const H = element.height;
      // 3 px inside the area: the demo images draw calibration guides on its edges.
      const x0 = Math.ceil(a.x0 * W) + 3;
      const x1 = Math.floor(a.x1 * W) - 3;
      const y0 = Math.ceil(a.y0 * H) + 3;
      const y1 = Math.floor(a.y1 * H) - 3;
      const { data } = ctx.getImageData(0, 0, W, H);
      const lines: { left: number; right: number; top: number; bottom: number }[] = [];
      let current: { left: number; right: number; top: number; bottom: number } | null = null;
      for (let y = y0; y < y1; y += 1) {
        let left = Infinity;
        let right = -Infinity;
        for (let x = x0; x < x1; x += 1) {
          if ((data[(y * W + x) * 4] ?? 255) < 110) {
            left = Math.min(left, x);
            right = Math.max(right, x);
          }
        }
        if (left === Infinity) {
          if (current) lines.push(current);
          current = null;
          continue;
        }
        if (current === null) current = { left, right, top: y, bottom: y };
        current.left = Math.min(current.left, left);
        current.right = Math.max(current.right, right);
        current.bottom = y;
      }
      if (current) lines.push(current);
      return lines.map((line) => ({
        left: line.left / W,
        right: (line.right + 1) / W,
        top: line.top / H,
        bottom: (line.bottom + 1) / H,
      }));
    }, area);
  }

  /** The bounding box of all text, polled until `accept` holds. */
  async function settledBox(
    page: Page,
    accept: (box: Box) => boolean,
    area: Area = SQUARE_AREA,
  ): Promise<Box> {
    let last: Box | undefined;
    await expect
      .poll(async () => {
        const lines = await textLines(page, area);
        if (lines.length === 0) return false;
        last = {
          left: Math.min(...lines.map((l) => l.left)),
          right: Math.max(...lines.map((l) => l.right)),
          top: Math.min(...lines.map((l) => l.top)),
          bottom: Math.max(...lines.map((l) => l.bottom)),
        };
        return accept(last);
      })
      .toBe(true);
    if (!last) throw new Error('No text box');
    return last;
  }

  const position = (page: Page) => page.getByRole('group', { name: 'Posição do texto' });
  const preset = (page: Page, name: string) =>
    position(page).getByRole('button', { name, exact: true });

  async function withText(page: Page, text = 'HHH') {
    await chooseModel(page, CERAMIC_PLATE);
    await (await textField(page)).fill(text);
    await openStep(page, 'Posição do texto');
    await expect(position(page)).toBeVisible();
  }
  const alignment = (page: Page, name: string) =>
    position(page)
      .getByRole('group', { name: 'Alinhamento das linhas' })
      .getByRole('radio', { name, exact: true });
  /** "Escolher posição" (presets) or "Ajustar manualmente" (arrow pad and dragging). */
  const mode = (page: Page, name: 'Escolher posição' | 'Ajustar manualmente') =>
    position(page).getByRole('radio', { name, exact: true }).check();

  const EDGE = 0.025;
  const near = (a: number, b: number, tolerance = EDGE) => Math.abs(a - b) <= tolerance;

  test('moves the drawn text to nine distinct places at the edges of the safe area @smoke', async ({
    page,
  }) => {
    await withText(page);
    const a = SQUARE_AREA;
    const columns = [
      ['à esquerda', (b: Box) => near(b.left, a.x0)],
      ['ao centro', (b: Box) => near((b.left + b.right) / 2, 0.5, 0.015)],
      ['à direita', (b: Box) => near(b.right, a.x1)],
    ] as const;
    const rows = [
      ['Superior', (b: Box) => b.top >= a.y0 && b.top - a.y0 < 0.045],
      ['Meio', (b: Box) => near((b.top + b.bottom) / 2, 0.5, 0.02)],
      ['Inferior', (b: Box) => b.bottom <= a.y1 && a.y1 - b.bottom < 0.045],
    ] as const;
    const seen = new Set<string>();
    for (const [rowName, rowOk] of rows) {
      for (const [columnName, columnOk] of columns) {
        const name =
          rowName === 'Meio' && columnName === 'ao centro' ? 'Centro' : `${rowName} ${columnName}`;
        await preset(page, name).click();
        await expect(preset(page, name)).toHaveAttribute('aria-pressed', 'true');
        const box = await settledBox(page, (b) => rowOk(b) && columnOk(b));
        seen.add(`${box.left.toFixed(2)},${box.top.toFixed(2)}`);
      }
    }
    expect(seen.size).toBe(9);
  });

  test('aligns multiline text independently of the block position (D-059) @smoke', async ({
    page,
  }) => {
    await withText(page, 'HHHHHH\nHH');
    await expect(alignment(page, 'Centralizar texto')).toBeChecked();

    const lines = async () => {
      let result: [Box, Box] | undefined;
      await expect
        .poll(async () => {
          const [long, short] = await textLines(page);
          result = long && short ? [long, short] : undefined;
          return result !== undefined;
        })
        .toBe(true);
      return result as [Box, Box];
    };
    const check = async (accept: (long: Box, short: Box) => boolean) => {
      await expect
        .poll(async () => {
          const [long, short] = await textLines(page);
          return long !== undefined && short !== undefined && accept(long, short);
        })
        .toBe(true);
    };

    // A preset places the block; the lines stay centered in it.
    await preset(page, 'Superior à esquerda').click();
    await check(
      (long, short) =>
        near(long.left, SQUARE_AREA.x0) &&
        near((short.left + short.right) / 2, (long.left + long.right) / 2, 0.006),
    );
    const [placed] = await lines();

    // Right alignment: both lines end at the same edge, and the block does not move.
    await alignment(page, 'Alinhar à direita').check();
    await check(
      (long, short) =>
        near(short.right, long.right, 0.006) &&
        short.left > long.left + 0.05 &&
        near(long.left, placed.left, 0.004),
    );
    await expect(preset(page, 'Superior à esquerda')).toHaveAttribute('aria-pressed', 'true');

    // Left alignment, then keyboard: arrow keys move through the three options.
    await alignment(page, 'Alinhar à esquerda').check();
    await check(
      (long, short) => near(short.left, long.left, 0.006) && short.right < long.right - 0.05,
    );
    await alignment(page, 'Alinhar à esquerda').focus();
    await page.keyboard.press('ArrowRight');
    await expect(alignment(page, 'Centralizar texto')).toBeChecked();

    // Another preset keeps the chosen alignment.
    await alignment(page, 'Alinhar à direita').check();
    await preset(page, 'Inferior à direita').click();
    await check(
      (long, short) => near(long.right, SQUARE_AREA.x1) && near(short.right, long.right, 0.006),
    );
    await expect(alignment(page, 'Alinhar à direita')).toBeChecked();
    await expect(position(page).getByText('Posição: Inferior à direita.')).toBeVisible();
  });

  test('drags the text with the mouse, changing only its position', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Mouse dragging is a desktop interaction; touch is tested separately.');
    await withText(page);
    await preset(page, 'Superior à esquerda').click();
    const before = await settledBox(page, (b) => near(b.left, SQUARE_AREA.x0));
    await mode(page, 'Ajustar manualmente');
    // The controls are below the preview; the pointer can only reach what is on screen.
    await canvas(page).scrollIntoViewIfNeeded();
    const rect = await boxOf(canvas(page));
    const startX = rect.x + ((before.left + before.right) / 2) * rect.width;
    const startY = rect.y + ((before.top + before.bottom) / 2) * rect.height;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 0.15 * rect.width, startY + 0.1 * rect.height, { steps: 8 });
    await page.mouse.up();

    const after = await settledBox(page, (b) => b.left > before.left + 0.1);
    expect(after.left - before.left).toBeCloseTo(0.15, 1);
    expect(after.top - before.top).toBeCloseTo(0.1, 1);
    await expect(position(page).getByRole('status')).toContainText('Posição personalizada:');
    await mode(page, 'Escolher posição');
    await expect(preset(page, 'Superior à esquerda')).toHaveAttribute('aria-pressed', 'false');
  });

  test('drags by touch only in "Ajustar manualmente", then scrolls again', async ({
    page,
    browserName,
    hasTouch,
  }) => {
    test.skip(
      browserName !== 'chromium' || !hasTouch,
      'Real touch input is driven through Chromium DevTools.',
    );
    await withText(page);
    await preset(page, 'Superior à esquerda').click();
    const before = await settledBox(page, (b) => near(b.left, SQUARE_AREA.x0));
    const cdp = await page.context().newCDPSession(page);
    /**
     * A real one-finger horizontal drag of 20% of the canvas width, starting on
     * the text. Coordinates are read just before, since the page may have scrolled.
     */
    const touchDrag = async () => {
      // The controls are below the preview; a finger can only touch what is on screen.
      await canvas(page).scrollIntoViewIfNeeded();
      const rect = await boxOf(canvas(page));
      const x = rect.x + ((before.left + before.right) / 2) * rect.width;
      const y = rect.y + ((before.top + before.bottom) / 2) * rect.height;
      const point = (dx: number) => [{ x: x + dx, y, id: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(0) });
      for (let i = 1; i <= 8; i += 1) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: point((0.2 * rect.width * i) / 8),
        });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      return rect.width;
    };

    await expect(canvas(page)).toHaveCSS('touch-action', 'auto');
    await touchDrag();
    const unchanged = await settledBox(page, () => true);
    expect(unchanged.left).toBeCloseTo(before.left, 3);
    await expect(position(page).getByRole('status')).toHaveText('Posição: Superior à esquerda.');

    await mode(page, 'Ajustar manualmente');
    await expect(position(page).getByRole('group', { name: 'Posições predefinidas' })).toHaveCount(
      0,
    );
    await expect(canvas(page)).toHaveCSS('touch-action', 'none');
    await touchDrag();
    const moved = await settledBox(page, (b) => b.left > before.left + 0.15);
    expect(moved.left - before.left).toBeCloseTo(0.2, 1);

    // Back to the presets: touch scrolls the page again, and the position is kept.
    await mode(page, 'Escolher posição');
    await expect(position(page).getByRole('group', { name: 'Ajuste fino' })).toHaveCount(0);
    await expect(canvas(page)).toHaveCSS('touch-action', 'auto');
    const kept = await settledBox(page, () => true);
    expect(kept.left).toBeCloseTo(moved.left, 2);
  });

  test('moves by 2% steps with the arrow keys and 10% with Shift', async ({ page }) => {
    await withText(page);
    await preset(page, 'Superior à esquerda').click();
    const start = await settledBox(page, (b) => near(b.left, SQUARE_AREA.x0));
    const right = position(page).getByRole('button', { name: 'Mover para a direita' });
    await mode(page, 'Ajustar manualmente');

    await right.focus();
    for (let i = 0; i < 5; i += 1) await page.keyboard.press('ArrowRight');
    await expect(position(page)).toContainText(
      'Posição personalizada: horizontal 10%, vertical 0%.',
    );
    const fiveSteps = await settledBox(page, (b) => b.left > start.left + 0.01);

    await mode(page, 'Escolher posição');
    await preset(page, 'Superior à esquerda').click();
    await settledBox(page, (b) => near(b.left, start.left, 0.002));
    await mode(page, 'Ajustar manualmente');
    await right.focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(position(page)).toContainText(
      'Posição personalizada: horizontal 10%, vertical 0%.',
    );
    const shiftStep = await settledBox(page, (b) => b.left > start.left + 0.01);

    expect(shiftStep.left).toBeCloseTo(fiveSteps.left, 3);
    // 10% of the free space: area width 0.6 minus the block width.
    const free = 0.6 - (start.right - start.left);
    expect(fiveSteps.left - start.left).toBeCloseTo(0.1 * free, 1);
  });

  test('keeps the position on another model, inside that model’s safe area', async ({ page }) => {
    await withText(page);
    await preset(page, 'Inferior à direita').click();
    await settledBox(page, (b) => near(b.right, SQUARE_AREA.x1));

    await chooseTray(page, 'G');
    await openStep(page, 'Posição do texto');

    await expect(preset(page, 'Inferior à direita')).toHaveAttribute('aria-pressed', 'true');
    const box = await settledBox(
      page,
      (b) =>
        near(b.right, TRAY_AREA.x1) && b.bottom <= TRAY_AREA.y1 && TRAY_AREA.y1 - b.bottom < 0.045,
      TRAY_AREA,
    );
    expect(box.left).toBeGreaterThanOrEqual(TRAY_AREA.x0);
  });

  test('resets the position to the catalog default, keeping the alignment', async ({ page }) => {
    await withText(page);
    const initial = await settledBox(page, (b) => near((b.left + b.right) / 2, 0.5, 0.015));
    await alignment(page, 'Alinhar à direita').check();
    await preset(page, 'Inferior à esquerda').click();
    await settledBox(page, (b) => near(b.left, SQUARE_AREA.x0));

    await position(page).getByRole('button', { name: 'Redefinir posição' }).click();

    // One line: the block and the line coincide, so it is back where it started.
    // Within a pixel: on phones the canvas is resized while the preview band expands.
    const reset = await settledBox(page, (b) => near(b.left, initial.left, 0.004));
    expect(reset.top).toBeCloseTo(initial.top, 2);
    await expect(preset(page, 'Centro')).toHaveAttribute('aria-pressed', 'true');
    await expect(alignment(page, 'Alinhar à direita')).toBeChecked();
    await expectNoHorizontalScroll(page);
  });
});

test.describe('missing and broken images', () => {
  test('reports a plate file that fails to load, without substituting another image', async ({
    page,
  }) => {
    await page.route('**/catalog/plates/demo-placa-ceramica/bege.png', (route) => route.abort());

    await chooseModel(page, CERAMIC_PLATE);

    await expect(preview(page)).toContainText('Não foi possível carregar a imagem do modelo.');
    await expect(canvas(page)).toHaveCount(0);

    // Another model still loads normally.
    await chooseModel(page, QUADRO);
    await expectPixel(page, 0.5, 0.75, BEGE);
  });
});

test.describe('responsive layout', () => {
  test('fits the viewport and keeps the image aspect ratio', async ({ page }) => {
    await chooseModel(page, CERAMIC_PLATE);
    await expectPixel(page, 0.5, 0.8, BEGE);

    const viewport = page.viewportSize();
    const box = await boxOf(canvas(page));
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual((viewport?.width ?? Infinity) + 1);
    expect(box.width / box.height).toBeCloseTo(1, 1);
    await expectNoHorizontalScroll(page);
  });

  test('keeps the canvas sharp on high-density screens without exceeding the source size', async ({
    page,
  }) => {
    await chooseModel(page, CERAMIC_PLATE);
    await expectPixel(page, 0.5, 0.8, BEGE);

    const width = await canvas(page).evaluate((element) =>
      element instanceof HTMLCanvasElement ? element.width : 0,
    );
    const cssWidth = (await boxOf(canvas(page))).width;
    const ratio = await page.evaluate(() => window.devicePixelRatio);
    // Follows displayed width × pixel ratio, capped at the 400 px source image.
    expect(width).toBe(Math.min(Math.round(cssWidth * Math.min(Math.max(ratio, 1), 3)), 400));
  });
});

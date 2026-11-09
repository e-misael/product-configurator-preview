import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Mobile-first layout (D-058) on the demo build at common phone widths:
 * preview first and sticky, one step open at a time, export last, nothing
 * hidden under the preview band, no horizontal scrolling. Runs in Chromium and
 * WebKit with touch. A real virtual keyboard cannot be emulated; the focused
 * text field is checked against the band instead.
 */

const WIDTHS = [320, 375, 393, 430] as const;
const STEPS = [
  'Modelo e tamanho',
  'Texto e cores',
  'Posição do texto',
  'Revisar personalização',
  'Observação',
];
const FINALIZE = 'Finalizar personalização';

const preview = (page: Page) => page.getByRole('region', { name: 'Pré-visualização' });
const toggle = (page: Page, title: string) =>
  page.getByRole('button', { name: title, exact: true });

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** The element is on screen and below the sticky preview band, not under it. */
async function expectNotObscured(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const hit = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return top !== null && (top === element || element.contains(top) || top.contains(element));
  });
  expect(hit).toBe(true);
}

async function open(page: Page, title: string) {
  const button = toggle(page, title);
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.tap();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
}

for (const width of WIDTHS) {
  test.describe(`${width} px wide`, () => {
    test.use({ viewport: { width, height: width < 375 ? 568 : 760 } });

    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText(/Modo demonstração/)).toBeVisible();
    });

    test('puts the preview first and the steps in order, with export last', async ({ page }) => {
      const order = await page.evaluate(() =>
        [...document.querySelectorAll('.preview__title, .step__title')].map(
          (element) => element.textContent,
        ),
      );
      expect(order).toEqual(['Pré-visualização', ...STEPS, FINALIZE]);
      for (const [index, title] of STEPS.entries()) {
        await expect(toggle(page, title)).toHaveAttribute(
          'aria-expanded',
          index === 0 ? 'true' : 'false',
        );
      }
      // "Finalizar" is always open, with no toggle; its last control ends the page (D-078).
      await expect(toggle(page, FINALIZE)).toHaveCount(0);
      const last = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button')];
        return buttons.at(-1)?.textContent;
      });
      expect(last).toBe('Baixar imagem');
      await expect(page.getByRole('button', { name: /Continuar/ })).toHaveCount(0);
      await expectNoHorizontalScroll(page);
    });

    test('completes a configuration by touch, keeping the preview in view', async ({ page }) => {
      await page
        .getByRole('group', { name: 'Modelo' })
        .getByRole('radio', { name: /Placa cerâmica/ })
        .tap();
      await expect(preview(page).getByRole('img')).toBeVisible();
      await expectNoHorizontalScroll(page);

      await open(page, 'Texto e cores');
      await expect(toggle(page, 'Modelo e tamanho')).toHaveAttribute('aria-expanded', 'false');
      const field = page.getByLabel('Texto', { exact: true });
      await field.fill('O que não cabe\ntransborda.');
      await page
        .getByRole('group', { name: 'Cor do texto' })
        .getByRole('radio', { name: /Letra grafite/ })
        .check();
      await expectNoHorizontalScroll(page);

      await open(page, 'Posição do texto');
      await expect(preview(page)).toHaveClass(/preview--expanded/);
      const right = page.locator('label', {
        has: page.getByRole('radio', { name: 'Alinhar à direita' }),
      });
      await expectNotObscured(right);
      await right.tap();
      await expect(page.getByRole('radio', { name: 'Alinhar à direita' })).toBeChecked();
      const preset = page.getByRole('button', { name: 'Inferior à direita', exact: true });
      await expectNotObscured(preset);
      await preset.tap();
      await expect(preset).toHaveAttribute('aria-pressed', 'true');
      await expectNoHorizontalScroll(page);

      await open(page, 'Revisar personalização');
      await expect(preview(page)).not.toHaveClass(/preview--expanded/);
      const exportButton = page.getByRole('button', { name: 'Baixar imagem' });
      await expect(exportButton).toHaveAttribute('aria-disabled', 'false');
      await expectNotObscured(exportButton);
      // Scrolled to the end, the preview band is still at the top of the screen.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const band = await preview(page).boundingBox();
      expect(band?.y ?? -1).toBeGreaterThanOrEqual(-1);
      expect(band?.y ?? 99).toBeLessThanOrEqual(1);
      await expect(preview(page).getByRole('img')).toBeInViewport();
      await expectNoHorizontalScroll(page);

      const [download] = await Promise.all([page.waitForEvent('download'), exportButton.tap()]);
      expect(download.suggestedFilename()).toBe('taavi-demo-placa-ceramica.png');
    });

    test('separates the review, the note, and "Finalizar" (D-078)', async ({ page }) => {
      const finalize = page.getByRole('region', { name: FINALIZE, exact: true });
      const review = page.getByRole('region', { name: 'Revisar personalização', exact: true });
      // "Finalizar" needs no step opened: disclaimer, status, then the actions.
      await expect(finalize.getByText(/^A pré-visualização é ilustrativa/)).toBeVisible();
      await expect(
        finalize.getByRole('region', { name: 'Situação da configuração' }),
      ).toBeVisible();
      await expect(finalize.getByRole('button', { name: 'Baixar imagem' })).toBeVisible();
      await expectNotObscured(finalize.getByRole('button', { name: 'Baixar imagem' }));
      // The review ends with "Reiniciar configurações".
      await open(page, 'Revisar personalização');
      await expect(review.getByRole('button')).toHaveText([
        /Revisar personalização/,
        'Reiniciar configurações',
      ]);
      await expect(review).not.toContainText(/ilustrativa|Falta escolher|Observação/);
      // Each blocker is said once on the page.
      await expect(page.getByText(/Falta escolher/)).toHaveCount(1);

      // The note: collapsed at first; its text survives closing and reopening.
      const note = page.getByRole('textbox', { name: 'Observação' });
      await expect(toggle(page, 'Observação')).toHaveAttribute('aria-expanded', 'false');
      await expect(note).toBeHidden();
      await open(page, 'Observação');
      await expect(toggle(page, 'Observação')).toBeFocused();
      await expect(review.getByRole('button', { name: 'Reiniciar configurações' })).toBeHidden();
      await note.fill('Presente\nde aniversário');
      await toggle(page, 'Observação').tap();
      await expect(note).toBeHidden();
      await expect(toggle(page, 'Observação')).toBeFocused();
      await open(page, 'Observação');
      await expect(note).toHaveValue('Presente\nde aniversário');
      await expectNoHorizontalScroll(page);
    });

    test('keeps every choice when steps close, and summarizes them', async ({ page }) => {
      await page
        .getByRole('group', { name: 'Modelo' })
        .getByRole('radio', { name: /Quadro/ })
        .tap();
      await open(page, 'Texto e cores');
      await page.getByLabel('Texto', { exact: true }).fill('Ana\nLuz');
      await page
        .getByRole('group', { name: 'Cor do texto' })
        .getByRole('radio', { name: /Letra azul/ })
        .check();
      await open(page, 'Posição do texto');
      await page
        .locator('label', { has: page.getByRole('radio', { name: 'Alinhar à esquerda' }) })
        .tap();

      await open(page, 'Modelo e tamanho');
      await expect(toggle(page, 'Texto e cores')).toHaveAccessibleDescription(
        /Concluído · “ANA” · .*Letra azul/,
      );
      await open(page, 'Texto e cores');
      await expect(page.getByLabel('Texto', { exact: true })).toHaveValue('Ana\nLuz');
      await expect(
        page
          .getByRole('group', { name: 'Cor do texto' })
          .getByRole('radio', { name: /Letra azul/ }),
      ).toBeChecked();
      await open(page, 'Posição do texto');
      await expect(page.getByRole('radio', { name: 'Alinhar à esquerda' })).toBeChecked();
      await open(page, 'Revisar personalização');
      await expect(
        page.locator('.review__summary dt', { hasText: 'Alinhamento' }).locator('+ dd'),
      ).toHaveText('À esquerda');
    });

    test('keeps the text field clear of the reduced band, which does not move on blur', async ({
      page,
    }) => {
      await page
        .getByRole('group', { name: 'Modelo' })
        .getByRole('radio', { name: /Placa cerâmica/ })
        .tap();
      await open(page, 'Texto e cores');
      const field = page.getByLabel('Texto', { exact: true });
      await field.focus();
      await field.pressSequentially('Ana');
      // With the text step open the band is reduced, leaving room for the virtual keyboard.
      await expect(preview(page)).toHaveClass(/preview--reduced/);
      await expect
        .poll(async () => (await preview(page).getByRole('img').boundingBox())?.width ?? 999)
        .toBeLessThanOrEqual(171);
      const band = await preview(page).boundingBox();
      const box = await field.boundingBox();
      expect((box?.y ?? 0) + 1).toBeGreaterThanOrEqual((band?.y ?? 0) + (band?.height ?? 0));
      // Leaving the field (a tap on a color) changes nothing in the layout.
      const swatch = page
        .getByRole('group', { name: 'Cor do texto' })
        .getByRole('radio', { name: /Letra azul/ });
      const onPage = () =>
        swatch.evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
      const before = await onPage();
      await field.blur();
      expect(await onPage()).toBe(before);
    });
  });
}

test('opens and closes steps with the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await page.goto('/');
  const step = toggle(page, 'Posição do texto');
  await step.focus();
  await page.keyboard.press('Enter');
  await expect(step).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText(/Disponível quando o texto aparece/)).toBeVisible();
  await page.keyboard.press('Space');
  await expect(step).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText(/Disponível quando o texto aparece/)).toBeHidden();
});

test.describe('accordion focus and scrolling (WAI-ARIA)', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  /** The header's top is on screen and below the sticky preview band. */
  async function expectHeaderVisible(page: Page, title: string) {
    // Polled: without reduced motion the correction scrolls smoothly.
    await expect
      .poll(async () => {
        const band = await preview(page).boundingBox();
        const header = await toggle(page, title).boundingBox();
        const bandBottom = (band?.y ?? 0) + (band?.height ?? 0);
        return (
          header !== null &&
          header.y >= Math.max(0, bandBottom) - 1 &&
          header.y + header.height <= 667
        );
      })
      .toBe(true);
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('group', { name: 'Modelo' })
      .getByRole('radio', { name: /Placa cerâmica/ })
      .tap();
    await expect(preview(page).getByRole('img')).toBeVisible();
  });

  test('keeps focus on the tapped header and shows it below the preview', async ({ page }) => {
    // Scrolled down inside the long model step, then the next step is opened.
    await toggle(page, 'Texto e cores').scrollIntoViewIfNeeded();
    await toggle(page, 'Texto e cores').tap();
    await expect(toggle(page, 'Texto e cores')).toBeFocused();
    await expect(page.getByLabel('Texto', { exact: true })).not.toBeFocused();
    await expectHeaderVisible(page, 'Texto e cores');

    await page.getByLabel('Texto', { exact: true }).fill('Ana');
    await toggle(page, 'Posição do texto').scrollIntoViewIfNeeded();
    await toggle(page, 'Posição do texto').tap();
    await expect(toggle(page, 'Posição do texto')).toBeFocused();
    // The preview grows for positioning; the header still sits below it.
    await expect(preview(page)).toHaveClass(/preview--expanded/);
    await expectHeaderVisible(page, 'Posição do texto');
  });

  test('keeps focus on the header opened with the keyboard', async ({ page }) => {
    await toggle(page, 'Revisar personalização').focus();
    await page.keyboard.press('Enter');
    await expect(toggle(page, 'Revisar personalização')).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle(page, 'Revisar personalização')).toBeFocused();
    await expectHeaderVisible(page, 'Revisar personalização');
    await expect(toggle(page, 'Revisar personalização')).toHaveAttribute(
      'aria-controls',
      'step-review-body',
    );
  });

  test('does not scroll when the opened header is already in view', async ({ page }) => {
    await toggle(page, 'Modelo e tamanho').tap();
    await toggle(page, 'Texto e cores').scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    await toggle(page, 'Texto e cores').tap();
    await expect(toggle(page, 'Texto e cores')).toHaveAttribute('aria-expanded', 'true');
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });

  test('positions with presets only; the preview scrolls by touch (D-068)', async ({ page }) => {
    await toggle(page, 'Texto e cores').tap();
    await page.getByLabel('Texto', { exact: true }).fill('Ana');
    await toggle(page, 'Posição do texto').tap();
    const canvas = preview(page).locator('canvas');
    await expect(canvas).toHaveCSS('touch-action', 'auto');
    await expect(page.getByRole('radio', { name: 'Ajustar manualmente' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Mover para/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Superior à direita' }).tap();
    await expect(page.getByText('Posição: Superior à direita.')).toBeVisible();
    await toggle(page, 'Revisar personalização').tap();
    await expect(
      page.locator('.review__summary dt', { hasText: 'Posição' }).locator('+ dd'),
    ).toHaveText('Superior à direita');
  });

  test('highlights words with single taps, keeping the preview in view (D-071)', async ({
    page,
  }) => {
    await toggle(page, 'Texto e cores').tap();
    const field = page.getByLabel('Texto', { exact: true });
    await field.fill('Ana e Ana, João!');
    await page
      .getByRole('group', { name: 'Cor do texto' })
      .getByRole('radio', { name: /Letra azul/ })
      .check();
    await page
      .locator('label', { has: page.getByRole('switch', { name: 'Destacar parte(s) do texto' }) })
      .tap();
    await page
      .getByRole('group', { name: 'Cor de destaque' })
      .locator('label', { has: page.getByRole('radio', { name: /Letra vinho/ }) })
      .tap();
    const words = page.getByRole('group', { name: 'Toque nas palavras que deseja destacar' });
    const second = words.getByRole('button', { name: 'ANA (2ª de 2)' });
    const joao = words.getByRole('button', { name: 'JOÃO' });
    await second.scrollIntoViewIfNeeded();
    await second.tap();
    await joao.tap();
    await expect(second).toHaveAttribute('aria-pressed', 'true');
    await expect(joao).toHaveAttribute('aria-pressed', 'true');
    await expect(words.getByRole('button', { name: 'ANA (1ª de 2)' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // Compact tokens: two short lines of words, not a tall list.
    const box = await words.locator('.words').boundingBox();
    expect(box?.height ?? 999).toBeLessThan(120);
    // The preview stays at the top while choosing words.
    const preview = await page.getByRole('region', { name: 'Pré-visualização' }).boundingBox();
    expect(preview?.y ?? 999).toBeLessThan(10);
    await joao.tap();
    await expect(joao).toHaveAttribute('aria-pressed', 'false');
    await expectNoHorizontalScroll(page);
  });
});

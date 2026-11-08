import { expect, test, type Page } from '@playwright/test';

/** Functional flows against the demo build's synthetic catalog (D-028). */

const model = (page: Page, name: RegExp) =>
  page.getByRole('group', { name: 'Modelo' }).getByRole('radio', { name });
const inks = (page: Page, name: string) => page.getByRole('group', { name });
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

test('lists the four models and no ceramic color choice', async ({ page }) => {
  const group = page.getByRole('group', { name: 'Modelo' });
  await expect(group.getByRole('radio')).toHaveCount(4);
  for (const name of [CERAMIC_PLATE, QUADRO, TRAY_8, TRAY_11]) {
    await expect(model(page, name)).toBeVisible();
  }
  await expect(page.getByRole('group', { name: /Cor da/ })).toHaveCount(0);
  await expect(frames(page)).toHaveCount(0);
});

test('completes a configuration @smoke', async ({ page }) => {
  await model(page, CERAMIC_PLATE).check();
  await expect(page.getByRole('group', { name: 'Modelo' })).toContainText('Cor da peça: Bege');

  await frames(page)
    .getByRole('radio', { name: /Moldura clara/ })
    .check();
  await page.getByLabel('Texto', { exact: true }).fill('Casa da Ana\nDesde 2024');
  await expect(page.getByRole('region', { name: 'Situação da configuração' })).toContainText(
    'Falta escolher: Cor do texto.',
  );
  await inks(page, 'Cor do texto')
    .getByRole('radio', { name: /Letra grafite/ })
    .check();

  await expect(page.getByText('Configuração completa.')).toBeVisible();
  const preview = page.getByRole('region', { name: 'Pré-visualização' });
  await expect(preview).toContainText('Casa da Ana');
  await expect(preview).toContainText('Bege');
  await expect(preview.getByRole('img')).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('applies the second color to a keyboard selection without changing the text', async ({
  page,
}) => {
  await model(page, CERAMIC_PLATE).check();
  const field = page.getByLabel('Texto', { exact: true });
  await field.fill('Casa da Ana');
  await inks(page, 'Cor do texto')
    .getByRole('radio', { name: /Letra grafite/ })
    .check();
  const secondary = inks(page, 'Segunda cor (opcional)');
  await expect(secondary.getByRole('radio', { name: /Letra grafite/ })).toBeDisabled();
  await secondary.getByRole('radio', { name: /Letra vinho/ }).check();

  const apply = page.getByRole('button', { name: 'Aplicar segunda cor à seleção' });
  await expect(apply).toBeDisabled();
  await field.focus();
  // Caret at the start (Home is not portable across platforms), then select by keyboard.
  await field.evaluate((element) => (element as HTMLTextAreaElement).setSelectionRange(0, 0));
  for (let i = 0; i < 4; i += 1) await field.press('Shift+ArrowRight');
  await expect(apply).toBeEnabled();
  await apply.click();

  await expect(field).toHaveValue('Casa da Ana');
  await expect(page.getByText('1 trecho com a segunda cor.')).toBeVisible();
  await expect(page.getByText('Configuração completa.')).toBeVisible();

  await secondary.getByRole('radio', { name: 'Sem segunda cor' }).check();
  await expect(apply).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

test('shows the handmade-product disclaimer', async ({ page }) => {
  await expect(page.getByText(/sujeitas à análise da Taavi/)).toBeVisible();
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

import { expect, test, type Page } from '@playwright/test';

/** Functional flows against the demo build's synthetic catalog (D-028). */

const model = (page: Page, name: RegExp) =>
  page.getByRole('group', { name: 'Modelo' }).getByRole('radio', { name });
const inks = (page: Page, name: string) => page.getByRole('group', { name });

const CERAMIC_PLATE = /Placa cerâmica — 10 × 10 cm/;
const QUADRO = /Quadro — 20 × 20 cm/;
const TRAY_8 = /Bandeja ondulada M — 8 × 8 cm/;
const TRAY_11 = /Bandeja ondulada G — 11 × 11 cm/;

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

test('lists the four models, with no ceramic color or frame choice', async ({ page }) => {
  const group = page.getByRole('group', { name: 'Modelo' });
  await expect(group.getByRole('radio')).toHaveCount(4);
  for (const name of [CERAMIC_PLATE, QUADRO, TRAY_8, TRAY_11]) {
    await expect(model(page, name)).toBeVisible();
  }
  await expect(page.getByRole('group', { name: /Cor da/ })).toHaveCount(0);
  for (const name of [CERAMIC_PLATE, QUADRO, TRAY_8, TRAY_11]) {
    await model(page, name).check();
    await expect(page.getByRole('group', { name: /Moldura/ })).toHaveCount(0);
  }
});

test('completes a configuration @smoke', async ({ page }) => {
  await model(page, CERAMIC_PLATE).check();
  await expect(page.getByRole('group', { name: 'Modelo' })).toContainText('Cor da peça: Bege');

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
  const toggle = page.getByRole('button', { name: 'Usar segunda cor' });
  const secondary = inks(page, 'Segunda cor');
  await expect(secondary).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
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

  // Collapsing only hides the options; the color and its trecho stay.
  await toggle.click();
  await expect(apply).toHaveCount(0);
  await expect(page.getByText(/Segunda cor em uso: .*Letra vinho.*\(1 trecho\)/)).toBeVisible();

  await toggle.click();
  await page.getByRole('button', { name: 'Remover segunda cor', exact: true }).click();
  await expect(apply).toHaveCount(0);
  await expect(secondary.getByRole('radio', { name: /Letra vinho/ })).not.toBeChecked();
  await expect(page.getByRole('region', { name: 'Pré-visualização' })).not.toContainText('trecho');
  await expectNoHorizontalScroll(page);
});

test('shows the handmade-product disclaimer', async ({ page }) => {
  for (const paragraph of [
    /^A pré-visualização é ilustrativa\. Como nossas peças são produzidas artesanalmente/,
    /^As cores também podem variar conforme a iluminação/,
    'Todas as solicitações de personalização estão sujeitas à análise e aprovação da Taavi.',
  ]) {
    await expect(page.getByText(paragraph)).toBeVisible();
  }
});

test('the Quadro is one complete product (plate and frame), chosen as a model', async ({
  page,
}) => {
  await model(page, QUADRO).check();

  await expect(model(page, QUADRO)).toBeChecked();
  const preview = page.getByRole('region', { name: 'Pré-visualização' });
  await expect(preview).toContainText('Quadro — 20 × 20 cm');
  await expect(preview).not.toContainText('Moldura');
});

test('is operable with the keyboard', async ({ page }) => {
  await model(page, CERAMIC_PLATE).focus();
  await page.keyboard.press('Space');
  await expect(model(page, CERAMIC_PLATE)).toBeChecked();
  await page.keyboard.press('ArrowDown');
  await expect(model(page, QUADRO)).toBeChecked();
});

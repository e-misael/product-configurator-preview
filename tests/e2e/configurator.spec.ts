import { expect, test, type Page } from '@playwright/test';
import { openStep, step, textField } from './support/steps';

/** Functional flows against the demo build's synthetic catalog (D-028). */

const model = (page: Page, name: RegExp) =>
  page.getByRole('group', { name: 'Modelo' }).getByRole('radio', { name });
const inks = (page: Page, name: string) => page.getByRole('group', { name });

const CERAMIC_PLATE = /Placa cerâmica — 10 × 10 cm/;
const QUADRO = /Quadro — 20 × 20 cm/;
/** The two demo Bandeja sizes are one option with a required "Tamanho" (D-057). */
const TRAYS = /^\(demonstração\) Bandeja ondulada$/;
const sizes = (page: Page) => page.getByRole('group', { name: 'Tamanho' });
/** The summary value for a term, in "Revisar personalização" (D-058). */
async function summary(page: Page, term: string) {
  const review = await step(page, 'Revisar personalização');
  return review.locator('dt', { hasText: term }).locator('+ dd');
}

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
  await expect(group.getByRole('radio')).toHaveCount(3);
  for (const name of [CERAMIC_PLATE, QUADRO, TRAYS]) {
    await expect(model(page, name)).toBeVisible();
  }
  await expect(page.getByRole('group', { name: /Cor da/ })).toHaveCount(0);
  for (const name of [CERAMIC_PLATE, QUADRO, TRAYS]) {
    await model(page, name).check();
    await expect(page.getByRole('group', { name: /Moldura/ })).toHaveCount(0);
  }
  for (const size of ['M — 8 × 8 cm', 'G — 11 × 11 cm']) {
    await sizes(page).getByRole('radio', { name: size }).check();
    await expect(page.getByRole('group', { name: /Moldura/ })).toHaveCount(0);
  }
});

test('groups the Bandejas like production: one option, a required size (D-057)', async ({
  page,
}) => {
  const preview = page.getByRole('region', { name: 'Pré-visualização' });
  await expect(model(page, TRAYS)).toHaveAccessibleDescription('Disponível em dois tamanhos');
  await expect(sizes(page)).toHaveCount(0);

  await model(page, TRAYS).check();
  await expect(sizes(page).getByRole('radio')).toHaveCount(2);
  await expect(sizes(page).getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(preview).toContainText('Selecione o tamanho para visualizar a personalização.');
  await expect(preview.getByRole('img')).toBeVisible();
  await expect(await summary(page, 'Tamanho')).toHaveText('Não escolhido');
  await expect(page.getByRole('region', { name: 'Situação da configuração' })).toContainText(
    'Falta escolher: Tamanho, Texto, Cor do texto.',
  );

  await openStep(page, 'Modelo e tamanho');
  await sizes(page).getByRole('radio', { name: 'M — 8 × 8 cm' }).check();
  await expect(preview.getByRole('img')).toHaveAttribute('aria-label', /Bandeja ondulada M/);
  await expect(await summary(page, 'Tamanho')).toHaveText('M — 8 × 8 cm');
  await expectNoHorizontalScroll(page);
});

test('completes a configuration @smoke', async ({ page }) => {
  await model(page, CERAMIC_PLATE).check();
  await expect(page.getByRole('group', { name: 'Modelo' })).toContainText('Cor da peça: Bege');

  await (await textField(page)).fill('Casa da Ana\nDesde 2024');
  await inks(page, 'Cor do texto')
    .getByRole('radio', { name: /Letra grafite/ })
    .check();
  // The step heading summarizes the step's state (D-058).
  await expect(page.locator('#step-text-summary')).toContainText('Concluído');

  const review = await step(page, 'Revisar personalização');
  await expect(review.getByText('Configuração completa.')).toBeVisible();
  // "Sem serifa" is lettered in capitals (D-068).
  await expect(review).toContainText('CASA DA ANA');
  await expect(review).toContainText('Bege');
  await expect(review.getByRole('button', { name: 'Baixar imagem' })).toHaveAttribute(
    'aria-disabled',
    'false',
  );
  const preview = page.getByRole('region', { name: 'Pré-visualização' });
  await expect(preview.getByRole('img')).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test('highlights several words by tapping them, without changing the text (D-071)', async ({
  page,
}) => {
  await model(page, CERAMIC_PLATE).check();
  const field = await textField(page);
  await field.fill('Casa da Ana');
  await inks(page, 'Cor do texto')
    .getByRole('radio', { name: /Letra grafite/ })
    .check();
  const highlight = page.getByRole('switch', { name: 'Destacar parte(s) do texto' });
  const secondary = inks(page, 'Cor de destaque');
  const words = page.getByRole('group', { name: 'Toque nas palavras que deseja destacar' });
  await expect(highlight).not.toBeChecked();
  await expect(secondary).toHaveCount(0);
  await highlight.check();
  await expect(secondary.getByRole('radio', { name: /Letra grafite/ })).toBeDisabled();
  await secondary.getByRole('radio', { name: /Letra vinho/ }).check();
  await expect(page.getByRole('button', { name: /Aplicar/ })).toHaveCount(0);

  await words.getByRole('button', { name: 'CASA' }).click();
  await words.getByRole('button', { name: 'ANA' }).click();
  await expect(words.getByRole('button', { name: 'CASA' })).toHaveAttribute('aria-pressed', 'true');
  await expect(words.getByRole('button', { name: 'DA' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('2 palavras destacadas.')).toBeVisible();
  await expect(field).toHaveValue('Casa da Ana');
  await expect(await summary(page, 'Destaque')).toHaveText(/Letra vinho: CASA, ANA$/);

  // Off draws one color but keeps the words; on restores them.
  await openStep(page, 'Texto e cores');
  await highlight.uncheck();
  await expect(await summary(page, 'Destaque')).toHaveText('—');
  await openStep(page, 'Texto e cores');
  await highlight.check();
  await expect(words.getByRole('button', { name: 'ANA' })).toHaveAttribute('aria-pressed', 'true');

  // Tapping again restores the primary color.
  await words.getByRole('button', { name: 'CASA' }).click();
  await expect(await summary(page, 'Destaque')).toHaveText(/Letra vinho: ANA$/);
  await expectNoHorizontalScroll(page);
});

test('selects repeated words independently and swaps colors on conflict (D-071)', async ({
  page,
}) => {
  await model(page, CERAMIC_PLATE).check();
  const field = await textField(page);
  await field.fill('Ana e Ana');
  await inks(page, 'Cor do texto')
    .getByRole('radio', { name: /Letra grafite/ })
    .check();
  await page.getByRole('switch', { name: 'Destacar parte(s) do texto' }).check();
  await inks(page, 'Cor de destaque')
    .getByRole('radio', { name: /Letra vinho/ })
    .check();
  const words = page.getByRole('group', { name: 'Toque nas palavras que deseja destacar' });
  await words.getByRole('button', { name: 'ANA (2ª de 2)' }).click();
  await expect(words.getByRole('button', { name: 'ANA (1ª de 2)' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  // The highlight color chosen as the text color: the two are swapped.
  await inks(page, 'Cor do texto')
    .getByRole('radio', { name: /Letra vinho/ })
    .check();
  await expect(
    page.getByText(/^As cores foram trocadas: destaque agora em .*Letra grafite\.$/),
  ).toBeVisible();
  await expect(
    inks(page, 'Cor de destaque').getByRole('radio', { name: /Letra grafite/ }),
  ).toBeChecked();
  await expect(words.getByRole('button', { name: 'ANA (2ª de 2)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(field).toHaveValue('Ana e Ana');
  await expectNoHorizontalScroll(page);
});

test('shows the handmade-product disclaimer in the review, before export', async ({ page }) => {
  const review = await step(page, 'Revisar personalização');
  for (const paragraph of [
    /^A pré-visualização é ilustrativa\. Como nossas peças são produzidas artesanalmente/,
    /^As cores também podem variar conforme a iluminação/,
    'Todas as solicitações de personalização estão sujeitas à análise e aprovação da TAAVI.',
  ]) {
    await expect(review.getByText(paragraph)).toBeVisible();
  }
  const disclaimer = review.getByText(/^Todas as solicitações/);
  const exportButton = review.getByRole('button', { name: 'Baixar imagem' });
  const [text, button] = [await disclaimer.boundingBox(), await exportButton.boundingBox()];
  expect((text?.y ?? 0) < (button?.y ?? 0)).toBe(true);
});

test('shows only the selected text color name; the others are chips', async ({ page }) => {
  await openStep(page, 'Texto e cores');
  const colors = inks(page, 'Cor do texto');
  const ink = colors.getByRole('radio', { name: /Letra grafite/ });
  const label = colors
    .locator('label')
    .filter({ has: page.getByRole('radio', { name: /Letra grafite/ }) });
  await expect(label.getByText(/Letra grafite/)).toHaveClass('visually-hidden');
  await expect(label).toHaveAttribute('title', /Letra grafite/);

  await ink.check();
  await expect(label.getByText(/Letra grafite/)).toBeVisible();
  await expect(colors.locator('.swatch-option__name')).toHaveCount(1);
  await expectNoHorizontalScroll(page);
});

test('takes an optional "Observação" just before export, never required (D-062)', async ({
  page,
}) => {
  await model(page, CERAMIC_PLATE).check();
  await (await textField(page)).fill('Ana');
  await inks(page, 'Cor do texto')
    .getByRole('radio', { name: /Letra grafite/ })
    .check();
  const review = await step(page, 'Revisar personalização');
  const note = review.getByRole('textbox', { name: 'Observação' });
  const exportButton = review.getByRole('button', { name: 'Baixar imagem' });
  await expect(exportButton).toHaveAttribute('aria-disabled', 'false');

  await note.fill('  Entregar até sexta\nObrigada ');
  await expect(note).toHaveValue('  Entregar até sexta\nObrigada ');
  await expect(exportButton).toHaveAttribute('aria-disabled', 'false');
  const [field, button] = [await note.boundingBox(), await exportButton.boundingBox()];
  expect((field?.y ?? 0) < (button?.y ?? 0)).toBe(true);
});

test('the Quadro is one complete product (plate and frame), chosen as a model', async ({
  page,
}) => {
  await model(page, QUADRO).check();

  await expect(model(page, QUADRO)).toBeChecked();
  // Model and size are separate summary rows (D-057).
  await expect(await summary(page, 'Modelo')).toHaveText('(demonstração) Quadro');
  await expect(await summary(page, 'Tamanho')).toHaveText('20 × 20 cm');
  await expect(page.getByRole('region', { name: 'Revisar personalização' })).not.toContainText(
    'Moldura',
  );
});

test('is operable with the keyboard', async ({ page }) => {
  await model(page, CERAMIC_PLATE).focus();
  await page.keyboard.press('Space');
  await expect(model(page, CERAMIC_PLATE)).toBeChecked();
  await page.keyboard.press('ArrowDown');
  await expect(model(page, QUADRO)).toBeChecked();
});

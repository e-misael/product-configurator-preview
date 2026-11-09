import type { Page } from '@playwright/test';

/** The collapsible steps (D-058, D-078): the four customization steps and the note. */
export type StepTitle =
  | 'Modelo e tamanho'
  | 'Texto e cores'
  | 'Posição do texto'
  | 'Revisar personalização'
  | 'Observação';

/**
 * Opens a step on narrow screens, where one step is open at a time. Wide
 * screens show every step open, with no toggle, so nothing is done there.
 */
export async function openStep(page: Page, title: StepTitle): Promise<void> {
  const toggle = page.getByRole('button', { name: title, exact: true });
  if ((await toggle.count()) === 0) return;
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
}

/** The step's region, opened first. */
export async function step(page: Page, title: StepTitle) {
  await openStep(page, title);
  return page.getByRole('region', { name: title, exact: true });
}

/** Checks a model option (and its size, for a grouped model). */
export async function chooseModel(page: Page, name: RegExp, size?: RegExp) {
  await openStep(page, 'Modelo e tamanho');
  await page.getByRole('group', { name: 'Modelo' }).getByRole('radio', { name }).check();
  if (size !== undefined) {
    await page.getByRole('group', { name: 'Tamanho' }).getByRole('radio', { name: size }).check();
  }
}

/** The text field, with its step opened. */
export async function textField(page: Page) {
  await openStep(page, 'Texto e cores');
  return page.getByLabel('Texto', { exact: true });
}

/** "Finalize seu pedido": always open; the order, the status, and the two actions (D-080). */
export function finalize(page: Page) {
  return page.getByRole('region', { name: 'Finalize seu pedido', exact: true });
}

/** The approved disclaimer (D-056), between "Observação" and "Finalize seu pedido" (D-080). */
export function disclaimer(page: Page) {
  return page.locator('.disclaimer');
}

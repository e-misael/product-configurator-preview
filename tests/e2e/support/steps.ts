import type { Page } from '@playwright/test';

/** The four customization steps (D-058). */
export type StepTitle =
  'Modelo e tamanho' | 'Texto e cores' | 'Posição do texto' | 'Revisar personalização';

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

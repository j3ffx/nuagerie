import { expect, test } from '@playwright/test';

const count = (text: string) => Number(/^([\d\s]+) éléments/.exec(text)?.[1]?.replace(/\s/g, ''));

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=1');
  await page.goto('/tout');
  await expect(page.getByText(/20\s000 éléments/)).toBeVisible();
});

test('hides folders from "Tout", remembers it, and shows everything again', async ({ page }) => {
  await page.getByRole('link', { name: 'Filtrer par albums' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Filtrer « Tout »' })).toBeVisible();
  await page.getByRole('button', { name: 'Déplier Albums' }).click();
  await page.getByRole('checkbox', { name: /^Albums/ }).uncheck();
  // Sub-folders go with their parent.
  await expect(page.getByRole('checkbox', { name: /^Animaux/ })).toBeDisabled();
  await expect(page.getByText('masqué avec Albums').first()).toBeVisible();

  await page.getByRole('link', { name: 'Retour à Tout' }).click();
  const summary = page.getByText(/éléments · 1 dossier masqué$/);
  await expect(summary).toBeVisible();
  expect(count(await summary.innerText())).toBeLessThan(20_000);
  await expect(page.getByRole('link', { name: /^Filtrer par albums \(1 masqué\)/ })).toBeVisible();

  await page.reload();
  await expect(summary).toBeVisible();

  await page.getByRole('link', { name: /^Filtrer par albums/ }).click();
  await page.getByRole('button', { name: 'Tout afficher' }).click();
  await page.getByRole('link', { name: 'Retour à Tout' }).click();
  await expect(page.getByText(/^20\s000 éléments$/)).toBeVisible();
});

test('reverses the order, undated items staying last', async ({ page }) => {
  const months = page.getByRole('main').getByRole('heading', { level: 2 });
  await expect(months.first()).toHaveText(/2026$/);
  await page.getByRole('button', { name: /^Ordre : récent d’abord/ }).click();
  await expect(months.first()).toHaveText(/20\d\d$/);
  await expect(months.first()).not.toHaveText(/2026$/);
});

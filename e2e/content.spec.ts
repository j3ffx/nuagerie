import { expect, test, type Page } from '@playwright/test';

const section = (page: Page) => page.getByRole('region', { name: 'Recherche dans les photos' });
const grid = (page: Page) => page.getByRole('main').locator('a[data-item-id]');

test.beforeEach(async ({ page }) => {
  await page.goto('/reglages?demo=1');
  await expect(section(page)).toBeVisible();
});

async function analysed(page: Page) {
  await section(page).getByRole('button', { name: 'Activer' }).click();
  await section(page).getByRole('button', { name: 'Analyser les photos' }).click();
  await expect(section(page).getByText('Toutes tes photos sont analysées')).toBeVisible({
    timeout: 45_000,
  });
}

test('is off by default, and offers nothing in the search until turned on', async ({ page }) => {
  await expect(section(page).getByRole('button', { name: 'Analyser les photos' })).toBeHidden();
  await page.goto('/recherche?demo=1');
  await page.getByRole('searchbox').fill('animaux');
  await expect(page.getByText('Ce que montrent les photos')).toBeHidden();
});

test('analyses the photos, then finds them by what they show, closest first', async ({ page }) => {
  await analysed(page);
  await page.getByRole('link', { name: 'Recherche' }).click();
  await page.getByRole('searchbox').fill('animaux');
  await page.getByRole('link', { name: /Chercher « animaux » dans les photos/ }).click();
  await expect(page).toHaveURL(/contenu=1/);
  await expect(page.getByRole('heading', { name: 'Les plus proches d’abord' })).toBeVisible();
  await expect(grid(page).first()).toBeVisible();
  await expect(page.getByText('120 éléments')).toBeVisible();
});

test('goes to the photos at once when the words match no name', async ({ page }) => {
  await analysed(page);
  await page.getByRole('link', { name: 'Recherche' }).click();
  await page.getByRole('searchbox').fill('gâteau avec des bougies');
  await page.getByRole('searchbox').press('Enter');
  await expect(page).toHaveURL(/contenu=1/);
  await expect(grid(page).first()).toBeVisible();
});

test('turned off, it forgets the analysis', async ({ page }) => {
  await analysed(page);
  await section(page).getByRole('button', { name: 'Désactiver' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Désactiver' }).click();
  await expect(section(page).getByRole('button', { name: 'Activer' })).toBeVisible();
  await page.getByRole('link', { name: 'Recherche' }).click();
  await page.getByRole('searchbox').fill('animaux');
  await expect(page.getByText('Ce que montrent les photos')).toBeHidden();
});

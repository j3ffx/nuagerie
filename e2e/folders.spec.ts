import { expect, test, type Page } from '@playwright/test';

const homeAlbums = (page: Page) => page.getByRole('list', { name: 'Albums' });

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(homeAlbums(page)).toBeVisible();
  await page.goto('/reglages');
});

test('adds a folder outside Pictures, then removes it', async ({ page }) => {
  await page.getByRole('link', { name: 'Choisir les dossiers' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Dossiers' })).toBeVisible();
  // Pictures is the only root: it cannot be removed.
  await expect(page.getByRole('button', { name: 'Retirer Pictures' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Ajouter Pictures' })).toBeHidden();

  // Each folder says what it holds: 40 scans and one subfolder here.
  await page.getByRole('button', { name: /^Ouvrir Documents, 2 éléments · [\d,]+ Mo$/ }).click();
  await expect(page.getByRole('button', { name: /^Ouvrir Scans, 41 éléments · / })).toBeVisible();
  await page.getByRole('button', { name: 'Ajouter Scans' }).click();
  await expect(page.getByText('/Documents/Scans')).toBeVisible();

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page).toHaveURL('/');
  // A root with files of its own is an album; its subfolder is one too.
  await expect(homeAlbums(page).getByText('Scans', { exact: true })).toBeVisible();
  await expect(homeAlbums(page).getByText('Anciennes', { exact: true })).toBeVisible();
  await homeAlbums(page)
    .getByRole('link', { name: /^Scans/ })
    .click();
  await expect(page.getByText(/^40 éléments/)).toBeVisible();

  await page.goto('/reglages');
  await expect(page.getByText('Pictures, Scans')).toBeVisible();
  await page.getByRole('link', { name: 'Choisir les dossiers' }).click();
  await page.getByRole('button', { name: 'Retirer Scans' }).click();
  await expect(page.getByRole('button', { name: 'Retirer Pictures' })).toBeHidden();
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page).toHaveURL('/');
  await expect(homeAlbums(page).getByText('Camera Roll', { exact: true })).toBeVisible();
  await expect(homeAlbums(page).getByText('Scans', { exact: true })).toBeHidden();
});

test('keeps a draft until it is saved', async ({ page }) => {
  await page.getByRole('link', { name: 'Choisir les dossiers' }).click();
  await page.getByRole('button', { name: 'Ajouter Musique' }).click();
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByText('/Musique')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeHidden();
});

test('opens the album choice from the settings and comes back', async ({ page }) => {
  await page.getByRole('link', { name: 'Choisir les albums' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Choisir les albums' })).toBeVisible();
  await page.getByRole('link', { name: 'Retour aux réglages' }).click();
  await expect(page).toHaveURL('/reglages');
});

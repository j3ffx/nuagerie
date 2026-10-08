import { expect, test, type Page } from '@playwright/test';

const homeAlbums = (page: Page) => page.getByRole('list', { name: 'Albums' });
const viewer = (page: Page) => page.getByRole('dialog', { name: 'Visionneuse' });

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(homeAlbums(page)).toBeVisible();
});

test('marks a photo as a favourite, gathered in a Favoris album first on the home screen', async ({
  page,
}) => {
  // No favourite yet: no Favoris album.
  await expect(homeAlbums(page).getByRole('link', { name: /^Favoris/ })).toBeHidden();

  await page.goto('/tout');
  const cell = page.getByRole('main').locator('a[data-item-id]').nth(3);
  const id = await cell.getAttribute('data-item-id');
  await cell.click();
  const heart = viewer(page).getByRole('button', { name: 'Ajouter aux favoris' });
  await heart.click();
  await expect(viewer(page).getByRole('button', { name: 'Retirer des favoris' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('Escape');

  // First tile of the home screen, whatever the sort; kept across a reload.
  await page.goto('/');
  await page.reload();
  const firstTile = homeAlbums(page).getByRole('listitem').first();
  await expect(firstTile).toContainText('Favoris');
  await expect(firstTile).toContainText('1 élément');
  await firstTile.getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Favoris' })).toBeVisible();
  const favorite = page.locator(`main a[data-item-id="${id}"]`);
  await expect(favorite).toBeVisible();

  // Taken out: the album goes.
  await favorite.click();
  await viewer(page).getByRole('button', { name: 'Retirer des favoris' }).click();
  await page.goto('/');
  await expect(homeAlbums(page).getByRole('link', { name: /^Favoris/ })).toBeHidden();
});

test('says in the settings where the favourites are kept', async ({ page }) => {
  await page.goto('/reglages');
  const section = page.getByRole('region', { name: 'Synchronisation' });
  await expect(section).toContainText('sur cet appareil');
  await expect(section).toContainText(
    'En démo, les favoris et les préférences restent sur cet appareil.',
  );
});

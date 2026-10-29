import { expect, test, type Page } from '@playwright/test';

/** Images in the cache of what is kept offline (Cache Storage, apart from the thumbnails). */
const keptImages = (page: Page) =>
  page.evaluate(async () => (await (await caches.open('nuagerie-offline-demo')).keys()).length);

const tile = (page: Page, name: string) =>
  page.getByRole('list', { name: 'Albums' }).getByRole('link', { name: new RegExp(`^${name},`) });
const offlineSection = (page: Page) => page.getByRole('region', { name: 'Hors connexion' });

async function keep(page: Page, name: string) {
  await tile(page, name).click({ button: 'right' });
  const menu = page.getByRole('dialog', { name });
  await expect(menu.getByText(/^≈ [\d,\s]+ [MK]o · 288 éléments$/)).toBeVisible();
  await menu.getByRole('button', { name: /^Garder hors connexion/ }).click();
  await expect(menu).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page.getByRole('list', { name: 'Albums' })).toBeVisible();
});

test('keeps an album offline, marks its tile, and lets it go', async ({ page }) => {
  await keep(page, 'Tapo');
  await expect(tile(page, 'Tapo')).toHaveAccessibleName(/, gardé hors connexion$/);
  await expect(tile(page, 'Messages')).not.toHaveAccessibleName(/gardé hors connexion/);

  await page.goto('/reglages');
  const section = offlineSection(page);
  await expect(section.getByRole('list', { name: 'Gardés hors connexion' })).toHaveText(/Tapo/);
  // A grid thumbnail and a large image for each of the 288 photos.
  await expect(section.getByText(/^[\d,\s]+ [MK]o · 576 images$/)).toBeVisible({ timeout: 30_000 });
  expect(await keptImages(page)).toBe(576);

  // Still kept after a restart, with nothing downloaded again.
  await page.reload();
  await expect(offlineSection(page).getByText(/· 576 images$/)).toBeVisible();
  await expect(offlineSection(page).getByText(/^Téléchargement/)).toHaveCount(0);

  await offlineSection(page).getByRole('button', { name: 'Ne plus garder Tapo' }).click();
  await expect(offlineSection(page).getByText(/^\d+ Ko · 0 image$/)).toBeVisible();
  expect(await keptImages(page)).toBe(0);
  await page.goto('/');
  await expect(tile(page, 'Tapo')).not.toHaveAccessibleName(/gardé hors connexion/);
});

test('opens a kept photo in large offline', async ({ page, context }) => {
  await keep(page, 'Tapo');
  await page.goto('/reglages');
  await expect(offlineSection(page).getByText(/· 576 images$/)).toBeVisible({ timeout: 30_000 });

  await context.setOffline(true);
  await page.goto('/');
  await tile(page, 'Tapo').click();
  await page.getByRole('main').locator('a[data-item-id]').nth(5).click();
  const viewer = page.getByRole('dialog', { name: 'Visionneuse' });
  await expect(viewer.locator('img[data-shown]').first()).toBeVisible();
  await context.setOffline(false);
});

test('waits for Wi-Fi on mobile data, unless told to go on', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', {
      value: Object.assign(new EventTarget(), { type: 'cellular', saveData: false }),
    });
  });
  await page.reload();
  await keep(page, 'Tapo');
  await page.goto('/reglages');
  const section = offlineSection(page);
  await expect(
    section.getByText(/^En attente du Wi-Fi : 576 images à télécharger\.$/),
  ).toBeVisible();
  expect(await keptImages(page)).toBe(0);
  await section.getByRole('button', { name: 'Télécharger quand même' }).click();
  await expect(section.getByText(/· 576 images$/)).toBeVisible({ timeout: 30_000 });
});

test('keeps the favourites, and takes everything back at once', async ({ page }) => {
  await page.goto('/tout');
  await page.getByRole('main').locator('a[data-item-id]').first().click();
  await page.getByRole('button', { name: 'Ajouter aux favoris' }).click();
  await page.goto('/');
  await tile(page, 'Favoris').click({ button: 'right' });
  await page
    .getByRole('dialog', { name: 'Favoris' })
    .getByRole('button', { name: /^Garder hors connexion/ })
    .click();
  await keep(page, 'Tapo');

  await page.goto('/reglages');
  const section = offlineSection(page);
  await expect(section.getByRole('listitem')).toHaveText(['FavorisRetirer', 'TapoRetirer']);
  await expect(section.getByText(/· 578 images$/)).toBeVisible({ timeout: 30_000 });
  await section.getByRole('button', { name: 'Tout retirer' }).click();
  await page
    .getByRole('dialog', { name: 'Ne plus rien garder hors connexion ?' })
    .getByRole('button', { name: 'Tout retirer' })
    .click();
  await expect(section.getByRole('list', { name: 'Gardés hors connexion' })).toHaveCount(0);
  await expect(section.getByText(/· 0 image$/)).toBeVisible();
  expect(await keptImages(page)).toBe(0);
});

const badge = (page: Page) => page.getByRole('button', { name: /^Hors connexion : / });

test('marks a kept album green once all is there, and tells the details', async ({ page }) => {
  await keep(page, 'Tapo');
  await expect(badge(page)).toHaveAccessibleName('Hors connexion : à jour. Voir les détails', {
    timeout: 30_000,
  });
  await expect(badge(page)).toHaveAttribute('data-phase', 'done');
  await badge(page).click();
  const details = page.getByRole('dialog', { name: 'Tapo' });
  await expect(details.getByText('Gardé hors connexion : à jour')).toBeVisible();
  await expect(details.getByText('288 sur 288')).toBeVisible();
  // The badge tells, it does not open the album.
  await expect(page).toHaveURL(/\/$/);
  // Closed, the details give the focus back to the badge.
  await details.getByRole('button', { name: 'Fermer' }).click();
  await expect(badge(page)).toBeFocused();
  await badge(page).click();
  await details.getByRole('button', { name: 'Ne plus garder' }).click();
  await expect(badge(page)).toHaveCount(0);
});

test('marks a kept album blue while waiting for Wi-Fi', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', {
      value: Object.assign(new EventTarget(), { type: 'cellular', saveData: false }),
    });
  });
  await page.reload();
  await keep(page, 'Tapo');
  await expect(badge(page)).toHaveAccessibleName(/en attente du Wi-Fi/);
  await expect(badge(page)).toHaveAttribute('data-phase', 'waiting');
  await badge(page).click();
  await page
    .getByRole('dialog', { name: 'Tapo' })
    .getByRole('button', { name: 'Télécharger quand même' })
    .click();
  await page.getByRole('dialog', { name: 'Tapo' }).getByRole('button', { name: 'Fermer' }).click();
  await expect(badge(page)).toHaveAttribute('data-phase', 'done', { timeout: 30_000 });
});

test('marks a kept album red when the device is full, and says so', async ({ page }) => {
  await page.addInitScript(() => {
    const put = Cache.prototype.put;
    Cache.prototype.put = function (request, response) {
      const url = request instanceof Request ? request.url : String(request);
      return url.includes('/__offline/')
        ? Promise.reject(new DOMException('full', 'QuotaExceededError'))
        : put.call(this, request, response);
    };
  });
  await page.reload();
  await keep(page, 'Tapo');
  await expect(badge(page)).toHaveAttribute('data-phase', 'error', { timeout: 30_000 });
  await expect(badge(page)).toHaveAccessibleName(/non gardées?\. Voir les détails$/);
  await badge(page).click();
  const details = page.getByRole('dialog', { name: 'Tapo' });
  await expect(details.getByText(/il n’y a plus de place sur l’appareil/)).toBeVisible();
  // Trying again would fail the same way.
  await expect(details.getByRole('button', { name: 'Réessayer maintenant' })).toHaveCount(0);
});

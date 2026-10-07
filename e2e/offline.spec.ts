import { expect, test, type Page } from '@playwright/test';

const banner = (page: Page) => page.getByRole('status').filter({ hasText: 'Hors connexion' });
const nav = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale' });

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page.getByRole('list', { name: 'Albums' })).toBeVisible();
});

test('says when the device is offline, and keeps working', async ({ page, context }) => {
  await expect(banner(page)).toBeHidden();
  // As once installed: the app's files, the thumbnail workers too, come from the cache.
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state))
    .toBe('activated');

  await context.setOffline(true);
  await expect(banner(page)).toBeVisible();
  await nav(page).getByRole('link', { name: 'Tout' }).click();
  await expect(page.getByRole('main').locator('a[data-item-id] img').first()).toBeVisible();

  // Hidden on request, until the next time the connection drops.
  await banner(page).getByRole('button', { name: 'Masquer' }).click();
  await expect(banner(page)).toBeHidden();
  await context.setOffline(false);
  await context.setOffline(true);
  await expect(banner(page)).toBeVisible();

  await context.setOffline(false);
  await expect(banner(page)).toBeHidden();
});

test('crosses out sharing and saving in the viewer while offline', async ({ page, context }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: () => true });
    Object.defineProperty(navigator, 'share', { value: async () => undefined });
  });
  await page.goto('/tout');
  await page.getByRole('main').locator('a[data-item-id]').first().click();
  const viewer = page.getByRole('dialog', { name: 'Visionneuse' });
  await expect(viewer.getByRole('button', { name: 'Télécharger' })).toBeEnabled();

  await context.setOffline(true);
  await expect(viewer.getByRole('button', { name: 'Partager (hors connexion)' })).toBeDisabled();
  await expect(viewer.getByRole('button', { name: 'Télécharger (hors connexion)' })).toBeDisabled();

  await context.setOffline(false);
  await expect(viewer.getByRole('button', { name: 'Partager' })).toBeEnabled();
  await expect(viewer.getByRole('button', { name: 'Télécharger' })).toBeEnabled();
});

test('starts with no network once installed', async ({ page, context }) => {
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state))
    .toBe('activated');

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('list', { name: 'Albums' })).toBeVisible();
  await expect(banner(page)).toBeVisible();
  await page.goto('/tout');
  await expect(page.getByRole('heading', { level: 1, name: 'Tout' })).toBeVisible();
});

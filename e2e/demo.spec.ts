import { expect, test, type Page } from '@playwright/test';

/** Fails the test on any console error or uncaught exception. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Navigation principale' });

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=1');
});

test('shows the demo albums on the home screen', async ({ page }) => {
  const errors = trackErrors(page);
  await page.reload();

  await expect(page.getByRole('heading', { level: 1, name: 'Albums' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Mode démo/ })).toBeVisible();
  const albums = page.getByRole('list', { name: 'Albums' });
  await expect(albums.getByText('Camera Roll', { exact: true })).toBeVisible();
  await expect(albums.getByText('Événements', { exact: true })).toBeVisible();
  expect(await albums.getByRole('listitem').count()).toBeGreaterThanOrEqual(10);
  // The demo flag is consumed and removed from the URL.
  expect(new URL(page.url()).search).toBe('');
  expect(errors).toEqual([]);
});

test('navigates between the four main screens', async ({ page }) => {
  for (const [label, path, heading] of [
    ['Tout', '/tout', 'Tout'],
    ['Carte', '/carte', 'Carte'],
    ['Réglages', '/reglages', 'Réglages'],
    ['Albums', '/', 'Albums'],
  ] as const) {
    await nav(page).getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(nav(page).getByRole('link', { name: label })).toHaveAttribute(
      'aria-current',
      'page',
    );
  }
});

test('shows every item grouped by month', async ({ page }) => {
  await page.goto('/tout');
  await expect(page.getByText(/20\s000 éléments/)).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText(
    /^\p{Lu}\p{Ll}+ \d{4}$/u,
  );
  const first = page
    .getByRole('main')
    .getByRole('img', { name: /^(Photo|Vidéo)/ })
    .first();
  await expect(first).toHaveAttribute('alt', /^(Photo|Vidéo) du \d{1,2} \S+ \d{4}$/);
  await expect(first).toHaveJSProperty('complete', true);
});

test('counts geotagged photos on the map placeholder', async ({ page }) => {
  await page.goto('/carte');
  await expect(page.getByText(/[\d\s]+ photos géolocalisées/)).toBeVisible();
});

test('remembers the theme across reloads', async ({ page }) => {
  await page.goto('/reglages');
  await page.getByText('Sombre', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radio', { name: 'Sombre' })).toBeChecked();
});

test('redirects unknown routes to the albums', async ({ page }) => {
  await page.goto('/nulle-part');
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Albums' })).toBeVisible();
});

test('keeps touch targets at least 44 px', async ({ page }) => {
  for (const link of await nav(page).getByRole('link').all()) {
    const box = await link.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
});

test('is an installable PWA with an active service worker', async ({ page }) => {
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  const json = (await manifest.json()) as { name: string; lang: string; icons: unknown[] };
  expect(json.name).toBe('Nuagerie');
  expect(json.lang).toBe('fr');
  expect(json.icons.length).toBeGreaterThanOrEqual(3);

  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state))
    .toBe('activated');
});

test('checks for updates on demand and reports when up to date', async ({ page }) => {
  await page.goto('/reglages');
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state))
    .toBe('activated');
  await page.getByRole('button', { name: 'Rechercher une mise à jour' }).click();
  await expect(page.getByText('à jour', { exact: true })).toBeVisible();
});

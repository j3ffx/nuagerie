import { expect, test, type Page } from '@playwright/test';

/** A 1×1 PNG instead of OpenStreetMap tiles: the tests do not depend on (or load) their servers. */
const TILE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const markers = (page: Page) => page.locator('.leaflet-marker-icon');
const zoneTitle = (page: Page) => page.locator('#map-zone');
const zoneCount = async (page: Page) =>
  Number((await zoneTitle(page).innerText()).replace(/\s/g, '').match(/^\d+/)?.[0]);

test.beforeEach(async ({ page }) => {
  await page.route('**/tile.openstreetmap.org/**', (route) =>
    route.fulfill({ body: TILE, contentType: 'image/png' }),
  );
  await page.goto('/?demo=1');
  await page.goto('/carte');
  await expect(markers(page).first()).toBeVisible();
});

test('groups the photos by place, and zooms into a group', async ({ page }) => {
  await expect(zoneTitle(page)).toHaveText(/^[\d\s]+ photos dans cette zone$/);
  await expect(page.getByText('contributeurs OpenStreetMap')).toBeVisible();
  const before = await zoneCount(page);
  // The group with the most photos.
  const counts = await markers(page).evaluateAll((icons) =>
    icons.map((icon) => Number(icon.textContent?.replace(/\s/g, '') || 0)),
  );
  await markers(page)
    .nth(counts.indexOf(Math.max(...counts)))
    .click();
  await expect.poll(() => zoneCount(page)).toBeLessThan(before);
});

test('opens a photo of the zone, then its place on the map, with a link to Maps', async ({
  page,
}) => {
  await page.locator('section[aria-labelledby="map-zone"] ul a').first().click();
  const viewer = page.getByRole('dialog', { name: 'Visionneuse' });
  await expect(viewer).toBeVisible();
  // Swiping goes through the zone's photos.
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/photo=/);

  // Not every photo of the strip shows a place before the list loads: wait for one.
  const place = viewer.locator('footer a');
  for (let i = 0; i < 20 && !(await place.isVisible()); i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
  }
  await place.click();
  await expect(page).toHaveURL(/\/carte\?focus=/);
  await expect(viewer).toBeHidden();
  await expect(page.getByRole('link', { name: 'Ouvrir dans Maps' })).toHaveAttribute(
    'href',
    /^geo:-?\d+\.\d+,-?\d+\.\d+\?q=/,
  );
});

test('lists every photo of the zone in a grid', async ({ page }) => {
  const count = await zoneCount(page);
  await page.getByRole('link', { name: 'Tout voir' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Photos de la zone' })).toBeVisible();
  await expect(page.getByText(/^[\d\s]+ éléments$/)).toHaveText(
    new RegExp(`^${count.toLocaleString('fr-FR').replace(/\s/g, '\\s')} éléments$`),
  );
  await page.getByRole('link', { name: 'Retour à la carte' }).click();
  await expect(markers(page).first()).toBeVisible();
});

test('shares the folder filter of "Tout"', async ({ page }) => {
  const before = await zoneCount(page);
  await page.getByRole('link', { name: 'Filtrer par albums' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Filtrer la carte' })).toBeVisible();
  await page.getByRole('checkbox', { name: /^Camera Roll/ }).uncheck();
  await page.getByRole('link', { name: 'Retour à la carte' }).click();
  await expect.poll(() => zoneCount(page)).toBeLessThan(before);
  await expect(page.getByRole('link', { name: /^Filtrer par albums \(1 masqué\)/ })).toBeVisible();
});

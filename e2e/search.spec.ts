import { expect, test, type Page } from '@playwright/test';

const count = (text: string) => Number(/^([\d\s]+) éléments?/.exec(text)?.[1]?.replace(/\s/g, ''));
const grid = (page: Page) => page.getByRole('main').locator('a[data-item-id]');
const field = (page: Page) => page.getByRole('searchbox', { name: /^Rechercher/ });
/** Finding the places of 8,000 photos takes a few seconds while other tests run. */
const PLACES = { timeout: 20_000 };
/** The start screen's town chips appear once the places of the photos are known. */
const lyonChip = (page: Page) =>
  page.getByRole('region', { name: 'Lieux' }).getByRole('link', { name: /^Lyon,/ });

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page.getByRole('list', { name: 'Albums' })).toBeVisible();
});

test('opens from the bar, ready to type, with places and years to start from', async ({ page }) => {
  await page.getByRole('link', { name: 'Recherche' }).click();
  await expect(page).toHaveURL(/\/recherche$/);
  await expect(field(page)).toBeFocused();
  await expect(lyonChip(page)).toBeVisible(PLACES);
  await expect(
    page.getByRole('region', { name: 'Pays' }).getByRole('link', { name: /^France,/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Années' }).getByRole('link', { name: /^2026,/ }),
  ).toBeVisible();
  // "Lyon 01"… "Lyon 09" are districts of one town.
  await expect(page.getByRole('link', { name: /^Lyon 0\d/ })).toHaveCount(0);

  await page
    .getByRole('region', { name: 'Années' })
    .getByRole('link', { name: /^2019,/ })
    .click();
  await expect(page).toHaveURL(/q=2019/);
  await expect(page.getByText(/éléments · 2019$/)).toBeVisible();
  await expect(
    page.getByRole('main').getByRole('heading', { level: 2, name: /2019$/ }).first(),
  ).toBeVisible();
});

test('crosses a place and a period, narrows to a town, and goes back step by step', async ({
  page,
}) => {
  await page.goto('/recherche');
  await expect(lyonChip(page)).toBeVisible(PLACES);
  await field(page).fill('lyon été 2023');
  const suggestion = page
    .getByRole('region', { name: 'Lieux' })
    .getByRole('link', { name: /^Lyon, France, Été 2023 · \d+ éléments$/ });
  await expect(suggestion).toBeVisible();
  await expect(page.getByRole('link', { name: /^Tout pour « lyon été 2023 »/ })).toBeVisible();

  await field(page).press('Enter');
  await expect(page).toHaveURL(/q=lyon\+%C3%A9t%C3%A9\+2023$/);
  const summary = page.getByText(/éléments · Été 2023$/);
  await expect(summary).toBeVisible();
  const all = count(await summary.innerText());
  expect(all).toBeGreaterThan(0);
  // Every photo is from that summer.
  const months = page.getByRole('main').getByRole('heading', { level: 2, name: /\d{4}$/ });
  await expect(months.first()).toHaveText(/^(Juin|Juillet|Août) 2023$/);

  // The places in the results narrow them down.
  const places = page.getByRole('region', { name: 'Lieux dans ces résultats' });
  await places.getByRole('link', { name: /^Lyon,/ }).click();
  await expect(page.getByRole('link', { name: 'Retirer le lieu Lyon, France' })).toBeVisible();
  await expect(places).toHaveCount(0);
  const narrowed = count(await summary.innerText());
  expect(narrowed).toBeGreaterThan(0);
  expect(narrowed).toBeLessThanOrEqual(all);

  // The viewer opens on top; back closes it, then undoes the town, then the search.
  await grid(page).first().click();
  await expect(page.getByRole('dialog', { name: 'Visionneuse' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Visionneuse' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Retirer le lieu Lyon, France' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('link', { name: 'Retirer le lieu Lyon, France' })).toHaveCount(0);
  await expect(field(page)).toHaveValue('lyon été 2023');
  await page.goBack();
  await expect(field(page)).toHaveValue('');

  // Both searches are remembered, the latest first.
  const recent = page.getByRole('region', { name: 'Récentes' }).getByRole('link');
  await expect(recent).toHaveCount(2);
  await expect(recent.first()).toHaveAccessibleName(/^Lyon · Été 2023/);
  await expect(recent.nth(1)).toHaveAccessibleName(/^lyon · Été 2023/);
  await page.reload();
  await expect(recent).toHaveCount(2);
  await recent.first().click();
  await expect(page.getByRole('link', { name: 'Retirer le lieu Lyon, France' })).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: 'Effacer' }).click();
  await expect(page.getByRole('region', { name: 'Récentes' })).toHaveCount(0);
});

test('finds an album by name, sub-albums included, and leaves it', async ({ page }) => {
  await page.goto('/recherche');
  await field(page).fill('mariage');
  const album = page
    .getByRole('region', { name: 'Albums' })
    .getByRole('link', { name: /^2025-08-23 - Mariage, Événements · \d+ éléments$/ });
  await album.click();
  await expect(page).toHaveURL(/album=/);
  const chip = page.getByRole('link', { name: 'Retirer l’album 2025-08-23 - Mariage' });
  await expect(chip).toBeVisible();
  await expect(field(page)).toHaveValue('');
  const summary = page.getByText(/^\d+ éléments$/);
  const found = count(await summary.innerText());

  // The album page shows its own photos only; the search adds its sub-albums'.
  await page.goto('/');
  await page
    .getByRole('list', { name: 'Albums' })
    .getByRole('link', { name: /^Événements/ })
    .click();
  await page.getByRole('link', { name: /Mariage/ }).click();
  const own = count(await page.getByText(/^\d+ éléments · /).innerText());
  expect(found).toBeGreaterThan(own);

  for (let step = 0; step < 3; step++) await page.goBack();
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(page).toHaveURL(/\/recherche$/);
});

test('reads a day of the year, and a word that is also an album name', async ({ page }) => {
  await page.goto('/recherche');
  await field(page).fill('14 juillet 2023');
  await page.getByRole('link', { name: /^14 juillet 2023, \d+ éléments$/ }).click();
  await expect(page.getByText(/éléments · 14 juillet 2023$/)).toBeVisible();
  await grid(page).first().click();
  await expect(
    page.getByRole('dialog', { name: 'Visionneuse' }).getByText(/14 juillet 2023/),
  ).toBeVisible();
  await page.goBack();

  // "Printemps" is a season, and a word of "2017-04 - Printemps à Kyoto".
  await field(page).fill('printemps');
  await expect(page.getByRole('link', { name: /^Printemps, chaque année/ })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Albums' }).getByRole('link', { name: /Printemps à Kyoto/ }),
  ).toBeVisible();
});

test('says when nothing fits', async ({ page }) => {
  await page.goto('/recherche');
  await field(page).fill('zanzibar');
  await expect(page.getByText(/^Rien ne correspond à « zanzibar »/)).toBeVisible();
  await page.getByRole('button', { name: 'Effacer la recherche' }).click();
  await expect(field(page)).toHaveValue('');
  await expect(field(page)).toBeFocused();
});

test('keeps the places it found: no place list needed the next time', async ({ page }) => {
  await page.goto('/recherche');
  await expect(lyonChip(page)).toBeVisible(PLACES);
  await expect(page.getByText('Recherche des lieux de tes photos…')).toHaveCount(0, PLACES);

  await page.route('**/places/**', (route) => route.abort());
  await page.reload();
  await expect(lyonChip(page)).toBeVisible(PLACES);
  await field(page).fill('lyon');
  await expect(
    page.getByRole('region', { name: 'Lieux' }).getByRole('link', { name: /^Lyon, France/ }),
  ).toBeVisible();
});

test('says when places cannot be found, and still searches albums and dates', async ({ page }) => {
  await page.route('**/places/**', (route) => route.abort());
  await page.goto('/recherche');
  await expect(page.getByText(/^Lieux indisponibles hors connexion/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Lieux' })).toHaveCount(0);
  await field(page).fill('mariage 2025');
  await expect(page.getByRole('link', { name: /^Tout pour « mariage 2025 »/ })).toBeVisible();
});

test('fits five tabs on a 360 px screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  const tabs = page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link');
  await expect(tabs).toHaveCount(5);
  for (const tab of await tabs.all()) {
    const fits = await tab.evaluate((link) => {
      const label = link.lastElementChild as HTMLElement;
      return label.scrollWidth <= label.clientWidth && link.getBoundingClientRect().height >= 44;
    });
    expect(fits, await tab.innerText()).toBe(true);
  }
});

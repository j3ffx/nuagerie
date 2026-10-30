import { expect, test, type Page } from '@playwright/test';

// A fixed day and time zone: the demo is generated up to "now", so the memories are the same
// at every run.
test.use({ timezoneId: 'Europe/Paris' });
const TODAY = new Date('2026-10-28T10:00:00+01:00');

const section = (page: Page) => page.getByRole('region', { name: 'Souvenirs' });
const cards = (page: Page) => section(page).getByRole('link', { name: /^Il y a \d+ ans?, / });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TODAY);
  await page.goto('/?demo=1');
  await expect(page.getByRole('list', { name: 'Albums' })).toBeVisible();
});

test('shows the memories of the day above the albums, one card a year', async ({ page }) => {
  await expect(section(page)).toBeVisible();
  const count = await cards(page).count();
  expect(count).toBeGreaterThan(1);
  // The most recent year first, each on this day.
  const names = await cards(page).allInnerTexts();
  const years = names.map((name) => Number(/(\d+) ans?/.exec(name)?.[1]));
  expect([...years].sort((a, b) => a - b)).toEqual(years);
  await expect(cards(page).first()).toHaveAccessibleName(
    /^Il y a \d+ ans?, 28 octobre 20\d\d, \d+ éléments?$/,
  );

  // A year's card opens all of today's memories, not just that year.
  await cards(page).nth(1).click();
  await expect(page).toHaveURL(/\/souvenirs$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Souvenirs' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveCount(count);
  // The albums tab stays the current one.
  await expect(
    page
      .getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('link', { name: 'Albums' }),
  ).toHaveAttribute('aria-current', 'page');

  // The viewer opens on top, and back comes back here, then to the albums.
  await page.getByRole('main').locator('a[data-item-id]').first().click();
  await expect(page.getByRole('dialog', { name: 'Visionneuse' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog', { name: 'Visionneuse' })).toHaveCount(0);
  await page.goBack();
  await expect(section(page)).toBeVisible();
});

test('opens the memories from anywhere on their panel, which stands out', async ({ page }) => {
  const panel = await section(page).evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      page: getComputedStyle(document.body).backgroundColor,
    };
  });
  expect(panel.background).not.toBe(panel.page);
  await section(page).getByRole('heading', { name: 'Souvenirs' }).click();
  await expect(page).toHaveURL(/\/souvenirs$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Souvenirs' })).toBeVisible();
});

test('shows one year alone from a link to it', async ({ page }) => {
  const name =
    (await cards(page).first().getAttribute('aria-label')) ??
    (await cards(page).first().innerText());
  const year = /20\d\d/.exec(name)?.[0];
  await page.goto(`/souvenirs?annee=${year}`);
  await expect(page.getByRole('heading', { level: 1, name: /^Il y a \d+ ans?$/ })).toBeVisible();
  await expect(page.getByText(/^28 octobre · \d+ éléments?$/)).toBeVisible();
  const months = page.getByRole('main').getByRole('heading', { level: 2 });
  await expect(months).toHaveCount(1);
  await expect(months.first()).toHaveText(`Octobre ${year}`);
});

test('shows every year of the day together', async ({ page }) => {
  const count = await cards(page).count();
  await section(page).getByRole('link', { name: 'Tout voir' }).click();
  await expect(page).toHaveURL(/\/souvenirs$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Souvenirs' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveCount(count);
});

test('closes the memories for the day only', async ({ page }) => {
  await section(page).getByRole('button', { name: 'Fermer les souvenirs jusqu’à demain' }).click();
  await expect(section(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('list', { name: 'Albums' })).toBeVisible();
  await expect(section(page)).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('nuagerie.memories.closedOn'))).toBe(
    '"2026-10-28"',
  );
  // Still there from the notification or a link.
  await page.goto('/souvenirs');
  await expect(page.getByRole('main').locator('a[data-item-id]').first()).toBeVisible();

  // The next day, they come back.
  await page.clock.setFixedTime(new Date('2026-10-29T09:00:00+01:00'));
  await page.goto('/');
  await expect(section(page)).toBeVisible();
});

test('shows every memory of today for a year without any (a link from another day)', async ({
  page,
}) => {
  const count = await cards(page).count();
  await page.goto('/souvenirs?annee=2001');
  await expect(page.getByRole('heading', { level: 1, name: 'Souvenirs' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveCount(count);
});

test('moves the focus on to the sort when the memories close', async ({ page }) => {
  await section(page).getByRole('button', { name: 'Fermer les souvenirs jusqu’à demain' }).focus();
  await page.keyboard.press('Enter');
  await expect(section(page)).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Trier les albums par' })).toBeFocused();
});

test('explains the morning notification, off in the demo', async ({ page }) => {
  await page.goto('/reglages');
  const memories = page.getByRole('region', { name: 'Souvenirs' });
  await expect(memories.getByText(/jamais avant 8 h/)).toBeVisible();
  await expect(memories.getByText(/^En démo, pas de notification/)).toBeVisible();
  await expect(memories.getByRole('button')).toHaveCount(0);
});

test('fits the cards on a 360 px screen, text included', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  const clipped = await section(page).evaluate((element) =>
    [...element.querySelectorAll('a span')]
      .filter((span) => span.children.length === 0 && span.scrollWidth > span.clientWidth + 1)
      .map((span) => span.textContent),
  );
  expect(clipped).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
});

test('renews the memories at midnight, for an app left open', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-10-28T23:58:00+01:00') });
  await page.goto('/?demo=1');
  await expect(section(page)).toBeVisible();
  await section(page).getByRole('button', { name: 'Fermer les souvenirs jusqu’à demain' }).click();
  await expect(section(page)).toHaveCount(0);
  await page.clock.fastForward('05:00');
  await expect(section(page)).toBeVisible();
  await expect(cards(page).first()).toHaveAccessibleName(/, 29 octobre 20\d\d, /);
  await context.close();
});

test('renews at midnight on the day clocks go back, 25 hours long', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  const page = await context.newPage();
  // Sunday 25 October 2026: at 3:00 summer time, it is 2:00 again.
  await page.clock.install({ time: new Date('2026-10-25T01:00:00+02:00') });
  await page.goto('/?demo=1');
  await expect(page.getByRole('list', { name: 'Albums' })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('nuagerie.memories.closedOn', '"2026-10-25"'));
  await page.reload();
  await expect(page.getByRole('list', { name: 'Albums' })).toBeVisible();
  await expect(section(page)).toHaveCount(0);
  // 23 hours later it is 23:00 the same day: still closed, and the next midnight still counts.
  await page.clock.fastForward('23:00:00');
  await expect(section(page)).toHaveCount(0);
  await page.clock.fastForward('01:30:00');
  await expect(section(page)).toBeVisible();
  await expect(cards(page).first()).toHaveAccessibleName(/, 26 octobre 20\d\d, /);
  await context.close();
});

/** The day the service worker will not tell about (src/data/memoryNotifier.ts). */
const toldOn = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const open = indexedDB.open('nuagerie-memories', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('state');
        open.onsuccess = () => {
          const get = open.result.transaction('state').objectStore('state').get('notifiedOn');
          get.onsuccess = () => {
            open.result.close();
            resolve(get.result ?? null);
          };
        };
      }),
  );

test('needs no notification once the memories were seen', async ({ page }) => {
  // Shown on the albums: seen.
  await expect(section(page)).toBeVisible();
  await expect.poll(() => toldOn(page)).toBe('2026-10-28');
});

test('needs no notification once the memories were closed, even unseen', async ({ page }) => {
  // Closed on another device (the sync brings the day) before this one showed them.
  await page.evaluate(() => localStorage.setItem('nuagerie.memories.closedOn', '"2026-10-28"'));
  await page.evaluate(() => indexedDB.deleteDatabase('nuagerie-memories'));
  await page.goto('/reglages');
  await expect.poll(() => toldOn(page)).toBe('2026-10-28');
});

import { expect, test, type Locator, type Page } from '@playwright/test';

const cells = (page: Page) => page.getByRole('main').locator('a[data-item-id]');
const bar = (page: Page) => page.getByRole('toolbar', { name: 'Sélection' });

/** A finger held on an element, then moved over another one if given (DevTools protocol). */
async function longPress(page: Page, on: Locator, dragTo?: Locator) {
  const from = await on.boundingBox();
  if (!from) throw new Error('nothing to press');
  const point = (box: { x: number; y: number; width: number; height: number }) => ({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    id: 0,
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(from)] });
  await page.waitForTimeout(700);
  if (dragTo) {
    const to = await dragTo.boundingBox();
    if (!to) throw new Error('nowhere to drag');
    const a = point(from);
    const b = point(to);
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: a.x + ((b.x - a.x) * i) / 8, y: a.y + ((b.y - a.y) * i) / 8, id: 0 }],
      });
    }
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=1');
  await page.goto('/tout');
  await expect(cells(page).first().locator('img')).toBeVisible();
});

test('a long press starts picking photos; taps add them; back ends it', async ({ page }) => {
  await longPress(page, cells(page).nth(1));
  await expect(bar(page)).toBeVisible();
  await expect(bar(page)).toContainText('1 sélectionné');
  await expect(cells(page).nth(1)).toHaveAttribute('aria-checked', 'true');
  // The viewer did not open.
  expect(new URL(page.url()).searchParams.get('photo')).toBeNull();

  await cells(page).nth(3).click();
  await expect(bar(page)).toContainText('2 sélectionnés');
  await cells(page).nth(3).click();
  await expect(bar(page)).toContainText('1 sélectionné');

  // A month's round box takes the whole month; a photo less makes it "mixed".
  const month = page
    .getByRole('main')
    .getByRole('checkbox', { name: /^Tout le mois/ })
    .first();
  await expect(month).toHaveAttribute('aria-checked', 'mixed');
  await month.click();
  await expect(month).toHaveAttribute('aria-checked', 'true');
  await expect(bar(page)).toContainText(/\d{2,} sélectionnés/);
  await cells(page).nth(0).click();
  await expect(month).toHaveAttribute('aria-checked', 'mixed');

  await page.goBack();
  await expect(bar(page)).toBeHidden();
  await expect(page).toHaveURL(/\/tout$/);
  // Taps open photos again.
  await cells(page).nth(1).click();
  await expect(page.getByRole('dialog', { name: 'Visionneuse' })).toBeVisible();
});

test('dragging after a long press picks every photo on the way', async ({ page }) => {
  await longPress(page, cells(page).nth(0), cells(page).nth(9));
  await expect(bar(page)).toContainText('10 sélectionnés');
  await bar(page).getByRole('button', { name: 'Annuler la sélection' }).click();
  await expect(bar(page)).toBeHidden();
});

test('adds the picked photos to the favourites at once', async ({ page }) => {
  const ids = await Promise.all(
    [0, 1, 2].map((i) => cells(page).nth(i).getAttribute('data-item-id')),
  );
  await longPress(page, cells(page).nth(0));
  await cells(page).nth(1).click();
  await cells(page).nth(2).click();
  await bar(page).getByRole('button', { name: 'Ajouter aux favoris' }).click();
  await expect(bar(page)).toBeHidden();

  await page.goto('/favoris');
  for (const id of ids) await expect(page.locator(`main a[data-item-id="${id}"]`)).toBeVisible();
});

test('asks before sharing many photos, and can share them anyway', async ({ page }) => {
  await page.addInitScript(() => {
    const shared: number[] = [];
    Object.assign(window, { shared });
    Object.defineProperty(navigator, 'canShare', { value: () => true });
    Object.defineProperty(navigator, 'share', {
      value: async ({ files }: { files: File[] }) => {
        shared.push(files.length);
      },
    });
  });
  await page.reload();
  await expect(cells(page).first().locator('img')).toBeVisible();
  await longPress(page, cells(page).nth(0));
  await page
    .getByRole('main')
    .getByRole('checkbox', { name: /^Tout le mois/ })
    .first()
    .click();
  const count = Number((await bar(page).getByRole('status').textContent())?.match(/\d+/)?.[0]);
  test.skip(count <= 30, 'the first month of the demo has 30 photos or fewer');

  await bar(page).getByRole('button', { name: 'Partager' }).click();
  const dialog = page.getByRole('dialog', { name: /^Partager \d+ éléments/ });
  await expect(dialog).toContainText('ça peut être très long, ou échouer');
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(bar(page)).toBeVisible();

  await bar(page).getByRole('button', { name: 'Partager' }).click();
  await dialog.getByRole('button', { name: 'Partager quand même' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { shared: number[] }).shared), {
      timeout: 30_000,
    })
    .toEqual([expect.any(Number)]);
  await expect(bar(page)).toBeHidden();
});

test('dragging onto the bottom bar scrolls on and keeps picking; back up, it stops', async ({
  page,
}) => {
  const cdp = await page.context().newCDPSession(page);
  const first = await cells(page).nth(4).boundingBox();
  if (!first) throw new Error('no cell');
  const touch = (type: 'touchStart' | 'touchMove', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [{ x, y, id: 0 }] });
  const x = first.x + first.width / 2;
  await touch('touchStart', x, first.y + first.height / 2);
  await page.waitForTimeout(700);
  await expect(bar(page)).toContainText('1 sélectionné');

  // Down onto the navigation bar, and held there.
  const height = await page.evaluate(() => window.innerHeight);
  for (let y = first.y + first.height / 2; y < height - 15; y += 40) await touch('touchMove', x, y);
  await touch('touchMove', x, height - 15);
  const count = async () =>
    Number((await bar(page).getByRole('status').textContent())?.match(/\d+/)?.[0] ?? 0);
  const scrolled = () => page.evaluate(() => window.scrollY);
  await expect.poll(scrolled).toBeGreaterThan(300);
  const before = await count();
  await expect.poll(count).toBeGreaterThan(before);
  // Far enough that the row the finger started on is well off screen.
  await expect.poll(scrolled, { timeout: 15_000 }).toBeGreaterThan(3000);

  // Back to the middle of the screen: the page stops.
  await touch('touchMove', x, height / 2);
  await page.waitForTimeout(200);
  const stopped = await scrolled();
  await page.waitForTimeout(400);
  expect(await scrolled()).toBe(stopped);

  // Down again, then the finger lifts over the bar: the page stops there too.
  await touch('touchMove', x, height - 15);
  await expect.poll(scrolled).toBeGreaterThan(stopped + 200);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  const lifted = await scrolled();
  await page.waitForTimeout(400);
  expect(await scrolled()).toBe(lifted);
  await expect(bar(page)).toBeVisible();
});

test('a long press works in the Favoris album too', async ({ page }) => {
  for (const i of [0, 1]) {
    await cells(page).nth(i).click();
    await page.getByRole('button', { name: 'Ajouter aux favoris' }).click();
    await page.keyboard.press('Escape');
  }
  await page.goto('/favoris');
  await expect(cells(page)).toHaveCount(2);
  await longPress(page, cells(page).first());
  await expect(bar(page)).toContainText('1 sélectionné');
  await cells(page).nth(1).click();
  await expect(bar(page)).toContainText('2 sélectionnés');
});

test('the floating month title takes its month too', async ({ page }) => {
  await longPress(page, cells(page).nth(0));
  // Well into the first month: its own title has scrolled away, the floating one shows it.
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(400);
  const sticky = page.locator('[data-picking]');
  await expect(sticky).toBeVisible();
  const box = await sticky.boundingBox();
  if (!box) throw new Error('no floating title');
  await page.mouse.click(box.x + 40, box.y + box.height / 2);
  await expect(bar(page)).toContainText(/\d{2,} sélectionnés/);
});

test('a selection does not follow into a sub-album', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('list', { name: 'Albums' })
    .getByRole('link', { name: /^Albums/ })
    .click();
  await page.getByRole('link', { name: /^Animaux/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Animaux' })).toBeVisible();
  await longPress(page, cells(page).first());
  await expect(bar(page)).toBeVisible();
  await page.getByRole('link', { name: /^Chat/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Chat' })).toBeVisible();
  await expect(bar(page)).toBeHidden();
  // A tap opens the photo, as usual.
  await cells(page).first().click();
  await expect(page.getByRole('dialog', { name: 'Visionneuse' })).toBeVisible();
});

test('back never stops on a selection that is gone', async ({ page }) => {
  // Left for another screen while picking, then back: one press is enough.
  await longPress(page, cells(page).nth(1));
  await page.getByRole('link', { name: 'Carte' }).click();
  await expect(page).toHaveURL(/\/carte$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/tout$/);
  await expect(bar(page)).toBeHidden();
  await page.goBack();
  await expect(page).not.toHaveURL(/\/tout$/);

  // Reloaded while picking: the next back leaves too.
  await page.goto('/tout');
  await expect(cells(page).first().locator('img')).toBeVisible();
  await longPress(page, cells(page).nth(1));
  await page.reload();
  await expect(cells(page).first().locator('img')).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/\/tout$/);
});

test('Escape ends a selection on a computer; Ctrl + click starts one', async ({ page }) => {
  await cells(page)
    .nth(2)
    .click({ modifiers: ['Control'] });
  await expect(bar(page)).toContainText('1 sélectionné');
  await cells(page)
    .nth(5)
    .click({ modifiers: ['Shift'] });
  await expect(bar(page)).toContainText('4 sélectionnés');
  await page.keyboard.press('Escape');
  await expect(bar(page)).toBeHidden();
  await expect(page).toHaveURL(/\/tout$/);
});

/** Headless Chromium has no share sheet: record what would be shared (and refuse once if asked). */
const stubShare = (page: Page, refuseFirst = false) =>
  page.addInitScript((refuse) => {
    const shared: number[] = [];
    let calls = 0;
    Object.assign(window, { shared });
    Object.defineProperty(navigator, 'canShare', { value: () => true });
    Object.defineProperty(navigator, 'share', {
      value: async ({ files }: { files: File[] }) => {
        if (refuse && calls++ === 0) throw new DOMException('Too late', 'NotAllowedError');
        shared.push(files.length);
      },
    });
  }, refuseFirst);
const shared = (page: Page) =>
  page.evaluate(() => (window as unknown as { shared: number[] }).shared);

test('cancelling stops the downloads under way', async ({ page }) => {
  await page.addInitScript(() => {
    let clicks = 0;
    Object.assign(window, { clicks: () => clicks });
    // Count the downloads started, without saving anything.
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) clicks++;
    };
  });
  await page.reload();
  await expect(cells(page).first().locator('img')).toBeVisible();
  await longPress(page, cells(page).nth(0), cells(page).nth(5));
  await expect(bar(page)).toContainText('6 sélectionnés');
  await bar(page).getByRole('button', { name: 'Télécharger' }).click();
  await bar(page).getByRole('button', { name: 'Annuler la sélection' }).click();
  await expect(bar(page)).toBeHidden();
  const clicks = () =>
    page.evaluate(() => (window as unknown as { clicks: () => number }).clicks());
  const atCancel = await clicks();
  await page.waitForTimeout(2500);
  expect(await clicks()).toBe(atCancel);
  expect(atCancel).toBeLessThan(6);
});

test('cancelling while preparing a share shares nothing', async ({ page }) => {
  await stubShare(page);
  await page.reload();
  await expect(cells(page).first().locator('img')).toBeVisible();
  // A whole month: preparing it lasts long enough to cancel midway.
  await longPress(page, cells(page).nth(0));
  await page
    .getByRole('main')
    .getByRole('checkbox', { name: /^Tout le mois/ })
    .first()
    .click();
  await bar(page).getByRole('button', { name: 'Partager' }).click();
  const dialog = page.getByRole('dialog', { name: /^Partager \d+ éléments/ });
  await dialog.getByRole('button', { name: 'Partager quand même' }).click();
  await expect(bar(page).getByRole('status')).toContainText('/');
  await bar(page).getByRole('button', { name: 'Annuler la sélection' }).click();
  await expect(bar(page)).toBeHidden();
  await page.waitForTimeout(2500);
  expect(await shared(page)).toEqual([]);
});

test('a share ready from before is redone for a changed selection', async ({ page }) => {
  await stubShare(page, true);
  await page.reload();
  await expect(cells(page).first().locator('img')).toBeVisible();
  await longPress(page, cells(page).nth(0), cells(page).nth(2));
  await bar(page).getByRole('button', { name: 'Partager' }).click();
  // Refused once (the tap's permission ran out): ready for a second tap.
  await expect(bar(page).getByRole('button', { name: /prêt/ })).toBeVisible();
  await cells(page).nth(4).click();
  await expect(bar(page)).toContainText('4 sélectionnés');
  await expect(bar(page).getByRole('button', { name: 'Partager' })).toBeVisible();
  await bar(page).getByRole('button', { name: 'Partager' }).click();
  await expect.poll(() => shared(page)).toEqual([4]);
});

test('the selection bar fits a 360 px phone, progress included', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await stubShare(page);
  await page.addInitScript(() => {
    // Downloads that never finish, to look at the progress.
    HTMLAnchorElement.prototype.click = () => undefined;
  });
  await page.reload();
  await expect(cells(page).first().locator('img')).toBeVisible();
  await longPress(page, cells(page).nth(0));
  await page
    .getByRole('main')
    .getByRole('checkbox', { name: /^Tout le mois/ })
    .first()
    .click();
  const fits = () =>
    bar(page)
      .getByRole('status')
      .evaluate((element) => element.scrollWidth <= element.clientWidth);
  expect(await fits()).toBe(true);
  await bar(page).getByRole('button', { name: 'Télécharger' }).click();
  // A whole month is over 30: the app's own dialog asks first.
  await page
    .getByRole('dialog', { name: /^Télécharger \d+ fichiers/ })
    .getByRole('button', { name: 'Télécharger' })
    .click();
  await expect(bar(page).getByRole('status')).toContainText('/');
  expect(await fits()).toBe(true);
});

test('Space ticks a photo while picking with a keyboard', async ({ page }) => {
  await cells(page)
    .nth(0)
    .click({ modifiers: ['Control'] });
  await cells(page).nth(3).focus();
  await page.keyboard.press('Space');
  await expect(cells(page).nth(3)).toHaveAttribute('aria-checked', 'true');
  await expect(bar(page)).toContainText('2 sélectionnés');
  const scrollY = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('Space');
  await expect(cells(page).nth(3)).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
});

test('dragging up under the header scrolls back and keeps picking', async ({ page }) => {
  await page.mouse.wheel(0, 3000);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(2500);
  // The photo in the middle of the screen (rows above it are rendered too, off screen).
  const id = await page.evaluate(() => {
    for (let y = window.innerHeight / 2; y < window.innerHeight; y += 20) {
      const cell = document.elementFromPoint(60, y)?.closest<HTMLElement>('[data-item-id]');
      if (cell) return cell.dataset.itemId;
    }
    return undefined;
  });
  const box = await page.locator(`main a[data-item-id="${id}"]`).boundingBox();
  if (!box) throw new Error('no cell');
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove', y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: [{ x: box.x + box.width / 2, y, id: 0 }],
    });
  await touch('touchStart', box.y + box.height / 2);
  await page.waitForTimeout(700);
  for (let y = box.y + box.height / 2; y > 30; y -= 40) await touch('touchMove', y);
  await touch('touchMove', 20);
  const before = await page.evaluate(() => window.scrollY);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(before - 300);
  const count = Number((await bar(page).getByRole('status').textContent())?.match(/\d+/)?.[0]);
  expect(count).toBeGreaterThan(12);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
});

test('a second finger during a drag stops it and keeps what was picked', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  const from = await cells(page).nth(0).boundingBox();
  const to = await cells(page).nth(4).boundingBox();
  if (!from || !to) throw new Error('no cells');
  const a = { x: from.x + from.width / 2, y: from.y + from.height / 2, id: 0 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  await page.waitForTimeout(700);
  const b = { x: to.x + to.width / 2, y: to.y + to.height / 2, id: 0 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [b] });
  await expect(bar(page)).toContainText('5 sélectionnés');
  // A second finger: the drag is over.
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [b, { x: 50, y: 600, id: 1 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { ...b, y: b.y + 300 },
      { x: 50, y: 700, id: 1 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(bar(page)).toContainText('5 sélectionnés');
});

test('offline, what needs the network is greyed out in the selection bar', async ({
  page,
  context,
}) => {
  await longPress(page, cells(page).nth(0));
  await context.setOffline(true);
  await expect(
    bar(page).getByRole('button', { name: 'Télécharger (hors connexion)' }),
  ).toBeDisabled();
  await expect(bar(page).getByRole('button', { name: 'Ajouter aux favoris' })).toBeEnabled();
  await context.setOffline(false);
});

test('picking another photo during a download frees the bar', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLAnchorElement.prototype.click = () => undefined;
  });
  await page.reload();
  await expect(cells(page).first().locator('img')).toBeVisible();
  await longPress(page, cells(page).nth(0), cells(page).nth(5));
  await expect(bar(page)).toContainText('6 sélectionnés');
  await bar(page).getByRole('button', { name: 'Télécharger' }).click();
  await expect(bar(page).getByRole('status')).toContainText('/');
  await cells(page).nth(6).click();
  await expect(bar(page)).toContainText('7 sélectionnés');
  await expect(bar(page).getByRole('button', { name: 'Télécharger' })).toBeEnabled();
});

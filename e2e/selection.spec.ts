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

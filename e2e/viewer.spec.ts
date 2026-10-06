import { expect, test, type Page } from '@playwright/test';

const viewer = (page: Page) => page.getByRole('dialog', { name: 'Visionneuse' });
const cells = (page: Page) => page.getByRole('main').locator('a[data-item-id]');
const photoParam = (page: Page) => new URL(page.url()).searchParams.get('photo');
const zoomTransform = (page: Page) =>
  page.evaluate(
    () => document.querySelector<HTMLElement>('[data-active] [data-zoom]')?.style.transform ?? '',
  );

/** Touch gesture through the DevTools protocol: real touch events, as on a phone. */
async function touch(page: Page, frames: { x: number; y: number }[][]) {
  const cdp = await page.context().newCDPSession(page);
  const points = (frame: { x: number; y: number }[]) =>
    frame.map((point, id) => ({ ...point, id }));
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: points(frames[0] ?? []),
  });
  for (const frame of frames.slice(1)) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(frame) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=1');
  await page.goto('/tout');
  await expect(cells(page).first()).toBeVisible();
});

test('opens a photo full screen, with its date and album, and closes back to it', async ({
  page,
}) => {
  const cell = cells(page).nth(4);
  const id = await cell.getAttribute('data-item-id');
  await cell.click();
  await expect(viewer(page)).toBeVisible();
  expect(photoParam(page)).toBe(id);
  await expect(viewer(page).locator('header')).toContainText(/\d{4}/);
  await expect(page.getByRole('button', { name: 'Fermer' })).toBeFocused();
  await expect(viewer(page).getByRole('img').first()).toBeVisible();

  await page.getByRole('button', { name: 'Fermer' }).click();
  await expect(viewer(page)).toBeHidden();
  expect(photoParam(page)).toBeNull();
  await expect(page.locator(`a[data-item-id="${id}"]`)).toBeFocused();
});

test('moves between photos by swiping and with the arrows; back closes the viewer', async ({
  page,
}) => {
  await cells(page).first().click();
  const first = photoParam(page);
  const second = await cells(page).nth(1).getAttribute('data-item-id');

  await touch(page, [
    [{ x: 300, y: 400 }],
    [{ x: 220, y: 402 }],
    [{ x: 120, y: 404 }],
    [{ x: 60, y: 404 }],
  ]);
  await expect.poll(() => photoParam(page)).toBe(second);

  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => photoParam(page)).toBe(first);

  // Android's back button: one step closes the viewer, wherever the swipes went.
  await page.goBack();
  await expect(viewer(page)).toBeHidden();
  await expect(page).toHaveURL(/\/tout$/);
});

test('zooms with a double tap and with two fingers', async ({ page }) => {
  await cells(page).first().click();
  await expect(viewer(page).getByRole('img').first()).toBeVisible();

  await page.mouse.dblclick(180, 400);
  await expect.poll(() => zoomTransform(page)).toContain('scale(2.5)');
  await page.mouse.dblclick(180, 400);
  await expect.poll(() => zoomTransform(page)).toBe('');

  await touch(page, [
    [
      { x: 150, y: 400 },
      { x: 210, y: 400 },
    ],
    [
      { x: 120, y: 400 },
      { x: 240, y: 400 },
    ],
    [
      { x: 80, y: 400 },
      { x: 280, y: 400 },
    ],
  ]);
  const scale = Number(/scale\(([\d.]+)\)/.exec(await zoomTransform(page))?.[1]);
  expect(scale).toBeGreaterThan(2);
});

test('opens straight from a link, and says demo videos cannot play', async ({ page }) => {
  const video = cells(page)
    .filter({ has: page.locator('svg') })
    .first();
  const id = await video.getAttribute('data-item-id');
  await page.goto(`/tout?photo=${encodeURIComponent(id ?? '')}`);
  await expect(viewer(page)).toBeVisible();
  await page.getByRole('button', { name: 'Lire la vidéo' }).click();
  await expect(viewer(page).getByText('Lecture des vidéos indisponible en démo')).toBeVisible();

  // No history entry of ours: closing stays on the screen.
  await page.keyboard.press('Escape');
  await expect(viewer(page)).toBeHidden();
  await expect(page).toHaveURL(/\/tout$/);
});

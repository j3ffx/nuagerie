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
  // A video starts on its own; demo videos have nothing to play.
  await expect(viewer(page).getByText('Lecture des vidéos indisponible en démo')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Télécharger' })).toBeHidden();

  // No history entry of ours: closing stays on the screen.
  await page.keyboard.press('Escape');
  await expect(viewer(page)).toBeHidden();
  await expect(page).toHaveURL(/\/tout$/);
});

test('downloads the original file', async ({ page }) => {
  const photo = cells(page)
    .filter({ hasNot: page.locator('svg') })
    .first();
  await photo.click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.(jpe?g|png|heic|webp|gif)$/i);
});

test('names the place of a geotagged photo, found on the device', async ({ page }) => {
  const placeRequests: string[] = [];
  page.on('request', (request) => {
    const { protocol, hostname } = new URL(request.url());
    if (protocol.startsWith('http') && hostname !== 'localhost') placeRequests.push(request.url());
  });
  await page.goto('/');
  await page
    .getByRole('list', { name: 'Albums' })
    .getByRole('link', { name: /^Camera Roll/ })
    .click();
  await cells(page).first().click();
  const footer = viewer(page).locator('footer');
  // Not every photo has a position: move on until one does.
  for (let i = 0; i < 20 && !(await footer.isVisible()); i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
  }
  await expect(footer).toHaveText(/^(Près de )?\S.*, France$/);
  // No request left the app: coordinates stay on the device.
  expect(placeRequests).toEqual([]);
});

test('shares the photo through the system share sheet, not the Download folder', async ({
  page,
}) => {
  // Headless Chromium has no share sheet: record what would be shared.
  await page.addInitScript(() => {
    const shared: string[] = [];
    Object.assign(window, { shared });
    Object.defineProperty(navigator, 'canShare', { value: () => true });
    Object.defineProperty(navigator, 'share', {
      value: async ({ files }: { files: File[] }) => {
        for (const file of files) shared.push(`${file.name} ${file.type} ${file.size}`);
      },
    });
  });
  await page.reload();
  await cells(page)
    .filter({ hasNot: page.locator('svg') })
    .first()
    .click();
  let downloaded = false;
  page.on('download', () => (downloaded = true));
  await page.getByRole('button', { name: 'Partager' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { shared: string[] }).shared))
    .toEqual([expect.stringMatching(/^\S+\.\w+ image\/\w+ [1-9]\d*$/)]);
  expect(downloaded).toBe(false);
});

test('says when sharing failed, and lets the user try again', async ({ page }) => {
  await page.addInitScript(() => {
    let calls = 0;
    const shared: string[] = [];
    Object.assign(window, { shared });
    Object.defineProperty(navigator, 'canShare', { value: () => true });
    Object.defineProperty(navigator, 'share', {
      value: async ({ files }: { files: File[] }) => {
        if (calls++ === 0) throw new DOMException('Share failed', 'DataError');
        shared.push(...files.map((file) => file.name));
      },
    });
  });
  await page.reload();
  await cells(page)
    .filter({ hasNot: page.locator('svg') })
    .first()
    .click();
  const button = page.getByRole('button', { name: 'Partager' });
  await button.click();
  await expect(viewer(page).getByRole('status')).toHaveText(/Partage impossible/);
  await expect(button).toBeEnabled();
  await button.click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { shared: string[] }).shared.length))
    .toBe(1);
});

test('shows a cut album name in full on a tap; light theme until the bars are hidden', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.getByRole('link', { name: /^Événements/ }).click();
  await page.getByRole('link', { name: /^2026-07 - Vacances à la mer/ }).click();
  await cells(page).first().click();
  await expect(viewer(page)).toBeVisible();

  const bubble = page.locator('[data-bubble]');
  await viewer(page)
    .getByRole('button', { name: /Vacances à la mer/ })
    .click();
  await expect(bubble).toHaveText('2026-07 - Vacances à la mer');

  // The theme's background with the bars, black without them (a tap on the photo).
  const background = () =>
    page.evaluate(() => {
      const stage = document.querySelector('[role="dialog"] > div');
      return stage ? getComputedStyle(stage, '::before').backgroundColor : '';
    });
  await expect.poll(background).toBe('rgb(245, 249, 255)');
  const box = await viewer(page).boundingBox();
  if (!box) throw new Error('no viewer');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(bubble).toBeHidden();
  await expect(viewer(page)).not.toHaveAttribute('data-chrome');
  await expect.poll(background).toBe('rgb(0, 0, 0)');
});

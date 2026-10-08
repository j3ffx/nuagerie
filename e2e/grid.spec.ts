import { expect, test, type Page } from '@playwright/test';

const scrubber = (page: Page) => page.getByRole('slider', { name: 'Frise des dates' });

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=1');
  await page.goto('/tout');
  await expect(page.getByText(/20\s000 éléments/)).toBeVisible();
});

test('renders only the rows near the screen, out of 20 000 items', async ({ page }) => {
  await expect(page.getByRole('main').locator('img').first()).toBeVisible();
  expect(await page.getByRole('main').locator('img').count()).toBeLessThan(150);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(100_000);
  // Nothing wider than the screen.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    await page.evaluate(() => window.innerWidth),
  );
});

test('shows the date scrubber while scrolling, and jumps to "Sans date" at the end', async ({
  page,
}) => {
  const root = scrubber(page).locator('..');
  await expect(root).not.toHaveAttribute('data-visible');
  await page.mouse.move(180, 400);
  await page.mouse.wheel(0, 2000);
  await expect(root).toHaveAttribute('data-visible', 'true');
  await expect(scrubber(page)).toHaveAttribute('aria-valuetext', /^\p{Lu}\p{Ll}+ \d{4}$/u);

  const box = await scrubber(page).boundingBox();
  if (!box) throw new Error('No scrubber');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // Years appear along the track while dragging.
  await expect(root.getByText('Sans date')).toBeVisible();
  await page.mouse.move(box.x + box.width / 2, 2000, { steps: 5 });
  await expect(scrubber(page)).toHaveAttribute('aria-valuetext', 'Sans date');
  await page.mouse.up();
  await expect(
    page
      .getByRole('main')
      .getByRole('link', { name: /sans date$/ })
      .last(),
  ).toBeInViewport();

  // Then it fades away.
  await expect(root).not.toHaveAttribute('data-visible', { timeout: 4000 });
});

test('moves through the months and years with the keyboard', async ({ page }) => {
  await scrubber(page).focus();
  await expect(scrubber(page)).toBeVisible();
  const first = await scrubber(page).getAttribute('aria-valuetext');
  await page.keyboard.press('PageDown');
  const nextYear = await scrubber(page).getAttribute('aria-valuetext');
  expect(nextYear?.slice(-4)).toBe(String(Number(first?.slice(-4)) - 1));
  await expect(page.getByRole('heading', { level: 2, name: nextYear ?? '' })).toBeInViewport();
  await page.keyboard.press('End');
  await expect(scrubber(page)).toHaveAttribute('aria-valuetext', 'Sans date');
});

test('keeps thumbnails on the device and can empty the cache', async ({ page }) => {
  await expect(page.getByRole('main').locator('img').first()).toHaveJSProperty('complete', true);
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Réglages' })
    .click();
  const usage = page.getByRole('status').filter({ hasText: /sur 500 Mo$/ });
  await expect(usage).not.toHaveText(/^0 Mo/);
  await expect(usage).toHaveText(/^\d+(,\d)? Mo sur 500 Mo$/);
  await page.getByLabel('Taille maximale').selectOption('1000');
  await expect(page.getByText(/sur 1 Go$/)).toBeVisible();
  await page.getByRole('button', { name: 'Effacer les miniatures' }).click();
  await expect(page.getByRole('button', { name: 'Miniatures effacées' })).toBeDisabled();
  await expect(page.getByText(/^0 Mo sur 1 Go$/)).toBeVisible();
});

/** Columns of the first row of photos on screen. */
const columns = (page: Page) =>
  page.evaluate(() => {
    const row = document.querySelector<HTMLElement>('main [data-item-id]')?.parentElement;
    return row ? getComputedStyle(row).gridTemplateColumns.split(' ').length : 0;
  });

/** Two fingers moving apart (or together) by `by` pixels each, through the DevTools protocol. */
async function pinch(page: Page, by: number) {
  const cdp = await page.context().newCDPSession(page);
  const frame = (spread: number) => [
    { x: 206 - spread, y: 450, id: 0 },
    { x: 206 + spread, y: 450, id: 1 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: frame(60) });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: frame(60 + (by * i) / 10),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('pinching sets the number of columns, kept on the device', async ({ page }) => {
  await expect(page.getByRole('main').locator('img').first()).toBeVisible();
  const before = await columns(page);
  expect(before).toBe(4);

  await pinch(page, -40); // fingers closer: more, smaller photos
  await expect.poll(() => columns(page)).toBeGreaterThan(before);
  const more = await columns(page);

  await page.reload();
  await expect(page.getByRole('main').locator('img').first()).toBeVisible();
  expect(await columns(page)).toBe(more);

  await pinch(page, 120); // fingers apart: fewer, bigger photos, never under 3
  await expect.poll(() => columns(page)).toBeLessThan(more);
  expect(await columns(page)).toBeGreaterThanOrEqual(3);
  // The page itself did not zoom.
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
});

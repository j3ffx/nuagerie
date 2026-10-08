import { expect, test } from '@playwright/test';

/** Dispatches a long press's context menu on the element, as a finger or a mouse would; was it cancelled? */
const contextMenuCancelled = (selector: string, pointerType: 'touch' | 'mouse') =>
  `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    el.dispatchEvent(new PointerEvent('pointerdown', { pointerType: '${pointerType}', bubbles: true }));
    const menu = new PointerEvent('contextmenu', { pointerType: '${pointerType}', bubbles: true, cancelable: true });
    el.dispatchEvent(menu);
    return menu.defaultPrevented;
  })()`;

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page.getByRole('list', { name: 'Albums' })).toBeVisible();
});

test('a long press opens no browser menu, but a right click still does', async ({ page }) => {
  await page.goto('/tout');
  await expect(page.getByRole('main').locator('a[data-item-id] img').first()).toBeVisible();
  expect(await page.evaluate(contextMenuCancelled('main a[data-item-id]', 'touch'))).toBe(true);
  expect(await page.evaluate(contextMenuCancelled('main a[data-item-id]', 'mouse'))).toBe(false);

  // Text fields keep their menu (paste).
  await page.goto('/albums/choisir');
  await expect(page.getByPlaceholder('Rechercher un dossier')).toBeVisible();
  expect(await page.evaluate(contextMenuCancelled('input[type=search]', 'touch'))).toBe(false);
});

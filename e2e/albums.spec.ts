import { expect, test, type Page } from '@playwright/test';

const homeAlbums = (page: Page) => page.getByRole('list', { name: 'Albums' });
const albumNames = async (page: Page) =>
  (await homeAlbums(page).locator('li').allInnerTexts()).map((text) => text.split('\n')[0]);

/** A finger held on the element, through the DevTools protocol (real touch events). */
async function longPress(page: Page, name: RegExp) {
  const box = await page.getByRole('link', { name }).boundingBox();
  if (!box) throw new Error(`no link ${String(name)}`);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 3, id: 0 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.waitForTimeout(800);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(homeAlbums(page)).toBeVisible();
});

test('opens an album, its sub-albums, and goes back to the parent', async ({ page }) => {
  await homeAlbums(page)
    .getByRole('link', { name: /^Albums/ })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Albums' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '7 sous-albums' })).toBeVisible();

  await page.getByRole('link', { name: /^Animaux/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Animaux' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '2 sous-albums' })).toBeVisible();
  await expect(page.getByText(/^\d[\d\s]* éléments · \d{4}/)).toBeVisible();
  const grid = page.getByLabel('Photos et vidéos de Animaux');
  await expect(grid.locator('img').first()).toBeVisible();

  await page.getByRole('link', { name: 'Retour à Albums' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Albums' })).toBeVisible();
  await page.getByRole('link', { name: 'Retour aux albums' }).click();
  await expect(page).toHaveURL('/');
});

test('opens an album at its top, and goes back to where the home was', async ({ page }) => {
  const scrollY = () => page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(scrollY).toBeGreaterThan(300);
  const home = await scrollY();

  await homeAlbums(page).getByRole('link').last().click();
  await expect(page).toHaveURL(/\/album\//);
  await expect(page.getByRole('main').locator('a[data-item-id]').first()).toBeVisible();
  expect(await scrollY()).toBe(0);

  await page.goBack();
  await expect(homeAlbums(page)).toBeVisible();
  await expect.poll(scrollY).toBe(home);
});

test('sorts the home albums and remembers the choice', async ({ page }) => {
  await page.getByLabel('Trier les albums par').selectOption('name');
  await expect
    .poll(() => albumNames(page))
    .toEqual([...(await albumNames(page))].sort((a, b) => (a ?? '').localeCompare(b ?? '', 'fr')));
  const ascending = await albumNames(page);

  await page.getByRole('button', { name: /^Ordre : A → Z/ }).click();
  await expect.poll(() => albumNames(page)).toEqual([...ascending].reverse());

  await page.reload();
  await expect(page.getByLabel('Trier les albums par')).toHaveValue('name');
  await expect.poll(() => albumNames(page)).toEqual([...ascending].reverse());
});

test('reverses the photo order of an album, undated items staying last', async ({ page }) => {
  await homeAlbums(page)
    .getByRole('link', { name: /^Camera Roll/ })
    .click();
  const months = page.getByRole('main').getByRole('heading', { level: 2 });
  const newest = await months.first().innerText();
  await page.getByRole('button', { name: /^Ordre : récent d’abord/ }).click();
  await expect(months.first()).not.toHaveText(newest);
  await expect(months.first()).toHaveText(/2016$/);
});

test('chooses albums, hides a sub-album, and resets the choice', async ({ page }) => {
  await page.getByRole('link', { name: 'Choisir les albums' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Choisir les albums' })).toBeVisible();

  // Unchecking a folder removes it from the home screen.
  await page.getByRole('checkbox', { name: /^Screenshots/ }).uncheck();

  // A sub-album can be hidden from its parent's page.
  await page.getByRole('button', { name: 'Déplier Albums' }).click();
  await page.getByRole('checkbox', { name: /^Memes/ }).uncheck();
  await expect(page.getByText('sous-album de Albums · masqué')).toBeVisible();

  // Search ignores accents.
  await page.getByPlaceholder('Rechercher un dossier').fill('evenem');
  await expect(page.getByRole('checkbox', { name: /^Événements/ })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /^Camera Roll/ })).toBeHidden();

  await page.getByRole('link', { name: 'Retour aux albums' }).click();
  expect(await albumNames(page)).not.toContain('Screenshots');
  await homeAlbums(page)
    .getByRole('link', { name: /^Albums/ })
    .click();
  await expect(page.getByRole('heading', { name: '6 sous-albums' })).toBeVisible();

  // The choice survives a reload, and can be reset.
  await page.goto('/albums/choisir');
  await expect(page.getByRole('checkbox', { name: /^Screenshots/ })).not.toBeChecked();
  // The app's own confirmation: cancelling (Escape) keeps the choice.
  const reset = page.getByRole('button', { name: 'Revenir à la sélection par défaut' });
  const dialog = page.getByRole('dialog', { name: 'Revenir à la sélection par défaut ?' });
  await reset.click();
  await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('checkbox', { name: /^Screenshots/ })).not.toBeChecked();
  await reset.click();
  await dialog.getByRole('button', { name: 'Revenir au défaut' }).click();
  await expect(page.getByRole('checkbox', { name: /^Screenshots/ })).toBeChecked();
});

test('sorts the sub-albums from a button, remembered apart from the home sort', async ({
  page,
}) => {
  await homeAlbums(page)
    .getByRole('link', { name: /^Événements/ })
    .click();
  const subNames = async () =>
    (await page
      .locator('section ul li a')
      .evaluateAll((links) =>
        links.map((link) => link.getAttribute('aria-label')?.split(',')[0] ?? ''),
      )) as string[];

  // Hidden until asked for.
  await expect(page.getByLabel('Trier les sous-albums par')).toBeHidden();
  const toggle = page.getByRole('button', { name: /^Trier les sous-albums/ });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  await page.getByLabel('Trier les sous-albums par').selectOption('name');
  const byName = await subNames();
  expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })));
  await page.getByRole('button', { name: /^Ordre : A → Z/ }).click();
  await expect.poll(subNames).toEqual([...byName].reverse());

  // The home screen keeps its own sort.
  await page.getByRole('link', { name: 'Retour aux albums' }).click();
  await expect(page.getByLabel('Trier les albums par')).toHaveValue('last');
});

test('a long press on an album opens its menu: its full name, the map, hiding it', async ({
  page,
}) => {
  await homeAlbums(page)
    .getByRole('link', { name: /^Événements/ })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Événements' })).toBeVisible();

  const menu = page.getByRole('dialog', { name: '2026-07 - Vacances à la mer' });
  await longPress(page, /^2026-07 - Vacances à la mer/);
  await expect(menu).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Événements' })).toBeVisible();
  await menu.getByRole('button', { name: 'Annuler' }).click();
  await expect(menu).toBeHidden();

  // Its photos alone on the map, until the chip is closed.
  await longPress(page, /^2026-07 - Vacances à la mer/);
  await menu.getByRole('button', { name: 'Voir sur la carte' }).click();
  await expect(page).toHaveURL(/\/carte\?album=/);
  const chip = page.getByRole('link', { name: /^Album 2026-07 - Vacances à la mer seulement/ });
  await expect(chip).toBeVisible();
  await expect(page.getByText(/\d+ éléments? dans cette zone/)).toBeVisible();
  await chip.click();
  await expect(page).toHaveURL(/\/carte$/);

  // Hidden among the sub-albums.
  await page.goBack();
  await page.goBack();
  await longPress(page, /^2026-07 - Vacances à la mer/);
  await menu.getByRole('button', { name: /^Masquer ce sous-album/ }).click();
  await expect(page.getByRole('link', { name: /^2026-07 - Vacances à la mer/ })).toBeHidden();
});

test('hides an album from the home screen with its menu', async ({ page }) => {
  await longPress(page, /^Screenshots/);
  await page
    .getByRole('dialog', { name: 'Screenshots' })
    .getByRole('button', { name: /^Masquer de l’accueil/ })
    .click();
  await expect(homeAlbums(page).getByRole('link', { name: /^Screenshots/ })).toBeHidden();
});

test('the Favoris tile has a menu too: its photos on the map', async ({ page }) => {
  // A geotagged favourite: from a photo whose place is shown.
  await page.goto('/carte');
  await page.locator('section[aria-labelledby="map-zone"] ul a').first().click();
  await page.getByRole('button', { name: 'Ajouter aux favoris' }).click();
  await page.keyboard.press('Escape');
  await page.goto('/');

  await longPress(page, /^Favoris/);
  const menu = page.getByRole('dialog', { name: 'Favoris' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: /^Masquer/ })).toHaveCount(0);
  await menu.getByRole('button', { name: 'Voir sur la carte' }).click();
  await expect(page.getByRole('link', { name: /^Album Favoris seulement/ })).toBeVisible();
  await expect(page.getByText('1 élément dans cette zone')).toBeVisible();
});

test('nothing in an album menu can be selected as text, and its rows look like buttons', async ({
  page,
}) => {
  await longPress(page, /^Screenshots/);
  const menu = page.getByRole('dialog', { name: 'Screenshots' });
  await expect(menu).toBeVisible();
  const styles = await menu.evaluate((dialog) => {
    const sheet = dialog.firstElementChild as HTMLElement;
    const row = dialog.querySelector('button') as HTMLElement;
    return {
      select: getComputedStyle(sheet).userSelect,
      rowBackground: getComputedStyle(row).backgroundColor,
      sheetBackground: getComputedStyle(sheet).backgroundColor,
    };
  });
  expect(styles.select).toBe('none');
  expect(styles.rowBackground).not.toBe('rgba(0, 0, 0, 0)');
  expect(styles.rowBackground).not.toBe(styles.sheetBackground);
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
});

test('closing an album menu gives the focus back to its tile', async ({ page }) => {
  const tile = homeAlbums(page).getByRole('link', { name: /^Screenshots/ });
  const menu = page.getByRole('dialog', { name: 'Screenshots' });
  for (const close of ['Escape', 'Annuler'] as const) {
    await tile.focus();
    await tile.click({ button: 'right' });
    await expect(menu).toBeVisible();
    if (close === 'Escape') await page.keyboard.press('Escape');
    else await menu.getByRole('button', { name: 'Annuler' }).click();
    await expect(menu).toBeHidden();
    await expect(tile).toBeFocused();
  }
});

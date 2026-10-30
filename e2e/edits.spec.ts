import { expect, test, type Locator, type Page } from '@playwright/test';

const cells = (page: Page) => page.getByRole('main').locator('a[data-item-id]');
const albums = (page: Page) => page.getByRole('list', { name: 'Albums' });
/** The notice of a change (its text, without the buttons beside it). */
const toast = (page: Page) =>
  page.getByRole('status').filter({ hasText: /corbeille|remis|dans « |Album/ });

/** A finger held on an element (DevTools protocol), as in selection.spec.ts. */
async function longPress(page: Page, on: Locator) {
  const box = await on.boundingBox();
  if (!box) throw new Error('nothing to press');
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 0 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.waitForTimeout(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** In the app, not by loading a page: the demo draws its drive anew at each load. */
async function go(page: Page, tab: 'Albums' | 'Tout' | 'Réglages') {
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: tab })
    .click();
}

/** Réglages → Modifications → Activer (the demo asks no permission). */
async function turnOnChanges(page: Page) {
  await go(page, 'Réglages');
  const section = page.getByRole('region', { name: 'Modifications' });
  await section.getByRole('button', { name: 'Activer les modifications' }).click();
  await expect(section.getByRole('button', { name: 'Désactiver' })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(albums(page)).toBeVisible();
});

test('the changes are off by default: the app only reads', async ({ page }) => {
  await go(page, 'Tout');
  await cells(page).first().click();
  const viewer = page.getByRole('dialog', { name: 'Visionneuse' });
  await expect(viewer.getByRole('button', { name: 'Télécharger' })).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Plus d’actions' })).toHaveCount(0);
  await page.goBack();
  await go(page, 'Réglages');
  await expect(
    page.getByRole('region', { name: 'Modifications' }).getByText(/ne fait que lire ton OneDrive/),
  ).toBeVisible();
  await go(page, 'Albums');
  await expect(page.getByRole('button', { name: 'Nouvel album' })).toHaveCount(0);
});

test('deletes a photo from the viewer, moves on, and brings it back from the bin', async ({
  page,
}) => {
  await turnOnChanges(page);
  await go(page, 'Tout');
  const first = await cells(page).first().getAttribute('data-item-id');
  await cells(page).first().click();
  const viewer = page.getByRole('dialog', { name: 'Visionneuse' });
  await viewer.getByRole('button', { name: 'Plus d’actions' }).click();
  await page.getByRole('button', { name: /^Supprimer/ }).click();
  const confirm = page.getByRole('dialog', { name: 'Supprimer 1 élément ?' });
  await expect(confirm).toContainText('Il va dans la corbeille');
  await confirm.getByRole('button', { name: 'Supprimer' }).click();

  // The next photo shows, and the change is said over the viewer.
  await expect(toast(page)).toContainText(/1 élément dans la corbeille/);
  await expect(page).not.toHaveURL(new RegExp(encodeURIComponent(first ?? '')));
  await page.goBack();
  await expect(cells(page).first()).not.toHaveAttribute('data-item-id', first ?? '');

  await go(page, 'Réglages');
  await page.getByRole('link', { name: 'Corbeille (1)' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Corbeille' })).toBeVisible();
  const list = page.getByRole('list', { name: 'Éléments supprimés' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await list.getByRole('button', { name: /^Restaurer / }).click();
  await expect(toast(page)).toContainText(/1 élément remis en place/);
  await expect(page.getByText(/Rien de supprimé depuis cet appareil/)).toBeVisible();
  await go(page, 'Tout');
  await expect(cells(page).first()).toHaveAttribute('data-item-id', first ?? '');
});

test('undoes a deletion right away, from the notice', async ({ page }) => {
  await turnOnChanges(page);
  await go(page, 'Tout');
  const ids = await Promise.all([0, 1].map((i) => cells(page).nth(i).getAttribute('data-item-id')));
  await longPress(page, cells(page).nth(0));
  await cells(page).nth(1).click();
  await page
    .getByRole('toolbar', { name: 'Sélection' })
    .getByRole('button', { name: 'Plus d’actions' })
    .click();
  await page.getByRole('button', { name: /^Supprimer/ }).click();
  await page
    .getByRole('dialog', { name: 'Supprimer 2 éléments ?' })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await expect(toast(page)).toContainText(/2 éléments dans la corbeille/);
  await expect(cells(page).first()).not.toHaveAttribute('data-item-id', ids[0] ?? '');
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(cells(page).nth(0)).toHaveAttribute('data-item-id', ids[0] ?? '');
  await expect(cells(page).nth(1)).toHaveAttribute('data-item-id', ids[1] ?? '');
});

test('moves photos into a new album, shown on the home screen', async ({ page }) => {
  await turnOnChanges(page);
  await go(page, 'Tout');
  await longPress(page, cells(page).nth(0));
  await cells(page).nth(1).click();
  await page
    .getByRole('toolbar', { name: 'Sélection' })
    .getByRole('button', { name: 'Plus d’actions' })
    .click();
  await page.getByRole('button', { name: 'Déplacer vers un album' }).click();
  const move = page.getByRole('dialog', { name: 'Déplacer 2 éléments' });
  await expect(
    move.getByRole('list', { name: 'Albums' }).getByRole('button').first(),
  ).toBeVisible();
  await move.getByRole('button', { name: 'Nouvel album…' }).click();
  const name = page.getByRole('dialog', { name: 'Nouvel album' });
  await name.getByRole('textbox', { name: 'Nom' }).fill('2023');
  await expect(name.getByText(/dossier technique/)).toBeVisible();
  await expect(name.getByRole('button', { name: 'Créer' })).toBeDisabled();
  await name.getByRole('textbox', { name: 'Nom' }).fill('Chats');
  await name.getByRole('button', { name: 'Créer' }).click();
  await expect(toast(page)).toContainText(/2 éléments dans « Chats »/);
  await expect(page.getByRole('toolbar', { name: 'Sélection' })).toHaveCount(0);

  await go(page, 'Albums');
  await expect(albums(page).getByRole('link', { name: /^Chats, 2 éléments/ })).toBeVisible();
});

test('undoes a move: the photos go back to their year and month folders', async ({ page }) => {
  await turnOnChanges(page);
  await go(page, 'Tout');
  const first = cells(page).first();
  const id = (await first.getAttribute('data-item-id')) ?? '';
  // The demo's camera roll sorts its photos into year and month folders.
  await first.click();
  const viewer = page.getByRole('dialog', { name: 'Visionneuse' });
  const album = (await viewer.locator('header').innerText()).split('·').at(-1)?.trim() ?? '';
  await viewer.getByRole('button', { name: 'Plus d’actions' }).click();
  await page.getByRole('button', { name: 'Déplacer vers un album' }).click();
  await page
    .getByRole('dialog', { name: 'Déplacer 1 élément' })
    .getByRole('button', { name: /^Animaux/ })
    .first()
    .click();
  await expect(toast(page)).toContainText(/1 élément dans « Animaux »/);
  await expect(viewer.locator('header')).toContainText('Animaux');
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(viewer.locator('header')).toContainText(album);
  await expect(page.getByText(/ne peut pas toucher/)).toHaveCount(0);
  await page.goBack();
  await expect(cells(page).first()).toHaveAttribute('data-item-id', id);
});

test('creates, renames and deletes an empty album; a full one cannot be deleted', async ({
  page,
}) => {
  await turnOnChanges(page);
  await go(page, 'Albums');
  await page.getByRole('button', { name: 'Nouvel album' }).click();
  const create = page.getByRole('dialog', { name: 'Nouvel album' });
  await create.getByRole('textbox', { name: 'Nom' }).fill('Brouillons');
  await create.getByRole('button', { name: 'Créer' }).click();
  await expect(toast(page)).toContainText('Album « Brouillons » créé');
  const tile = albums(page).getByRole('link', { name: /^Brouillons/ });
  await expect(tile).toBeVisible();

  await tile.click({ button: 'right' });
  await page
    .getByRole('dialog', { name: 'Brouillons' })
    .getByRole('button', { name: 'Renommer' })
    .click();
  const rename = page.getByRole('dialog', { name: 'Renommer l’album' });
  await expect(rename.getByRole('textbox', { name: 'Nom' })).toHaveValue('Brouillons');
  await rename.getByRole('textbox', { name: 'Nom' }).fill('Essais');
  await rename.getByRole('button', { name: 'Renommer' }).click();
  await expect(toast(page)).toContainText('Album renommé « Essais »');

  await albums(page)
    .getByRole('link', { name: /^Essais/ })
    .click({ button: 'right' });
  await page
    .getByRole('dialog', { name: 'Essais' })
    .getByRole('button', { name: /^Supprimer l’album/ })
    .click();
  await page
    .getByRole('dialog', { name: 'Supprimer « Essais » ?' })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await expect(toast(page)).toContainText('Album supprimé');
  await expect(albums(page).getByRole('link', { name: /^Essais/ })).toHaveCount(0);

  // An album with photos: deleting it is not offered.
  await albums(page).getByRole('link').nth(1).click({ button: 'right' });
  const remove = page.getByRole('button', { name: /^Supprimer l’album/ });
  await expect(remove).toBeDisabled();
  await expect(remove).toContainText('Seulement un album vide.');
});

test('brings a photo back into its album made again, when the album was deleted too', async ({
  page,
}) => {
  await turnOnChanges(page);
  await go(page, 'Tout');
  await cells(page).first().click();
  const viewer = page.getByRole('dialog', { name: 'Visionneuse' });
  await viewer.getByRole('button', { name: 'Plus d’actions' }).click();
  await page.getByRole('button', { name: 'Déplacer vers un album' }).click();
  await page
    .getByRole('dialog', { name: 'Déplacer 1 élément' })
    .getByRole('button', { name: 'Nouvel album…' })
    .click();
  const name = page.getByRole('dialog', { name: 'Nouvel album' });
  await name.getByRole('textbox', { name: 'Nom' }).fill('Brouillons');
  await name.getByRole('button', { name: 'Créer' }).click();
  await expect(toast(page)).toContainText(/1 élément dans « Brouillons »/);
  await viewer.getByRole('button', { name: 'Plus d’actions' }).click();
  await page.getByRole('button', { name: /^Supprimer/ }).click();
  await page
    .getByRole('dialog', { name: 'Supprimer 1 élément ?' })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await expect(toast(page)).toContainText(/1 élément dans la corbeille/);
  await page.goBack();

  // The album, empty now, goes too.
  await go(page, 'Albums');
  await albums(page)
    .getByRole('link', { name: /^Brouillons/ })
    .click({ button: 'right' });
  await page
    .getByRole('dialog', { name: 'Brouillons' })
    .getByRole('button', { name: /^Supprimer l’album/ })
    .click();
  await page
    .getByRole('dialog', { name: 'Supprimer « Brouillons » ?' })
    .getByRole('button', { name: 'Supprimer' })
    .click();
  await expect(albums(page).getByRole('link', { name: /^Brouillons/ })).toHaveCount(0);

  await go(page, 'Réglages');
  await page.getByRole('link', { name: 'Corbeille (1)' }).click();
  await page
    .getByRole('list', { name: 'Éléments supprimés' })
    .getByRole('button', { name: /^Restaurer / })
    .click();
  await expect(toast(page)).toContainText(
    '1 élément dans « Brouillons » : son album n’existait plus',
  );
  await go(page, 'Albums');
  await expect(albums(page).getByRole('link', { name: /^Brouillons, 1 élément/ })).toBeVisible();
});

test('fits the actions and the notice on a 360 px screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  await turnOnChanges(page);
  await go(page, 'Tout');
  await longPress(page, cells(page).nth(0));
  const bar = page.getByRole('toolbar', { name: 'Sélection' });
  for (const name of ['Ajouter aux favoris', 'Plus d’actions']) {
    await expect(bar.getByRole('button', { name })).toBeInViewport();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
});

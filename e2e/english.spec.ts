import { expect, test, type Page } from '@playwright/test';

/** Finding the places of the demo's photos takes a few seconds while other tests run. */
const PLACES = { timeout: 45_000 };

/** French words that only French texts have: none may show in English. */
const FRENCH =
  /\b(Réglages|Recherche|Carte|Tout voir|Souvenirs|Favoris|Retour|Annuler|élément|dossier|hors connexion|Télécharger|Partager|Masquer|Fermer|Lieux|Années)\b/;

/** The visible text of the page, without what comes from the user's drive (album, folder names). */
const uiText = (page: Page) =>
  page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll('[data-item-id], ul[aria-label] li span, h1, [data-album-name]')
      .forEach((node) => node.remove());
    return clone.innerText;
  });

test.describe('on a phone in English', () => {
  test.use({ locale: 'en-GB' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/?demo=1');
    await expect(page.getByRole('list', { name: 'Albums' })).toBeVisible();
  });

  test('speaks English everywhere, and tells the language to the page', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    for (const name of ['Albums', 'All', 'Map', 'Search', 'Settings']) {
      await expect(nav.getByRole('link', { name })).toBeVisible();
    }
    for (const path of ['/', '/tout', '/reglages', '/recherche', '/nouveautes']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await uiText(page)).not.toMatch(FRENCH);
    }
    await page.goto('/nouveautes');
    await expect(page.getByRole('heading', { name: 'What’s new', level: 1 })).toBeVisible();
    await expect(
      page.getByText('Keep offline: long-press an album', { exact: false }),
    ).toBeVisible();
  });

  test('searches in English words, French ones too, and names places in English', async ({
    page,
  }) => {
    test.slow();
    await page.goto('/recherche');
    const field = page.getByRole('searchbox', { name: /^Search for/ });
    await field.fill('summer 2023');
    await field.press('Enter');
    await expect(page.getByText(/ · Summer 2023$/)).toBeVisible();
    await field.fill('été 2023');
    await field.press('Enter');
    await expect(page.getByText(/ · Summer 2023$/)).toBeVisible();

    await field.fill('london');
    await expect(page.getByRole('heading', { name: 'Places' })).toBeVisible(PLACES);
    await expect(
      page
        .getByRole('main')
        .getByRole('link', { name: /^London/ })
        .first(),
    ).toBeVisible();
    await field.fill('londres');
    await expect(page.getByText(/^Nothing matches “londres”/)).toBeVisible();
  });

  test('switches to French from the settings, and stays in it', async ({ page }) => {
    await page.goto('/reglages');
    // Clicked, not checked: the page starts again in the new language.
    await page.getByRole('radio', { name: 'Français' }).click();
    await expect(page.getByRole('heading', { name: 'Réglages', level: 1 })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Français' })).toBeChecked();
    await page
      .getByRole('group', { name: 'Langue' })
      .getByRole('radio', { name: 'Automatique' })
      .click();
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  });
});

test.describe('in French', () => {
  test('names foreign places in French', async ({ page }) => {
    test.slow();
    await page.goto('/?demo=1');
    await page.goto('/recherche');
    await page.getByRole('searchbox').fill('londres');
    await expect(page.getByRole('heading', { name: 'Lieux' })).toBeVisible(PLACES);
    await expect(
      page
        .getByRole('main')
        .getByRole('link', { name: /^Londres/ })
        .first(),
    ).toBeVisible();
  });
});

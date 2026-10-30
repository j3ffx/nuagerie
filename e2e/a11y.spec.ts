import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Finding the places of the demo's photos takes a few seconds while other tests run. */
const PLACES = { timeout: 45_000 };

/**
 * Every screen, as reached by a user; `ready` waits for its content. `places`:
 * it waits for the places of the photos, which take longer on a busy machine.
 */
const SCREENS: {
  name: string;
  path: string;
  places?: boolean;
  ready: (page: Page) => Promise<void>;
}[] = [
  {
    name: 'albums',
    path: '/',
    ready: (page) => expect(page.getByRole('list', { name: 'Albums' })).toBeVisible(),
  },
  {
    name: 'album',
    path: '/',
    ready: async (page) => {
      await page
        .getByRole('list', { name: 'Albums' })
        .getByRole('link', { name: /^Événements/ })
        .click();
      await page.getByRole('link', { name: /Mariage/ }).click();
      // Sub-albums, then the grid.
      await expect(page.getByRole('heading', { name: /sous-albums/ })).toBeVisible();
      await expect(page.getByRole('main').locator('a[data-item-id] img').first()).toBeVisible();
    },
  },
  {
    name: 'choose albums',
    path: '/albums/choisir',
    ready: (page) => expect(page.getByRole('list', { name: 'Dossiers' })).toBeVisible(),
  },
  {
    name: 'all',
    path: '/tout',
    ready: (page) =>
      expect(page.getByRole('main').locator('a[data-item-id] img').first()).toBeVisible(),
  },
  {
    name: 'all filter',
    path: '/tout/filtre',
    ready: (page) => expect(page.getByRole('checkbox').first()).toBeVisible(),
  },
  {
    name: 'viewer',
    path: '/tout',
    ready: async (page) => {
      await page.getByRole('main').locator('a[data-item-id]').nth(2).click();
      await expect(page.getByRole('dialog', { name: 'Visionneuse' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Fermer' })).toBeFocused();
    },
  },
  {
    name: 'viewer infos',
    path: '/tout',
    ready: async (page) => {
      await page.getByRole('main').locator('a[data-item-id]').nth(2).click();
      await page.getByRole('button', { name: /voir les infos$/ }).click();
      await expect(page.getByRole('region', { name: 'Infos' })).toBeVisible();
    },
  },
  {
    name: 'selection',
    path: '/tout',
    ready: async (page) => {
      const cells = page.getByRole('main').locator('a[data-item-id]');
      await cells.nth(0).click({ modifiers: ['Control'] });
      await cells.nth(1).click();
      await expect(page.getByRole('toolbar', { name: 'Sélection' })).toBeVisible();
      await expect(
        page
          .getByRole('main')
          .getByRole('checkbox', { name: /^Tout le mois/ })
          .first(),
      ).toHaveAttribute('aria-checked', 'mixed');
    },
  },
  {
    name: 'album menu',
    path: '/',
    ready: async (page) => {
      await page
        .getByRole('list', { name: 'Albums' })
        .getByRole('link', { name: /^Camera Roll/ })
        .click({ button: 'right' });
      await expect(page.getByRole('dialog', { name: 'Camera Roll' })).toBeVisible();
    },
  },
  {
    name: 'map',
    path: '/carte',
    ready: (page) => expect(page.getByText(/dans cette zone/)).toBeVisible(),
  },
  {
    name: 'memories',
    path: '/souvenirs',
    ready: async (page) => {
      // Any day may have no memories: the screen then says so.
      await expect(
        page
          .getByRole('main')
          .locator('a[data-item-id] img')
          .first()
          .or(page.getByText('Pas de souvenir aujourd’hui.')),
      ).toBeVisible();
    },
  },
  {
    name: 'search',
    path: '/recherche',
    places: true,
    ready: (page) =>
      expect(page.getByRole('list').getByRole('link', { name: /^Lyon,/ })).toBeVisible(PLACES),
  },
  {
    name: 'search suggestions',
    path: '/recherche',
    places: true,
    ready: async (page) => {
      await page.getByRole('searchbox').fill('lyon 2024');
      await expect(page.getByRole('heading', { name: 'Lieux' })).toBeVisible(PLACES);
    },
  },
  {
    name: 'search results',
    path: '/recherche?q=lyon+2024',
    places: true,
    ready: async (page) => {
      await page
        .getByRole('region', { name: 'Lieux dans ces résultats' })
        .getByRole('link')
        .first()
        .click();
      await expect(page.getByRole('link', { name: /^Retirer le lieu/ })).toBeVisible();
      await expect(page.getByRole('main').locator('a[data-item-id] img').first()).toBeVisible();
    },
  },
  {
    name: 'kept album details',
    path: '/',
    ready: async (page) => {
      await page
        .getByRole('list', { name: 'Albums' })
        .getByRole('link', { name: /^Tapo,/ })
        .click({ button: 'right' });
      await page.getByRole('button', { name: /^Garder hors connexion/ }).click();
      const badge = page.getByRole('button', { name: /^Hors connexion : à jour/ });
      await badge.click({ timeout: 30_000 });
      await expect(page.getByRole('dialog', { name: 'Tapo' })).toBeVisible();
    },
  },
  {
    name: 'settings',
    path: '/reglages',
    ready: (page) => expect(page.getByRole('heading', { name: 'Apparence' })).toBeVisible(),
  },
  {
    name: 'folders',
    path: '/reglages/dossiers',
    ready: (page) => expect(page.getByRole('button', { name: 'Ajouter Documents' })).toBeVisible(),
  },
  {
    name: 'confirm dialog',
    path: '/reglages/dossiers',
    ready: async (page) => {
      await page.getByRole('button', { name: 'Ajouter Musique' }).click();
      await page.getByRole('button', { name: 'Enregistrer' }).click();
      await expect(page.getByRole('dialog', { name: 'Enregistrer ces dossiers ?' })).toBeVisible();
    },
  },
  {
    name: 'favourites',
    path: '/tout',
    ready: async (page) => {
      await page.getByRole('main').locator('a[data-item-id]').first().click();
      await page.getByRole('button', { name: 'Ajouter aux favoris' }).click();
      await page.goto('/favoris');
      await expect(page.getByRole('main').locator('a[data-item-id] img').first()).toBeVisible();
    },
  },
  {
    name: 'news',
    path: '/nouveautes',
    ready: (page) => expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible(),
  },
  {
    name: 'recycle bin',
    path: '/corbeille',
    ready: (page) =>
      expect(page.getByRole('heading', { level: 1, name: 'Corbeille' })).toBeVisible(),
  },
  {
    name: 'privacy',
    path: '/confidentialite',
    ready: (page) => expect(page.getByRole('heading', { name: 'Confidentialité' })).toBeVisible(),
  },
  {
    name: 'diagnostic',
    path: '/diagnostic',
    ready: (page) => expect(page.getByRole('heading', { level: 1 })).toBeVisible(),
  },
];

test.beforeEach(async ({ page }) => {
  // Map tiles come from OpenStreetMap: not needed to check the page.
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('/?demo=1');
  await expect(page.getByRole('list', { name: 'Albums' })).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const) {
  for (const screen of SCREENS) {
    test(`${screen.name} screen meets WCAG 2.1 AA (${scheme})`, async ({ page }) => {
      test.slow(screen.places === true, 'waits for the places of the photos');
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.goto(screen.path);
      await screen.ready(page);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const violations = results.violations.map((violation) => ({
        rule: violation.id,
        impact: violation.impact,
        targets: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')),
        summary: violation.nodes[0]?.failureSummary,
      }));
      expect(violations).toEqual([]);
    });
  }
}

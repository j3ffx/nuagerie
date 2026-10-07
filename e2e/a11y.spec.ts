import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Every screen, as reached by a user; `ready` waits for its content. */
const SCREENS: { name: string; path: string; ready: (page: Page) => Promise<void> }[] = [
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
    name: 'map',
    path: '/carte',
    ready: (page) => expect(page.getByText(/dans cette zone/)).toBeVisible(),
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

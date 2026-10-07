import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

test.beforeEach(async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page.getByRole('list', { name: 'Albums' })).toBeVisible();
});

test('lists what each version brought, from the settings', async ({ page }) => {
  await page.goto('/reglages');
  await page.getByRole('link', { name: 'Nouveautés' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Nouveautés' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /^Version 0\.1\.0/ })).toBeVisible();
  await page.getByRole('link', { name: 'Retour aux réglages' }).click();
  await expect(page).toHaveURL('/reglages');
});

test('reports a problem on GitHub with the version and device, nothing personal', async ({
  page,
}) => {
  await page.goto('/reglages');
  const href = await page.getByRole('link', { name: 'Signaler un problème' }).getAttribute('href');
  const url = new URL(href ?? '');
  expect(`${url.origin}${url.pathname}`).toBe('https://github.com/j3ffx/nuagerie/issues/new');
  const body = url.searchParams.get('body') ?? '';
  expect(body).toContain(`Version : ${version}`);
  expect(body).toContain('Données : démo');
  expect(body).toMatch(/Appareil : Android \d+ · Chrome \d+/);
});

test('tells once what is new after an update', async ({ page }) => {
  test.skip(version === '0.0.0', 'No released version yet');
  // As if the previous version was the last one seen.
  await page.evaluate(() => localStorage.setItem('nuagerie.seenVersion', '"0.0.0"'));
  await page.reload();
  const banner = page.getByRole('status').filter({ hasText: 'Nouveautés' });
  await expect(banner).toContainText(`Version ${version}`);

  await banner.getByRole('button', { name: 'Voir' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Nouveautés' })).toBeVisible();
  await page.getByRole('link', { name: 'Retour' }).click();
  await expect(page).toHaveURL('/');

  await page.reload();
  await expect(page.getByRole('list', { name: 'Albums' })).toBeVisible();
  await expect(banner).toBeHidden();
});

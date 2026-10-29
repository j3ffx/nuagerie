import { defineConfig, devices } from '@playwright/test';

/**
 * Vite's usual preview port is shared by other projects: E2E_PORT picks
 * another one (a server already there is reused, see webServer).
 */
const PORT = Number(process.env.E2E_PORT) || 4173;

/**
 * End-to-end tests in demo mode, on a phone-sized screen, against the
 * production build (so the service worker and the manifest are tested too).
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

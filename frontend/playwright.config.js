import { defineConfig } from '@playwright/test';

// Browser tests run the BUILT app (../st_automation/public/frontend, run `npm run build` first)
// from a tiny static server. Every /api/method call is mocked in the test, so no Frappe
// site, login or shared data is involved. Uses the locally installed Google Chrome.
const PORT = 4173;
const common = { channel: 'chrome', baseURL: `http://127.0.0.1:${PORT}` };

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list'], ['json', { outputFile: 'e2e/results.json' }]],
  webServer: { command: 'node e2e/static-server.mjs', url: `http://127.0.0.1:${PORT}/hr-ops`, reuseExistingServer: true, timeout: 20_000 },
  projects: [
    { name: 'mobile-390', use: { ...common, viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'tablet-820', use: { ...common, viewport: { width: 820, height: 1100 } } },
    { name: 'desktop-1440', use: { ...common, viewport: { width: 1440, height: 900 } } },
  ],
});

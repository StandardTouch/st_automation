import { test as base, expect } from '@playwright/test';

import { PROFILE, summary, emp, DEFAULTS } from './mock-data.js';
export { PROFILE, summary, emp };

// Mock every Frappe API call. `handlers` override/extend DEFAULTS: (params, calls) => data.
// Returns the recorded calls so tests can assert what the UI sent (writes are never real).
export async function mockApi(page, handlers = {}) {
  const calls = [];
  await page.route((url) => url.origin !== 'http://127.0.0.1:4173', (route) => route.abort()); // fonts etc.
  await page.addInitScript(() => { window.ST_BOOT = { user: 'hr@example.com', csrf_token: 'test' }; });
  await page.route('**/api/method/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = url.pathname.split('/api/method/')[1].replace(/^st_automation\.api\./, '');
    let params = Object.fromEntries(url.searchParams);
    if (req.method() !== 'GET') { try { params = req.postDataJSON() || {}; } catch { params = {}; } }
    calls.push({ method, params });
    const handler = handlers[method] || DEFAULTS[method];
    let data = handler ? handler(params, calls) : {};
    let message;
    if (data && data.__error) message = { status: 'error', message: data.__error, data: {} };
    else message = { status: 'success', message: data?.__message || '', data: data?.__message ? data.data : data };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message }) });
  });
  return calls;
}

export const test = base;
export { expect };
export const hasHeaderOverflow = (page) => page.evaluate(() => {
  const W = window.innerWidth;
  return [...document.querySelectorAll('header button, header select')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).length;
});

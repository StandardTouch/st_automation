// Lighthouse accessibility audit of the built app against the mock-API static server.
// Usage: node e2e/static-server.mjs &  node e2e/lighthouse.mjs   (uses local Google Chrome)
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const pages = ['payroll-command', 'recruitment-pipeline', 'run-payroll', 'salary-structures', 'job-openings', 'loans'];
const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox'], chromePath: '/usr/bin/google-chrome' });
const out = [];
try {
  for (const form of ['mobile', 'desktop']) {
    for (const p of pages) {
      const flags = { port: chrome.port, onlyCategories: ['accessibility'], output: 'json', logLevel: 'error', formFactor: form, screenEmulation: form === 'mobile' ? { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false } : { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false } };
      const r = await lighthouse(`http://127.0.0.1:4173/hr-ops#/${p}`, flags);
      const lhr = r.lhr;
      const fails = Object.values(lhr.audits).filter((a) => a.score === 0 && a.scoreDisplayMode === 'binary').map((a) => a.id);
      out.push({ form, page: p, score: Math.round(lhr.categories.accessibility.score * 100), failing: fails });
    }
  }
} finally {
  await chrome.kill();
}
console.log(JSON.stringify(out, null, 1));

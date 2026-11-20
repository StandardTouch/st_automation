// Browser-console responsive sweep used for UX_RETEST_RESULTS.md.
// Usage: log in, open http://<site>/hr-ops in Chrome, paste this file into the
// DevTools console, then run:   await __run(390, 844); __report(390)
// It loads /hr-ops in a same-origin iframe of the exact CSS size (so media
// queries respond to the iframe width, not the window), visits every sidebar
// route and reports: the real viewport, page-level horizontal scroll, controls
// whose box lies outside the viewport (excluding scroll containers and the
// off-canvas sidebar) and icon-only buttons with no accessible name.
// It does not click anything and changes no data. Run widths one at a time
// (each run takes ~20 s).
window.__routes = ['recruitment-pipeline', 'job-openings', 'my-interviews', 'offer-letters', 'onboarding-pipeline', 'exit-pipeline', 'payroll-command', 'run-payroll', 'salary-structures', 'loans', 'salary-slips', 'staff-feedback', 'my-feedback', 'feedback-analytics', 'templates', 'diagnostics'];
window.__mk = async (w, h) => {
  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;background:#222;display:flex;justify-content:center';
  const f = document.createElement('iframe');
  f.id = 'vp';
  f.style.cssText = `width:${w}px;height:${h}px;border:0;background:#fff`;
  f.src = '/hr-ops#/recruitment-pipeline';
  document.body.appendChild(f);
  await new Promise((r) => (f.onload = r));
  await new Promise((r) => setTimeout(r, 2500));
  return f;
};
window.__measure = (f) => {
  const d = f.contentDocument, W = f.contentWindow.innerWidth, bad = [];
  d.querySelectorAll('button,a,input,select,th,td,h1,h2,h3,[role=dialog]').forEach((e) => {
    if (e.closest('aside,nav')) return;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) return;
    let p = e.parentElement, scroll = false;
    while (p && p !== d.body) {
      const o = f.contentWindow.getComputedStyle(p).overflowX;
      if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) { scroll = true; break; }
      p = p.parentElement;
    }
    if (!scroll && (r.right > W + 1 || r.left < -1)) {
      bad.push((e.getAttribute('aria-label') || e.innerText || e.tagName).trim().slice(0, 25) + '@' + Math.round(r.left) + '-' + Math.round(r.right));
    }
  });
  const unnamed = [...d.querySelectorAll('button')].filter((b) => !b.closest('aside,nav') && !(b.innerText || '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length;
  return { pageHScroll: d.documentElement.scrollWidth > W + 1, clipped: bad.slice(0, 4), n: bad.length, unnamedMainBtns: unnamed };
};
window.__out = {};
window.__run = async (w, h) => {
  const f = await window.__mk(w, h);
  const o = { vp: f.contentWindow.innerWidth + 'x' + f.contentWindow.innerHeight, routes: {} };
  window.__out[w] = o;
  for (const r of window.__routes) {
    f.contentWindow.location.hash = '#/' + r;
    await new Promise((x) => setTimeout(x, 1000));
    o.routes[r] = window.__measure(f);
  }
  o.done = true;
};
window.__report = (w) => {
  const o = window.__out[w];
  return JSON.stringify({ viewport: o.vp, routes: Object.keys(o.routes).length, issues: Object.entries(o.routes).filter(([, v]) => v.pageHScroll || v.n || v.unnamedMainBtns).map(([k, v]) => [k, v.pageHScroll, v.clipped, v.unnamedMainBtns]) });
};

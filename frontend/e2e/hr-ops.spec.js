import AxeBuilder from '@axe-core/playwright';
import { test, expect, mockApi, summary, emp, hasHeaderOverflow } from './fixtures.js';

const go = (page, route) => page.goto(`/hr-ops#/${route}`);
const isDesktop = (page) => page.viewportSize().width >= 1024;

test.describe('Payroll readiness and confirmation (mocked API, nothing real runs)', () => {
  test('blocked when nobody has a salary structure', async ({ page }) => {
    await mockApi(page, { 'payroll.get_payroll_dashboard_summary': () => summary({ assigned_structure_count: 0, missing_structure_count: 10, readiness_score: 0 }) });
    await go(page, 'payroll-command');
    await expect(page.getByTestId('payroll-readiness-pill')).toContainText('Action needed');
    await expect(page.getByRole('heading', { name: "Payroll isn't ready" })).toBeVisible();
    await expect(page.getByRole('button', { name: /run payroll now/i })).toHaveCount(0);
    await page.getByRole('button', { name: /set up salary structures/i }).click();
    await expect(page).toHaveURL(/#\/salary-structures$/);
  });

  test('partly ready and ready states', async ({ page }) => {
    await mockApi(page, { 'payroll.get_payroll_dashboard_summary': () => summary({ assigned_structure_count: 6, missing_structure_count: 4, readiness_score: 60 }) });
    await go(page, 'payroll-command');
    await expect(page.getByTestId('payroll-readiness-pill')).toContainText(/partly ready/i);
    await expect(page.getByRole('button', { name: /review & run payroll/i })).toBeVisible();

    const ready = await page.context().newPage();
    await mockApi(ready);
    await ready.goto('/hr-ops#/payroll-command');
    await expect(ready.getByTestId('payroll-readiness-pill')).toContainText('Ready for');
    await expect(ready.getByRole('button', { name: /run payroll now/i })).toBeEnabled();
  });

  test('run requires period confirmation and exclusion acknowledgement, then sends the snapshot', async ({ page }) => {
    const calls = await mockApi(page, {
      'payroll.get_payroll_eligibility': () => ({ snapshot: 'SNAP1', eligible: [emp(1), emp(2)], excluded: [{ ...emp(3), reason: 'No salary structure assignment effective by 2026-11-30' }], not_applicable: [] }),
      'payroll.run_payroll_and_report': () => ({ successful: [], failed: [], total_processed: 0, total_gross: 0, total_deductions: 0, total_net_payout: 0, payroll_entry: 'PE-MOCK' }),
    });
    await go(page, 'run-payroll');
    const start = page.getByRole('button', { name: /start payroll processing/i });
    await expect(page.getByText('Included: 2 employees')).toBeVisible();
    await expect(page.getByText(/Person 3 \(E3\)/)).toBeVisible();
    await expect(page.getByText(/No salary structure assignment effective/)).toBeVisible();
    await expect(start).toBeDisabled();
    await page.getByTestId('confirm-period').check();
    await expect(start).toBeDisabled();
    await page.getByTestId('ack-excluded').check();
    await expect(start).toBeEnabled();
    await start.click();
    await expect.poll(() => calls.some((c) => c.method === 'payroll.run_payroll_and_report')).toBe(true);
    const run = calls.find((c) => c.method === 'payroll.run_payroll_and_report');
    expect(run.params.eligibility_snapshot).toBe('SNAP1');
    expect(JSON.parse(run.params.acknowledged_excluded)).toEqual(['E3']);
    expect(run.params.start_date).toMatch(/-01$/);
  });

  test('a changed eligibility list invalidates the acknowledgement and nothing runs', async ({ page }) => {
    let n = 0;
    const calls = await mockApi(page, {
      'payroll.get_payroll_eligibility': () => (++n === 1
        ? { snapshot: 'SNAP1', eligible: [emp(1)], excluded: [emp(2)], not_applicable: [] }
        : { snapshot: 'SNAP2', eligible: [emp(1), emp(2)], excluded: [emp(3)], not_applicable: [] }),
    });
    await go(page, 'run-payroll');
    await page.getByTestId('confirm-period').check();
    await page.getByTestId('ack-excluded').check();
    await page.getByRole('button', { name: /start payroll processing/i }).click();
    await expect(page.getByTestId('eligibility-changed')).toBeVisible();
    await expect(page.getByTestId('ack-excluded')).not.toBeChecked();
    await expect(page.getByRole('button', { name: /start payroll processing/i })).toBeDisabled();
    expect(calls.some((c) => c.method === 'payroll.run_payroll_and_report')).toBe(false);
  });

  test('blocked when nobody is eligible', async ({ page }) => {
    await mockApi(page, { 'payroll.get_payroll_eligibility': () => ({ snapshot: 'S', eligible: [], excluded: [emp(1), emp(2)], not_applicable: [] }) });
    await go(page, 'run-payroll');
    await expect(page.getByTestId('run-payroll-readiness-warning')).toContainText(/can't run yet/i);
    await expect(page.getByRole('button', { name: /start payroll processing/i })).toBeDisabled();
  });
});

test.describe('Salary structures and bulk assignment (mocked)', () => {
  test('assign dialog explains the dead end; new structure form opens and closes with Escape', async ({ page }) => {
    await mockApi(page);
    await go(page, 'salary-structures');
    await page.getByRole('button', { name: 'Assign Structure' }).click();
    await expect(page.getByTestId('assign-no-structures')).toBeVisible();
    await expect(page.getByRole('button', { name: /^assign structure$/i }).last()).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: /new structure/i }).first().click();
    await expect(page.getByRole('dialog', { name: /new salary structure/i })).toBeVisible();
    await expect(page.getByText('Structure Name')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('bulk assignment: validate, dry-run preview, explicit confirmation, then write (mock)', async ({ page }) => {
    const calls = await mockApi(page, {
      'payroll.get_salary_structures': () => [{ name: 'Basic', company: 'Acme' }],
      'payroll.get_unassigned_employees': () => [emp(1, { designation: 'Dev' }), emp(2)],
      'payroll.bulk_assign_salary_structure': (p) => (Number(p.dry_run)
        ? { dry_run: true, valid: true, problems: [], preview: JSON.parse(p.assignments) }
        : { __message: 'Created 1 salary structure assignment(s).', data: { count: 1, created: ['SSA-1'] } }),
    });
    await go(page, 'salary-structures');
    await page.getByRole('button', { name: 'Assign to many' }).click();
    const preview = page.getByRole('button', { name: /preview changes/i });
    await expect(preview).toBeDisabled();
    await page.getByRole('checkbox', { name: 'Select Person 1' }).check();
    await page.getByLabel('Salary structure').selectOption('Basic');
    await expect(preview).toBeDisabled();
    await expect(page.getByTestId('bulk-local-problems')).toContainText(/base salary/i);
    await page.getByLabel('Base salary for Person 1').fill('30000');
    await expect(preview).toBeEnabled();
    await preview.click();
    await expect(page.getByTestId('bulk-step-2')).toContainText(/no assignments have been created yet/i);
    expect(calls.filter((c) => c.method === 'payroll.bulk_assign_salary_structure' && Number(c.params.dry_run) === 0)).toHaveLength(0);
    const create = page.getByRole('button', { name: /create assignments/i });
    await expect(create).toBeDisabled();
    await page.getByTestId('bulk-confirm').check();
    await create.click();
    await expect.poll(() => calls.filter((c) => c.method === 'payroll.bulk_assign_salary_structure' && Number(c.params.dry_run) === 0).length).toBe(1);
    const write = calls.find((c) => c.method === 'payroll.bulk_assign_salary_structure' && Number(c.params.dry_run) === 0);
    expect(write.params.confirmed).toBe(1);
    expect(JSON.parse(write.params.assignments)).toEqual([{ employee: 'E1', salary_structure: 'Basic', base: '30000', from_date: expect.any(String) }]);
  });

  test('bulk assignment shows server validation problems and blocks creation', async ({ page }) => {
    await mockApi(page, {
      'payroll.get_salary_structures': () => [{ name: 'Basic', company: 'Acme' }],
      'payroll.get_unassigned_employees': () => [emp(1)],
      'payroll.bulk_assign_salary_structure': (p) => ({ dry_run: true, valid: false, problems: [{ index: 0, employee: 'E1', errors: ['Employee already has a salary structure assignment.'] }], preview: JSON.parse(p.assignments) }),
    });
    await go(page, 'salary-structures');
    await page.getByRole('button', { name: 'Assign to many' }).click();
    await page.getByRole('checkbox', { name: 'Select Person 1' }).check();
    await page.getByLabel('Salary structure').selectOption('Basic');
    await page.getByLabel('Base salary for Person 1').fill('1000');
    await page.getByRole('button', { name: /preview changes/i }).click();
    await expect(page.getByRole('alert')).toContainText(/already has a salary structure/i);
    await expect(page.getByTestId('bulk-confirm')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /create assignments/i })).toBeDisabled();
  });
});

test.describe('Feedback rating conflict (mocked)', () => {
  const interview = { interview_id: 'INT-1', applicant_id: 'A1', applicant_name: 'Alice', job_title: 'QA', status: 'Pending', scheduled_on: '2026-11-12T10:00:00', has_feedback: false };
  test('contradiction needs an explanation, then is submitted with it', async ({ page }) => {
    const calls = await mockApi(page, {
      'recruitment.get_my_interviews': () => ({ interviews: [interview] }),
      'recruitment.submit_interview_feedback': () => ({ __message: 'Feedback saved', data: {} }),
    });
    await go(page, 'my-interviews');
    await page.getByRole('button', { name: /submit feedback/i }).first().click();
    const dialog = page.getByRole('dialog', { name: /interview scorecard/i });
    await dialog.getByRole('button', { name: '1 star' }).click();
    await dialog.getByRole('button', { name: /strong hire/i }).click();
    const submit = dialog.getByRole('button', { name: /submit scorecard/i });
    await expect(dialog.getByTestId('rating-mismatch-warning')).toBeVisible();
    await dialog.getByPlaceholder(/candidate strengths/i).fill('Strong answers overall');
    await expect(submit).toBeDisabled();
    await dialog.getByTestId('conflict-explanation').fill('Stars were set by mistake');
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect.poll(() => calls.some((c) => c.method === 'recruitment.submit_interview_feedback')).toBe(true);
    const sent = calls.find((c) => c.method === 'recruitment.submit_interview_feedback');
    expect(sent.params).toMatchObject({ rating: 1, recommendation: 'Strong Hire', conflict_explanation: 'Stars were set by mistake' });
  });

  test('consistent feedback needs no explanation', async ({ page }) => {
    await mockApi(page, { 'recruitment.get_my_interviews': () => ({ interviews: [interview] }) });
    await go(page, 'my-interviews');
    await page.getByRole('button', { name: /submit feedback/i }).first().click();
    const dialog = page.getByRole('dialog', { name: /interview scorecard/i });
    await expect(dialog.getByTestId('rating-mismatch-warning')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: /submit scorecard/i })).toBeEnabled();
  });
});

test.describe('Routing and navigation', () => {
  test('deep link, sidebar navigation updates the URL, unknown route shows a notice', async ({ page }) => {
    await mockApi(page);
    await go(page, 'job-openings');
    await expect(page.getByRole('heading', { name: 'Job Openings' })).toBeVisible();
    if (isDesktop(page)) {
      await page.getByRole('button', { name: 'Salary Structures' }).click();
      await expect(page).toHaveURL(/#\/salary-structures$/);
      await expect(page.getByRole('heading', { name: 'Salary Structures' })).toBeVisible();
    }
    const other = await page.context().newPage();
    await mockApi(other);
    await other.goto('/hr-ops#/bogus-page');
    await expect(other.getByTestId('route-not-found')).toContainText('#/bogus-page');
    await other.getByRole('button', { name: 'Dismiss' }).click();
    await expect(other.getByTestId('route-not-found')).toHaveCount(0);
  });

  test('header actions are scoped to their module', async ({ page }) => {
    await mockApi(page);
    await go(page, 'payroll-command');
    await expect(page.getByRole('button', { name: 'Quick Incentive' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Candidate' })).toHaveCount(0);
    await go(page, 'recruitment-pipeline');
    await expect(page.getByRole('button', { name: 'Add Candidate' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quick Incentive' })).toHaveCount(0);
  });
});

test.describe('Dialog keyboard behaviour', () => {
  test('focus moves in, stays trapped, Escape closes, focus returns to the opener', async ({ page }) => {
    await mockApi(page);
    await go(page, 'recruitment-pipeline');
    const opener = page.getByRole('button', { name: 'Add Candidate' });
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: /quick add candidate/i });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    for (let i = 0; i < 30; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
});

const PAGES = ['recruitment-pipeline', 'job-openings', 'my-interviews', 'payroll-command', 'run-payroll', 'salary-structures', 'loans', 'salary-slips', 'diagnostics'];

test.describe('Layout and accessibility on every project width', () => {
  for (const route of PAGES) {
    test(`${route}: no horizontal scroll, header in viewport, buttons named, axe`, async ({ page }, info) => {
      await mockApi(page);
      await go(page, route);
      await expect(page.locator('main h2').first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, 'page-level horizontal scroll').toBeLessThanOrEqual(1);
      expect(await hasHeaderOverflow(page), 'header controls outside the viewport').toBe(0);
      const unnamed = await page.evaluate(() => [...document.querySelectorAll('main button')].filter((b) => !(b.innerText || '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length);
      expect(unnamed, 'icon-only buttons without a name').toBe(0);
      const small = await page.evaluate(() => [...document.querySelectorAll('header button, header select, main button, main a, main select, main input:not([type=checkbox]):not([type=radio])')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && (r.width < 24 || r.height < 24); }).map((e) => `${(e.getAttribute('aria-label') || e.innerText || e.tagName).trim().slice(0, 24)} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
      expect(small, 'interactive targets smaller than 24x24px (WCAG 2.5.8)').toEqual([]);
      const axe = await new AxeBuilder({ page }).analyze();
      await info.attach('axe-violations.json', { body: JSON.stringify(axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0]?.target })), null, 2), contentType: 'application/json' });
      const blocking = axe.violations.filter((v) => ['critical', 'serious'].includes(v.impact) && v.id !== 'color-contrast'); // contrast has its own tests below
      expect(blocking.map((v) => v.id), 'critical/serious axe violations').toEqual([]);
    });
  }
});

for (const scheme of ['light', 'dark']) {
  test.describe(`Colour contrast, ${scheme} theme`, () => {
    test.use({ colorScheme: scheme });
    for (const route of PAGES) {
      test(`${route}: WCAG AA text contrast`, async ({ page }) => {
        await mockApi(page);
        await go(page, route);
        await expect(page.locator('main h2').first()).toBeVisible();
        await page.waitForTimeout(800); // let the fade-in animation finish: axe samples mid-animation colours otherwise
        const res = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
        const nodes = res.violations.flatMap((v) => v.nodes.map((n) => `${n.any[0]?.data?.contrastRatio} ${n.target.join(' ')}`));
        expect(nodes).toEqual([]);
      });
    }
  });
}

const inside = (dialog, page) => dialog.evaluate((d) => d.contains(document.activeElement));
async function keyboardChecks(page, dialog, tabs = 20) {
  await expect(dialog).toBeVisible();
  expect(await inside(dialog, page), 'focus moved into dialog').toBe(true);
  for (let i = 0; i < tabs; i += 1) {
    await page.keyboard.press('Tab');
    expect(await inside(dialog, page), `focus escaped dialog after ${i + 1} Tabs`).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await inside(dialog, page)).toBe(true);
}

test.describe('Remaining dialogs (mocked)', () => {
  const separations = {
    separations: [
      { name: 'SEP-1', employee: 'E1', employee_name: 'Person 1', designation: 'Dev', department: 'Eng', percent_complete: 100, boarding_status: 'Pending', employee_status: 'Active', resignation_letter_date: '2026-11-01', tasks: [{ name: 'T0', subject: 'Handover', status: 'Completed' }] },
      { name: 'SEP-2', employee: 'E2', employee_name: 'Person 2', designation: 'Dev', department: 'Eng', percent_complete: 50, boarding_status: 'Pending', employee_status: 'Active', resignation_letter_date: '2026-11-02', tasks: [{ name: 'T1', subject: 'Exit Documents', status: 'Open', assigned_to_names: [] }] },
    ],
  };

  test('Mark as Left: opens, traps focus, Escape closes without calling the API', async ({ page }) => {
    const calls = await mockApi(page, { 'exit.get_exit_pipeline': () => separations });
    await go(page, 'exit-pipeline');
    await page.getByText('Person 1', { exact: true }).click();
    const opener = page.getByRole('button', { name: /mark as left/i });
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: /mark employee as left/i });
    await keyboardChecks(page, dialog);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(calls.some((c) => /mark_employee_left|mark_left/i.test(c.method))).toBe(false);
  });

  test('Exit Documents: opens, traps focus, Escape closes without sending anything', async ({ page }) => {
    const calls = await mockApi(page, { 'exit.get_exit_pipeline': () => separations, 'exit.preview_exit_documents': () => ({ documents: [] }) });
    await go(page, 'exit-pipeline');
    await page.getByText('Person 2', { exact: true }).click();
    const opener = page.getByRole('button', { name: /generate documents/i }).first();
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: /exit documents/i });
    await keyboardChecks(page, dialog);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(calls.some((c) => /send_exit_documents/.test(c.method))).toBe(false);
  });

  test('My Feedback detail: decoded text, traps focus, Escape closes', async ({ page }) => {
    await mockApi(page, { 'feedback.get_my_feedback': () => [{ name: 'FB-1', feedback_type: 'General Feedback', title: 'Calm &amp; quiet office', feedback: 'Nice &lt;b&gt;place&lt;/b&gt;', rating: 4, date: '2026-11-01', status: 'Open', is_anonymous: 1 }] });
    await go(page, 'my-feedback');
    await expect(page.getByText('Calm & quiet office').first()).toBeVisible(); // entities decoded for display
    await page.getByText('Calm & quiet office').first().click();
    const dialog = page.getByRole('dialog', { name: /feedback details/i });
    await keyboardChecks(page, dialog);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('Visual check: template titles (F-17)', () => {
  test('long identical template titles wrap to two lines and stay distinguishable', async ({ page }) => {
    const long = (n, co) => ({ name: `HR-EMP-ONT-00${n}`, title: `Standard Onboarding - StandardTouch - Department ${n} - ${co}`, company: co });
    await mockApi(page, { 'template.get_templates': () => ({ templates: [long(1, 'StandardTouch DAB'), long(2, 'StandardTouch KSA')] }) });
    await go(page, 'templates');
    const h3 = page.locator('main h3').first();
    await expect(h3).toBeVisible();
    const cls = await h3.getAttribute('class');
    expect(cls).toContain('line-clamp-2');
    const { scrollW, clientW } = await h3.evaluate((e) => ({ scrollW: e.scrollWidth, clientW: e.clientWidth }));
    expect(scrollW).toBeLessThanOrEqual(clientW + 1); // wraps instead of overflowing
    await page.screenshot({ path: 'e2e/screenshots/templates-long-titles.png' });
  });
});

// Source-level regression tests for the confirmed UX audit defects.
// Run with: npm test   (uses Node's built-in runner, no extra dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (p) => readFileSync(path.join(root, p), 'utf8');

test('F-03: every sidebar item id is a routable tab and is rendered by App', () => {
  const sidebar = read('components/layout/Sidebar.jsx');
  const app = read('App.jsx');
  const ids = [...sidebar.matchAll(/\{ id: '([a-z-]+)'/g)].map((m) => m[1]);
  assert.ok(ids.length >= 16, `expected >=16 sidebar ids, got ${ids.length}`);
  const valid = app.match(/const VALID_TABS = \[([\s\S]*?)\];/)[1];
  for (const id of ids) {
    assert.ok(valid.includes(`'${id}'`), `${id} missing from VALID_TABS (URL would not update)`);
  }
});

test('F-03: unknown routes show a not-found notice', () => {
  const app = read('App.jsx');
  assert.match(app, /data-testid="route-not-found"/);
});

test('F-01: payroll banner is driven by readiness, not hard-coded "Ready"', () => {
  const src = read('modules/payroll/PayrollDashboard.jsx');
  assert.match(src, /readyState/);
  assert.doesNotMatch(src, /<span>Ready for \{months/, 'hard-coded Ready pill is back');
  assert.match(src, /assignedCount === 0/);
});

test('F-01: Run Payroll page disables start when no employee has a structure', () => {
  const src = read('modules/payroll/RunPayrollWizard.jsx');
  assert.match(src, /disabled=\{!canStart\}/);
});

test('F-02: Assign Structure modal explains and offers a way out when none exist', () => {
  const src = read('modules/payroll/AssignSalaryStructureModal.jsx');
  assert.match(src, /data-testid="assign-no-structures"/);
  assert.match(src, /onCreateStructure/);
});

test('F-04: custom dialogs close on Escape', () => {
  for (const f of ['modules/onboarding/StartOnboardingModal.jsx', 'modules/exit/StartSeparationModal.jsx', 'modules/recruitment/OfferLettersView.jsx']) {
    assert.match(read(f), /useEscapeClose\(/, `${f} has no Escape handler`);
  }
});

test('F-05: offer letter generator is height-bounded and scrollable', () => {
  assert.match(read('modules/recruitment/OfferLettersView.jsx'), /aria-label="Generate Offer Letter"[^>]*max-h-\[calc\(100vh/);
});

test('F-06: scorecard warns on contradictory rating and recommendation', () => {
  assert.match(read('modules/recruitment/FeedbackScorecardModal.jsx'), /data-testid="rating-mismatch-warning"/);
});

test('F-07: header does not rely on visible labels below xl', () => {
  const src = read('components/layout/TopHeader.jsx');
  assert.doesNotMatch(src, /hidden sm:inline">(Add Candidate|Quick Incentive)/);
  assert.match(src, /aria-label="Quick Incentive"/);
});

test('F-23: icon-only buttons have accessible names', () => {
  for (const f of ['modules/feedback/FeedbackFormView.jsx', 'modules/feedback/FeedbackCardLayoutView.jsx', 'modules/recruitment/FeedbackScorecardModal.jsx']) {
    assert.match(read(f), /aria-label=\{`\$\{star\} star/, `${f} star buttons unnamed`);
  }
  assert.match(read('modules/templates/TemplateListPage.jsx'), /aria-label=\{`Edit template/);
});

test('F-10/F-15: labels match page titles', () => {
  assert.doesNotMatch(read('modules/payroll/LoanApplicationWizard.jsx'), /4-Step/);
  assert.doesNotMatch(read('modules/recruitment/MyInterviewsView.jsx'), />My Scheduled Interviews</);
});

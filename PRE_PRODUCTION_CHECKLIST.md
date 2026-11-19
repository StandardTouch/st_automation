# Pre-Production Checklist — HR Operations UX release

Date: 2026-11-18. Branch `Amir-Cloud`. **Nothing committed, deployed or restarted.** No live business operation (payroll run, bulk assignment, feedback submit, email, delete) was executed against any site. All write paths were exercised only through mocks.
Continues `FINAL_UX_QA_REPORT.md`.

## FINAL RECOMMENDATION: **NO-GO**

Reasons (critical, unresolved):
1. No test has ever run payroll eligibility, payroll creation, duplicate-slip protection, bulk assignment or feedback storage against a real Frappe database. Those flows are the release's highest-risk code.
2. The live app could not be re-verified after the last changes (dev web server on :8000 is down; see "Outstanding blockers").
3. Business-rule defaults, a brand-colour change and a payroll/readiness inconsistency still need owner sign-off.

Everything the UI/UX audit raised is implemented, and the mocked browser, component, unit and accessibility suites are green. That is necessary, not sufficient.

**Heads-up:** the bench's default site is named `st-prod` (`sites/common_site_config.json`). If it holds production data, treat "shared development data" as production. My exploration was read-only.

## 1. Verified fixes

All F-01…F-25 are covered in `FINAL_UX_QA_REPORT.md` (live-browser evidence from earlier rounds). Since then, newly verified with the **mocked-API Playwright suite** (built app, local Chrome, 3 widths):
- F-17 template titles wrap to two lines and stay distinguishable (screenshot `frontend/e2e/screenshots/templates-long-titles.png`, reviewed).
- Exit Documents, Mark as Left and My Feedback detail dialogs: open, trap focus (20 Tabs + Shift+Tab), Escape closes, no API write.
- Touch targets ≥24px on 9 pages x 3 widths; no page-level horizontal scroll; header controls inside viewport; no unnamed buttons.
- Real accessibility defects found and fixed by axe/Playwright this round: unlabelled `select` elements (critical `select-name`) on pipeline and payroll pages; scrollable regions not keyboard-focusable (pipeline board, salary slips); modal dialogs without an accessible name when the title was not a plain string (now `aria-labelledby`); search button visible/accessible name mismatch; muted-grey and red text below AA in both themes; coloured buttons (success/warning/danger) below AA.

## 2. Outstanding blockers

| # | Blocker | Needed to close |
|---|---|---|
| B1 | No real-database integration tests (payroll eligibility SQL/ORM calls, `run_payroll_and_report` end to end, duplicate-slip protection, `bulk_assign_salary_structure` write + rollback, feedback storage) | An authorized isolated Frappe site with sanitized data (see section 5) |
| B2 | Live app not retested after final changes. Dev web server for this bench is not listening on :8000 (honcho runs, no web listener; :8002 is a different project `kamra_PR`). I did not start or restart anything | Owner starts the bench web process, then re-run the console sweeps / manual smoke |
| B3 | Duplicate payroll protection is by code reading only (see rule 5 below) | B1 |
| B4 | Payroll Overview "readiness %" (`get_payroll_dashboard_summary`) uses a simpler count than the new eligibility rules (it ignores effective date, structure active/submitted state, joining/relieving). Overview and Run page can disagree | Decide: reuse `_fetch_payroll_eligibility` in the summary. Not changed (out of scope, touches existing business logic) |
| B5 | Filled brand red darkened `#ED1D24` → `#DC1A21` for AA contrast of white text; light/dark text-grey/red overrides in `index.css` | Design owner approval, or revert and accept 4.37:1 on red buttons |
| B6 | Business-rule defaults need approval (section 3) | Product/payroll owner |
| B7 | ERPNext rules not reproduced in eligibility: salary structure `payroll_frequency`, structure company, Payroll Entry filters (branch/department/designation), attendance-based pay, holiday lists | Compare against ERPNext's `get_emp_list` on a test site |
| B8 | Race window: eligibility is recomputed and checked at the start of `run_payroll_and_report`; it is not locked for the rest of the run | Accept, or lock/re-validate before submission |
| B9 | Lighthouse and the axe sweep ran on the built app with **mocked data** (authenticated session cannot be handed to them safely). Real data (long lists, odd names) not covered; sidebar and some dialogs not axe-scanned | Run authenticated against the isolated site |
| B10 | Screen-reader testing, real-user testing, dark/light visual review by a designer: not done | Manual QA |
| B11 | Playwright tests validate UI behaviour against **my fixtures**; if a backend response shape differs from `e2e/mock-data.js`, tests can pass while the app fails | B1 plus contract checks |

## 3. Business rules and their test coverage

| Rule | Implementation | Coverage | Gap |
|---|---|---|---|
| Included/excluded computed correctly; effective dates, superseded assignments, status, period | `_classify_payroll_employees`: latest submitted assignment effective on/before period end wins; its structure must be submitted + active; not-applicable = non-Active, joins after period, relieved before period | 13 unit tests (boundary dates, superseded to inactive/newer, draft/missing structure, joining/relieving inside/outside period, mixed population) | Real-DB queries untested; ERPNext extras (B7) |
| Confirmation tied to period **and** exact eligibility snapshot | `_eligibility_snapshot` hashes company + period + eligible (employee, assignment, structure) + excluded; server recomputes it on every run | 3 snapshot tests (order-independent; changes with period, company, membership, structure, assignment) + 5 server-side gate tests | none beyond B8 |
| Backend validation cannot be bypassed | `run_payroll_and_report` checks eligible > 0, snapshot, acknowledgement before any data access; UI is not trusted | Tests assert refusal happens before `get_doc`/`new_doc`; valid request reaches payroll code | whitelisted-call permission behaviour on a real site |
| Changed eligibility invalidates acknowledgement | Stale snapshot rejected server-side; UI re-fetches right before running, resets confirmation and acknowledgement | backend tests, component test, e2e test (all pass) | race B8 |
| No double processing for same employee + period | Existing logic: submitted Payroll Entry → only employees without a slip are processed (supplementary run); existing non-cancelled slips → resume instead of create; ERPNext rejects duplicate slips | Code review only | **not tested** (B3) |
| Partial payroll supported | Allowed only with confirmed snapshot + acknowledged excluded list; zero eligible refused | unit + component + e2e | live run |
| Feedback contradiction rule | rating ≤2 with Strong Hire/Strongly Recommend, or ≥4 with Fail/Do Not Recommend → explanation ≥15 chars required, stored in the comment; UI and backend; history untouched | backend matrix + rejected-before-save tests, component tests, e2e test | real submission (B1) |
| Bulk assignment ≤200 rows, atomic, server-validated | dry run default; write needs `dry_run=0` and `confirmed=1`; all-or-nothing with `frappe.db.rollback()` | tests for >200 refused, exactly 200 accepted, no write without confirmation, rollback on mid-batch failure (mock), validation matrix (8 tests) | real transaction behaviour (B1) |

**Approval needed:** conflict thresholds and 15-character minimum; "already assigned" = any submitted assignment, regardless of date; partial payroll only with acknowledgement; eligible = employee's company equals the run's company.

## 4. Test results

| Suite | Command (from `frontend/` unless noted) | Result |
|---|---|---|
| Backend unit (mocked `frappe`, no DB) | `cd apps/st_automation && ../../env/bin/python -m unittest st_automation.tests.test_ux_rules` | **50 / 50 pass** |
| Source-level regression | `npm test` (first stage) | 11 / 11 pass (not behaviour tests) |
| Component (vitest, jsdom, axe) | `npm run test:unit` | **23 / 23 pass** |
| Browser end-to-end, mocked API, local Chrome, 390/820/1440 | `npm run test:e2e` | **132 / 132 pass** (44 tests x 3 widths) |
| Lighthouse accessibility, 6 pages x mobile/desktop, mocked data | `npm run test:lighthouse` | score **100** on all 12 runs. Desktop reports `label-content-name-mismatch` (weight 0) because `<select>` visible text is its option list: judged a false positive, left as is |
| Database integration | none | **NOT RUN / BLOCKED** |

E2E coverage: payroll blocked/partial/ready banners; run requires period confirmation + acknowledgement and sends snapshot; changed eligibility drops confirmation; zero-eligible block; assign dead-end; New Structure form; bulk assignment (validation, dry run, confirmation, mocked write, server problems); feedback conflict (required explanation) and consistent feedback; routing, deep link, not-found, header scoping; dialog keyboard behaviour (5 dialogs); layout/axe/touch-target on 9 pages x 3 widths; WCAG AA contrast on 9 pages x light + dark; F-17 visual.
Known limits: `e2e/results.json` and screenshots are git-ignored; tests run against `st_automation/public/frontend` (run `vite build` first, done by `npm run test:e2e`).

## 5. Database integration test status and plan

Status: **not started — blocked.** Creating a Frappe test site needs MariaDB root credentials and authorization, and bench `run-tests` writes to the active site. I did not attempt it.
Plan (on an isolated site, e.g. `bench new-site st-test` with sanitized fixtures, never `st-prod`):
1. Fixtures: company, 6 employees (active, joining after period, relieved before period, relieved inside period), salary structures (active/inactive/draft), assignments (superseded, future-dated).
2. Assert `_fetch_payroll_eligibility` output and snapshot against the unit-test expectations.
3. Run `run_payroll_and_report` twice for one period: second run must create no new slips; add an employee mid-way: supplementary run only for that employee; stale snapshot refused.
4. `bulk_assign_salary_structure`: 200 rows OK, 201 refused, force a failure on row N and confirm no assignment remains.
5. `submit_interview_feedback`: conflict without/with explanation (in-app and token path), comment text stored.
6. Run the existing HRMS/ERPNext Payroll Entry on the same data and compare employee sets (B7).

## 6. Accessibility status

| Check | Result |
|---|---|
| axe-core in a real browser (local `@axe-core/playwright`), 9 pages x 3 widths | 0 critical/serious violations except contrast |
| Contrast AA, 9 pages x light and dark | pass after fixes (first measurement: 146 failing nodes on 5 pages in light, 57 in dark; final suite: 0 on all 9 pages in both themes) with the overrides in `index.css` and darker success/warning/danger buttons; filled red `#DC1A21` (B5) |
| Lighthouse accessibility | 100 on 12 runs (mocked data) |
| Keyboard: dialogs open, focus in, trapped, Escape, focus returns | pass in Playwright (5 dialogs) and earlier live checks |
| Accessible names | no unnamed icon buttons in main area; stars, templates, header, selects named; sidebar names not scanned live |
| Touch targets ≥24px | pass on 9 pages x 3 widths (WCAG 2.5.8 minimum; 44px not targeted) |
| Form error announcements | conflict field uses `aria-invalid` and `aria-describedby` (component-tested); other forms not audited; announcements not tested with a screen reader |
| Screen reader / zoom / reduced motion | **not tested** |
| Pages not in the 9-page scan (feedback, templates, onboarding, exit, offers) | layout-checked earlier on real data; axe/contrast not run on them |

## 7. Git change review

Pre-existing uncommitted work before this effort (from the session's initial status): `App.jsx`, `api/client.js`, `api/recruitmentApi.js`, `Sidebar.jsx`, `ApplicantDetailModal.jsx`, `KanbanBoard.jsx`, `QuickAddApplicantModal.jsx`, `api/recruitment.py`, and the built bundle files (old `index-Bn-Tz997.*` deleted, new hashed bundle, `index.html`). All were preserved; my edits are additive.

| Group | Files |
|---|---|
| Pre-existing only (untouched by UX work) | `api/client.js`, `QuickAddApplicantModal.jsx` |
| **Mixed** (pre-existing + UX edits; review hunks) | `App.jsx`, `api/recruitmentApi.js`, `Sidebar.jsx`, `ApplicantDetailModal.jsx`, `KanbanBoard.jsx`, `st_automation/api/recruitment.py` |
| UX work, modified | `package.json`, `package-lock.json`, `yarn.lock`, `index.css`, `api/payrollApi.js`, `common/{Button,Modal,SlideOver}.jsx`, `layout/TopHeader.jsx`, exit/feedback/onboarding/payroll/recruitment/template modules and `pages/InterviewFeedback.jsx` (see `git status`), `st_automation/api/payroll.py`, `st_automation/api/check.py`, `st_automation/test_payroll.py`, `scratch/test_payroll.py` |
| UX work, new | `common/{DialogA11y.jsx,Portal.jsx,useEscapeClose.js}`, `modules/payroll/BulkAssignStructureModal.jsx`, `src/utils/feedbackRules.js`, `frontend/{tests/,e2e/,vitest.config.js,playwright.config.js,.gitignore}`, `st_automation/api/payroll_cli.py`, `st_automation/tests/`, report documents |
| Build artifacts | `st_automation/public/frontend/index-DRJO00da.js`, `index-BERfEb8Q.css`, regenerated `index.html`; earlier hashed bundles removed. Rebuild right before committing |

Totals: 46 tracked files modified (+6,731 / −1,234 including lockfiles), plus new files.

Lockfile review:
- `package.json`: only dev dependencies added (`@axe-core/playwright`, `@playwright/test`, Testing Library x4, `axe-core`, `chrome-launcher`, `jsdom`, `lighthouse`, `vitest`) and four scripts. Runtime dependencies unchanged.
- `package-lock.json`: 182 → 438 packages; **0 existing package versions changed, 0 removed** (checked programmatically; `vite` 5.4.21 and `react` 18.3.1 unchanged).
- `yarn.lock`: rewritten by npm (≈2,400 changed lines, 406 removed lines, mostly regrouped entries such as `@esbuild/*`). Existing resolved versions were not verified one by one. Both lockfiles exist; if the team uses one tool, regenerate the other with that tool and review before commit, or restore `yarn.lock` from HEAD if yarn is not used.
- Playwright browser binaries are not committed (they live in `~/.cache/ms-playwright`); the suite uses installed Google Chrome.

Scripts reviewed (item 5): `check.py`, `test_payroll.py`, `scratch/test_payroll.py` now call `payroll_cli.run_payroll_checked`, which fetches eligibility, prints included/excluded, **refuses** if anyone is excluded unless `ST_ACK_EXCLUDED=1` is exported, then passes the real snapshot and the explicit list. Not bypassed; 3 unit tests. The scripts themselves still contain destructive dev actions (create loan, assign structures, delete drafts); they were not run.

## 8. Deployment prerequisites

1. Authorized isolated site, B1 tests green, B2 live smoke done.
2. Owner decisions: section 3 rules, B4 (summary vs eligibility), B5 (colour).
3. `cd frontend && npm ci && npm test && npm run test:e2e` (builds into `st_automation/public/frontend`), backend unit tests, then commit source + built bundle together.
4. Deploy backend and frontend **together**. A cached old bundle calls `run_payroll_and_report` without the snapshot and is refused by design (user sees "eligibility changed or was not confirmed"); bust browser cache (hashed bundle names do this) and `bench clear-website-cache`.
5. Python changes require `bench restart` (supervisor/gunicorn workers) at deploy time, by the owner.
6. No DocType changes, patches or migrations are included.
7. Review `yarn.lock` / `package-lock.json` (section 7).

## 9. Rollback considerations

- Code: revert the release commit(s) and rebuild/restore the previous bundle; no schema changes to undo.
- API compatibility: new endpoints (`get_payroll_eligibility`, `get_unassigned_employees`, `bulk_assign_salary_structure`) are additive. `run_payroll_and_report` changed behaviour (needs `eligibility_snapshot`); rolling back only the frontend would be refused by the new backend, and rolling back only the backend would ignore the extra arguments. Roll back both.
- Data written by the new features is not auto-reversed: bulk-created Salary Structure Assignments must be cancelled manually in ERPNext; feedback comments containing "Conflict explained:" remain; payroll entries/slips created after release follow normal ERPNext cancellation.
- Dev scripts that used the old signature now require `payroll_cli`.
- Keep the previous built bundle and `index.html` available for a quick swap.

## 10. Final GO / NO-GO

**NO-GO** until: B1 and B2 are closed, B4–B6 are decided, and an authorized isolated environment has successfully run the payroll, bulk-assignment and feedback workflows end to end.

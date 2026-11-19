# Final UX QA Report — Standard Touch HR Operations

> **Superseded by `PRE_PRODUCTION_CHECKLIST.md` (release gate, NO-GO).** Since this report: payroll eligibility now uses effective dates, superseded assignments and an eligibility snapshot enforced server-side; Playwright (132 tests), Lighthouse and axe were added and run on the mocked-API build; contrast, touch-target and dialog accessibility defects were fixed.

Date: 2026-11-18. Branch `Amir-Cloud`. **Nothing was committed.** Pre-existing uncommitted edits were kept; all changes are additive on top of them.
Safety: no payroll was run, no email sent, nothing deleted or submitted, no shared record changed. State-changing paths were exercised only through mocked unit/component tests, or as read-only dry runs. No disposable database was available, so live write tests are BLOCKED.
Evidence: screenshots in `/tmp/claude-chrome-screenshots-Mi2zsU/` (`screenshot-<id>.jpg`); sweep harness `frontend/tests/responsive-sweep.browser.js`; tests in `frontend/tests/` and `st_automation/tests/`.

## 1. Production readiness recommendation

**Not ready for production.** Visual/UX defects from the audit are largely closed and verified, but the business-critical write paths have never run against real data:

1. Payroll run with partial coverage (period confirmation + acknowledged exclusions) is enforced by backend code and mocked tests only. A real run was deliberately not executed.
2. Bulk salary structure assignment: dry-run preview and UI verified; the real write (`dry_run=0, confirmed=1`) is covered only by mocked tests (no ERPNext, no DB transaction/rollback behaviour tested).
3. Feedback conflict rule: verified in the browser (UI) and by mocked backend tests; a real submission was not made.
4. Axe in the real page and Lighthouse were not run (see section 5).
5. No automated real-browser end-to-end tests exist.
6. Dev scripts `st_automation/api/check.py`, `st_automation/test_payroll.py`, `scratch/test_payroll.py` call `run_payroll_and_report` without the new `period_confirmed`/`acknowledged_excluded` arguments and will now be refused by design.

Before release: run section 8's checklist on a disposable copy of the site (with an authorized, sanitized dataset), then `bench restart`.

## 2. Status of all 25 findings

Classification: FIXED & VERIFIED = tested in a browser. IMPLEMENTED BUT UNVERIFIED = code done, not browser-tested. BLOCKED = needs data change/authorization. NOT STARTED.

| ID | Issue | Status | Evidence / note |
|---|---|---|---|
| F-01 | Payroll "Ready" at 0% | **FIXED & VERIFIED** | Overview banner "Action needed / Payroll isn't ready" `…981238306` and `…979407641-47`; Run page lists 32 excluded from the **backend** eligibility API and keeps Start disabled. Partial/acknowledged path: component + backend unit tests only (no partial data on this site). Real run BLOCKED |
| F-02 | Assign Structure dead end | **FIXED & VERIFIED** (UI) / live write **BLOCKED** | Notice + disabled Assign `…979423202-48`; new "Assign to many" modal opened at 390/820/1440 and screenshot `…981712594-65`; preview is a server dry run; create path only mocked |
| F-03 | `salary-structures` route / unknown route | **FIXED & VERIFIED** | URL `#/salary-structures`; "Page not found" banner `…979443987-52` |
| F-04 | Escape / focus for dialogs | **FIXED & VERIFIED** for 12 dialogs; **IMPLEMENTED BUT UNVERIFIED** for Exit documents, Mark-as-left, My-Feedback detail | All 12 opened at 390/820/1440: focus inside, Escape closes. Real keyboard: 45 Tab presses stay inside, Escape closes, focus returns to opener |
| F-05 | Offer dialog taller than viewport | **FIXED & VERIFIED** | top 16 / bottom 1009 of 1025 `…979976394-58`; fits at 390/820/1440 |
| F-06 | Rating vs recommendation | **FIXED & VERIFIED** (new submissions) | Browser: 1 star + Strong Hire shows explanation field, Submit disabled `…981904453-67`; drawer stage "Shortlisted" `…981871546-66`; backend rule (>=15-char explanation, saved in the comment) unit-tested. Historical records untouched. Real submit BLOCKED |
| F-07 | Header clipped | **FIXED & VERIFIED** | 0 clipped controls on 16 routes at 390/820/1440 (section 3) |
| F-08 | Mobile Kanban | **FIXED & VERIFIED** | columns 289px, next peeks `…979994302-59` |
| F-09 | Offer table density | **FIXED & VERIFIED** | card layout below 1280px `…979994302-60` |
| F-10 | Labels vs titles | **FIXED & VERIFIED** | DOM read: "Scheduled Interviews", "Salary Slips", sidebar "Share Feedback" |
| F-11 | Escaped text in feedback | **FIXED & VERIFIED** | decoded text rendered, not HTML |
| F-12 | Duplicate API calls | **FIXED & VERIFIED** (first load) | Run Payroll reload: 14 requests, each endpoint once (was 29 with duplicates and `company=`). Company-switch reloads not measured |
| F-13 | Status colours | **FIXED & VERIFIED** (partial scope) | job title and candidate count no longer red (computed colour `rgb(203,213,225)`/grey). Feedback "Open" chip colour unchanged |
| F-14 | Desktop board width | **FIXED & VERIFIED** | columns 420px at 1920-wide viewport |
| F-15 | Loan wizard title | **FIXED & VERIFIED** | dialog title "Loan Application"; duplicate empty-state CTA still present |
| F-16 | Job card consistency | **FIXED & VERIFIED** (partial) | status badge, department/designation/vacancies rows with "—", toggle "On careers page"/"Not published" `…981712594-64`. Department stays a combobox (typing a new department is a feature) |
| F-17 | Truncated template titles | **IMPLEMENTED BUT UNVERIFIED** (class applied `line-clamp-2`, verified in DOM; no visual before/after screenshot) |
| F-18 | Raw IDs in selects | **FIXED & VERIFIED** | Separation options: "Auto-select for company", "Standard Separation - StandardTouch" |
| F-19 | Empty states | **FIXED & VERIFIED** | slips hint and "No loans yet" present |
| F-20 | Run page period | **FIXED & VERIFIED** | month/year selects on the page `…981238306-61` |
| F-21 | Interview list note | **FIXED & VERIFIED** | dialog explains why General Applicants are not listed (matches `get_active_candidates`) |
| F-22 | Locked checklist contrast | **FIXED & VERIFIED** (approx.) | chip "Locked until previous task is done", contrast 8.4:1 by my own luminance calculation, not an audit tool |
| F-23 | Accessible names | **FIXED & VERIFIED** | 0 unnamed buttons in main area on 16 routes x 3 widths; stars named "N star(s)". Sidebar/axe-in-browser not checked |
| F-24 | Global header actions | **FIXED & VERIFIED** | Quick Incentive only on payroll pages, Add Candidate only on recruitment pages (screenshots `…981238306-61`, `…981712594-64`); Ctrl+K still offers both |
| F-25 | System Readiness discoverability | **FIXED & VERIFIED** | Payroll Overview "View readiness checks" button (blocked/partial states) `…981712593-62` |

Counts: 24 FIXED & VERIFIED (F-01, F-02, F-06 with their live-write parts BLOCKED; F-04 with three dialogs unverified), 1 IMPLEMENTED BUT UNVERIFIED (F-17), 0 NOT STARTED. Sub-items still unverified/blocked are listed in section 7.

## 3. Responsive results (390 / 820 / 1440)

Method: same-origin iframe at exact CSS size; viewport read back from the page (`390x844`, `820x1100`, `1440x900`). Each of the 16 routes was visited. Measured: page-level horizontal scroll, controls outside the viewport (excluding scroll containers and off-canvas sidebar), unnamed icon buttons, targets <24px, text <11px.

| Route | 390 clipped / H-scroll / unnamed | 820 | 1440 |
|---|---|---|---|
| recruitment-pipeline, job-openings, my-interviews, offer-letters, onboarding-pipeline, exit-pipeline, payroll-command, run-payroll, salary-structures, loans, salary-slips, staff-feedback, my-feedback, feedback-analytics, templates, diagnostics | 0 / none / 0 on all 16 | 0 / none / 0 on all 16 | 0 / none / 0 on all 16 |

Before the fixes: 390px header buttons at x 385–489 off-screen on every route; 820px "Quick Incentive" at 699–860 clipped on every route; Templates 326 and Staff Feedback 5 unnamed buttons; My Feedback titles to x 596.

Small-target / tiny-text sweep (run before the last padding fix): Company select 221x20 on every page, job-card icons 16x16, template "Manage tasks" links 117x20, offer preset chips, 48 labels at 10px on Offer Letters, 11 on My Feedback. Fixes applied afterwards (select `py-1.5`, icon buttons padded to 28px, links padded, 10px→12px). **These last fixes were built but the sweep was not re-run**: status IMPLEMENTED BUT UNVERIFIED.

Screenshots reviewed at 390: Payroll Overview `…981712593-62`, Run Payroll `…-63`, Job Openings `…-64`, Bulk assign dialog `…-65`; at 820: offer list `…979994302-60`. Visual notes: Run Payroll period wraps to two lines and "Assign structure" squeezes to two lines at 390 (acceptable, not fixed); the bulk dialog's footer is below the table and needs a scroll inside the dialog on small screens (works, not ideal).

## 4. Dialogs at every width

12 dialogs opened by their real buttons, each checked for: fits viewport, focus lands inside, Escape closes.

| Dialog | 390 | 820 | 1440 |
|---|---|---|---|
| Add Candidate, Quick Incentive, New Structure, Assign Structure, Assign to many, New Loan Application, New Job Opening, Generate Offer Letter, Start Onboarding, Initiate Separation, Schedule Interview, Interview Scorecard | fit / focus / Esc: all 12 pass | all 12 pass | all 12 pass |

Residual: Generate Offer Letter has 8 controls <24px (preset chips, since enlarged, unverified) and New Loan 1 (advanced link, since padded, unverified). Dialogs not opened in a browser: Exit documents, Mark-as-left, My-Feedback detail, Offer preview, Command palette at 390/820.

## 5. Accessibility results

| Check | Result |
|---|---|
| axe-core in the real page | **BLOCKED**: loading axe from a CDN into the logged-in page was denied by the permission classifier; I did not retry or work around it |
| axe-core in jsdom (component level, colour-contrast and landmark rules off) | PASS: Modal, Run Payroll wizard, Bulk assign step 1 have 0 violations |
| Lighthouse | **NOT RUN** (needs install and an authenticated session; no safe session handoff) |
| Keyboard-only: open dialog with Enter, 45 Tabs, Escape | PASS in the real page (focus inside every Tab; Escape closes; focus back on opener "Generate Offer Letter") |
| Focus trap / return in all other dialogs | PASS for the shared Modal and wrapper in jsdom; real-browser: 12 dialogs focus-inside + Escape. Return-focus verified only for the offer dialog |
| Accessible names | 0 unnamed main-area buttons; sidebar not checked |
| Form labels | Bulk dialog and conflict textarea have `label`/`aria-label`; other forms not audited |
| Colour contrast | Only the locked chip measured (8.4:1, own calculation). Dark theme in general **NOT TESTED** with a tool |
| Error messages | Conflict textarea uses `aria-invalid`/`aria-describedby` (jsdom-tested); other error messages not audited |
| Screen reader semantics | `role="dialog"`, `aria-modal`, labels on dialogs; no screen reader was run |

Open findings: sidebar button names, contrast of low-opacity text, untested dialogs, `Date` picker semantics, Lighthouse/axe in-browser.

## 6. Functional and automated testing

| Suite | Command | Result |
|---|---|---|
| Source-level regression | `cd frontend && npm test` (first stage) | 11 / 11 pass (not a replacement for behaviour tests) |
| Component tests (vitest + Testing Library + axe-core, jsdom) | `npm run test:unit` | 21 / 21 pass: Modal keyboard/focus/Escape/return, DialogA11y, Run Payroll rules (blocked, partial + acknowledgement, period confirmation, load error), dashboard states, Assign modal notice, Bulk assign (validation, dry-run before write, explicit confirmation, server problems), feedback conflict |
| Backend unit tests (mocked `frappe`, no DB) | `cd apps/st_automation && ../../env/bin/python -m unittest st_automation.tests.test_ux_rules` | 30 / 30 pass: eligibility split, period token, acknowledgement rules, `run_payroll_and_report` refuses before touching data, bulk validation matrix, dry-run default / refusal without confirmation, feedback conflict matrix and explanation saved |
| Browser end-to-end automation | none | **NOT STARTED**: Playwright is not installed and needs an authenticated session or a mocked backend. Manual real-browser checks above and the console harness stand in; this is a gap |
| Backend tests against a real DB | none | **BLOCKED** (no disposable database) |

A bug caught by these tests: my first backend tests asserted the wrong response key (`success` instead of `status`) and passed vacuously; fixed and re-verified.

Functional browser checks this round (read-only): payroll banner states, Run page eligibility from the new API, assign notice, bulk modal open/preview gating, scorecard conflict UI (closed without submitting), route not-found, keyboard trap, dialog sweep, network dedupe.

## 7. Remaining blockers and risks

1. Live payroll run, bulk write, feedback submit: BLOCKED until a disposable, authorized database exists.
2. Business-rule choices implemented as defaults and **needing approval**: partial payroll allowed only with acknowledged exclusions + confirmed period; feedback conflict = (rating ≤2 with Strong Hire/Strongly Recommend) or (rating ≥4 with Fail/Do Not Recommend), explanation ≥15 chars; bulk assignment limited to 200 rows, structures must be active and submitted, employee must have no submitted assignment (any date, matching the existing "unassigned" definition); eligibility uses employees of the selected company and any submitted assignment with `from_date <= period end`.
3. Existing public interview feedback page now asks for the same explanation on conflict.
4. Dev scripts calling `run_payroll_and_report` (see section 1.6) need the new arguments.
5. `npm install` of dev dependencies also rewrote `frontend/yarn.lock` and `package-lock.json`; review before committing.
6. Backend changes need `bench restart` in production (the dev server picked them up).
7. Unverified: F-17 visual, enlarged touch targets, three dialogs, axe/Lighthouse, sidebar names, company-switch network behaviour, dark-theme contrast.
8. `ExitDocumentModal`, Mark-as-left and feedback-detail dialogs were wrapped but never opened in a browser.

## 8. Retest checklist before production

1. On a disposable site copy: assign structures to a subset, open Run Payroll, confirm included/excluded lists, period and acknowledgement gates; call the API without acknowledgement and confirm refusal; run payroll once end to end.
2. Bulk assign: preview with an invalid row, then a valid batch; confirm all-or-nothing rollback by forcing one failure.
3. Submit conflicting and consistent feedback (in-app and public link); confirm stored text.
4. Run axe-core and Lighthouse on every page and dialog (authenticated); fix findings.
5. Re-run the sweep (`frontend/tests/responsive-sweep.browser.js`) at 390/820/1440 and the dialog sweep after the touch-target fixes.
6. Add Playwright tests with mocked API routes for the flows in section 6.
7. Review `git diff`, `yarn.lock`, then commit.

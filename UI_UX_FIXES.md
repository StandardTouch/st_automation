# UI/UX Fixes — grouped by severity

> **Update (final pass, 2026-11-18):** All items F-01…F-25 have been implemented; see `FINAL_UX_QA_REPORT.md` section 2 for status. Differences from the plan written here: payroll gating uses a new backend eligibility endpoint plus server-side enforcement (period confirmation and acknowledged exclusions) instead of a UI-only check; feedback conflicts are allowed with a required explanation (validated in UI and backend) instead of being blocked; bulk assignment was built (preview, dry run, explicit confirmation); Department on the job form stays a combobox on purpose.

Source of facts: `UX_AUDIT_REPORT.md`. Tags: **[Observed]**, **[Code]** (read in source, application code was not changed), **[Opinion]**. Line numbers are as read at audit time (branch `Amir-Cloud`) and may drift. Evidence ids refer to `/tmp/claude-chrome-screenshots-Mi2zsU/screenshot-<id>.jpg`.

## HIGH

### F-01 Payroll shows "Ready" while readiness is 0%
- Location: Payroll Overview banner; Run Monthly Payroll page. Evidence: Payroll Overview screenshot, `…673520-8`, `…699406-17`.
- Impact: admin can launch a payroll run with 0 of 32 employees having a salary structure.
- Cause [Code]: `frontend/src/modules/payroll/PayrollDashboard.jsx:83` hard-codes "Ready for <month year>". Heading at ~line 85 depends only on `is_fully_processed`. `readiness_score` (computed in `st_automation/api/payroll.py` ~96-98) is displayed in a tile but not used to gate the banner or the run button.
- Fix:
  1. Derive `isReady = readinessScore === 100 && activeEmployees > 0`.
  2. If not ready: pill "Action needed", heading "Payroll isn't ready", body "32 employees need a salary structure", primary button "Assign structures" (to Salary Structures), secondary "View System Readiness"; render "Run Payroll Now" disabled with tooltip.
  3. On `RunPayrollWizard`/Run page, call the same readiness data and show a warning banner; require an explicit checkbox to continue if score < 100 (or block).
  4. Server side: make `run_payroll` reject or warn when `readiness_score < 100` so the UI cannot be bypassed.
- Verify: with 0 structures banner says not ready and run disabled; with all assigned banner says ready.

### F-02 Assign Structure dead end
- Location: Assign Structure modal (`…744157-24`), Salary Structures empty state (`…709957-18`).
- Impact: a new site cannot complete setup without leaving the modal and guessing the next step.
- Fix: when `structures.length === 0` replace the select with an inline message "No salary structure yet" + button "Create structure" that opens the New Structure modal and reopens Assign after save. Add "Assign to all unassigned employees" with a base-salary input. Provide a prefilled simple template (Basic + Allowance) in the New Structure modal.

## MEDIUM

### F-03 `salary-structures` missing from router, silent fallback
- Location: `frontend/src/App.jsx` `VALID_TABS` (~lines 304-309) and `hashTab()`.
- Evidence [Observed]: after clicking Salary Structures the address stayed `#/diagnostics`; opening `#/salary-structures` displayed Loans (`…699406-11`).
- Fix: add `'salary-structures'` to `VALID_TABS`. For unknown first segments, set an `unknownRoute` state and render a "Page not found" panel with link to the default page instead of ignoring the hash. Add a unit test that every sidebar `id` in `Sidebar.jsx` exists in `VALID_TABS` (single shared constant exported from one file).

### F-04 Some modals ignore Escape
- Location: Start Onboarding (`…767610-30`), Initiate Separation (`…784021-32`).
- Cause [Code, partial]: Escape handlers found only in `SlideOver.jsx`, `EmployeeSelect.jsx`, `Sidebar.jsx`, `CommandPalette.jsx`. Other modals' close logic was not traced.
- Fix: one shared `Modal` component (or hook `useEscapeToClose(onClose)`) used by all dialogs; add focus trap, `role="dialog"`, `aria-modal`, `aria-labelledby`, return focus to trigger.

### F-05 Offer letter modal taller than viewport
- Location: Generate Offer Letter (`…767609-28`).
- Fix: `max-height: calc(100vh - 2rem)`, `overflow-y: auto` on body, sticky footer with Submit; position at top with margin instead of centered.

### F-06 Rating/recommendation contradiction and stage mismatch
- Location: Pipeline card chip (`…495679-1`), drawer (`…809786-37`).
- Cause [Code]: `KanbanBoard.jsx:12-17` formats stored text; `FeedbackScorecardModal.jsx:26` offers Strong Hire independent of rating.
- Fix: in the scorecard modal, warn/block when rating ≤ 2 and recommendation is "Strong Hire" or rating ≥ 4 and "Reject"; server-side validation in the feedback endpoint. Define one mapping table (rating → allowed recommendations). Label the drawer "Stage" with the same names as the pipeline columns (card says Shortlisted, drawer says Replied). Optionally fix existing bad records via a data check.

### F-07 Header button clipped at 820px
- Location: top bar at tablet width (`…511476-3`).
- Fix: at `<lg`, collapse "Add Candidate" and "Quick Incentive" to icon buttons with `aria-label`, or move them into an overflow menu; ensure `min-w-0` on the search/company area and `flex-shrink-0` on actions.

### F-08 Mobile Kanban
- Location: Pipeline at 390px (`…511476-4`).
- Fix: on `<md` show stage tabs (Applied 3 / Shortlisted 5) with one column visible, or use snap scrolling with 85% column width so the next column peeks; wrap rating chip text instead of truncating.

### F-09 Offer-letter table density
- Fix: widen ID column and `white-space: nowrap` for IDs; stack candidate/designation; show stipend on one line; combine actions into primary button + overflow ("Preview / Print", "Send Email"); card layout below 1024px.

### F-10 Labels that don't match content
- "My Salary Slips" → HR sees "Salary Slips Hub" (all employees): label by role ("Salary Slips" for HR, "My Salary Slips" for employees).
- "Scheduled Interviews" page titled "My Scheduled Interviews": align title to sidebar.
- "Staff Feedback" is a submit form: rename "Share Feedback"; keep "My Feedback" for history.

## LOW

### F-11 Escaped HTML in feedback titles
Display shows `&lt;script&gt;…`. Decode once on render (React escapes automatically), and stop storing pre-escaped text server-side. Use `textContent`-safe rendering only. Evidence `…699406-14`.

### F-12 Duplicate API requests
Gate `loadRecruitment`/`loadPayroll`/etc. on a resolved `company` (do not fire with `company=''`), and avoid triggering both the initial load and the `activeTab` effect (`App.jsx` effect near line 339). Consider a small cache/SWR layer. Verify one request per endpoint per navigation.

### F-13 Status colour system
Define tokens: red = destructive/error only; brand colour for primary actions; neutral for IDs and zero counts; amber = pending; green = done; blue = info. Change red job/candidate IDs (`…673511-5`) to neutral, red "0 Candidates" (`…495679-2`) to grey, "Open" feedback status to blue or neutral. Add icons/text so colour is never the only signal.

### F-14 Desktop pipeline width
Let the board span the content width (`max-w-none`, columns `flex-1 min-w-[260px]`), or show all stage columns even when empty with counts.

### F-15 Loan wizard step count
Change title to "Loan Application" (or "3-Step …") to match the stepper. Remove duplicate empty-state CTA.

### F-16 Job Openings cards
Use one card template: title, status badge (Open/Closed), department, vacancies, candidates (neutral), visibility toggle with explicit label "Published on careers page" / "Not published". Department as a select.

### F-17/F-18 Template and select labels
Show full name on hover and wrap to two lines; list `company · department · designation` as a second line; hide raw IDs (`HR-EMP-STP-0000`) from option text.

### F-19/F-20 Empty states and run period
Salary Slips: show month/year selectors and "Run payroll to generate slips" action. Loans: remove the heading "Active Loan Management" when empty or say "No loans yet". Run Payroll page: add month/year selector or link back to Overview selector.

### F-21 Schedule Interview list
Show all shortlisted with a chip ("Interview scheduled") or a note explaining the filter.

### F-22 Locked checklist contrast
Raise locked-row text to at least 4.5:1 against its background (measure with a contrast tool; not measured here), add a lock icon and "Unlocks after: <task>".

### F-23 Accessible names
Give every icon-only or text-in-span button an `aria-label` or visible text in the accessibility tree; run axe-core and fix findings (not run in this audit).

### F-24/F-25 Navigation placement
Show "Quick Incentive" only on payroll pages; move System Readiness near Payroll or surface a banner on Payroll Overview linking to it when checks fail.

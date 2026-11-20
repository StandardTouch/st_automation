# UX Audit Report — Standard Touch HR Operations (full pass)

> **Update (final pass, 2026-11-18):** Findings F-01…F-25 were addressed in code. Current status of every finding, with evidence, is in `FINAL_UX_QA_REPORT.md` (24 FIXED & VERIFIED, 1 IMPLEMENTED BUT UNVERIFIED). This document keeps the original baseline observations. Part of the baseline claim "responsive checks blocked" is resolved: all 16 pages and 12 dialogs were measured at 390/820/1440 with page-verified viewport sizes.

Target: `http://localhost:8000/hr-ops` (dev site, logged in as a developer/HR-admin user).
Method: real Chrome session driven through the Chrome extension. Read-only. No record was created, edited, deleted or submitted. Application code was only read, never changed.
Companion files: `UX_USER_JOURNEYS.md`, `UI_UX_FIXES.md`, `FUNCTIONAL_TEST_REPORT.md`, `UX_IMPROVEMENT_ROADMAP.md`.

Evidence convention: screenshots live in `/tmp/claude-chrome-screenshots-Mi2zsU/` as `screenshot-<id>.jpg`. In this report an id such as `…495679-0` means `screenshot-1794978495679-0.jpg`. Tags: **[Observed]** seen in the browser, **[Code]** confirmed by reading source, **[Opinion]** design judgment, **[Estimate]** unmeasured projection.

## 1. Scope and honesty statement

Visited all 17 sidebar destinations on desktop: Candidate Pipeline, Job Openings, Scheduled Interviews, Offer Letters & Contracts, Onboarding Pipeline, Exit Pipeline, Payroll Overview, Run Monthly Payroll, Salary Structures, Loans & Advances, My Salary Slips, Staff Feedback, My Feedback, Feedback Analytics, Template Management (list + new-template page), System Readiness. Also opened: global search (Ctrl+K), company switcher, candidate detail drawer, and 11 modals/wizards (Add Candidate, Quick Incentive, New Salary Structure, Assign Structure, Loan wizard step 1, New Job Opening, Generate Offer Letter, Start Onboarding, Initiate Separation, Schedule Interview).

Limits:
- **Tablet/mobile:** Only the Candidate Pipeline was captured at 820px and 390px (earlier pass). In this pass the window-resize call reported success but the page kept its desktop layout (screenshots `…839311-38` to `-44`, page viewport reported 1920x1025). Further responsive checks are **blocked by the tooling**, not passed. The statement "responsive layout of other pages" is therefore **not tested**.
- **Not tested:** any form submission, validation message, destructive button, payroll run, email send, file upload, public candidate/onboarding/careers pages, keyboard-only use, screen reader, measured contrast ratios, print/PDF output, Decided & Archive tab, Completed tabs, Separation Templates tab.
- **Personas** are assumed roles, not user research. "Non-technical user" and "first-time employee" views were judged by reading the UI, not by observing real people.
- The app account is HR/admin; employee-only views (`My Offer Letter`, employee payslips) were not reachable as a different role.

## 2. Executive assessment

Is it user-friendly, efficient, intuitive, professionally designed? **Partly.** The visual system is coherent (dark theme, consistent cards, one red primary colour, sidebar grouped by job-to-be-done) and common actions are usually one click (card buttons, header buttons, Ctrl+K palette). Weak spots are trust, wayfinding and finish:

1. **Payroll trust gap.** Three screens disagree: Payroll Overview says "Ready for November 2026 / Ready to Run Monthly Payroll?", Readiness tile says 0%, System Readiness says 0 of 32 employees have a salary structure. Run Monthly Payroll offers an enabled "Start Payroll Processing" with no warning. **[Observed] [Code]**
2. **Dead-end setup loop.** Salary Structures is empty, and Assign Structure needs a structure ("No structures found") with no link to create one, while 32 employees need assignment. **[Observed]**
3. **Wayfinding inconsistencies.** Sidebar labels differ from page titles; Salary Structures never updates the URL; unknown routes silently show another page. **[Observed] [Code]**
4. **Inconsistent modal behaviour.** Some modals close on Escape, Start Onboarding and Initiate Separation do not. **[Observed]**
5. **Data-quality signals shown as truth.** "1/5 stars · Strong Hire", stage "Replied" in the Shortlisted column, raw HTML entities in feedback titles, raw template IDs in a select. **[Observed]**
6. **Density and responsive finish.** Cramped offer-letter table, clipped header button on tablet, overflowing mobile Kanban, a tall modal that runs off a normal laptop viewport. **[Observed]**

Not every item is severe; nothing observed blocks the happy path of recruiting. The payroll items are the ones that could cause real-world mistakes.

## 3. Screenshot index

| Page / state | Evidence |
|---|---|
| Pipeline desktop, rating chip zoom | `…495679-0`, `…495679-1` |
| Job Openings | `…495679-2` |
| Pipeline tablet 820 / mobile 390 | `…511476-3`, `…511476-4` |
| Scheduled Interviews | `…673511-5` |
| Onboarding / Exit pipelines | `…673520-6`, `…673520-7` |
| Run Payroll | `…673520-8` |
| URL `#/salary-structures` rendering Loans | `…699406-11` (also `…673520-9`, a repeat of Run Payroll) |
| Loans empty state | `…673520-10` |
| Salary Slips Hub | `…699406-12` |
| Staff Feedback form | `…699406-13` |
| My Feedback list (escaped HTML text) | `…699406-14` |
| Feedback Analytics | `…699406-15` |
| Template list | `…699406-16` |
| System Readiness | `…699406-17` |
| Salary Structures empty | `…709957-18` |
| Add Candidate modal | `…723937-19` |
| Quick Incentive modal | `…723938-21` |
| New Salary Structure / Assign Structure / Loan wizard | `…744157-23`, `-24`, `-25` |
| New Job Opening / Offer modal / Start Onboarding | `…767609-27`, `-28`, `-29` |
| Start Onboarding after Escape (still open) | `…767610-30` |
| Initiate Separation (+ after Escape) | `…784021-31`, `-32` |
| Command palette / company dropdown / Schedule Interview | `…799422-33`, `-34`, `-35` |
| Candidate drawer | `…809786-37` |
| New Template page / onboarding checklist expanded | `…874158-45`, `…874158-46` |
| Failed responsive re-check (desktop layout at "390") | `…839311-38` to `-44` |

## 4. Page-by-page findings

### 4.1 Candidate Pipeline (`…495679-0`)
- [Observed] Two columns (Applied 3, Shortlisted 5) fill about 55% of the width; right side blank. Content block starts ~175px right of the sidebar edge, so the board looks off-centre. Other stages not verified (the "Decided & Archive" tab was not opened).
- [Observed] Card actions are clear and one click: red "Shortlist", green "Schedule". Resume icon appears only on some cards.
- [Observed] Rating chip "1/5 stars · Strong Hire" (jackie). The drawer shows the same text from the submitted feedback ("Rating 1/5 • …", badge "Strong Hire", `…809786-37`), and "Current Stage: Replied" although the card sits in Shortlisted. [Code] `formatRatingSummary` (`KanbanBoard.jsx:12-17`) only reformats stored text; nothing checks that rating and recommendation agree.
- [Observed] Candidate names `<img src="x">QA_X` and `QA_'; DROP TABLE x;--` display as plain text (good).
- [Observed] Drawer footer places "Select / Offer", "Talent Pool / Bench" and red "Reject" side by side. Reject confirmation was not tested.
- [Observed] Header carries "Add Candidate" and a red "Quick Incentive" on every page. [Opinion] Incentive is a payroll action and competes with page CTAs on recruiting pages.

### 4.2 Job Openings (`…495679-2`)
- [Observed] Cards are inconsistent: Closed shows a badge, Open shows "Status: Open" text; Department shown on only some cards. "0 Candidates" is red. "Hidden"/"Published" is a state toggle whose label reads like a status and not an action. Edit and delete icons are tiny and adjacent.
- [Observed] New Job Opening modal is simple: Title*, Department, Vacancies, Description, publish checkbox (`…767609-27`). Department is free text, not a list.

### 4.3 Scheduled Interviews (`…673511-5`)
- [Observed] Page title is "My Scheduled Interviews" but sidebar says "Scheduled Interviews"; the "Schedule Interview" button is on a page whose name implies "mine".
- [Observed] Candidate IDs and job IDs print in red (reads as an error colour). Statuses "Cleared" and "Pending" are small pills.
- [Observed] Schedule Interview modal lists only 2 candidates (QA_P1 Resume Dave, QA_Alice) while the pipeline shows 5 shortlisted (`…799422-35`). Reason not determined (could be already-scheduled filtering). Needs a short explanation in the UI either way.

### 4.4 Offer Letters & Contracts
- [Observed] Table is cramped: offer ID wraps over 3 lines, stipend and manager text tiny (`…511476` earlier pass; layout same). Accepted rows show three buttons ("Onboard Employee", "Preview / Print", "Send Email"), which wrap to two lines.
- [Observed] Generate Offer Letter modal is taller than the viewport: it starts about halfway down the page and its lower fields are cut off at a 807px-high viewport (`…767609-28`). Needs internal scroll or a top-aligned position.
- [Observed] Positive: "Quick-fill from Pipeline Candidate" reduces typing.

### 4.5 Onboarding / Exit pipelines (`…673520-6`, `-7`, `…874158-46`)
- [Observed] Progress bars and statuses are clear. Expanded checklist shows locked rows at very low contrast, and the active task has an email input plus "Waiting on Assignee" and "Mark Complete" at similar visual weight. [Opinion] Hard to see who must act.
- [Observed] Start Onboarding and Initiate Separation modals did **not** close on Escape (pressed twice each; `…767610-30`, `…784021-32`). Cancel works.
- [Observed] Initiate Separation template select shows a raw ID ("Standard Separation - StandardTouch - HR-EMP-STP-0000").

### 4.6 Payroll Overview / Run Payroll / Salary Structures / Loans / Salary Slips
- [Observed] Overview: "Ready for November 2026" pill + "Ready to Run Monthly Payroll?" + red "Run Payroll Now" while Readiness 0%, 32 employees missing structure, 0 assigned structures. [Code] The pill text is hard-coded (`PayrollDashboard.jsx:83`); only the heading changes with `is_fully_processed`.
- [Observed] Run Monthly Payroll (`…673520-8`): a single card listing four bullet points and "Start Payroll Processing", period fixed to November 2026 with no selector, "Assign Structure" as a small secondary button. No readiness warning.
- [Observed] Salary Structures: empty ("Structures (0)", "Assignments (0)"), CTA "Create one" (good). New Structure modal mirrors ERPNext fields (Letter Head, Mode of Payment, Leave Encashment, Earnings/Deductions rows, Save Draft / Save & Submit) and is dense for a non-technical user (`…744157-23`).
- [Observed] Assign Structure modal: structure select reads "No structures found", no create link (`…744157-24`).
- [Observed] Loans: empty state card titled "Active Loan Management" has its own CTA duplicating the header "New Loan Application". Wizard title says "4-Step Loan Application Wizard" but the stepper shows three steps (`…744157-25`).
- [Observed] Salary Slips: sidebar says "My Salary Slips", page is "Salary Slips Hub" with an employee column (an all-staff view). Empty state "No salary slips found for this period" with no visible period control.
- [Observed] Quick Incentive modal is well structured (employee, amount, component, recurring checkbox, date, reason) (`…723938-21`).

### 4.7 Feedback (Staff Feedback, My Feedback, Analytics)
- [Observed] "Staff Feedback" is an anonymous-style submission form with category tiles, star rating and text. For an HR admin the label suggests "feedback about staff". "Switch to Standard Form" link is tiny.
- [Observed] My Feedback list shows a title as literal text `&lt;script&gt;alert(1)&lt;/script&gt;QA_xss &lt;b onmouseover=ale…`: HTML entities displayed as characters (double escaping or storing escaped text). Nothing executed.
- [Observed] Analytics: tidy KPI tiles, category bars, a one-bar "volume trend" chart that conveys little with a single month.

### 4.8 Templates
- [Observed] List of onboarding templates: card titles are truncated with identical prefixes ("Standard Onboarding - StandardT…"); only the small company line differentiates them. New Template page pre-fills the title "New Onboarding Template"; first task row shows an empty "Activity Name" (`…874158-45`).

### 4.9 System Readiness (`…699406-17`)
- [Observed] Strong feature: pre-flight checks with an "Auto-Fix Issue" button. It confirms the payroll problem ("0 of 32 active employees have an assigned salary structure (0%)") and that no Loan Product exists. It is placed last in the sidebar, away from Payroll, where it is most relevant.

### 4.10 Global
- [Observed] Ctrl+K command palette lists all pages; works and closes with Escape. Company switcher is a native select with test companies ("QA Corp Pvt Ltd", "STG (Inactive)").
- [Code] `salary-structures` is missing from `VALID_TABS` (`App.jsx:~304-309`). Result [Observed]: after opening Salary Structures from the sidebar the URL stayed `#/diagnostics`; loading `#/salary-structures` directly showed Loans & Advances. Unknown hashes are ignored silently.
- [Observed] Accessibility tree: 15 header/sidebar buttons reported with no accessible name by the page-reading tool (e.g. `ref_6`…`ref_38`). Could be a tool limitation; verify with a screen reader or axe.
- [Observed] Duplicate API calls on first load (each list endpoint twice, `get_pipeline` three times, first with empty `company`, then with `company=StandardTouch`). All returned 200; no console errors on the pipeline page.

## 5. Verification of the previously listed issues

| Issue | Status | Evidence | Exact fix |
|---|---|---|---|
| Incorrect payroll readiness status | **Confirmed** | Payroll Overview screenshot; `PayrollDashboard.jsx:83`; `…699406-17` | See `UI_UX_FIXES.md` F-01 |
| Rating / hiring label mismatch | **Confirmed in data**; UI shows it without a check | `…495679-1`, `…809786-37`; `KanbanBoard.jsx:12-17` | F-06 |
| Clipped buttons on tablet | **Confirmed** (earlier pass, 820px: "Quick Incentive" cut off) | `…511476-3` | F-07 |
| Mobile Kanban overflow | **Confirmed** (390px, second column clipped, chip text truncated) | `…511476-4` | F-08 |
| Cramped offer-letter table | **Confirmed** (desktop) | Offer Letters screenshot | F-09 |
| Empty desktop pipeline space | **Confirmed** (two columns only, ~45% blank right) | `…495679-0` | F-14 |
| Unclear status colours | **Confirmed**: red = primary action, IDs, zero counts, "Open" feedback status, destructive; green = positive and "Schedule" | `…673511-5`, `…495679-2`, `…699406-14` | F-13 |
| Silent route fallback | **Confirmed** and root cause found | `App.jsx` `hashTab()`, `VALID_TABS` | F-03 |
| Duplicate API requests | **Confirmed** (network log) | 29 requests on first load | F-12 |

## 6. Issue register (all severities)

| ID | Sev | Type | Location | Problem | User impact |
|---|---|---|---|---|---|
| F-01 | High | Observed+Code | Payroll Overview banner, Run Payroll page | "Ready" shown with 0% readiness; run not gated | Admin may start payroll with no salary structures; failed or empty run, loss of trust |
| F-02 | High | Observed | Assign Structure modal / Salary Structures | Needs a structure that does not exist; no path to create | Admin stuck in setup loop on a fresh site |
| F-03 | Medium | Observed+Code | Router (`App.jsx`) | `salary-structures` not in `VALID_TABS`; unknown hash ignored | No bookmark/back for a page; wrong page on direct link |
| F-04 | Medium | Observed | Start Onboarding, Initiate Separation | Escape does not close | Inconsistent, keyboard users trapped to the Cancel button |
| F-05 | Medium | Observed | Offer letter modal | Taller than viewport, cut off | Fields unreachable without browser scroll tricks |
| F-06 | Medium | Observed+Code | Pipeline chip, drawer | Rating 1/5 with "Strong Hire"; stage "Replied" in Shortlisted | Wrong hiring signal; mistrust |
| F-07 | Medium | Observed | Header at 820px | "Quick Incentive" clipped | Primary header action partly unreadable |
| F-08 | Medium | Observed | Mobile pipeline | Horizontal board with no cue; chip text truncated | Hidden stages on phones |
| F-09 | Medium | Observed | Offer table | Cramped columns, wrapped ID and buttons | Slow scanning |
| F-10 | Medium | Observed | Sidebar vs page titles | "My Salary Slips" = all-staff hub; "Scheduled Interviews" = "My …"; "Staff Feedback" = a form | Users misjudge what a page does |
| F-11 | Low | Observed | My Feedback list | Literal `&lt;…&gt;` text | Looks broken; data hygiene |
| F-12 | Low | Observed | Network | Duplicate calls, unscoped first call | Wasted load; possible flash of wrong data |
| F-13 | Low | Observed | Whole app | Red overloaded as colour signal | Status unclear at a glance |
| F-14 | Low | Observed | Desktop pipeline | Narrow board, blank right side | Wasted space |
| F-15 | Low | Observed | Loan wizard | Title says 4 steps, stepper shows 3 | Confusing expectation |
| F-16 | Low | Observed | Job Openings cards | Inconsistent fields, red zero counts, ambiguous "Hidden" | Scanning cost |
| F-17 | Low | Observed | Templates list | Truncated identical titles | Hard to choose |
| F-18 | Low | Observed | Initiate Separation select | Raw ID in option text | Technical leakage |
| F-19 | Low | Observed | Loans/Salary Slips empty states | Duplicate CTA; no period or next step | Empty states do not guide |
| F-20 | Low | Observed | Run Payroll | Period fixed, no selector | Cannot choose month here |
| F-21 | Low | Observed | Schedule Interview modal | 2 candidates vs 5 shortlisted, no explanation | Candidate "missing" |
| F-22 | Low | Observed | Onboarding checklist | Locked rows very low contrast | Readability |
| F-23 | Low | Observed | Accessibility tree | 15 unnamed buttons (verify) | Possible screen-reader gap |
| F-24 | Low | Opinion | Header | "Quick Incentive" always visible, red | Competes with page CTA |
| F-25 | Info | Observed | System Readiness | Valuable page buried at sidebar bottom | Missed pre-flight check |

## 7. Positives (observed)

- One-click card actions on the pipeline.
- Ctrl+K palette and company switcher.
- Empty states on Salary Structures and Slips exist; Salary Structures has a CTA.
- System Readiness with Auto-Fix.
- Add Candidate requires a target job opening (field marked `*`).
- Untrusted text is not executed in pipeline cards.
- All 29 API calls on first load returned HTTP 200; no console errors on the pipeline page.

## 8. Not covered / next steps

See `FUNCTIONAL_TEST_REPORT.md` (Blocked and Not tested sections). Recommended next: retest responsive on all pages in a working device emulator, run axe/Lighthouse, then test form validation on a disposable site copy.

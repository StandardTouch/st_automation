# UX Improvement Roadmap

> **Update (final pass, 2026-11-18):** Phase 0 and 1 done and browser-verified. Phase 2: header, Kanban, offer cards, job cards, templates done; touch-target tweaks built but not re-measured. Phase 3: payroll eligibility/acknowledgement, bulk assignment, conflict explanation implemented. Phase 4: component and backend tests added; browser e2e, axe-in-browser, Lighthouse and live-data tests remain open. Details: `FINAL_UX_QA_REPORT.md`.

Based on `UX_AUDIT_REPORT.md`, `UI_UX_FIXES.md` and `FUNCTIONAL_TEST_REPORT.md`. Effort sizes are rough **estimates** (S = under half a day, M = 1-2 days, L = 3+ days), not measured. Application code has not been changed.

## Phase 0 — Safety and trust (do first)

| Order | Item | Fix id | Size | Done when |
|---|---|---|---|---|
| 1 | Gate payroll on readiness: banner state, disabled run, server-side check | F-01 | M | 0 structures → banner "not ready", run blocked in UI and API |
| 2 | Break the structure setup loop: inline create, bulk assign | F-02 | M-L | New site can assign all employees without leaving the flow |
| 3 | Validate rating vs recommendation, align stage names | F-06 | M | Contradictory feedback cannot be saved; drawer/card stage names match |
| 4 | Add `salary-structures` to routes; "page not found" state; single source of route ids | F-03 | S | Every sidebar item deep-links and survives reload |

## Phase 1 — Consistency and finish

| Order | Item | Fix id | Size |
|---|---|---|---|
| 5 | Shared Modal component: Escape, focus trap, aria, max-height, sticky footer | F-04, F-05 | M |
| 6 | Rename mismatched labels (Salary Slips, Scheduled Interviews, Staff Feedback) | F-10 | S |
| 7 | Colour tokens: red only for destructive/error; neutral IDs and zero counts | F-13 | S-M |
| 8 | Fix double-escaped text | F-11 | S |
| 9 | De-duplicate startup API calls; gate on company | F-12 | S-M |
| 10 | Loan wizard title; remove duplicate empty-state CTAs; salary slips period control | F-15, F-19, F-20 | S |

## Phase 2 — Responsive and density

| Order | Item | Fix id | Size |
|---|---|---|---|
| 11 | Header actions collapse to icons below 1024px | F-07 | S |
| 12 | Mobile pipeline: stage tabs or snap scroll | F-08 | M |
| 13 | Offer letter table: widths, nowrap IDs, overflow menu, card layout on small screens | F-09 | M |
| 14 | Pipeline board uses available width | F-14 | S |
| 15 | Job Openings card template; Department as select | F-16 | S-M |
| 16 | Template names: 2-line wrap, secondary metadata, hide raw IDs | F-17, F-18 | S |

## Phase 3 — Efficiency and guidance

| Order | Item | Size |
|---|---|---|
| 17 | Payroll run flow as readiness → review → confirm modal (same clicks, safer) | M |
| 18 | Simple/advanced toggle in salary structure form; default "Basic + Allowance" template | M |
| 19 | Pre-fill onboarding from accepted offer; show who must act on each task | M |
| 20 | Schedule Interview list explains missing candidates (F-21) | S |
| 21 | Surface System Readiness failures on Payroll Overview (F-25); scope "Quick Incentive" to payroll (F-24) | S |

## Phase 4 — Quality gates (run in parallel with the above)

| Item | Size | Done when |
|---|---|---|
| Responsive retest at 390/820/1440 on all 17 pages in a working device emulator | S | Screenshots saved, no clipped actions |
| axe-core / Lighthouse accessibility run; fix unnamed buttons (F-23), contrast (F-22) | M | No serious or critical axe findings |
| Throwaway-site pass for all BLOCKED tests (B1-B14), including validation and error messages | M | Functional report has no BLOCKED items |
| Sidebar-id ↔ route-id unit test; e2e smoke test per page | S | CI fails if a page is unreachable by URL |
| Real-user check with an HR person and an employee for the first-time and non-technical views | M | Notes added to audit |

## Retest checklist

1. Payroll: with 0 structures, banner says not ready, Run is disabled, API rejects; with all assigned, ready state appears.
2. Salary setup: new site → create structure → assign all, without dead ends.
3. Feedback: rating 1 + "Strong Hire" is blocked or warned; stage labels match across card and drawer.
4. Routing: every sidebar item changes the URL; reload and back/forward work; unknown hash shows "not found".
5. Modals: all close on Escape; focus returns to the trigger; offer modal fully reachable at 807px height.
6. Network: one request per endpoint per navigation.
7. Responsive: 390, 820, 1440 on every page, no clipped buttons, no hidden stages without a cue.
8. Accessibility: axe has no critical findings; all icon buttons named; contrast at least 4.5:1 for body text.
9. Text rendering: no literal `&lt;` or `&amp;` in lists.
10. Colour: red only for destructive/error states.

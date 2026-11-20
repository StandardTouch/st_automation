# Functional Test Report — Standard Touch HR Operations

> **Update (final pass, 2026-11-18):** New automated coverage: 21 component tests (jsdom + axe), 30 backend unit tests (mocked `frappe`), 11 source-level tests, all passing. B1–B14 remain BLOCKED for live writes (no disposable database); dry-run/preview paths are exercised read-only. Added passes: 12 dialogs open/focus/Escape at 390/820/1440, real keyboard trap test, Run Payroll eligibility from the new endpoint, scorecard conflict UI (closed without submitting). Axe in the real page was denied by the permission classifier; Lighthouse not run. See `FINAL_UX_QA_REPORT.md`.

Environment: `http://localhost:8000/hr-ops`, Chrome, logged-in HR/developer user, shared dev data. Read-only testing. No form was submitted. Application code was not modified.
Result key: PASS (worked as expected), FAIL (defect), BLOCKED (needs data change; skipped on purpose), NOT TESTED (not attempted), LIMITED (tooling issue).

## 1. Summary

| Result | Count |
|---|---|
| PASS | 29 |
| FAIL | 6 |
| BLOCKED | 14 |
| NOT TESTED | 12 |
| LIMITED | 1 group (responsive) |

## 2. PASS

| # | Test | Evidence |
|---|---|---|
| P1 | Candidate Pipeline loads with cards and counts | `…495679-0` |
| P2 | Job Openings loads | `…495679-2` |
| P3 | Scheduled Interviews loads | `…673511-5` |
| P4 | Offer Letters loads | Offer page screenshots |
| P5 | Onboarding Pipeline loads; row expands to checklist | `…874158-46` |
| P6 | Exit Pipeline loads | `…673520-7` |
| P7 | Payroll Overview loads | Payroll screenshot |
| P8 | Run Monthly Payroll loads | `…673520-8` |
| P9 | Salary Structures loads (via sidebar) | `…709957-18` |
| P10 | Loans & Advances loads | `…673520-10` |
| P11 | Salary Slips Hub loads (empty state shown) | `…699406-12` |
| P12 | Staff Feedback form loads | `…699406-13` |
| P13 | My Feedback list loads | `…699406-14` |
| P14 | Feedback Analytics loads | `…699406-15` |
| P15 | Template list loads | `…699406-16` |
| P16 | New Template page opens | `…874158-45` |
| P17 | System Readiness loads | `…699406-17` |
| P18 | Ctrl+K command palette opens and lists pages; Escape closes | `…799422-33` |
| P19 | Company switcher opens with 9 companies | `…799422-34` |
| P20 | Candidate drawer opens and closes via X | `…809786-37` |
| P21 | Add Candidate modal opens; Escape closes; target job opening marked required | `…723937-19` |
| P22 | Quick Incentive modal opens; Escape closes | `…723938-21` |
| P23 | New Salary Structure modal opens/closes | `…744157-23` |
| P24 | Assign Structure modal opens/closes | `…744157-24` |
| P25 | Loan wizard step 1 opens/closes (fields: employee, amount, tenure, start date, advanced options) | `…744157-25` |
| P26 | New Job Opening modal opens/closes | `…767609-27` |
| P27 | Generate Offer Letter modal opens/closes (closing inferred: the next click on the sidebar worked) | `…767609-28` |
| P28 | Schedule Interview modal opens (closing seen on a later low-res capture, treat as likely) | `…799422-35` |
| P29 | Hostile-looking names (`<img src="x">`, `DROP TABLE`) render as plain text in cards; no console errors on pipeline page; 29/29 API calls on first load returned 200 | network log |

## 3. FAIL

| # | Defect | Steps | Expected | Actual | Evidence |
|---|---|---|---|---|---|
| X1 | Payroll "Ready" with 0% readiness | Open Payroll Overview and System Readiness | Not-ready state, run blocked | "Ready for November 2026", enabled Run button | Payroll screenshot, `…699406-17` |
| X2 | `salary-structures` route not in router | Click Salary Structures; or load `#/salary-structures` | URL updates; deep link works | URL stayed `#/diagnostics`; direct hash showed Loans | `…699406-11` |
| X3 | Escape fails on Start Onboarding | Open modal, press Escape twice | Modal closes | Stays open | `…767610-30` |
| X4 | Escape fails on Initiate Separation | Open modal, press Escape | Modal closes | Stays open | `…784021-32` |
| X5 | Literal HTML entities in feedback titles | Open My Feedback | Readable text | `&lt;script&gt;…` shown | `…699406-14` |
| X6 | Contradictory rating label | Open Pipeline, drawer for "jackie" | Label consistent with rating | "1/5 stars · Strong Hire", stage "Replied" while in Shortlisted | `…495679-1`, `…809786-37` |

Also seen as defects but not functional breakage: modal taller than viewport (Offer modal), Loan wizard "4-Step" title vs 3 steps, duplicate API calls. See `UX_AUDIT_REPORT.md`.

## 4. BLOCKED (would modify shared records)

| # | Test | Why blocked |
|---|---|---|
| B1 | Add Candidate submit and required-field validation | Creates an applicant |
| B2 | Quick Incentive submit/validation | Creates a payroll entry |
| B3 | New Salary Structure save draft/submit | Creates a structure |
| B4 | Assign Structure submit | Changes employee payroll |
| B5 | Loan wizard steps 2-3, disbursement | Creates a loan |
| B6 | New Job Opening submit, publish toggle, edit, delete | Modifies openings |
| B7 | Generate Offer Letter submit, Send Email, Onboard Employee | Creates a letter / sends mail / creates records |
| B8 | Shortlist, Schedule, Reject, Select/Offer, Talent Pool | Changes candidate stage |
| B9 | Schedule Interview "Select" and slot booking | Creates an interview |
| B10 | Start Onboarding / Initiate Separation submit; Mark Complete; Generate Link | Creates or advances processes |
| B11 | Run Payroll Now / Start Payroll Processing | Creates salary slips |
| B12 | Staff Feedback submit | Creates a record |
| B13 | Template save, delete, add task | Modifies templates |
| B14 | System Readiness "Auto-Fix Issue" | Creates a Loan Product |

Suggested way to unblock: clone the site (`bench --site <site> backup` then restore to a throwaway site) and repeat B1-B14 there.

## 5. NOT TESTED

| # | Area |
|---|---|
| N1 | Decided & Archive tab, Completed tabs, Separation Templates tab |
| N2 | Pipeline job-opening filter and candidate search typing |
| N3 | Global search typing (palette query results) |
| N4 | Table search on Offer Letters / Salary Slips |
| N5 | Keyboard-only navigation, focus order, focus ring |
| N6 | Screen-reader behaviour (only the page-reading tool's accessibility tree was viewed) |
| N7 | Measured colour contrast ratios |
| N8 | Public pages: careers, candidate slot booking, onboarding/exit status, interview feedback |
| N9 | Employee-role views (`My Offer Letter`, employee payslips), other role permissions |
| N10 | Print/PDF preview, bulk upload, file upload (CV) |
| N11 | Light theme / dark-mode toggle, if any |
| N12 | Error handling for offline/500 responses |

## 6. LIMITED: responsive

| Viewport | Result |
|---|---|
| 820px, Candidate Pipeline | Captured in an earlier pass: header button clipped (`…511476-3`) |
| 390px, Candidate Pipeline | Captured in an earlier pass: board overflows (`…511476-4`) |
| 820px / 390px, other pages | **LIMITED.** The resize call returned success but screenshots stayed at desktop layout (`…839311-38`…`-44`; viewport reported 1920x1025). Not a pass; unverified. |

## 7. Console and network

- Console, pipeline page: no errors. One warning came from a different app at `/` (Kamra PMS, out of scope).
- Network, first load: 29 requests to `/api/method/st_automation.api.*`, all HTTP 200; list endpoints requested twice, `get_pipeline` three times (first with empty `company`).
- Console/network for other pages and modals: not collected.

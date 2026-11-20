# User Journeys — current vs improved

> **Update (final pass, 2026-11-18):** Two journeys changed. Payroll run (counted from UI, not executed): Payroll Overview (1) → Review & Run (1) → on the Run page confirm period (1) → acknowledge exclusions if any (1) → Start (1). Added deliberate confirmations; clarity over click count. First-time salary setup: Salary Structures → New Structure (create) → Assign to many → select employees, pick structure and date, enter base → Preview (dry run) → confirm → Create: about 7 steps plus typing, independent of the number of employees (before: about 4 clicks per employee), counted from the UI and not executed against data.

Legend: **[Measured]** = I performed those clicks in the browser. **[Counted from UI]** = steps counted by reading the screens, not performed (action would modify shared data). **[Estimate]** = projected saving, not measured.

Persona roles are assumed (HR administrator, recruiter, payroll manager, first-time employee, non-technical user). I only had an HR-admin session, so employee and non-technical views are judged from the UI text and layout.

## 1. Measured primitives (HR administrator session)

| Action | Clicks | Notes |
|---|---|---|
| Go to any page from any page | 1 (sidebar) or Ctrl+K then Enter | [Measured] 15+ times. Palette lists all pages. |
| Open Add Candidate modal | 1 (header) | [Measured]. Close: Cancel/X, Escape also worked |
| Open Quick Incentive modal | 1 (header) | [Measured] |
| Open candidate details | 1 (card) | [Measured] drawer opens; close 1 (X) |
| Open Start Onboarding / Initiate Separation | 1 | [Measured]. Escape fails; Cancel needed (1 more click) |
| Switch company | 2 (open select, pick) | opened only, did not change company |

## 2. Recruiter

### 2.1 Review a new applicant and shortlist
Current [Counted from UI]: open Candidate Pipeline (1) → read card; optional open details (1) → "Shortlist" on card (1, not clicked). **2–3 clicks.** Good. Gap: card shows no skills/score before shortlisting, so the drawer is needed to judge.
Improved [Opinion]: show resume icon on every card (currently only some) and keep one-click Shortlist. No click saving; improves decision confidence.

### 2.2 Schedule an interview
Current, from card: "Schedule" button on a Shortlisted card (1, not clicked) → booking dialog (not opened).
Current, from Scheduled Interviews page: page (1) → "Schedule Interview" (1) → search/choose "Select" on a candidate (1) = **3 clicks** [Measured up to the candidate list]. The list showed 2 candidates, the pipeline 5 shortlisted, no explanation.
Improved [Estimate]: add a line "3 shortlisted candidates already have a round" or show all five with a status chip. Saves 0 clicks, saves confusion.

### 2.3 Review interview feedback and decide
Current: open candidate (1) → read "Scheduled Interviews" block, feedback, "Interviewer Feedback Summary" → footer "Select / Offer", "Talent Pool / Bench", "Reject" (1). [Measured: drawer content only.]
Problem [Measured]: feedback says "Rating 1/5 • Strong Hire".
Improved [Opinion]: scorecard should reject contradictory input (rating ≤2 with "Strong Hire") and show a warning.

## 3. HR administrator

### 3.1 Create an offer letter for an accepted candidate
Current [Counted from UI]: Offer Letters (1) → "Generate Offer Letter" (1) → optional quick-fill select (1–2) → fill about 8 fields → submit. On an Accepted row, "Onboard Employee" is one click (1).
Friction [Measured]: modal runs below the fold at 807px height.
Improved [Estimate]: top-aligned modal with sticky footer; 0 clicks saved, avoids scroll hunting.

### 3.2 Start onboarding after an accepted offer
Current: Offers (1) → "Onboard Employee" on row (1, not clicked). Alternatively Onboarding Pipeline (1) → Start Onboarding (1) → search employee, choose template, date → confirm (≥2). [Measured to modal.]
Improved [Opinion]: if opened from an offer, pre-fill employee and joining date (could not verify whether it already does).

### 3.3 Complete an onboarding task
Current [Measured to expansion]: Onboarding Pipeline (1) → expand row (1) → "Mark Complete" (1, not clicked). 3 clicks. Locked rows are low contrast and the optional email box competes with "Mark Complete".

## 4. Payroll manager

### 4.1 Run monthly payroll — current
[Counted from UI, not executed]: Payroll Overview (1) → "Run Payroll Now" (1) → Run page "Start Payroll Processing" (1) → likely progress/confirmation (not seen). **≥3 clicks, 2 screens**.
Problems [Measured]: Overview says Ready, Readiness 0%, System Readiness says 0/32 structures; Run page has no warning and no period selector.
### 4.1 Run monthly payroll — improved [Estimate]
Overview shows a state machine: *Not ready* (reasons + "Fix now" CTA, run disabled) → *Ready* (single "Review & run" modal with period, employee count, total preview, confirm) → *Done*. Clicks: Overview (1) → "Review & run" (1) → "Confirm" (1) = same 3 clicks but one fewer screen, with a safety gate. Saving is in errors, not clicks.

### 4.2 First-time salary setup — current
Salary Structures (1) → "Assign Structure" (1) → modal shows "No structures found" [Measured] → close (1) → "New Structure" (1) → complex ERPNext-style form (earnings/deductions rows, Letter Head, Mode of Payment) → Save & Submit → reopen Assign (1) → pick employee, structure, salary, date → submit. **≥6 clicks plus 32 repetitions** (one per employee) [Counted from UI]; no bulk assign visible.
### 4.2 improved [Estimate]
- In Assign modal, replace the dead end with "Create structure" inline.
- Add "Assign to all unassigned (32)" with a base-salary column in a grid.
- Offer a default simple template ("Basic + Allowance").
Projected: from ~6 + 32×4 clicks to under 15 for the first setup [Estimate, unmeasured].

### 4.3 Add a bonus
Current [Measured to modal]: header Quick Incentive (1) → employee select (1+) → amount → date → "Add Incentive". Also Payroll Overview "Add Incentive" and "Bulk Upload". Efficient: 1 click to open from anywhere. Improvement [Opinion]: scope the header button to payroll pages.

### 4.4 Apply for a loan
Current [Measured to step 1]: Loans (1) → "New Loan Application" (1) → 3 steps (Employee & Amount → EMI & Schedule → Confirm & Disburse), but header says "4-Step". Two identical CTAs on the empty page. Improved: fix title; keep header CTA only.

## 5. First-time employee (assumed; HR session only)

Sidebar shows role-based labels in code (`My Offer Letter`, `My Salary Slips`, `Staff Feedback`, `My Feedback`). Not tested as an employee. Judged from UI [Opinion]: Staff Feedback is a friendly form with category tiles and a star rating; it needs a visible "anonymous" statement above the form (the Feedback Analytics says 90% anonymous share, so anonymity is a feature) and a success state (not tested: submit blocked).

## 6. Non-technical user

Hard spots [Observed]: ERPNext field names in New Salary Structure (Letter Head, Mode of Payment, "Amount based on formula", "Condition (optional), e.g. base > 20000"), raw IDs in selects (`HR-EMP-STP-0000`), truncated identical template names, and technical diagnostics wording ("ERPNext settings"). Improve with plain labels and a simple/advanced toggle [Opinion].

## 7. Back-and-forth navigation observed

- Payroll setup requires Salary Structures → Assign → back to create structure → Assign again (F-02).
- Payroll Overview → System Readiness are far apart in the sidebar; the answer to "why is readiness 0%" lives in a different group [Observed].
- Loans page "Assign Structure" button (header) mixes payroll setup into loans [Observed].

## 8. Where combining operations makes sense (all Estimates)

- Run payroll: readiness gate plus run in one flow.
- Create structure + assign in one wizard.
- Offer accepted → one click "Onboard" with pre-filled data.
- Header "Add Candidate" and "Quick Incentive": keep global search and company switch; show module actions only in their module.

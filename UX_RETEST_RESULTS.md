# UX Retest Results

> **Update (final pass, 2026-11-18):** Final-pass results (all re-run on the final build): 16 routes x 3 widths = 0 clipped controls, 0 page-level horizontal scroll, 0 unnamed buttons in the main area; 12 dialogs x 3 widths all fit, take focus and close on Escape; keyboard trap verified with 45 Tab presses and focus return; Run Payroll network on reload = 14 requests, no duplicates. Tests: `npm test` 11/11 + 21/21, backend `unittest` 30/30. Not re-run after the last touch-target padding: the small-target sweep. See `FINAL_UX_QA_REPORT.md` sections 3-6.

Environment: Chrome via the Claude-in-Chrome extension, site `http://localhost:8000/hr-ops`, HR/developer user, after `npx vite build` and hard reload (Ctrl+Shift+R). Read-only: nothing submitted. Screenshot ids: `/tmp/claude-chrome-screenshots-Mi2zsU/screenshot-<id>.jpg`.

## 1. How the viewport was verified

`resize_window` returned success but the page kept the desktop layout (page-reported viewport stayed 1920x1025), so window resizing was **not** used as evidence. Instead `frontend/tests/responsive-sweep.browser.js` loads `/hr-ops` in a same-origin iframe with the exact CSS size, then reads `iframe.contentWindow.innerWidth/innerHeight` back. Viewports reported:

| Requested | Reported by page |
|---|---|
| 390x844 | 390x844 |
| 820x1100 | 820x1100 |
| 1440x900 | 1440x900 |

Reproduce: log in, open `/hr-ops`, paste the file into the console, then `await __run(390, 844); __report(390)` (repeat for 820 and 1440).

## 2. Sweep results (16 routes each; baseline vs after)

Routes: recruitment-pipeline, job-openings, my-interviews, offer-letters, onboarding-pipeline, exit-pipeline, payroll-command, run-payroll, salary-structures, loans, salary-slips, staff-feedback, my-feedback, feedback-analytics, templates, diagnostics. Measures: page horizontal scroll, controls outside the viewport (excluding scroll containers and off-canvas sidebar), unnamed icon-only buttons in the main area.

| Width | Baseline (before fixes) | After fixes |
|---|---|---|
| 390 | Header buttons at x 385–489 off-screen on all 16 routes; page horizontal scroll false | 15 routes clean. my-feedback: long titles ran to x 596 (fixed once: width constraint). Last single-route check: 1 element still past the edge, no page horizontal scroll. Not fully clean |
| 820 | "Quick Incentive" at 699–860 clipped on all 16 routes; templates 326 and staff-feedback 5 unnamed buttons | 0 clipped, 0 unnamed, 0 page scroll on all 16 routes |
| 1440 | 0 clipped | 0 clipped, 0 unnamed, 0 page scroll on all 16 routes |

Notes: baseline 1440/820 numbers come from the pre-fix build in the same session; unnamed-button counting was added to the harness after the first baseline, so the "326 / 5" figures were measured on the intermediate build before the label fixes.

## 3. Functional re-tests

| # | Test | Steps | Expected | Result | Evidence |
|---|---|---|---|---|---|
| T1 | Payroll banner, 0 structures | Payroll Overview | Not ready, no "Run" | PASS: "Action needed / Payroll isn't ready", buttons "Set up salary structures", "View readiness checks" | `…979407641-47` |
| T2 | Banner CTA | Click "Set up salary structures" | Opens Salary Structures | PASS (page opened, URL `#/salary-structures`) | tab URL |
| T3 | Assign dead end | Salary Structures → Assign Structure | Explains, offers create | PASS: alert + "Create a salary structure" button, Assign disabled. Button click not tested | `…979423202-48` |
| T4 | Run page gate | Sidebar → Run Monthly Payroll | Warning, start disabled | PASS: alert "Payroll can't run yet: 0 of 32…", button disabled | `…979423203-49` |
| T5 | Deep link | Click Salary Structures, read URL | `#/salary-structures` | PASS | tab URL |
| T6 | Unknown route | Open `#/bogus-page`, reload | Notice shown | PASS: "Page not found: #/bogus-page …" with Dismiss | `…979443987-52` |
| T7 | Escape: Start Onboarding | Open, press Escape | Closes | PASS | `…979443986-50` |
| T8 | Escape: Initiate Separation | Open, press Escape | Closes | PASS | `…979443986-51` |
| T9 | Rating warning | Interviews → Submit Feedback → 1 star + Strong Hire | Warning, nothing submitted | PASS: warning shown; closed with Escape, no submit | `…979923977-55` |
| T10 | Offer dialog fit | Offer Letters → Generate | Within viewport, scrollable, Escape closes | PASS: top 16, bottom 1009 of 1025, scrollable true; Escape → closed | `…979976394-58` |
| T11 | Kanban at 390 | Pipeline at 390 | Next column peeks | PASS: columns 289px at x 16 and 321 | `…979994302-59` |
| T12 | Offer list at 820 | Offer Letters at 820 | Card layout | PASS | `…979994302-60` |
| T13 | Star button names | `find` in scorecard | `1 star` name | PASS | find output |
| T14 | Entity text | Sweep read My Feedback DOM at 390 | Text, not `&lt;` | PASS: `<script>alert(1)</script>` appears as text | sweep output |
| T15 | Sidebar labels | Sidebar after reload | "Salary Slips", "Share Feedback" | PASS | `…979934863-57` |
| T16 | Automated tests | `cd frontend && npm test` | All pass | PASS 11/11 | terminal |
| T17 | Production build | `cd frontend && npx vite build` | No errors | PASS | terminal |

## 4. Not retested / blocked

- BLOCKED (needs a disposable database and decisions): form validation messages, Create-structure flow end to end, partial payroll acknowledgment, any submit/delete/send.
- NOT TESTED: contrast measurement, keyboard focus order, axe/Lighthouse, screen reader, modals at 390/820, Decided/Completed tabs, public pages, 1440 pipeline width, drawer stage label, loan wizard title, Salary Slips page title.
- NOT STARTED issues: F-12, F-16, F-17, F-18, F-20, F-21, F-22, F-24, F-25.

## 5. Regression tests added

`frontend/tests/regression.test.mjs` (`npm test`): route ids vs sidebar, not-found notice, payroll banner not hard-coded, run gate, assign notice, Escape handlers, offer dialog bounds, rating warning, header labels, icon-button names, label/title consistency. They assert on source text; they were not executed against the pre-fix code.

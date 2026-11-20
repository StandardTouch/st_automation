"""Backend rule tests that need no database and change no data.

Run (from the bench directory):
    env/bin/python -m unittest st_automation.tests.test_ux_rules -v

Every Frappe database/session call is mocked. These tests cover the pure rule
helpers plus the whitelisted entry points with `frappe` patched out.
"""
import json
import unittest
from unittest import mock

import frappe  # noqa: F401  (imported so the module under test can be loaded)

from st_automation.api import payroll, payroll_cli, recruitment


def setUpModule():
	# The @frappe.whitelist type-validation wrapper reads frappe.local.flags.
	frappe.local.flags = frappe._dict(in_test=True)


def emp(n):
	return {"name": f"E{n}", "employee_name": f"Person {n}"}


def person(n, **over):
	d = {"name": f"E{n}", "employee_name": f"Person {n}", "status": "Active", "date_of_joining": "2020-01-01", "relieving_date": None}
	d.update(over)
	return d


def ssa(emp, frm, structure="Basic", name=None):
	return {"name": name or f"SSA-{emp}-{frm}", "employee": emp, "from_date": frm, "salary_structure": structure}


GOOD = {"Basic": {"docstatus": 1, "is_active": "Yes"}, "Old": {"docstatus": 1, "is_active": "No"}, "Draft": {"docstatus": 0, "is_active": "Yes"}}
START, END = "2026-11-01", "2026-11-30"


def classify(employees, assignments, structures=GOOD):
	return payroll._classify_payroll_employees(employees, assignments, structures, START, END)


def names(rows):
	return [r["name"] for r in rows]


class TestPayrollEligibilityClassification(unittest.TestCase):
	def test_active_employee_with_effective_assignment_is_eligible(self):
		el, ex, na = classify([person(1)], [ssa("E1", "2026-01-01")])
		self.assertEqual(names(el), ["E1"])
		self.assertEqual(el[0]["salary_structure"], "Basic")
		self.assertEqual((ex, na), ([], []))

	def test_no_assignment_is_excluded_with_reason(self):
		el, ex, na = classify([person(1)], [])
		self.assertEqual(names(ex), ["E1"])
		self.assertIn("No salary structure assignment", ex[0]["reason"])

	def test_assignment_starting_after_period_end_does_not_count(self):
		el, ex, _ = classify([person(1)], [ssa("E1", "2026-12-01")])
		self.assertEqual((names(el), names(ex)), ([], ["E1"]))

	def test_assignment_starting_on_period_end_counts(self):
		el, _, _ = classify([person(1)], [ssa("E1", "2026-11-30")])
		self.assertEqual(names(el), ["E1"])

	def test_latest_assignment_supersedes_older_one(self):
		# older valid assignment, newer one points at an inactive structure: latest wins -> excluded
		el, ex, _ = classify([person(1)], [ssa("E1", "2026-01-01", "Basic"), ssa("E1", "2026-10-01", "Old")])
		self.assertEqual((names(el), names(ex)), ([], ["E1"]))
		self.assertIn("not active and submitted", ex[0]["reason"])

	def test_newer_valid_assignment_is_the_one_reported(self):
		structures = {**GOOD, "Premium": {"docstatus": 1, "is_active": "Yes"}}
		el, _, _ = classify([person(1)], [ssa("E1", "2026-01-01", "Basic"), ssa("E1", "2026-10-01", "Premium")], structures)
		self.assertEqual(el[0]["salary_structure"], "Premium")

	def test_draft_or_unknown_structure_is_excluded(self):
		self.assertEqual(names(classify([person(1)], [ssa("E1", "2026-01-01", "Draft")])[1]), ["E1"])
		self.assertEqual(names(classify([person(1)], [ssa("E1", "2026-01-01", "Missing")])[1]), ["E1"])

	def test_joining_after_period_is_not_applicable(self):
		el, ex, na = classify([person(1, date_of_joining="2026-12-05")], [ssa("E1", "2026-01-01")])
		self.assertEqual((el, ex, names(na)), ([], [], ["E1"]))

	def test_joining_inside_period_is_still_payable(self):
		el, _, _ = classify([person(1, date_of_joining="2026-11-15")], [ssa("E1", "2026-11-15")])
		self.assertEqual(names(el), ["E1"])

	def test_relieved_before_period_is_not_applicable(self):
		_, _, na = classify([person(1, relieving_date="2026-10-31")], [ssa("E1", "2026-01-01")])
		self.assertEqual(names(na), ["E1"])

	def test_relieved_inside_period_is_still_payable(self):
		el, _, _ = classify([person(1, relieving_date="2026-11-10")], [ssa("E1", "2026-01-01")])
		self.assertEqual(names(el), ["E1"])

	def test_non_active_status_is_not_applicable(self):
		_, _, na = classify([person(1, status="Left")], [ssa("E1", "2026-01-01")])
		self.assertEqual(names(na), ["E1"])

	def test_mixed_population_is_split_correctly(self):
		emps = [person(1), person(2), person(3), person(4, status="Inactive")]
		el, ex, na = classify(emps, [ssa("E1", "2026-01-01"), ssa("E3", "2026-12-15")])
		self.assertEqual((names(el), names(ex), names(na)), (["E1"], ["E2", "E3"], ["E4"]))


class TestPayrollSnapshotAndRules(unittest.TestCase):
	def snap(self, eligible, excluded, start=START, end=END, company="Acme"):
		return payroll._eligibility_snapshot(company, start, end, eligible, excluded)

	def el(self, n, struct="Basic", asg=None):
		return {"name": f"E{n}", "salary_structure": struct, "assignment": asg or f"A{n}"}

	def ex(self, n):
		return {"name": f"E{n}"}

	def test_snapshot_is_stable_and_order_independent(self):
		a = self.snap([self.el(1), self.el(2)], [self.ex(3), self.ex(4)])
		b = self.snap([self.el(2), self.el(1)], [self.ex(4), self.ex(3)])
		self.assertEqual(a, b)

	def test_snapshot_changes_with_period_company_and_membership(self):
		base = self.snap([self.el(1)], [self.ex(2)])
		self.assertNotEqual(base, self.snap([self.el(1)], [self.ex(2)], start="2026-10-01", end="2026-10-31"))
		self.assertNotEqual(base, self.snap([self.el(1)], [self.ex(2)], company="Other"))
		self.assertNotEqual(base, self.snap([self.el(1), self.el(2)], []))  # employee moved lists
		self.assertNotEqual(base, self.snap([self.el(1)], [self.ex(2), self.ex(3)]))  # employee added
		self.assertNotEqual(base, self.snap([self.el(1, struct="Premium")], [self.ex(2)]))  # structure changed
		self.assertNotEqual(base, self.snap([self.el(1, asg="A9")], [self.ex(2)]))  # new assignment

	def result(self, eligible, excluded):
		return {"eligible": eligible, "excluded": excluded, "not_applicable": []}

	def err(self, eligible, excluded, supplied="CUR", ack=None, current="CUR"):
		return payroll._partial_payroll_error(self.result(eligible, excluded), current, supplied, ack)

	def test_nobody_eligible_is_rejected(self):
		self.assertIn("No employees are eligible", self.err([], [self.ex(1)], ack=["E1"]))

	def test_missing_snapshot_is_rejected(self):
		self.assertIn("changed or was not confirmed", self.err([self.el(1)], [], supplied=None))

	def test_stale_snapshot_invalidates_previous_acknowledgement(self):
		msg = self.err([self.el(1)], [self.ex(2)], supplied="OLD", ack=["E2"])
		self.assertIn("changed or was not confirmed", msg)

	def test_new_excluded_employee_needs_new_acknowledgement(self):
		# snapshot matches (user re-confirmed) but ack list predates E3
		msg = self.err([self.el(1)], [self.ex(2), self.ex(3)], ack=["E2"])
		self.assertIn("1 employee(s)", msg)

	def test_all_excluded_acknowledged_passes(self):
		self.assertIsNone(self.err([self.el(1)], [self.ex(2)], ack=["E2"]))
		self.assertIsNone(self.err([self.el(1)], [self.ex(2)], ack=json.dumps(["E2", "E99"])))

	def test_clean_run_needs_snapshot_but_no_acknowledgement(self):
		self.assertIsNone(self.err([self.el(1)], []))

	def test_as_list_accepts_json_string_and_garbage(self):
		self.assertEqual(payroll._as_list('["E1","E2"]'), ["E1", "E2"])
		self.assertEqual(payroll._as_list("not json"), [])
		self.assertEqual(payroll._as_list(None), [])


class TestRunPayrollEnforcesRulesServerSide(unittest.TestCase):
	"""run_payroll_and_report must refuse before touching any data, and the
	snapshot is recomputed on the server (a client cannot invent a matching one)."""

	def fake_result(self, eligible, excluded):
		snap = payroll._eligibility_snapshot("Acme", START, END, eligible, excluded)
		return {"eligible": eligible, "excluded": excluded, "not_applicable": [], "snapshot": snap}

	def run_it(self, result, get_doc_raises=False, **kwargs):
		fake = mock.MagicMock()
		if get_doc_raises:
			fake.get_doc.side_effect = RuntimeError("reached payroll side effects")
		with mock.patch.object(payroll, "frappe", fake), \
			mock.patch.object(payroll, "_assert_hr_admin"), \
			mock.patch.object(payroll, "_fetch_payroll_eligibility", return_value=result):
			res = payroll.run_payroll_and_report("Acme", START, END, **kwargs)
		return res, fake

	def test_rejects_without_snapshot(self):
		res, fake = self.run_it(self.fake_result([self.el(1)], []))
		self.assertEqual(res.get("status"), "error", res)
		self.assertIn("changed or was not confirmed", res["message"])
		self.assertFalse(fake.get_doc.called)
		self.assertFalse(fake.new_doc.called)

	def el(self, n):
		return {"name": f"E{n}", "salary_structure": "Basic", "assignment": f"A{n}"}

	def test_rejects_stale_snapshot_after_eligibility_changed(self):
		old = self.fake_result([self.el(1)], [])
		new = self.fake_result([self.el(1), self.el(2)], [])
		res, fake = self.run_it(new, eligibility_snapshot=old["snapshot"])
		self.assertEqual(res.get("status"), "error", res)
		self.assertFalse(fake.new_doc.called)

	def test_rejects_unacknowledged_exclusions(self):
		r = self.fake_result([self.el(1)], [{"name": "E2"}])
		res, fake = self.run_it(r, eligibility_snapshot=r["snapshot"])
		self.assertEqual(res.get("status"), "error", res)
		self.assertIn("acknowledged", res["message"])
		self.assertFalse(fake.get_doc.called)

	def test_rejects_when_nobody_is_eligible(self):
		r = self.fake_result([], [{"name": "E1"}])
		res, fake = self.run_it(r, eligibility_snapshot=r["snapshot"], acknowledged_excluded=["E1"])
		self.assertEqual(res.get("status"), "error", res)
		self.assertIn("No employees are eligible", res["message"])

	def test_valid_request_passes_the_gate_and_reaches_payroll_logic(self):
		r = self.fake_result([self.el(1)], [{"name": "E2"}])
		res, fake = self.run_it(r, get_doc_raises=True, eligibility_snapshot=r["snapshot"], acknowledged_excluded=["E2"])
		self.assertTrue(fake.get_doc.called, "a valid, acknowledged request must reach the payroll code")
		self.assertNotIn("eligibility", res.get("message", "").lower())


class TestBulkAssignValidation(unittest.TestCase):
	valid = {"Basic"}
	companies = {"E1": "Acme", "E2": "Acme", "E3": "Acme"}

	def check(self, rows, already=()):
		return payroll._validate_bulk_assignments(rows, self.valid, self.companies, set(already))

	def good(self, e="E1", **over):
		row = {"employee": e, "salary_structure": "Basic", "base": 30000, "from_date": "2026-11-01"}
		row.update(over)
		return row

	def test_valid_rows_have_no_problems(self):
		self.assertEqual(self.check([self.good("E1"), self.good("E2")]), [])

	def test_base_must_be_positive(self):
		for bad in (0, -5, "", None, "abc"):
			problems = self.check([self.good(base=bad)])
			self.assertTrue(any("Base salary" in e for e in problems[0]["errors"]), bad)

	def test_unknown_structure_rejected(self):
		self.assertTrue(any("structure" in e for e in self.check([self.good(salary_structure="Nope")])[0]["errors"]))

	def test_inactive_or_unknown_employee_rejected(self):
		self.assertTrue(any("active employee" in e for e in self.check([self.good("E9")])[0]["errors"]))

	def test_duplicate_employee_in_batch_rejected(self):
		problems = self.check([self.good("E1"), self.good("E1")])
		self.assertEqual([p["index"] for p in problems], [1])

	def test_existing_assignment_rejected(self):
		self.assertTrue(any("already has" in e for e in self.check([self.good("E1")], already=["E1"])[0]["errors"]))

	def test_date_required_and_valid(self):
		self.assertTrue(any("Effective date" in e for e in self.check([self.good(from_date="")])[0]["errors"]))
		self.assertTrue(any("not a valid date" in e for e in self.check([self.good(from_date="2026-99-99")])[0]["errors"]))

	def test_missing_employee(self):
		self.assertTrue(any("Employee is required" in e for e in self.check([self.good(e="")])[0]["errors"]))


class TestBulkAssignEntryPointNeverWritesWithoutConfirmation(unittest.TestCase):
	def call(self, **kwargs):
		rows = [{"employee": "E1", "salary_structure": "Basic", "base": 30000, "from_date": "2026-11-01"}]
		fake = mock.MagicMock()
		fake.get_all.side_effect = [["Basic"], [{"name": "E1"}]]
		fake.db.sql.return_value = []
		with mock.patch.object(payroll, "frappe", fake), mock.patch.object(payroll, "_assert_hr_admin"):
			res = payroll.bulk_assign_salary_structure(json.dumps(rows), "Acme", **kwargs)
		return res, fake.new_doc

	def test_default_is_dry_run(self):
		res, new_doc = self.call()
		self.assertTrue(res["data"]["dry_run"])
		self.assertTrue(res["data"]["valid"])
		self.assertFalse(new_doc.called)

	def test_real_write_without_confirmation_is_refused(self):
		res, new_doc = self.call(dry_run=0, confirmed=0)
		self.assertEqual(res.get("status"), "error", res)
		self.assertFalse(new_doc.called)

	def test_confirmed_write_creates_and_submits(self):
		res, new_doc = self.call(dry_run=0, confirmed=1)
		self.assertEqual(res.get("status"), "success", res)
		self.assertEqual(res["data"]["count"], 1)
		new_doc.return_value.submit.assert_called_once()

	def test_empty_selection_rejected(self):
		with mock.patch.object(payroll, "frappe", mock.MagicMock()), mock.patch.object(payroll, "_assert_hr_admin"):
			res = payroll.bulk_assign_salary_structure("[]", "Acme")
		self.assertEqual(res.get("status"), "error", res)

	def test_batch_over_200_rows_is_refused_before_any_query(self):
		rows = [{"employee": f"E{i}", "salary_structure": "Basic", "base": 1, "from_date": "2026-11-01"} for i in range(201)]
		fake = mock.MagicMock()
		with mock.patch.object(payroll, "frappe", fake), mock.patch.object(payroll, "_assert_hr_admin"):
			res = payroll.bulk_assign_salary_structure(json.dumps(rows), "Acme", dry_run=0, confirmed=1)
		self.assertEqual(res.get("status"), "error")
		self.assertIn("maximum 200", res["message"])
		self.assertFalse(fake.new_doc.called)

	def test_exactly_200_rows_is_accepted_for_validation(self):
		rows = [{"employee": f"E{i}", "salary_structure": "Basic", "base": 1, "from_date": "2026-11-01"} for i in range(200)]
		fake = mock.MagicMock()
		fake.get_all.side_effect = [["Basic"], [{"name": f"E{i}"} for i in range(200)]]
		fake.db.sql.return_value = []
		with mock.patch.object(payroll, "frappe", fake), mock.patch.object(payroll, "_assert_hr_admin"):
			res = payroll.bulk_assign_salary_structure(json.dumps(rows), "Acme")
		self.assertTrue(res["data"]["valid"])
		self.assertEqual(len(res["data"]["preview"]), 200)

	def test_failure_midway_rolls_back_and_commits_nothing(self):
		rows = [{"employee": f"E{i}", "salary_structure": "Basic", "base": 5, "from_date": "2026-11-01"} for i in (1, 2)]
		fake = mock.MagicMock()
		fake.get_all.side_effect = [["Basic"], [{"name": "E1"}, {"name": "E2"}]]
		fake.db.sql.return_value = []
		docs = [mock.MagicMock(), mock.MagicMock()]
		docs[1].submit.side_effect = RuntimeError("boom on second row")
		fake.new_doc.side_effect = docs
		with mock.patch.object(payroll, "frappe", fake), mock.patch.object(payroll, "_assert_hr_admin"):
			res = payroll.bulk_assign_salary_structure(json.dumps(rows), "Acme", dry_run=0, confirmed=1)
		self.assertEqual(res.get("status"), "error")
		fake.db.rollback.assert_called_once()
		fake.db.commit.assert_not_called()


class TestFeedbackConflictRule(unittest.TestCase):
	def test_conflict_matrix(self):
		c = recruitment._rating_recommendation_conflict
		self.assertTrue(c(1, "Strong Hire"))
		self.assertTrue(c(2, "Strongly Recommend"))
		self.assertFalse(c(3, "Strong Hire"))
		self.assertTrue(c(4, "Fail"))
		self.assertTrue(c(5, "Do Not Recommend"))
		self.assertFalse(c(3, "Fail"))
		self.assertFalse(c(1, "Fail"))
		self.assertFalse(c(5, "Strong Hire"))
		self.assertFalse(c(3, "Pass"))
		self.assertFalse(c(1, "Hold"))

	def submit(self, rating, rec, explanation=None):
		interview = mock.MagicMock()
		interview.name = "INT-1"
		fake = mock.MagicMock()
		fake.get_doc.return_value = interview
		fake.session.user = "hr@example.com"
		fake.get_all.return_value = []
		fake.get_roles.return_value = ["HR Manager"]
		fake.db.exists.return_value = False
		with mock.patch.object(recruitment, "frappe", fake):
			res = recruitment.submit_interview_feedback("INT-1", rating, rec, "Good talk", conflict_explanation=explanation)
		return res, interview

	def test_conflict_without_explanation_is_rejected_before_saving(self):
		res, interview = self.submit(1, "Strong Hire")
		self.assertEqual(res.get("status"), "error", res)
		self.assertIn("explain", res.get("message", "").lower())
		interview.save.assert_not_called()

	def test_short_explanation_rejected(self):
		res, interview = self.submit(5, "Fail", "oops")
		self.assertEqual(res.get("status"), "error", res)
		interview.save.assert_not_called()

	def test_conflict_with_explanation_is_accepted_and_recorded(self):
		res, interview = self.submit(1, "Strong Hire", "Rated on the wrong scale by mistake")
		self.assertEqual(res.get("status"), "success", res)
		interview.save.assert_called()
		comment = interview.add_comment.call_args[0][1]
		self.assertIn("Conflict explained: Rated on the wrong scale by mistake", comment)

	def test_consistent_feedback_needs_no_explanation(self):
		res, interview = self.submit(4, "Strong Hire")
		self.assertEqual(res.get("status"), "success", res)
		self.assertNotIn("Conflict explained", interview.add_comment.call_args[0][1])


class TestPayrollCliHelperDoesNotBypassSafeguards(unittest.TestCase):
	def elig(self, excluded):
		return {"status": "success", "data": {
			"eligible_count": 1, "excluded_count": len(excluded), "not_applicable": [],
			"excluded": [{"name": n, "employee_name": n, "reason": "x"} for n in excluded], "snapshot": "SNAP"}}

	def run_cli(self, excluded, env):
		with mock.patch.object(payroll_cli, "get_payroll_eligibility", return_value=self.elig(excluded)), \
			mock.patch.object(payroll_cli, "run_payroll_and_report", return_value={"status": "success"}) as run, \
			mock.patch.dict(payroll_cli.os.environ, env, clear=False):
			payroll_cli.os.environ.pop("ST_ACK_EXCLUDED", None) if "ST_ACK_EXCLUDED" not in env else None
			res = payroll_cli.run_payroll_checked("Acme", "2026-11-01", "2026-11-30")
		return res, run

	def test_refuses_when_employees_are_excluded_and_no_explicit_opt_in(self):
		res, run = self.run_cli(["E2"], {})
		self.assertEqual(res["status"], "error")
		run.assert_not_called()

	def test_runs_with_snapshot_and_explicit_acknowledgement_when_opted_in(self):
		res, run = self.run_cli(["E2"], {"ST_ACK_EXCLUDED": "1"})
		run.assert_called_once_with("Acme", "2026-11-01", "2026-11-30", eligibility_snapshot="SNAP", acknowledged_excluded=["E2"])

	def test_clean_run_needs_no_opt_in_but_still_passes_the_snapshot(self):
		res, run = self.run_cli([], {})
		run.assert_called_once_with("Acme", "2026-11-01", "2026-11-30", eligibility_snapshot="SNAP", acknowledged_excluded=[])


if __name__ == "__main__":
	unittest.main()

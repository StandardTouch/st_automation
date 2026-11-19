"""Payroll helper for bench-console / dev scripts.

The payroll engine now requires an eligibility snapshot (and acknowledgement of
every excluded employee). Scripts must not bypass that: this helper fetches the
current eligibility, prints who is included and excluded, and runs payroll only
when nobody is excluded OR the operator explicitly opted in by exporting
ST_ACK_EXCLUDED=1 for that run. It performs real business operations when it
runs payroll, so never point it at shared data without authorization.
"""
import os

from st_automation.api.payroll import get_payroll_eligibility, run_payroll_and_report


def run_payroll_checked(company, start_date, end_date):
	elig = get_payroll_eligibility(company, start_date, end_date)
	if elig.get("status") != "success":
		print("Eligibility check failed:", elig.get("message"))
		return elig
	data = elig["data"]
	print(f"Payroll {start_date}..{end_date} for {company}: "
		f"{data['eligible_count']} included, {data['excluded_count']} excluded, "
		f"{len(data.get('not_applicable', []))} not payable this period")
	for e in data["excluded"]:
		print(f"  EXCLUDED {e['name']} {e.get('employee_name')}: {e.get('reason')}")
	excluded = [e["name"] for e in data["excluded"]]
	if excluded and os.environ.get("ST_ACK_EXCLUDED") != "1":
		msg = "Refusing to run: employees are excluded. Re-run with ST_ACK_EXCLUDED=1 to acknowledge them explicitly."
		print(msg)
		return {"status": "error", "message": msg, "data": {}}
	return run_payroll_and_report(
		company, start_date, end_date,
		eligibility_snapshot=data["snapshot"],
		acknowledged_excluded=excluded,
	)

import unittest
from datetime import datetime, timedelta

from st_automation.api.pipeline_stage import ALL_STAGE_IDS, comm_state, derive_stage

NOW = datetime(2026, 11, 20, 12, 0, 0)


def facts(**kw):
	base = dict(status="Open", talent_pool_tag="", employee=None, offer=None, selected_decision=False,
		interviews=[], booking_token=None, token_expired=False, now=NOW)
	base.update(kw)
	return base


def stage(**kw):
	return derive_stage(facts(**kw))[0]


def labels(**kw):
	return [b[0] for b in derive_stage(facts(**kw))[1]]


class TestStage(unittest.TestCase):
	def test_basic_stages(self):
		self.assertEqual(stage(), "applied")
		self.assertEqual(stage(status="Replied"), "shortlisted")
		self.assertNotIn("Needs link", labels(status="Replied"))

	def test_interview_scheduled_until_all_feedback(self):
		iv = [{"assigned": 3, "feedback": 1, "when": NOW + timedelta(days=1)}]
		self.assertEqual(stage(status="Replied", interviews=iv), "interview_scheduled")
		self.assertIn("1 of 3 feedback", labels(status="Replied", interviews=iv))

	def test_first_scorecard_does_not_complete_multi_interviewer(self):
		iv = [{"assigned": 2, "feedback": 1, "when": NOW - timedelta(days=1)}]
		self.assertEqual(stage(status="Replied", interviews=iv), "interview_scheduled")
		self.assertIn("Feedback due", labels(status="Replied", interviews=iv))

	def test_complete_when_all_feedback_in(self):
		iv = [{"assigned": 2, "feedback": 2, "when": NOW}]
		self.assertEqual(stage(status="Replied", interviews=iv), "interview_completed")

	def test_single_interviewer_or_none_assigned_needs_one_feedback(self):
		self.assertEqual(stage(status="Replied", interviews=[{"assigned": 1, "feedback": 1}]), "interview_completed")
		self.assertEqual(stage(status="Replied", interviews=[{"assigned": 0, "feedback": 0}]), "interview_scheduled")
		self.assertIn("No interviewer", labels(status="Replied", interviews=[{"assigned": 0, "feedback": 0}]))

	def test_multi_round_incomplete_wins(self):
		iv = [{"assigned": 1, "feedback": 1}, {"assigned": 1, "feedback": 0, "when": NOW + timedelta(days=2)}]
		self.assertEqual(stage(status="Replied", interviews=iv), "interview_scheduled")

	def test_accepted_without_offer_or_decision_is_not_selected(self):
		self.assertEqual(stage(status="Accepted"), "interview_completed")
		self.assertIn("Needs decision review", labels(status="Accepted"))

	def test_selected_and_offer_badges(self):
		self.assertEqual(stage(status="Accepted", selected_decision=True), "selected")
		self.assertIn("No offer yet", labels(status="Accepted", selected_decision=True))
		o = {"status": "Awaiting Response", "comm_state": "none"}
		self.assertIn("Offer draft", labels(status="Accepted", offer=o))
		o["comm_state"] = "queued"
		self.assertEqual(stage(status="Accepted", offer=o), "selected")
		self.assertIn("Offer queued", labels(status="Accepted", offer=o))
		o["comm_state"] = "failed"
		self.assertIn("Offer email failed", labels(status="Accepted", offer=o))

	def test_offer_sent_only_when_verified(self):
		o = {"status": "Awaiting Response", "comm_state": "sent"}
		self.assertEqual(stage(status="Accepted", offer=o), "offer_sent")
		self.assertIn("Awaiting response", labels(status="Accepted", offer=o))

	def test_offer_accepted_is_badge_not_hired(self):
		o = {"status": "Accepted", "comm_state": "sent"}
		self.assertEqual(stage(status="Accepted", offer=o), "offer_sent")
		self.assertIn("Accepted - ready to hire", labels(status="Accepted", offer=o))
		o["comm_state"] = "queued"
		self.assertIn("Send not verified", labels(status="Accepted", offer=o))

	def test_hired_beats_everything(self):
		self.assertEqual(stage(status="Rejected", employee="EMP-1", offer={"status": "Accepted", "comm_state": "sent"}), "hired")
		self.assertIn("Status out of date", labels(status="Replied", employee="EMP-1"))

	def test_rejected_vs_declined(self):
		self.assertEqual(stage(status="Rejected"), "rejected")
		self.assertIn("Rejected by us", labels(status="Rejected"))
		self.assertIn("Offer declined", labels(status="Rejected", offer={"status": "Rejected", "comm_state": "sent"}))

	def test_bench_beats_active(self):
		self.assertEqual(stage(status="Hold", talent_pool_tag="On Bench"), "bench")
		self.assertEqual(stage(status="Replied", talent_pool_tag="On Bench"), "bench")

	def test_unknown_status_goes_to_applied_with_flag(self):
		self.assertEqual(stage(status="Weird"), "applied")
		self.assertIn("Data issue", labels(status="Weird"))

	def test_every_result_is_a_known_stage(self):
		for st in ("Open", "Replied", "Accepted", "Hold", "Rejected", "Weird"):
			self.assertIn(stage(status=st), ALL_STAGE_IDS)

	def test_comm_state_never_calls_queued_sent(self):
		self.assertEqual(comm_state([]), "none")
		self.assertEqual(comm_state(["Not Sent"]), "queued")
		self.assertEqual(comm_state(["Sending"]), "queued")
		self.assertEqual(comm_state(["Sent"]), "sent")
		self.assertEqual(comm_state(["Error"]), "failed")
		self.assertEqual(comm_state(["Not Sent", "Sent"]), "sent")


if __name__ == "__main__":
	unittest.main()

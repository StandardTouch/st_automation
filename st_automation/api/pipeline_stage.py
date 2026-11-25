"""Deterministic Kanban stage derivation for the recruitment pipeline.

Pure functions only (no frappe imports) so every rule can be unit-tested.
The Kanban stage is never stored: it is computed on each load from the real
records (Job Applicant, Interview, Job Offer, Email Queue, Employee). Each
candidate lands in exactly one stage; terminal states beat active ones.

Precedence (first match wins):
  1 Hired  2 Rejected  3 Talent Pool / Bench  4 Offer Sent  5 Selected
  6 Interview Completed  7 Interview Scheduled  8 Shortlisted  9 Applied
"""

ACTIVE_STAGES = [
	("applied", "Applied"),
	("shortlisted", "Shortlisted"),
	("interview_scheduled", "Interview Scheduled"),
	("interview_completed", "Interview Completed"),
	("selected", "Selected"),
	("offer_sent", "Offer Sent"),
]
ARCHIVE_STAGES = [
	("hired", "Hired"),
	("bench", "Talent Pool / Bench"),
	("rejected", "Rejected"),
]
ALL_STAGE_IDS = [s for s, _ in ACTIVE_STAGES + ARCHIVE_STAGES]

# Email Queue / Communication states that count as "accepted by the mail server".
SENT_QUEUE_STATUSES = {"Sent"}
FAILED_QUEUE_STATUSES = {"Error"}
FAILED_COMM_STATUSES = {"Bounced", "Soft-Bounced", "Error", "Rejected", "Expired", "Marked As Spam"}


def comm_state(recipient_statuses):
	"""Collapse the Email Queue Recipient statuses for the candidate into one state.

	Returns one of: none, queued, sent, failed. 'queued' is never reported as sent.
	"""
	statuses = [s for s in (recipient_statuses or []) if s is not None]
	if not statuses:
		return "none"
	if any(s in SENT_QUEUE_STATUSES for s in statuses):
		return "sent"
	if any(s in FAILED_QUEUE_STATUSES for s in statuses):
		return "failed"
	return "queued"


def interview_feedback_needed(assigned_count):
	"""Feedback items needed before an interview counts as complete (at least one)."""
	return max(1, int(assigned_count or 0))


def derive_stage(f):
	"""Return (stage_id, badges) for one applicant.

	f keys: status, talent_pool_tag, employee, offer, selected_decision, interviews,
	booking_token, token_expired, now.
	offer: None or {"status": str, "comm_state": str}
	interviews: list of {"assigned": int, "feedback": int, "when": datetime|None}
	badges: list of (label, tone) with tone in neutral, info, warn, bad, good
	"""
	status = (f.get("status") or "Open").strip()
	offer = f.get("offer")
	interviews = f.get("interviews") or []
	badges = []

	# 1 Hired: an Employee is linked to this applicant.
	if f.get("employee"):
		if status in ("Open", "Replied", "Rejected"):
			badges.append(("Status out of date", "neutral"))
		return "hired", badges

	# 2 Rejected (by us) or offer declined by the candidate.
	if status == "Rejected":
		if offer and offer.get("status") == "Rejected":
			badges.append(("Offer declined", "bad"))
		else:
			badges.append(("Rejected by us", "bad"))
		if offer and offer.get("status") == "Awaiting Response":
			badges.append(("Open offer exists", "warn"))
		return "rejected", badges

	# 3 Bench.
	if status == "Hold" or f.get("talent_pool_tag") == "On Bench":
		if any(interview_feedback_needed(i.get("assigned")) > (i.get("feedback") or 0) for i in interviews):
			badges.append(("Interview still scheduled", "warn"))
		return "bench", badges

	# 4 Offer Sent: an offer exists AND its email to the candidate is verified Sent,
	# or the candidate already answered Accepted (then flagged if the send is unverified).
	if offer and offer.get("status") in ("Awaiting Response", "Accepted"):
		comm = offer.get("comm_state") or "none"
		if comm == "sent" or offer.get("status") == "Accepted":
			if offer.get("status") == "Accepted":
				badges.append(("Accepted - ready to hire", "good"))
				if comm != "sent":
					badges.append(("Send not verified", "warn"))
			else:
				badges.append(("Awaiting response", "neutral"))
			return "offer_sent", badges

	# 5 Selected: explicit decision (status Accepted with an offer or a recorded decision).
	if status == "Accepted" and (offer or f.get("selected_decision")):
		comm = (offer or {}).get("comm_state") or "none"
		if not offer:
			badges.append(("No offer yet", "neutral"))
		elif comm == "queued":
			badges.append(("Offer queued", "warn"))
		elif comm == "failed":
			badges.append(("Offer email failed", "bad"))
		else:
			badges.append(("Offer draft", "warn"))
		return "selected", badges

	# 6 / 7 Interviews, judged from real feedback, never from Interview.status.
	if interviews:
		now = f.get("now")
		incomplete = [i for i in interviews if interview_feedback_needed(i.get("assigned")) > (i.get("feedback") or 0)]
		if incomplete:
			total_need = sum(interview_feedback_needed(i.get("assigned")) for i in interviews)
			total_have = sum(min(i.get("feedback") or 0, interview_feedback_needed(i.get("assigned"))) for i in interviews)
			if len(interviews) > 1:
				badges.append((f"Round {len(interviews)} of {len(interviews)}", "info"))
			if total_have:
				badges.append((f"{total_have} of {total_need} feedback", "info"))
			if any(not i.get("assigned") for i in interviews):
				badges.append(("No interviewer", "bad"))
			whens = [i.get("when") for i in incomplete if i.get("when")]
			if now and whens and min(whens) < now:
				badges.append(("Feedback due", "warn"))
			return "interview_scheduled", badges
		if status == "Accepted":
			badges.append(("Needs decision review", "warn"))
		return "interview_completed", badges

	if status == "Accepted":
		# Accepted with no offer, no decision and no interview: do not call it Selected.
		badges.append(("Needs decision review", "warn"))
		return "interview_completed", badges

	# Shortlisted, Applied.
	if status in ("Replied", "Shortlisted"):
		return "shortlisted", badges
	if status == "Open":
		return "applied", badges
	badges.append(("Data issue", "warn"))
	return "applied", badges

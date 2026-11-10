import frappe
from frappe.utils import (
	now_datetime, add_to_date, get_datetime, format_datetime,
	get_url, getdate, nowdate, cint
)
import json
from datetime import datetime, timedelta
from frappe.rate_limiter import rate_limit
from st_automation.api.utils import (
	success_response, error_response, generate_secure_token,
	get_site_booking_url, ensure_custom_fields_exist, safe_int,
	split_datetime, combine_date_time, get_hr_manager_emails
)


@frappe.whitelist()
def get_recruitment_overview():
	"""Returns overview metrics for the Recruitment Dashboard."""
	try:
		total_applicants = frappe.db.count("Job Applicant")
		open_applicants = frappe.db.count("Job Applicant", {"status": ["in", ["Open", "Applied"]]})
		shortlisted = frappe.db.count("Job Applicant", {"status": ["in", ["Shortlisted", "Awaiting Slot Booking"]]})
		interviews_scheduled = frappe.db.count("Job Applicant", {"status": "Interview Scheduled"})
		decisions_pending = frappe.db.count("Job Applicant", {"status": "Interview Completed"})
		selected = frappe.db.count("Job Applicant", {"status": ["in", ["Selected", "Accepted"]]})
		active_jobs = frappe.db.count("Job Opening", {"status": "Open"})

		# Upcoming interviews
		interviews = frappe.get_all(
			"Interview",
			fields=["name", "job_applicant", "job_opening", "scheduled_on", "status"],
			filters={"status": ["in", ["Scheduled", "Pending"]]},
			order_by="scheduled_on asc",
			limit=5
		)

		for item in interviews:
			if item.get("job_applicant"):
				item["applicant_name"] = frappe.db.get_value("Job Applicant", item["job_applicant"], "applicant_name")

		return success_response({
			"total_applicants": total_applicants,
			"open_applicants": open_applicants,
			"shortlisted": shortlisted,
			"interviews_scheduled": interviews_scheduled,
			"decisions_pending": decisions_pending,
			"selected": selected,
			"active_jobs": active_jobs,
			"upcoming_interviews": interviews
		})
	except Exception as e:
		return error_response("Error loading recruitment overview", e)


@frappe.whitelist()
def get_pipeline(job_opening=None, search=None, company=None):
	"""
	Returns all applicants organized by workflow stages for the Kanban pipeline.
	"""
	try:
		filters = {}
		or_filters = None
		specific_job = job_opening if (job_opening and job_opening != "all") else None

		# Job Applicant has no `company` field of its own — a candidate's
		# company is implied by which Job Opening they applied to. The
		# company selector in the topbar was previously wired to state but
		# never actually passed to this call, so switching companies never
		# changed anything shown here.
		empty_stages = {"stages": {"Open": [], "Replied": [], "Accepted": [], "Hold": [], "Rejected": []}}
		if company:
			company_job_titles = frappe.get_all(
				"Job Opening", filters={"company": company}, pluck="name"
			)
			if specific_job and specific_job not in company_job_titles:
				# The selected job opening doesn't belong to the selected
				# company — nothing can match both, rather than silently
				# ignoring one of the two filters.
				return success_response(empty_stages)
			if not company_job_titles:
				return success_response(empty_stages)
			if specific_job:
				filters["job_title"] = specific_job
			else:
				# Include candidates with no job opening yet, so they do not
				# vanish from the pipeline when a company is selected.
				or_filters = [["job_title", "in", company_job_titles], ["job_title", "is", "not set"]]
		elif specific_job:
			filters["job_title"] = specific_job

		applicants = frappe.get_all(
			"Job Applicant",
			fields=[
				"name", "applicant_name", "email_id", "phone_number",
				"job_title", "status", "creation", "resume_attachment",
				"booking_token", "booking_token_expiry", "talent_pool_tag",
				"interview_rating_summary", "booked_slot_time"
			],
			filters=filters,
			or_filters=or_filters,
			order_by="creation desc",
			limit=300
		)

		# Human-readable job title (job_title holds the Job Opening ID).
		_titles = {j.name: j.job_title for j in frappe.get_all("Job Opening", fields=["name", "job_title"])}
		for a in applicants:
			a["job_opening_title"] = _titles.get(a.job_title) or a.job_title

		if search:
			q = search.lower()
			applicants = [
				a for a in applicants
				if q in (a.applicant_name or "").lower() or q in (a.email_id or "").lower() or q in (a.job_title or "").lower()
			]

		# One batched lookup instead of a per-row query — lets the frontend
		# hide "Onboard as Employee" once it's already been done (it was
		# showing every time regardless, so re-clicking just threw "Employee
		# EMP-XXXXXX already exists with this email" instead of the button
		# simply not being offered again).
		employee_by_email = {
			e.personal_email: e.name
			for e in frappe.get_all("Employee", filters={"personal_email": ["is", "set"]}, fields=["name", "personal_email"])
		}

		# Normalize pipeline stages to standard ERPNext statuses
		stages = {
			"Open": [],
			"Replied": [],
			"Accepted": [],
			"Hold": [],
			"Rejected": []
		}

		for app in applicants:
			raw_status = (app.get("status") or "Open").strip()
			booking_token = app.get("booking_token")
			talent_pool = app.get("talent_pool_tag")

			target_stage = "Open"
			if raw_status in ["Open", "Applied"]:
				target_stage = "Open"
			elif raw_status in ["Replied", "Shortlisted", "Awaiting Slot Booking", "Interview Scheduled", "Scheduled", "Interview Completed", "Under Review"]:
				target_stage = "Replied"
			elif raw_status in ["Accepted", "Selected"]:
				target_stage = "Accepted"
			elif raw_status in ["Hold", "On Bench", "Talent Pool"] or talent_pool == "On Bench":
				target_stage = "Hold"
			elif raw_status in ["Rejected"]:
				target_stage = "Rejected"
			else:
				target_stage = "Open"

			app["stage"] = target_stage
			app["employee"] = employee_by_email.get(app.get("email_id"))
			stages[target_stage].append(app)

		return success_response({
			"stages": stages,
			"total_count": len(applicants)
		})
	except Exception as e:
		return error_response("Error loading recruitment pipeline", e)


@frappe.whitelist()
def shortlist_and_notify(applicant_id, notes=None):
	"""
	Shortlists candidate. (Candidate self-booking link has been removed as per requirements)
	"""
	try:
		if not frappe.db.exists("Job Applicant", applicant_id):
			return error_response(f"Applicant {applicant_id} does not exist.")

		doc = frappe.get_doc("Job Applicant", applicant_id)

		doc.status = "Replied"
		# Remove any existing booking tokens just in case
		doc.booking_token = None
		doc.booking_token_expiry = None
		if notes:
			doc.add_comment("Comment", f"Shortlisted by HR. Notes: {notes}")
		doc.save(ignore_permissions=True)
		frappe.db.commit()

		return success_response({
			"applicant_id": applicant_id,
			"status": "Replied",
			"email_sent": False
		}, message="Candidate shortlisted successfully!")
	except Exception as e:
		return error_response(f"Error shortlisting candidate: {str(e)}", e)


@frappe.whitelist(allow_guest=True)
def get_available_slots(token):
	"""
	Public endpoint for candidate slot booking.
	Validates token and returns available time slots across the next 5 business days.
	"""
	try:
		if not token:
			return error_response("Booking token is required.")

		applicants = frappe.get_all(
			"Job Applicant",
			fields=["name", "applicant_name", "email_id", "job_title", "booking_token_expiry", "status", "booked_slot_time"],
			filters={"booking_token": token},
			limit=1
		)

		if not applicants:
			return error_response("Invalid or expired booking link. Please contact HR.")

		applicant = applicants[0]
		expiry = applicant.get("booking_token_expiry")
		if expiry and get_datetime(expiry) < now_datetime():
			return error_response("This interview booking link has expired. Please contact the HR team for a new link.")

		if applicant.get("status") == "Interview Scheduled" and applicant.get("booked_slot_time"):
			return success_response({
				"already_booked": True,
				"applicant_name": applicant.applicant_name,
				"job_title": applicant.job_title,
				"booked_slot_time": format_datetime(applicant.booked_slot_time),
			}, message="You have already scheduled your interview.")

		# Generate next 5 business days slots
		# Standard Touch slots: 10:00 AM, 11:30 AM, 02:00 PM, 03:30 PM, 05:00 PM
		daily_time_slots = ["10:00", "11:30", "14:00", "15:30", "17:00"]
		slots_by_date = []

		current_date = getdate()
		# Start from tomorrow or today afternoon
		day_offset = 1 if now_datetime().hour >= 15 else 0

		days_collected = 0
		while days_collected < 5:
			test_date = current_date + timedelta(days=day_offset)
			day_offset += 1
			# Skip Sunday (6) and Saturday (5) if standard weekend
			if test_date.weekday() in [5, 6]:
				continue

			date_str = test_date.strftime("%Y-%m-%d")
			formatted_header = test_date.strftime("%A, %b %d")

			slot_items = []
			for t in daily_time_slots:
				dt_str = f"{date_str} {t}:00"
				slot_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")

				# Format friendly label
				label = slot_dt.strftime("%I:%M %p")
				slot_items.append({
					"datetime": dt_str,
					"time_label": label,
					"is_available": True
				})

			slots_by_date.append({
				"date": date_str,
				"date_formatted": formatted_header,
				"slots": slot_items
			})
			days_collected += 1

		return success_response({
			"applicant_name": applicant.applicant_name,
			"job_title": applicant.job_title or "Position",
			"already_booked": False,
			"days": slots_by_date
		})
	except Exception as e:
		return error_response("Error loading available interview slots", e)


@frappe.whitelist(allow_guest=True)
def book_slot(token, slot_datetime, interviewer=None):
	"""
	Public endpoint to confirm interview slot booking in 1 click.
	Creates Interview doc and updates applicant.
	"""
	try:
		if not token or not slot_datetime:
			return error_response("Missing token or slot datetime.")

		applicants = frappe.get_all(
			"Job Applicant",
			fields=["name", "applicant_name", "email_id", "job_title", "booking_token_expiry"],
			filters={"booking_token": token},
			limit=1
		)

		if not applicants:
			return error_response("Invalid or expired booking link.")

		app_info = applicants[0]
		doc = frappe.get_doc("Job Applicant", app_info.name)

		# Check default interviewer from Job Opening if not passed
		if not interviewer and doc.job_title:
			interviewer = frappe.db.get_value("Job Opening", {"job_title": doc.job_title}, "default_interviewer")
		if not interviewer:
			# Fallback to current administrator or system user
			interviewer = "Administrator"

		# Create ERPNext Interview record
		interview_doc = frappe.new_doc("Interview")
		interview_doc.job_applicant = doc.name
		interview_doc.job_opening = doc.job_title
		# `scheduled_on` on the core Interview doctype is Date-only — assigning
		# the full datetime string here would silently drop the time, so split
		# it and store the time half in `from_time` as well.
		slot_date, slot_time = split_datetime(slot_datetime)
		interview_doc.scheduled_on = slot_date
		interview_doc.from_time = slot_time
		interview_doc.to_time = slot_time + timedelta(minutes=30)
		interview_doc.status = "Pending"
		interview_doc.flags.ignore_permissions = True
		interview_doc.flags.ignore_mandatory = True
		try:
			interview_doc.insert(ignore_permissions=True)
		except Exception as int_err:
			frappe.log_error(title="st_automation Interview", message=f"Interview creation note: {int_err}")

		# Update applicant status
		doc.status = "Replied"
		doc.booked_slot_time = slot_datetime
		# Clear token to prevent replay
		doc.booking_token = None
		doc.save(ignore_permissions=True)
		frappe.db.commit()

		formatted_time = format_datetime(slot_datetime)

		# Send Confirmation Email
		if doc.email_id:
			try:
				subject = f"Confirmed: Interview for {doc.job_title or 'Position'} — Standard Touch"
				message = f"""
				<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
					<h2 style="color: #10b981; margin-top: 0;">✓ Interview Confirmed!</h2>
					<p>Hi {doc.applicant_name},</p>
					<p>Your interview for <strong>{doc.job_title or 'Position'}</strong> is confirmed for:</p>
					<div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #4f46e5;">
						<p style="margin: 0; font-size: 16px; font-weight: bold; color: #1e293b;">📅 {formatted_time}</p>
					</div>
					<p>Our team will meet with you at the scheduled time. If you need to make any adjustments, please reply to this email.</p>
					<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
					<p style="font-size: 12px; color: #94a3b8;">Standard Touch HR Operations Team</p>
				</div>
				"""
				frappe.sendmail(
					recipients=[doc.email_id],
					cc=get_hr_manager_emails(),
					subject=subject,
					message=message,
					now=True
				)
			except Exception as e:
				frappe.log_error(title="st_automation Email", message=f"Failed to send confirmation email: {e}")

		return success_response({
			"applicant_name": doc.applicant_name,
			"job_title": doc.job_title,
			"slot_datetime": slot_datetime,
			"formatted_time": formatted_time
		}, message="Interview successfully scheduled!")
	except Exception as e:
		return error_response(f"Error booking slot: {str(e)}", e)


def generate_ics_content(subject, description, start_time, duration_hours=1):
	"""Generates an ICS file content for calendar invites."""
	from datetime import timedelta
	start_dt = get_datetime(start_time)
	end_dt = start_dt + timedelta(hours=duration_hours)
	
	dtstamp = now_datetime().strftime('%Y%m%dT%H%M%SZ')
	dtstart = start_dt.strftime('%Y%m%dT%H%M%S')
	dtend = end_dt.strftime('%Y%m%dT%H%M%S')
	
	ics = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Standard Touch//HR Ops//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:REQUEST",
		"BEGIN:VEVENT",
		f"DTSTAMP:{dtstamp}",
		f"DTSTART:{dtstart}",
		f"DTEND:{dtend}",
		f"SUMMARY:{subject}",
		f"DESCRIPTION:{description}",
		"STATUS:CONFIRMED",
		"SEQUENCE:0",
		"BEGIN:VALARM",
		"TRIGGER:-PT15M",
		"ACTION:DISPLAY",
		"DESCRIPTION:Reminder",
		"END:VALARM",
		"END:VEVENT",
		"END:VCALENDAR"
	]
	return "\r\n".join(ics)

@frappe.whitelist(allow_guest=True)
def submit_guest_feedback():
    """Endpoint for interviewers to submit feedback via a secure token.
    Expected GET/POST params:
        token: secure token generated per interviewer
        interview: Interview document name
        feedback: textual feedback (POST)
        rating: optional numeric rating (POST)
    """
    token = frappe.form_dict.get('token')
    interview_name = frappe.form_dict.get('interview')
    feedback = frappe.form_dict.get('feedback')
    rating = frappe.form_dict.get('rating')

    if not token or not interview_name:
        return error_response('Missing token or interview identifier')

    interview = frappe.get_doc('Interview', interview_name)
    # feedback_token stored as JSON mapping interviewer -> token
    token_map = {}
    try:
        token_map = json.loads(interview.feedback_token or '{}')
    except Exception:
        pass
    # Find interviewer associated with token
    interviewer = None
    for emp, tkn in token_map.items():
        if tkn == token:
            interviewer = emp
            break
    if not interviewer:
        return error_response('Invalid or expired feedback token')

    # Record feedback as a comment on the Interview
    # Map Employee ID → User ID (email) since Frappe Comment.comment_by
    # expects a User, not an Employee record name.
    user_id = frappe.db.get_value("Employee", interviewer, "user_id") or frappe.session.user
    comment_text = f"Feedback from {interviewer}: {feedback}"
    if rating:
        comment_text += f" (Rating: {rating})"
    interview.add_comment('Feedback', comment_text, comment_by=user_id)
    interview.flags.ignore_mandatory = True
    interview.save(ignore_permissions=True)
    frappe.db.commit()
    return success_response(message='Feedback submitted successfully')


@frappe.whitelist()
def schedule_interview_round(applicant_id, round_number, interviewers, scheduled_time):
	"""
	Schedules a specific interview round (1, 2, or 3) for a candidate.
	Sends calendar invites (.ics) to all selected interviewers.
	"""
	try:
		if not applicant_id or not round_number or not scheduled_time:
			return error_response("Applicant ID, round number, and scheduled time are required.")

		if isinstance(interviewers, str):
			interviewers = json.loads(interviewers)

		if not interviewers:
			return error_response("At least one interviewer must be selected.")

		doc = frappe.get_doc("Job Applicant", applicant_id)

		# Determine Round Label
		round_labels = {1: "Round 1 (Initial)", 2: "Round 2 (Technical)", 3: "Round 3 (Final/Managerial)"}
		round_name = round_labels.get(int(round_number), f"Round {round_number}")

		# Create Interview Record
		interview_doc = frappe.new_doc("Interview")
		interview_doc.job_applicant = doc.name
		
		# Resolve job_opening safely to avoid LinkValidationError from core ERPNext
		job_opening_id = doc.job_title
		if job_opening_id and not frappe.db.exists("Job Opening", job_opening_id):
			# Resolve by title; never auto-create (and publish) a new Job
			# Opening just because an applicant carried free text.
			job_opening_id = frappe.db.get_value("Job Opening", {"job_title": job_opening_id}) or None
			if job_opening_id:
				doc.db_set("job_title", job_opening_id)

		if job_opening_id:
			interview_doc.job_opening = job_opening_id
			
		# `scheduled_on` is Date-only on the core Interview doctype — split
		# out the time half into `from_time`/`to_time` too, or the time the
		# HR user actually picked is silently discarded.
		sched_date, sched_time = split_datetime(scheduled_time)
		interview_doc.scheduled_on = sched_date
		interview_doc.from_time = sched_time
		interview_doc.to_time = sched_time + timedelta(minutes=30)
		interview_doc.status = "Pending"
		
		# Add Interviewers to child table
		for emp in interviewers:
			user_id = frappe.db.get_value("Employee", emp, "user_id")
			if user_id:
				interview_doc.append("interview_details", {
					"interviewer": user_id
				})
			else:
				# Fallback: if no user_id, check if employee has email and find user by email
				email = frappe.db.get_value("Employee", emp, "company_email") or frappe.db.get_value("Employee", emp, "personal_email")
				if email and frappe.db.exists("User", email):
					interview_doc.append("interview_details", {
						"interviewer": email
					})
			
		# Optional: add a custom field or append to remarks to denote the round
		interview_doc.flags.ignore_permissions = True
		interview_doc.flags.ignore_mandatory = True
		interview_doc.insert(ignore_permissions=True)
		
		# Log the round action
		doc.add_comment("Comment", f"Scheduled {round_name} for {format_datetime(scheduled_time)} with {', '.join(interviewers)}")
		doc.save(ignore_permissions=True)

		# Fetch emails for all selected interviewers (who are Employees)
		interviewer_emails = {}  # emp -> email
		for emp in interviewers:
			email = frappe.db.get_value("Employee", emp, "company_email") or frappe.db.get_value("Employee", emp, "personal_email")
			if email:
				interviewer_emails[emp] = email

		# Generate a unique feedback token per interviewer and store on the interview doc
		feedback_token_map = {}
		for emp in interviewers:
			feedback_token_map[emp] = generate_secure_token(prefix="fb_")

		# Store the feedback token map as JSON on the interview doc (custom field)
		try:
			frappe.db.set_value("Interview", interview_doc.name, "feedback_token", json.dumps(feedback_token_map), update_modified=False)
		except Exception:
			# If field doesn't exist yet, just log and continue
			frappe.log_error(title="st_automation", message="feedback_token field not yet on Interview doctype. Please add it as a custom field.")

		# Generate ICS and send emails
		site_url = frappe.utils.get_url()
		emails_sent = 0
		if interviewer_emails:
			subject = f"Interview Scheduled: {round_name} with {doc.applicant_name}"
			description = f"Please conduct {round_name} for {doc.applicant_name} ({doc.job_title}).\\nCandidate Email: {doc.email_id}\\nCandidate Phone: {doc.phone_number}"
			ics_content = generate_ics_content(subject, description, scheduled_time)

			for emp, email in interviewer_emails.items():
				token = feedback_token_map.get(emp, "")
				# `/interview-feedback` is not a registered Frappe route and 404s —
				# `/hr-ops` is the actual SPA shell, and it already detects this
				# same public-feedback mode via the `token` query param (see
				# App.jsx's `searchParams.has('token')` check), same pattern as
				# the working onboarding/exit `?onboarding_token=`/`?exit_token=` links.
				feedback_url = f"{site_url}/hr-ops?token={token}&interview={interview_doc.name}"
				emp_name = frappe.db.get_value("Employee", emp, "employee_name") or emp

				message = f"""
				<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
				  <h2 style="color: #4f46e5; margin-top: 0;">📅 Interview Assigned – {round_name}</h2>
				  <p>Hi {emp_name},</p>
				  <p>You have been assigned to conduct an interview with <strong>{doc.applicant_name}</strong> for the position of <strong>{doc.job_title or 'the open role'}</strong>.</p>
				  <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #4f46e5;">
				    <p style="margin: 0; font-weight: bold;">🕐 {format_datetime(scheduled_time)}</p>
				  </div>
				  <p>After the interview, please click the link below to submit your feedback:</p>
				  <div style="text-align: center; margin: 24px 0;">
				    <a href="{feedback_url}" style="background-color: #10b981; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Submit Interview Feedback</a>
				  </div>
				  <p style="font-size: 12px; color: #94a3b8;">This feedback link is unique to you. Please do not share it. Your feedback will be recorded in the HR system under your name.</p>
				  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
				  <p style="font-size: 12px; color: #94a3b8;">Standard Touch HR Operations Team</p>
				</div>
				"""

				try:
					frappe.sendmail(
						recipients=[email],
						cc=get_hr_manager_emails(),
						subject=subject,
						message=message,
						attachments=[{
							"fname": "invite.ics",
							"fcontent": ics_content.encode("utf-8")
						}],
						now=True
					)
					emails_sent += 1
				except Exception as mail_err:
					frappe.log_error(title="st_automation Email", message=f"Failed to send interview email to {email}: {mail_err}")

		frappe.db.commit()
		return success_response(message=f"{round_name} scheduled successfully. Calendar invites sent to {len(interviewer_emails)} interviewers.")

	except Exception as e:
		return error_response(f"Error scheduling round {round_number}: {str(e)}", e)


@frappe.whitelist()
def get_applicant_details(applicant_id):
	"""Returns the full applicant profile, used when opening the candidate modal directly."""
	try:
		if not frappe.db.exists("Job Applicant", applicant_id):
			return error_response("Candidate not found.")

		# Fetch with ignore_permissions so interviewers can load candidate profiles.
		# The @frappe.whitelist() decorator + session authentication is the access gate.
		frappe.flags.ignore_permissions = True
		try:
			doc = frappe.get_doc("Job Applicant", applicant_id)
		finally:
			frappe.flags.ignore_permissions = False

		# Map basic fields
		applicant = {
			"name": doc.name,
			"applicant_name": doc.applicant_name,
			"email_id": doc.email_id,
			"phone_number": doc.phone_number,
			"job_title": doc.job_title,
			"job_opening_title": (frappe.db.get_value("Job Opening", doc.job_title, "job_title") if doc.job_title else None) or doc.job_title,
			"status": doc.status,
			"stage": doc.status,
			"creation": doc.creation,
			"resume_attachment": doc.resume_attachment,
			"booking_token": doc.booking_token,
			"booking_token_expiry": doc.booking_token_expiry,
			"talent_pool_tag": doc.talent_pool_tag,
			"interview_rating_summary": doc.interview_rating_summary,
			"booked_slot_time": doc.booked_slot_time,
		}

		if doc.email_id:
			emp_name = frappe.db.get_value("Employee", {"personal_email": doc.email_id}, "name")
			if emp_name:
				applicant["employee"] = emp_name

		return success_response(applicant)
	except Exception as e:
		return error_response("Error loading candidate profile", e)


@frappe.whitelist()
def get_active_candidates(company=None):
	"""Returns candidates in the active 'Replied' stage for ad-hoc scheduling."""
	try:
		filters = {"status": "Replied"}
		if company:
			# Get jobs for this company
			jobs = frappe.get_all("Job Opening", filters={"company": company}, pluck="name")
			if jobs:
				filters["job_title"] = ["in", jobs]
			else:
				# If company has no jobs, it has no candidates
				return success_response({"candidates": []})
				
		candidates = frappe.get_all(
			"Job Applicant",
			filters=filters,
			fields=["name", "applicant_name", "job_title", "email_id"],
			order_by="creation desc"
		)
		return success_response({"candidates": candidates})
	except Exception as e:
		return error_response("Error loading active candidates", e)


@frappe.whitelist()
def get_applicant_interviews(applicant_id):
	"""Fetches all scheduled interviews for a specific applicant."""
	try:
		interviews = frappe.get_all(
			"Interview",
			filters={"job_applicant": applicant_id},
			fields=["name", "job_opening", "scheduled_on", "from_time", "status", "creation"]
		)

		# For each interview, we can find the assigned interviewers from Interview Detail
		for iv in interviews:
			details = frappe.get_all("Interview Detail", filters={"parent": iv.name}, fields=["interviewer"])
			iv["interviewers"] = [d.interviewer for d in details]
			# Human-readable names so the UI can show who the interview is
			# assigned to, not just two-letter initials of an email address.
			iv["interviewer_employees"] = [
				frappe.db.get_value("Employee", {"user_id": u}, "name") for u in iv["interviewers"]
			]
			iv["interviewer_names"] = [
				frappe.db.get_value("User", u, "full_name") or u for u in iv["interviewers"]
			]

			# Fetch feedbacks from Comments on the Interview
			iv["feedbacks"] = []
			comments = frappe.get_all(
				"Comment",
				filters={"reference_doctype": "Interview", "reference_name": iv.name, "comment_type": "Comment"},
				fields=["content", "creation"]
			)
			for c in comments:
				if c.content.startswith("Feedback from "):
					# Parse "Feedback from EMP-1001: Rating 4/5 | Pass | good"
					parts = c.content.split(":", 1)
					if len(parts) == 2:
						interviewer = parts[0].replace("Feedback from ", "").strip()
						details = parts[1].split("|")
						if len(details) >= 3:
							rating = details[0].strip()
							result = details[1].strip()
							fb_text = "|".join(details[2:]).strip()
							iv["feedbacks"].append({
								"interviewer": interviewer,
								"result": result,
								"feedback": f"{rating} - {fb_text}",
								"creation": c.creation
							})


		# Sort by scheduled_on descending (before combining it with from_time below)
		interviews.sort(key=lambda x: x.scheduled_on or x.creation, reverse=True)

		# `scheduled_on` is Date-only on the core Interview doctype — combine
		# it with `from_time` into one datetime string for the frontend, or
		# the time the interview was actually scheduled for gets lost.
		for iv in interviews:
			iv["scheduled_on"] = combine_date_time(iv["scheduled_on"], iv.pop("from_time", None))

		return success_response(interviews)
	except Exception as e:
		return error_response(f"Failed to fetch interviews: {str(e)}", e)


def _interview_has_feedback(interview_name):
	return bool(frappe.db.exists("Interview Feedback", {"interview": interview_name})) or bool(
		frappe.db.exists("Comment", {"reference_doctype": "Interview", "reference_name": interview_name, "content": ["like", "Feedback from %"]})
	)


@frappe.whitelist()
def update_interview(interview_id, scheduled_time=None, interviewers=None):
	"""Reschedules an interview and/or changes its interviewers (before feedback exists)."""
	try:
		if not interview_id or not frappe.db.exists("Interview", interview_id):
			return error_response("Interview not found.")
		doc = frappe.get_doc("Interview", interview_id)
		if doc.status != "Pending":
			return error_response(f"This interview is already {doc.status} and can no longer be changed.")
		if _interview_has_feedback(interview_id):
			return error_response("Feedback has already been submitted for this interview, so it can no longer be changed.")

		changes = []
		new_schedule = None
		if scheduled_time:
			sched_date, sched_time = split_datetime(scheduled_time)
			new_schedule = {
				"scheduled_on": sched_date,
				"from_time": sched_time,
				"to_time": sched_time + timedelta(minutes=30),
			}
			changes.append(f"time to {format_datetime(scheduled_time)}")

		if interviewers is not None:
			if isinstance(interviewers, str):
				interviewers = json.loads(interviewers)
			if not interviewers:
				return error_response("At least one interviewer must be selected.")
			users = []
			for emp in interviewers:
				user_id = frappe.db.get_value("Employee", emp, "user_id")
				if not user_id:
					email = frappe.db.get_value("Employee", emp, "company_email") or frappe.db.get_value("Employee", emp, "personal_email")
					if email and frappe.db.exists("User", email):
						user_id = email
				if user_id:
					users.append(user_id)
			if not users:
				return error_response("None of the selected interviewers has a user account.")
			doc.set("interview_details", [])
			for u in users:
				doc.append("interview_details", {"interviewer": u})
			changes.append("interviewers to " + ", ".join(users))

		if not changes:
			return error_response("Nothing to update.")

		doc.flags.ignore_permissions = True
		doc.flags.ignore_mandatory = True
		doc.save(ignore_permissions=True)
		# HRMS marks `scheduled_on` as set-only-once, so a normal save rejects a
		# reschedule. Write the schedule fields directly, after the save.
		if new_schedule:
			frappe.db.set_value("Interview", doc.name, new_schedule, update_modified=True)
		if doc.job_applicant and frappe.db.exists("Job Applicant", doc.job_applicant):
			frappe.get_doc("Job Applicant", doc.job_applicant).add_comment("Comment", f"Interview {doc.name} updated: " + "; ".join(changes))
		frappe.db.commit()
		return success_response({"name": doc.name}, message=f"Interview {doc.name} updated.")
	except Exception as e:
		return error_response(f"Error updating interview: {str(e)}", e)


@frappe.whitelist()
def cancel_interview(interview_id):
	"""Cancels (deletes) a pending interview that has no feedback yet."""
	try:
		if not interview_id or not frappe.db.exists("Interview", interview_id):
			return error_response("Interview not found.")
		doc = frappe.get_doc("Interview", interview_id)
		if doc.status != "Pending":
			return error_response(f"This interview is already {doc.status} and cannot be cancelled.")
		if _interview_has_feedback(interview_id):
			return error_response("Feedback has already been submitted for this interview, so it cannot be cancelled.")
		applicant = doc.job_applicant
		frappe.delete_doc("Interview", interview_id, ignore_permissions=True, force=True)
		if applicant and frappe.db.exists("Job Applicant", applicant):
			frappe.get_doc("Job Applicant", applicant).add_comment("Comment", f"Interview {interview_id} was cancelled.")
		frappe.db.commit()
		return success_response({"name": interview_id}, message=f"Interview {interview_id} cancelled.")
	except Exception as e:
		return error_response(f"Error cancelling interview: {str(e)}", e)


@frappe.whitelist()
def get_my_interviews():
	"""Returns list of upcoming and past interviews for the interviewer."""
	try:
		user = frappe.session.user
		roles = frappe.get_roles(user)
		is_hr_admin = (
			user == "Administrator"
			or "System Manager" in roles
			or "HR Manager" in roles
			or "HR User" in roles
		)

		if is_hr_admin:
			# HR staff see all interviews
			interviews = frappe.get_all(
				"Interview",
				fields=["name", "job_applicant", "job_opening", "scheduled_on", "from_time", "status"],
				order_by="scheduled_on desc",
				limit=50
			)
		else:
			# Regular users only see interviews they're assigned to
			my_interview_names = frappe.get_all(
				"Interview Detail",
				filters={"interviewer": user},
				pluck="parent"
			)
			if not my_interview_names:
				return success_response({"interviews": []})
			interviews = frappe.get_all(
				"Interview",
				filters={"name": ["in", my_interview_names]},
				fields=["name", "job_applicant", "job_opening", "scheduled_on", "from_time", "status"],
				order_by="scheduled_on desc",
				limit=50
			)

		results = []
		for item in interviews:
			app_name = ""
			resume_url = ""
			phone = ""
			email = ""
			if item.get("job_applicant"):
				app_data = frappe.db.get_value(
					"Job Applicant",
					item["job_applicant"],
					["applicant_name", "resume_attachment", "email_id", "phone_number"],
					as_dict=True
				)
				if app_data:
					app_name = app_data.get("applicant_name")
					resume_url = app_data.get("resume_attachment")
					phone = app_data.get("phone_number")
					email = app_data.get("email_id")

			results.append({
				"interview_id": item.name,
				"applicant_id": item.job_applicant,
				"applicant_name": app_name or item.job_applicant,
				"job_title": item.job_opening or "Position",
				"scheduled_on": combine_date_time(item.scheduled_on, item.from_time),
				"status": item.status,
				"resume_attachment": resume_url,
				"email": email,
				"phone": phone
			})

		return success_response({"interviews": results})
	except Exception as e:
		return error_response("Error loading interviews", e)


@frappe.whitelist(allow_guest=True)
def submit_interview_feedback(interview_id, rating, recommendation, comments, scorecard=None, token=None):
	"""
	Submits structured interview feedback and moves candidate to 'Interview Completed'.

	Called two ways:
	  - By a logged-in HR/interviewer user from the in-app Feedback Scorecard
	    modal (no `token` — the session itself is the authorization).
	  - By an unauthenticated interviewer from the public emailed feedback
	    link (`token` required — this is `allow_guest=True`, so the token is
	    the *only* thing standing between this endpoint and anyone who can
	    guess an `interview_id`, and must be validated against the specific
	    per-interviewer token map stored on the Interview doc).
	"""
	try:
		if not interview_id:
			return error_response("Interview ID is required.")

		interview = frappe.get_doc("Interview", interview_id)

		# --- input validation (applies to both the in-app and public paths) ---
		try:
			rating_val = int(rating)
		except (ValueError, TypeError):
			return error_response("Rating must be a whole number from 1 to 5.")
		if rating_val < 1 or rating_val > 5:
			return error_response("Rating must be a whole number from 1 to 5.")
		rating = rating_val
		if recommendation not in FEEDBACK_RECOMMENDATIONS:
			return error_response("Please choose a valid hiring recommendation.")
		comments = (comments or "").strip()
		if not comments:
			return error_response("Please add a short comment explaining your rating.")
		if len(comments) > 2000:
			return error_response("Comments are too long (maximum 2000 characters).")

		if token:
			# Guest path: the token must match one of the per-interviewer
			# tokens generated when this round was scheduled, and is
			# consumed on successful use (the emailed link is one-time-use,
			# as the public page itself tells the interviewer).
			raw_map = interview.get("feedback_token")
			token_map = frappe.parse_json(raw_map) if raw_map else {}
			matched_employee = next((emp for emp, t in token_map.items() if t == token), None)
			if not matched_employee:
				return error_response("This feedback link is invalid or has already been used.")
			del token_map[matched_employee]
			# Set on the in-memory doc (not a direct db.set_value) — this
			# object still gets a full `.save()` a few lines down for the
			# status change, which would otherwise overwrite a direct DB
			# update with this doc's own stale, pre-consumption token map.
			interview.feedback_token = json.dumps(token_map)
		elif not frappe.session.user or frappe.session.user == "Guest":
			# No token and no logged-in session — neither authorization path applies.
			return error_response("Not permitted. This feedback link may be invalid.")
		else:
			# Logged-in path: only an assigned interviewer or an HR admin may score.
			assigned = [d.interviewer for d in frappe.get_all("Interview Detail", filters={"parent": interview.name}, fields=["interviewer"])]
			roles = set(frappe.get_roles(frappe.session.user))
			is_admin = frappe.session.user == "Administrator" or bool(roles & {"System Manager", "HR Manager"})
			if frappe.session.user not in assigned and not is_admin:
				return error_response("You are not assigned to this interview, so you cannot submit feedback for it.")
			if frappe.db.exists("Comment", {"reference_doctype": "Interview", "reference_name": interview.name, "content": ["like", f"Feedback from {frappe.session.user}:%"]}):
				return error_response("You have already submitted feedback for this interview.")

		interview.status = "Cleared"
		interview.flags.ignore_mandatory = True
		interview.save(ignore_permissions=True)

		applicant_id = interview.job_applicant
		if applicant_id and frappe.db.exists("Job Applicant", applicant_id):
			app_doc = frappe.get_doc("Job Applicant", applicant_id)
			app_doc.status = "Replied"
			submitter = matched_employee if token else frappe.session.user
			summary = f"[{submitter}] Rating: {rating}/5 | Rec: {recommendation} | Notes: {comments}"
			# `interview_rating_summary` is a Data field capped at 140 chars —
			# any candidate feedback with a moderately detailed comment blew
			# past that and threw a validation error on save (surfaced to the
			# submitter, confusingly, as "Invalid Link" by the public feedback
			# page's generic error handler). The full, untruncated text still
			# goes into the comment below, which has no such length limit.
			app_doc.interview_rating_summary = summary[:137] + "..." if len(summary) > 140 else summary
			app_doc.add_comment("Comment", f"Interview Feedback: {summary}")
			app_doc.save(ignore_permissions=True)

		# Add a comment directly to the Interview document so we can retrieve it
		submitter_name = matched_employee if token else frappe.session.user
		interview.add_comment("Comment", f"Feedback from {submitter_name}: Rating {rating}/5 | {recommendation} | {comments}")

		frappe.db.commit()
		return success_response(message="Feedback submitted successfully!")
	except Exception as e:
		return error_response(f"Error submitting feedback: {str(e)}", e)


FEEDBACK_RECOMMENDATIONS = ("Strong Hire", "Pass", "Hold", "Fail", "Strongly Recommend", "Neutral", "Do Not Recommend")


def _get_default_company():
	"""Shared default-company lookup, matching what `onboard_candidate` already used."""
	company = frappe.db.get_single_value("Global Defaults", "default_company")
	if not company:
		companies = frappe.get_all("Company")
		company = companies[0].name if companies else None
	return company


def _resolve_designation(job_title):
	"""
	Job Offer/Employee `designation` is a Link field to the Designation doctype.
	Auto-creates the Designation if it doesn't exist yet, and resolves Job Opening ID if passed.
	"""
	if not job_title:
		return None

	# If job_title passed is actually a Job Opening record ID (e.g. HR-OPN-...), resolve the real designation
	if frappe.db.exists("Job Opening", job_title):
		jo = frappe.db.get_value("Job Opening", job_title, ["designation", "job_title"], as_dict=True)
		if jo:
			job_title = jo.designation or jo.job_title or job_title

	if frappe.db.exists("Designation", job_title):
		return job_title
	try:
		new_desig = frappe.new_doc("Designation")
		new_desig.designation_name = job_title
		new_desig.insert(ignore_permissions=True)
		return job_title
	except Exception:
		return None

def _resolve_department(department, company):
	"""Auto-creates Department if it doesn't exist, handling the tree structure implicitly."""
	if not department:
		return None
	if frappe.db.exists("Department", department):
		return department
	
	existing = frappe.db.get_value("Department", {"department_name": department, "company": company}, "name")
	if existing:
		return existing
		
	try:
		new_dept = frappe.new_doc("Department")
		new_dept.department_name = department
		new_dept.company = company
		new_dept.insert(ignore_permissions=True)
		return new_dept.name
	except Exception:
		return None


@frappe.whitelist()
def record_decision(applicant_id, decision, notes=None, salary_offered=None, designation=None):
	"""
	1-Click Decision Engine:
	- Select: moves to Selected, creates draft Job Offer
	- Bench: tags as Talent Pool / Bench
	- Reject: moves to Rejected, sends polite rejection email
	"""
	try:
		if not frappe.db.exists("Job Applicant", applicant_id):
			return error_response(f"Applicant {applicant_id} does not exist.")

		doc = frappe.get_doc("Job Applicant", applicant_id)

		if decision == "Select":
			doc.status = "Accepted"
			doc.talent_pool_tag = "Shortlisted"
			doc.add_comment("Comment", f"Hiring Decision: SELECTED. {notes or ''}")
			doc.save(ignore_permissions=True)

			# Attempt to create draft Job Offer if DocType exists
			# NOTE: this was silently failing for every single Select decision
			# until now — confirmed via Error Log: `status = "Draft"` isn't a
			# valid Job Offer status (only "Awaiting Response"/"Accepted"/
			# "Rejected" are), and free-text job titles that don't exactly
			# match an existing Designation record also threw. Both errors
			# were swallowed by the bare except below, so `Job Offer` count
			# was 0 despite 6 candidates already marked Selected/Hired.
			if frappe.db.exists("DocType", "Job Offer"):
				try:
					offer = frappe.new_doc("Job Offer")
					offer.job_applicant = doc.name
					offer.applicant_name = doc.applicant_name
					offer.applicant_email = doc.email_id
					# job_title holds a Job Opening ID; use that opening's real
					# designation instead of creating a junk "HR-OPN-..." one.
					opening_designation = frappe.db.get_value("Job Opening", doc.job_title, "designation") if doc.job_title else None
					offer.designation = _resolve_designation(designation or opening_designation or doc.job_title)
					offer.company = _get_default_company()
					offer.offer_date = nowdate()
					offer.status = "Awaiting Response"
					offer.candidate_name = doc.applicant_name
					# Same defaults as the Offer Letter form, so the printed letter
					# never shows "None" for these terms.
					offer.training_duration = "6 months"
					offer.training_stipend = "INR 5,000/month"
					offer.salary_range = "INR 10,000 - 15,000/month"
					offer.contract_duration = "24 Months + 6 months of Training"
					offer.reporting_manager = "Mr. Abdul Nasir Mauzam Ali"
					offer.hr_signatory_name = "Muzammil Siddiqui"
					from st_automation.api.offer_letter import DEFAULT_RESPONSIBILITIES  # lazy: avoids circular import
					offer.responsibilities_text = "\n".join(DEFAULT_RESPONSIBILITIES)
					offer.flags.ignore_permissions = True
					offer.flags.ignore_mandatory = True
					offer.insert(ignore_permissions=True)
				except Exception as offer_err:
					frappe.log_error(title="st_automation Offer", message=f"Job offer draft note: {offer_err}")

			message = f"{doc.applicant_name} marked as SELECTED and Job Offer drafted!"

		elif decision == "Bench":
			doc.status = "Hold"
			doc.talent_pool_tag = "On Bench"
			doc.add_comment("Comment", f"Hiring Decision: ON BENCH / TALENT POOL. {notes or ''}")
			doc.save(ignore_permissions=True)

			# Previously this was a dead end: candidates sat with status=Hold
			# forever with no notification and no way back into the pipeline.
			# Select and Reject both message the candidate — Bench should too.
			if doc.email_id:
				try:
					subject = f"Update regarding your application for {doc.job_title or 'Position'} — Standard Touch"
					email_body = f"""
					<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
						<p>Dear {doc.applicant_name},</p>
						<p>Thank you for your interest in the <strong>{doc.job_title or 'Position'}</strong> role at Standard Touch.</p>
						<p>We were impressed with your profile, and while we don't have an immediate opening that's the right fit today, we'd like to keep you in mind for upcoming opportunities that match your experience.</p>
						<p>We'll reach out if a suitable role opens up — no action is needed from you right now.</p>
						<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
						<p style="font-size: 12px; color: #94a3b8;">Standard Touch Recruitment Team</p>
					</div>
					"""
					frappe.sendmail(
						recipients=[doc.email_id],
						cc=get_hr_manager_emails(),
						subject=subject,
						message=email_body,
						now=True
					)
				except Exception as mail_err:
					frappe.log_error(title="st_automation Bench Email", message=f"Bench email note: {mail_err}")

			message = f"{doc.applicant_name} moved to Talent Pool / Bench and notified."

		elif decision == "Reconsider":
			# Completes the loop for benched candidates: brings them back into
			# the active decision pipeline (same stage as "Replied", where the
			# full Select/Bench/Reject decision set is available) instead of
			# leaving them stuck on the bench forever with no way forward.
			# "Replied" (not "Interview Completed") is the actual valid Job
			# Applicant status value — confirmed both by the field's own
			# validation error and by `submit_interview_feedback` (line 687
			# above) already using "Replied" for this exact same transition.
			# `talent_pool_tag` is a constrained Select too (options defined
			# in setup.py: "", Shortlisted, On Bench, Future Pipeline,
			# Rejected) — "Reconsidered" isn't one of them either. Clearing
			# it back to blank is both valid and semantically right: once
			# pulled out of the bench and back into active decision-making,
			# they're no longer in a talent-pool state this field describes.
			doc.status = "Replied"
			doc.talent_pool_tag = ""
			doc.add_comment("Comment", f"Reconsidered from Talent Pool / Bench for a new role. {notes or ''}")
			doc.save(ignore_permissions=True)
			message = f"{doc.applicant_name} moved back into the active pipeline for a new decision."

		elif decision == "Reject":
			doc.status = "Rejected"
			doc.talent_pool_tag = "Rejected"
			doc.add_comment("Comment", f"Hiring Decision: REJECTED. Reason: {notes or 'Not specified'}")
			doc.save(ignore_permissions=True)

			# Send polite rejection email
			if doc.email_id:
				try:
					subject = f"Update regarding your application for {doc.job_title or 'Position'} — Standard Touch"
					email_body = f"""
					<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
						<p>Dear {doc.applicant_name},</p>
						<p>Thank you for taking the time to speak with us regarding the <strong>{doc.job_title or 'Position'}</strong> role at Standard Touch.</p>
						<p>While we were impressed with your background, we have decided to move forward with another candidate who more closely matches our immediate technical needs for this role.</p>
						<p>We will keep your profile in our talent network for upcoming opportunities that align with your experience.</p>
						<p>We wish you all the best in your career search!</p>
						<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
						<p style="font-size: 12px; color: #94a3b8;">Standard Touch Recruitment Team</p>
					</div>
					"""
					frappe.sendmail(
						recipients=[doc.email_id],
						cc=get_hr_manager_emails(),
						subject=subject,
						message=email_body,
						now=True
					)
				except Exception as mail_err:
					frappe.log_error(title="st_automation Rejection Email", message=f"Rejection email note: {mail_err}")

			message = f"{doc.applicant_name} marked as REJECTED and polite notification sent."

		else:
			return error_response(f"Invalid decision type: {decision}")

		frappe.db.commit()
		return success_response({
			"applicant_id": applicant_id,
			"decision": decision,
			"status": doc.status
		}, message=message)
	except Exception as e:
		return error_response(f"Error recording decision: {str(e)}", e)


@frappe.whitelist()
def quick_add_applicant(applicant_name, email_id, phone_number=None, job_title=None, notes=None, resume_attachment=None):
	"""
	1-Click fast intake form for adding a candidate directly into the pipeline.
	"""
	ensure_custom_fields_exist()
	try:
		if not applicant_name or not email_id:
			return error_response("Candidate Name and Email are required.")
		if not job_title:
			return error_response("Please select a target job opening for this candidate.")

		applicant_name = applicant_name.strip()
		email_id = email_id.strip()
		if len(applicant_name) > 140:
			return error_response("Name is too long (maximum 140 characters).")
		existing = frappe.db.get_value("Job Applicant", {"email_id": email_id}, ["name", "status"], as_dict=True)
		if existing:
			return error_response(f"A candidate with the email {email_id} already exists in the pipeline (status: {existing.status}).")
		if job_title:
			resolved_job = job_title if frappe.db.exists("Job Opening", job_title) else frappe.db.get_value("Job Opening", {"job_title": job_title})
			if not resolved_job:
				return error_response("The selected job opening was not found. Please pick an existing job opening.")
			job_title = resolved_job
		if resume_attachment and not str(resume_attachment).startswith(("/files/", "/private/files/")):
			return error_response("Invalid resume file reference.")

		doc = frappe.new_doc("Job Applicant")
		doc.applicant_name = applicant_name
		doc.email_id = email_id
		doc.phone_number = phone_number or ""
		doc.job_title = job_title or ""
		doc.status = "Open"
		doc.resume_attachment = resume_attachment or ""
		if notes:
			doc.notes = notes

		doc.insert(ignore_permissions=True)
		frappe.db.commit()

		return success_response({
			"name": doc.name,
			"applicant_name": doc.applicant_name,
			"email_id": doc.email_id,
			"job_title": doc.job_title,
			"status": "Applied"
		}, message=f"Candidate {applicant_name} added to pipeline!")
	except Exception as e:
		return error_response(f"Error adding candidate: {str(e)}", e)


@frappe.whitelist()
def create_job_opening(job_title, company, department=None, vacancies=1, publish=0, description=None):
	"""
	Quickly creates a Job Opening from just a title — Job Opening's
	`designation` is a required Link field, so a recruiter typing a free-text
	title (e.g. "Digital Marketing Lead") would normally hit a strict
	Frappe validation error. Reuses `_resolve_designation()` (already backing
	Select/Onboard elsewhere in this file) to auto-create the Designation
	if it doesn't exist yet, matching the same "don't make HR deal with
	ERPNext's strict linking" pattern used throughout this app.
	"""
	try:
		if not job_title or not job_title.strip():
			return error_response("Job title is required.")
		if not company:
			return error_response("Company is required.")

		vac, vac_err = _validate_vacancies(vacancies)
		if vac_err:
			return error_response(vac_err)
		if frappe.db.exists("Job Opening", {"job_title": job_title.strip(), "company": company}):
			return error_response(f"A job opening titled '{job_title.strip()}' already exists for {company}. Edit the existing one or use a different title.")

		designation = _resolve_designation(job_title.strip())
		if not designation:
			return error_response(f"Could not resolve or create a Designation for '{job_title}'.")

		opening = frappe.new_doc("Job Opening")
		opening.job_title = job_title.strip()
		opening.designation = designation
		opening.company = company
		opening.status = "Open"
		opening.vacancies = vac
		opening.publish = 1 if cint(publish) else 0
		if department:
			resolved_dept = _resolve_department(department, company)
			if resolved_dept:
				opening.department = resolved_dept
		if description:
			opening.description = description
		opening.flags.ignore_permissions = True
		opening.flags.ignore_mandatory = True
		opening.insert(ignore_permissions=True)

		frappe.db.commit()
		return success_response(
			{"name": opening.name, "job_title": opening.job_title},
			message=f"Job Opening '{opening.job_title}' created!"
		)
	except Exception as e:
		return error_response(f"Error creating job opening: {str(e)}", e)


def _validate_vacancies(vacancies):
	"""Returns (int_value, error_message). Vacancies must be a whole number 1-1000."""
	if vacancies is None or str(vacancies).strip() == "":
		return 1, None
	try:
		vac = int(str(vacancies).strip())
	except (ValueError, TypeError):
		return None, "Vacancies must be a whole number."
	if vac < 1 or vac > 1000:
		return None, "Vacancies must be between 1 and 1000."
	return vac, None


@frappe.whitelist()
def update_job_opening(job_name=None, job_opening_id=None, job_title=None, department=None, vacancies=None, publish=None, status=None, description=None):
	"""Edits an existing Job Opening (title, department, vacancies, status, visibility)."""
	try:
		target_id = job_name or job_opening_id
		if not target_id or not frappe.db.exists("Job Opening", target_id):
			return error_response("Job Opening not found.")
		doc = frappe.get_doc("Job Opening", target_id)

		if job_title is not None:
			title = job_title.strip()
			if not title:
				return error_response("Job title is required.")
			if title != doc.job_title:
				if frappe.db.exists("Job Opening", {"job_title": title, "company": doc.company, "name": ["!=", doc.name]}):
					return error_response(f"Another job opening titled '{title}' already exists for {doc.company}.")
				if doc.designation == doc.job_title:
					doc.designation = _resolve_designation(title) or doc.designation
				doc.job_title = title
		if vacancies is not None:
			vac, vac_err = _validate_vacancies(vacancies)
			if vac_err:
				return error_response(vac_err)
			doc.vacancies = vac
		if publish is not None:
			doc.publish = 1 if cint(publish) else 0
		if status is not None:
			if status not in ("Open", "Closed"):
				return error_response("Status must be Open or Closed.")
			doc.status = status
		if department is not None:
			if department:
				resolved = _resolve_department(department, doc.company)
				if resolved:
					doc.department = resolved
			else:
				doc.department = None
		if description is not None:
			doc.description = description

		doc.flags.ignore_permissions = True
		doc.save(ignore_permissions=True)
		frappe.db.commit()
		return success_response({"name": doc.name, "job_title": doc.job_title}, message=f"Job Opening '{doc.job_title}' updated!")
	except Exception as e:
		return error_response(f"Error updating job opening: {str(e)}", e)


@frappe.whitelist()
def get_job_openings(company=None):
	"""Returns all job openings with applicant counts, optionally filtered by company."""
	try:
		filters = {}
		if company:
			filters["company"] = company

		openings = frappe.get_all(
			"Job Opening",
			filters=filters,
			fields=["name", "job_title", "status", "designation", "department", "vacancies", "publish", "description"],
			order_by="creation desc"
		)

		for job in openings:
			job["applicant_count"] = frappe.db.count("Job Applicant", {"job_title": job.name})

		return success_response({"job_openings": openings})
	except Exception as e:
		return error_response("Error loading job openings", e)


@frappe.whitelist()
def get_departments(company=None):
	"""Returns a list of all department names, optionally filtered by company."""
	try:
		filters = {}
		if company:
			filters["company"] = company
		departments = frappe.get_all("Department", filters=filters, pluck="name")
		return success_response({"departments": departments})
	except Exception as e:
		return error_response("Error loading departments", e)


@frappe.whitelist()
def toggle_job_opening(job_opening_id, publish):
	"""Toggles publish status of a job opening in 1 click."""
	try:
		doc = frappe.get_doc("Job Opening", job_opening_id)
		doc.publish = 1 if publish else 0
		doc.save(ignore_permissions=True)
		frappe.db.commit()
		return success_response(message=f"Job Opening status updated!")
	except Exception as e:
		return error_response("Error updating job opening", e)


@frappe.whitelist()
def send_offer_letter(applicant_id, file_url=None):
	"""
	Emails the candidate the offer letter HR uploads from their own machine
	(via Frappe's standard `/api/method/upload_file`, then this endpoint
	attaches that exact File record — no auto-generated PDF; the file HR
	picked is what gets sent, always). Sent with `reference_doctype`/
	`reference_name` pointing at the Job Offer record — this is standard
	Frappe email threading, not custom sync code: the "ST HR" Email Account
	already has both incoming and outgoing enabled on this site, so when the
	candidate hits Reply in Gmail, Frappe's own scheduled mail-fetch job
	picks up the reply and automatically threads it onto that Job Offer's
	Communication timeline in ERPNext. No new email credentials needed.
	"""
	try:
		if not file_url:
			return error_response("Please upload the offer letter file before sending.")

		if not frappe.db.exists("Job Applicant", applicant_id):
			return error_response(f"Applicant {applicant_id} does not exist.")

		app_doc = frappe.get_doc("Job Applicant", applicant_id)
		if app_doc.status != "Accepted":
			return error_response("Candidate must be Selected before an offer letter can be sent.")

		if not app_doc.email_id:
			return error_response("This candidate has no email address on file.")

		file_name = frappe.db.get_value("File", {"file_url": file_url}, "name")
		if not file_name:
			return error_response("Could not find the uploaded file — please try uploading it again.")

		offer_name = frappe.db.get_value("Job Offer", {"job_applicant": applicant_id})
		if offer_name:
			offer = frappe.get_doc("Job Offer", offer_name)
		else:
			# The Select decision's Job Offer creation can itself fail (e.g.
			# an unresolvable Designation) — create one now instead of
			# leaving the HR admin at a dead end with nothing to send.
			offer = frappe.new_doc("Job Offer")
			offer.job_applicant = app_doc.name
			offer.applicant_name = app_doc.applicant_name
			offer.applicant_email = app_doc.email_id
			offer.designation = _resolve_designation(app_doc.job_title)
			offer.company = _get_default_company()
			offer.offer_date = nowdate()
			offer.status = "Awaiting Response"
			offer.flags.ignore_permissions = True
			offer.flags.ignore_mandatory = True
			offer.insert(ignore_permissions=True)

		# Attach the uploaded File record directly (by `fid`) — Frappe reads
		# and includes its actual bytes, so this is the real file HR chose,
		# not a generated stand-in.
		attachments = [{"fid": file_name}]
		# Also link the file to this Job Offer so it shows up on the
		# document itself, not just buried in the sent email.
		frappe.db.set_value("File", file_name, {
			"attached_to_doctype": "Job Offer",
			"attached_to_name": offer.name,
		})

		role_label = offer.designation or app_doc.job_title or "this role"
		subject = f"Offer of Employment — {role_label} at Standard Touch"
		email_body = f"""
		<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
			<p>Dear {app_doc.applicant_name},</p>
			<p>Congratulations! We're delighted to offer you the position of <strong>{role_label}</strong> at Standard Touch.</p>
			<p>Please find your formal offer letter attached to this email. Simply reply directly to this email to let us know if you accept, or if you have any questions about the offer.</p>
			<p style="background-color: #f8fafc; padding: 12px; border-left: 4px solid #ef4444; margin: 20px 0;">
				<strong>Note:</strong> This offer is valid for <strong>72 hours</strong> from the time of this email. We kindly request your response within this timeframe.
			</p>
			<p>We're looking forward to hearing from you!</p>
			<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
			<p style="font-size: 12px; color: #94a3b8;">Standard Touch Recruitment Team</p>
		</div>
		"""

		frappe.sendmail(
			recipients=[app_doc.email_id],
			cc=get_hr_manager_emails(),
			subject=subject,
			message=email_body,
			attachments=attachments,
			reference_doctype="Job Offer",
			reference_name=offer.name,
			now=True,
		)

		offer.status = "Awaiting Response"
		offer.flags.ignore_permissions = True
		offer.save(ignore_permissions=True)

		app_doc.add_comment("Comment", f"Offer letter emailed to {app_doc.email_id}.")

		frappe.db.commit()
		return success_response({
			"applicant_id": applicant_id,
			"job_offer": offer.name,
		}, message=f"Offer letter sent to {app_doc.applicant_name}! Their reply will appear on the Job Offer's timeline in ERPNext.")
	except Exception as e:
		return error_response(f"Error sending offer letter: {str(e)}", e)


@frappe.whitelist()
def onboard_candidate(applicant_id):
	"""Converts a Job Applicant into an Employee record in ERPNext."""
	roles = frappe.get_roles(frappe.session.user)
	if frappe.session.user != "Administrator" and not set(roles) & {"System Manager", "HR Manager", "HR User", "Payroll Manager"}:
		frappe.throw("You do not have permission to perform this action.", frappe.PermissionError)
	try:
		if not frappe.db.exists("Job Applicant", applicant_id):
			return error_response(f"Applicant {applicant_id} does not exist.")

		app_doc = frappe.get_doc("Job Applicant", applicant_id)

		# Check if Employee already exists for this email or job_applicant
		existing = None
		if app_doc.email_id:
			existing = frappe.db.get_value("Employee", {"personal_email": app_doc.email_id}, "name")
			if not existing:
				existing = frappe.db.get_value("Employee", {"company_email": app_doc.email_id}, "name")
		if not existing:
			existing = frappe.db.get_value("Employee", {"job_applicant": applicant_id}, "name")

		if existing:
			# Link to Job Offer if exists
			if app_doc.email_id and frappe.db.exists("Job Offer", {"applicant_email": app_doc.email_id}):
				frappe.db.set_value("Job Offer", {"applicant_email": app_doc.email_id}, "employee", existing)
			app_doc.status = "Accepted"
			app_doc.save(ignore_permissions=True)
			frappe.db.commit()
			return success_response({
				"employee": existing,
				"applicant_id": applicant_id,
				"already_existed": True
			}, message=f"Candidate is already onboarded as Employee {existing}!")

		# Create Employee
		emp = frappe.new_doc("Employee")
		candidate_name = (app_doc.applicant_name or "Employee").strip()
		parts = candidate_name.split(" ", 1)
		emp.first_name = parts[0]
		if len(parts) > 1:
			emp.last_name = parts[1]
		emp.employee_name = candidate_name
		if app_doc.email_id:
			emp.personal_email = app_doc.email_id
		emp.status = "Active"
		emp.date_of_joining = nowdate()

		emp.designation = _resolve_designation(app_doc.job_title)

		emp.company = _get_default_company()
		emp.job_applicant = applicant_id

		emp.flags.ignore_mandatory = True

		# Universally bypass permissions for this block
		frappe.flags.ignore_permissions = True
		try:
			emp.insert(ignore_permissions=True)
			frappe.db.commit()
		finally:
			frappe.flags.ignore_permissions = False

		# Link to Job Offer if exists
		if app_doc.email_id and frappe.db.exists("Job Offer", {"applicant_email": app_doc.email_id}):
			frappe.db.set_value("Job Offer", {"applicant_email": app_doc.email_id}, "employee", emp.name)

		app_doc.status = "Accepted"
		app_doc.save(ignore_permissions=True)
		frappe.db.commit()

		return success_response({
			"employee": emp.name,
			"applicant_id": applicant_id
		}, message=f"Successfully onboarded {app_doc.applicant_name} as Employee {emp.name} in ERPNext!")
	except Exception as e:
		return error_response(f"Failed to onboard candidate: {str(e)}", e)

@frappe.whitelist(allow_guest=True)
def get_active_jobs():
	"""Returns published Job Openings for the public careers page."""
	try:
		jobs = frappe.get_all(
			"Job Opening",
			filters={"publish": 1, "status": "Open"},
			fields=["name", "job_title", "department", "company", "description", "route"],
			order_by="creation desc"
		)
		return success_response(jobs)
	except Exception as e:
		return error_response(f"Failed to fetch jobs: {str(e)}", e)


ALLOWED_RESUME_EXT = (".pdf", ".doc", ".docx")
MAX_RESUME_BYTES = 5 * 1024 * 1024


@frappe.whitelist(allow_guest=True)
@rate_limit(limit=20, seconds=600)
def submit_job_application(job_title, applicant_name, email_id, phone_number=None, cover_letter=None, resume_base64=None, resume_name=None):
	"""Creates a Job Applicant from the public careers page."""
	try:
		import base64
		import os
		from frappe.utils import validate_email_address

		applicant_name = (applicant_name or "").strip()
		email_id = (email_id or "").strip()
		if not applicant_name or not email_id:
			return error_response("Name and email are required.")
		if len(applicant_name) > 140:
			return error_response("Name is too long (maximum 140 characters).")
		if not validate_email_address(email_id):
			return error_response("Please enter a valid email address.")

		# The position must exist, be published and still be open.
		job = frappe.db.get_value("Job Opening", job_title, ["name", "publish", "status"], as_dict=True) if job_title else None
		if not job or not job.publish or job.status != "Open":
			return error_response("This position is no longer accepting applications.")

		if frappe.db.exists("Job Applicant", {"email_id": email_id, "job_title": job.name}):
			return error_response("You have already applied for this position with this email address.")
		job_display = frappe.utils.escape_html(frappe.db.get_value("Job Opening", job.name, "job_title") or "Open Role")

		# Validate the resume BEFORE creating anything, so a bad file never
		# leaves a half-created application behind.
		file_content = None
		safe_name = None
		if resume_base64 and resume_name:
			safe_name = os.path.basename(str(resume_name)).strip()
			if not safe_name or safe_name != str(resume_name).strip():
				return error_response("Invalid file name.")
			if not safe_name.lower().endswith(ALLOWED_RESUME_EXT):
				return error_response("Resume must be a PDF, DOC or DOCX file.")
			payload = resume_base64.split(",", 1)[1] if "," in resume_base64 else resume_base64
			if len(payload) > int(MAX_RESUME_BYTES * 1.4):
				return error_response("Resume must be 5MB or smaller.")
			try:
				file_content = base64.b64decode(payload)
			except Exception:
				return error_response("The resume file could not be read. Please upload it again.")
			if len(file_content) > MAX_RESUME_BYTES:
				return error_response("Resume must be 5MB or smaller.")

		app = frappe.new_doc("Job Applicant")
		app.job_title = job.name
		app.applicant_name = applicant_name
		app.email_id = email_id
		app.phone_number = phone_number
		app.cover_letter = cover_letter
		app.status = "Open"

		# Ensure source exists or leave empty
		if frappe.db.exists("Source", "Careers Website"):
			app.source = "Careers Website"

		app.flags.ignore_permissions = True
		app.flags.ignore_mandatory = True
		app.insert(ignore_permissions=True)
		frappe.db.commit()

		# Process file upload if present
		if file_content is not None:
			from frappe.utils.file_manager import save_file
			# Guests may not create private files (frappe raises PermissionError), so
			# the resume never attached for public applicants. The file has already
			# been type/size checked above; elevate only for this single save.
			previous_user = frappe.session.user
			try:
				frappe.set_user("Administrator")
				saved_file = save_file(
					fname=safe_name,
					content=file_content,
					dt="Job Applicant",
					dn=app.name,
					folder="Home/Attachments",
					is_private=1
				)
			except Exception:
				err_trace = frappe.get_traceback()
				frappe.db.rollback()
				frappe.log_error(title="Careers resume upload failed", message=err_trace)
				frappe.delete_doc("Job Applicant", app.name, ignore_permissions=True, force=True)
				frappe.db.commit()
				frappe.set_user(previous_user)
				return error_response("The resume file looks corrupted or is not a valid document. Please upload a valid PDF, DOC or DOCX file.")
			finally:
				frappe.set_user(previous_user)
			app.resume_attachment = saved_file.file_url
			app.save(ignore_permissions=True)
			frappe.db.commit()

		# Send application acknowledgement to applicant and CC HR Managers
		if email_id:
			try:
				ack_subject = f"Application Received: {job_display} — Standard Touch"
				ack_message = f"""
				<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
					<h2 style="color: #ef4444; margin-top: 0;">Application Received</h2>
					<p>Dear {frappe.utils.escape_html(applicant_name)},</p>
					<p>Thank you for applying for the position of <strong>{job_display}</strong> at Standard Touch.</p>
					<p>We have successfully received your application and resume. Our recruitment team is currently reviewing profiles and will contact you if your qualifications match our current requirements.</p>
					<div style="background-color: #f8fafc; padding: 14px; border-radius: 6px; margin: 18px 0; border-left: 4px solid #ef4444;">
						<p style="margin: 0; font-size: 13px; color: #475569;">Application Reference ID: <strong>{app.name}</strong></p>
					</div>
					<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
					<p style="font-size: 12px; color: #94a3b8;">Standard Touch HR Operations Team</p>
				</div>
				"""
				frappe.sendmail(
					recipients=[email_id],
					cc=get_hr_manager_emails(),
					subject=ack_subject,
					message=ack_message,
					now=True
				)
			except Exception as mail_err:
				frappe.log_error(title="st_automation App Ack Email", message=f"Application ack email note: {mail_err}")

		return success_response({"applicant_id": app.name}, message="Application submitted successfully!")
	except Exception as e:
		return error_response(f"Failed to submit application: {str(e)}", e)


@frappe.whitelist()
def delete_job_opening(job_name):
	"""Deletes a Job Opening"""
	try:
		frappe.delete_doc("Job Opening", job_name)
		return success_response(message="Job Opening deleted successfully")
	except Exception as e:
		return error_response(f"Failed to delete Job Opening: {str(e)}", e)

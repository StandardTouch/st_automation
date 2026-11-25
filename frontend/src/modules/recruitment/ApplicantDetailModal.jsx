import React, { useState, useEffect, useRef } from 'react';
import { 
  Mail, Phone, Calendar, Briefcase, FileText, Send, 
  CheckCircle, Clock, Copy, Check, Star, AlertCircle, 
  ExternalLink, UserCheck, ShieldAlert, Users, Video, RefreshCcw, MessageSquare,
  Eye, EyeOff, Trash2, Upload, X
} from 'lucide-react';
import { SlideOver } from '../../components/common/SlideOver';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { formatDate, formatDateTime, callApi, uploadFile } from '../../api/client';
import { formatRatingSummary } from './KanbanBoard';
import { recruitmentApi } from '../../api/recruitmentApi';
import { useToast } from '../../components/common/Toast';
import EmployeeSelect from '../../components/EmployeeSelect';
import { DateInput } from '../../components/common/DateInput';
import { confirmAction } from '../../components/common/ConfirmDialog';

export function ApplicantDetailModal({
  reloadKey,
  isOpen,
  onClose,
  applicant,
  onShortlist,
  onDecision,
  onRefresh,
  onResumeAttached,
  isActionLoading,
  initialSchedulingOpen = false,
  onOpenFeedback,
}) {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [isDecisionOpen, setIsDecisionOpen] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState(null);

  // 3-Round Interview State. `initialSchedulingOpen` lets the Kanban card's
  // "Schedule Interview" button (Replied column) jump straight into the
  // scheduling form instead of landing on the general profile first —
  // previously the only way to reach this was open profile -> find
  // "Schedule Now" -> click it, a two-step detour for the single most
  // common action on a shortlisted candidate.
  const [isSchedulingOpen, setIsSchedulingOpen] = useState(initialSchedulingOpen);
  useEffect(() => {
    if (isOpen) setIsSchedulingOpen(initialSchedulingOpen);
  }, [isOpen, applicant?.name, initialSchedulingOpen]);
  const [interviewRound, setInterviewRound] = useState(1);
  const [selectedInterviewers, setSelectedInterviewers] = useState([]);
  const [interviewTime, setInterviewTime] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);

  // Clear or reset interviewers only when applicant changes
  useEffect(() => {
    setSelectedInterviewers([]);
    setInterviewTime('');
  }, [applicant?.name]);

  const [showResumePreview, setShowResumePreview] = useState(false);
  useEffect(() => {
    setShowResumePreview(false);
  }, [applicant?.name, isOpen]);

  const [interviewEmailPreview, setInterviewEmailPreview] = useState({ subject: '', notes: '' });
  useEffect(() => {
    if (applicant) {
      const roundLabels = { 1: 'Round 1 (Initial)', 2: 'Round 2 (Technical)', 3: 'Round 3 (Final/Managerial)' };
      const roundName = roundLabels[interviewRound] || `Round ${interviewRound}`;
      setInterviewEmailPreview((prev) => ({
        ...prev,
        subject: `Interview Scheduled: ${roundName} with ${applicant.applicant_name}`
      }));
    }
  }, [applicant?.applicant_name, interviewRound]);

  const [scheduledInterviews, setScheduledInterviews] = useState([]);
  // Editing a scheduled interview: { id, time, interviewers } or null
  const [editingInterview, setEditingInterview] = useState(null);
  const [isSavingInterview, setIsSavingInterview] = useState(false);

  const toLocalInput = (iso) => (iso ? String(iso).slice(0, 16) : '');

  const startEditInterview = (iv) => {
    setEditingInterview({
      id: iv.name,
      time: toLocalInput(iv.scheduled_on),
      interviewers: (iv.interviewer_employees || []).filter(Boolean),
    });
  };

  const saveInterviewEdit = async () => {
    if (!editingInterview) return;
    if (!editingInterview.time) { addToast('Please select a date and time.', 'error'); return; }
    if (!editingInterview.interviewers.length) { addToast('Please select at least one interviewer.', 'error'); return; }
    setIsSavingInterview(true);
    try {
      const res = await recruitmentApi.updateInterview(editingInterview.id, {
        scheduled_time: editingInterview.time,
        interviewers: JSON.stringify(editingInterview.interviewers),
      });
      addToast(res.message || 'Interview updated.', 'success');
      setEditingInterview(null);
      loadInterviews();
      onRefresh && onRefresh();
    } catch (err) {
      addToast(err.message || 'Failed to update interview', 'error');
    } finally {
      setIsSavingInterview(false);
    }
  };

  const cancelInterview = async (iv) => {
    if (!(await confirmAction({ title: 'Cancel interview?', message: `Cancel interview ${iv.name}? This cannot be undone.`, confirmLabel: 'Cancel interview', cancelLabel: 'Keep interview', tone: 'danger' }))) return;
    try {
      const res = await recruitmentApi.cancelInterview(iv.name);
      addToast(res.message || 'Interview cancelled.', 'success');
      setEditingInterview(null);
      loadInterviews();
      onRefresh && onRefresh();
    } catch (err) {
      addToast(err.message || 'Failed to cancel interview', 'error');
    }
  };
  const [isLoadingInterviews, setIsLoadingInterviews] = useState(false);

  // Reload every time the drawer opens, not only when the applicant changes:
  // reopening the same candidate used to show the previously cached interviews.
  useEffect(() => {
    if (isOpen && applicant?.name) {
      setScheduledInterviews([]);
      loadInterviews();
    }
  }, [isOpen, applicant?.name, reloadKey]);

  const loadInterviews = async () => {
    setIsLoadingInterviews(true);
    try {
      const res = await callApi('st_automation.api.recruitment.get_applicant_interviews', { applicant_id: applicant.name }, 'GET');
      setScheduledInterviews(res.data || []);
    } catch (err) {
      console.error('Failed to load interviews', err);
    } finally {
      setIsLoadingInterviews(false);
    }
  };

  // Emails already sent to this candidate (shown so HR can see what went out).
  const [sentEmails, setSentEmails] = useState([]);
  const [expandedEmail, setExpandedEmail] = useState(null);
  const loadEmails = async () => {
    try {
      const res = await recruitmentApi.getApplicantEmails(applicant.name);
      setSentEmails(res.data || []);
    } catch (err) {
      console.error('Failed to load emails', err);
    }
  };
  useEffect(() => {
    if (isOpen && applicant?.name) {
      setSentEmails([]);
      setExpandedEmail(null);
      loadEmails();
    }
  }, [isOpen, applicant?.name, applicant?.stage]);

  // Editable rejection email (subject + body), loaded when Reject is chosen.
  const [rejectEmail, setRejectEmail] = useState({ to: '', subject: '', body: '' });
  const [isLoadingRejectEmail, setIsLoadingRejectEmail] = useState(false);
  const [sendRejectEmail, setSendRejectEmail] = useState(true);

  // Resume upload and management for candidates.
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isRemovingResume, setIsRemovingResume] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const resumeFileInputRef = useRef(null);

  const handleResumeUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.(pdf|doc|docx)$/i.test(file.name)) { setResumeError('Only PDF, DOC or DOCX files are allowed.'); return; }
    if (file.size > 5 * 1024 * 1024) { setResumeError('Resume must be 5MB or smaller.'); return; }
    setResumeError('');
    setIsUploadingResume(true);
    try {
      const uploaded = await uploadFile(file, { isPrivate: true, doctype: 'Job Applicant', docname: applicant.name });
      const res = await recruitmentApi.attachResume(applicant.name, uploaded.file_url);
      addToast(res.message || 'Resume attached.', 'success');
      // Parent refetches the applicant so the new resume renders from props.
      onResumeAttached && onResumeAttached(applicant.name);
      onRefresh && onRefresh();
    } catch (err) {
      setResumeError(err.message || 'Failed to upload resume');
    } finally {
      setIsUploadingResume(false);
    }
  };

  const handleRemoveResume = async () => {
    if (!applicant?.name) return;
    const confirmed = await confirmAction({
      title: 'Remove resume?',
      message: 'Are you sure you want to remove the attached resume?',
      confirmLabel: 'Remove resume',
      tone: 'danger',
    });
    if (!confirmed) return;

    setIsRemovingResume(true);
    try {
      const res = await callApi('st_automation.api.recruitment.remove_resume', {
        applicant_id: applicant.name,
      });
      addToast(res.message || 'Resume removed.', 'success');
      setShowResumePreview(false);
      onResumeAttached && onResumeAttached(applicant.name);
      onRefresh && onRefresh();
    } catch (err) {
      addToast(err.message || 'Failed to remove resume', 'error');
    } finally {
      setIsRemovingResume(false);
    }
  };

  const [isOfferLetterOpen, setIsOfferLetterOpen] = useState(false);
  const offerFileInputRef = useRef(null);
  const [offerEmail, setOfferEmail] = useState({ subject: '', body: '' });
  const [useExistingAttachment, setUseExistingAttachment] = useState(false);

  useEffect(() => {
    if (isOfferLetterOpen && applicant) {
      setUseExistingAttachment(Boolean(applicant.resume_attachment));
      const role = applicant.job_opening_title || applicant.job_title || 'this role';
      setOfferEmail({
        subject: `Offer of Employment — ${role} at Standard Touch`,
        body: `Dear ${applicant.applicant_name},\n\nCongratulations! We're delighted to offer you the position of ${role} at Standard Touch.\n\nPlease find your formal offer letter attached to this email. Simply reply directly to this email to let us know if you accept, or if you have any questions about the offer.\n\nNote: This offer is valid for 72 hours from the time of this email. We kindly request your response within this timeframe.\n\nWe look forward to hearing from you!\n\nStandard Touch Recruitment Team`
      });
    }
  }, [isOfferLetterOpen, applicant]);
  const [offerLetterFile, setOfferLetterFile] = useState(null);
  const [isSendingOffer, setIsSendingOffer] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);

  if (!applicant) return null;

  const handleTriggerDecision = (type) => {
    setSelectedDecision(type);
    setIsDecisionOpen(true);
    if (type === 'Reject') {
      setSendRejectEmail(true);
      setIsLoadingRejectEmail(true);
      recruitmentApi.getRejectionEmailPreview(applicant.name)
        .then((res) => setRejectEmail(res.data || { to: '', subject: '', body: '' }))
        .catch(() => setRejectEmail({ to: '', subject: '', body: '' }))
        .finally(() => setIsLoadingRejectEmail(false));
    }
  };

  const confirmDecision = () => {
    if (selectedDecision) {
      if (selectedDecision === 'Reject' && sendRejectEmail && (!rejectEmail.subject.trim() || !rejectEmail.body.trim())) {
        addToast('Rejection email subject and message cannot be empty.', 'error');
        return;
      }
      const isReject = selectedDecision === 'Reject';
      onDecision(
        applicant.name, selectedDecision, decisionNotes,
        isReject && sendRejectEmail ? rejectEmail.subject : undefined,
        isReject && sendRejectEmail ? rejectEmail.body : undefined,
      );
      setIsDecisionOpen(false);
      setDecisionNotes('');
    }
  };

  const handleSendOfferLetter = async () => {
    setIsSendingOffer(true);
    try {
      let fileUrlToSend = null;
      if (useExistingAttachment && applicant.resume_attachment) {
        fileUrlToSend = applicant.resume_attachment;
      } else if (offerLetterFile) {
        // Upload file privately without linking to Job Applicant doctype,
        // so it never overwrites Job Applicant.resume_attachment!
        const uploaded = await uploadFile(offerLetterFile, {
          isPrivate: true,
        });
        fileUrlToSend = uploaded.file_url;
      } else {
        addToast('Please select or upload an offer letter file.', 'error');
        setIsSendingOffer(false);
        return;
      }

      const res = await callApi('st_automation.api.recruitment.send_offer_letter', {
        applicant_id: applicant.name,
        file_url: fileUrlToSend,
        subject: offerEmail.subject,
        message: offerEmail.body,
      });
      addToast(res.message, 'success');
      setIsOfferLetterOpen(false);
      setOfferLetterFile(null);
      if (offerFileInputRef.current) offerFileInputRef.current.value = '';
      loadEmails();
      onRefresh && onRefresh();
    } catch (err) {
      addToast(err.message || 'Failed to send offer letter', 'error');
    } finally {
      setIsSendingOffer(false);
    }
  };

  const handleScheduleInterview = async () => {
    if (!selectedInterviewers || selectedInterviewers.length === 0) {
      addToast('Please select at least one interviewer.', 'error');
      return;
    }
    if (!interviewTime) {
      addToast('Please select a scheduled date and time.', 'error');
      return;
    }
    
    setIsScheduling(true);
    try {
      const res = await callApi('st_automation.api.recruitment.schedule_interview_round', {
        applicant_id: applicant.name,
        round_number: interviewRound,
        interviewers: JSON.stringify(selectedInterviewers),
        scheduled_time: interviewTime,
        custom_subject: interviewEmailPreview.subject,
        custom_notes: interviewEmailPreview.notes,
      });
      addToast(res.message || 'Interview scheduled and calendar invites sent!', 'success');
      setIsSchedulingOpen(false);
      loadInterviews();
      loadEmails();
      onRefresh && onRefresh();
    } catch (err) {
      addToast(err.message || 'Failed to schedule interview', 'error');
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={applicant.applicant_name}
      subtitle={applicant.job_opening_title || applicant.job_title || 'Applicant Profile'}
      width="max-w-4xl"
    >
      <div className="space-y-6 pb-24">
        {/* Top Info Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gray-100 text-gray-700 border border-gray-200 dark:bg-slate-800 dark:border-slate-700">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-label font-semibold text-gray-500 dark:text-slate-400 block">Email Address</span>
              <span className="text-sm font-bold text-gray-900 dark:text-slate-50 truncate block">{applicant.email_id || 'N/A'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600 border border-cyan-100">
              <Phone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-label font-semibold text-gray-500 dark:text-slate-400 block">Phone</span>
              <span className="text-sm font-bold text-gray-900 dark:text-slate-50 truncate block">{applicant.phone_number || 'N/A'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-label font-semibold text-gray-500 dark:text-slate-400 block">Current Stage</span>
              <Badge variant="primary">{({ applied: 'Applied', shortlisted: 'Shortlisted', interview_scheduled: 'Interview Scheduled', interview_completed: 'Interview Completed', selected: 'Selected', offer_sent: 'Offer Sent', hired: 'Hired', bench: 'Talent Pool / Bench', rejected: 'Rejected' })[applicant.pipeline_stage] || ({ Open: 'Applied', Replied: 'Shortlisted' })[applicant.stage || applicant.status] || applicant.stage || applicant.status}</Badge>
            </div>
          </div>
        </div>

        {/* Rejection reason */}
        {applicant.stage === 'Rejected' && (
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-2xl p-4">
            <span className="text-caption font-bold text-rose-700 dark:text-rose-300 block mb-1">Reason for rejection</span>
            <p className="text-sm text-gray-900 dark:text-slate-50 whitespace-pre-wrap">{applicant.rejection_reason || 'No reason was recorded.'}</p>
          </div>
        )}

        {/* Emails sent to candidate & Communications */}
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-slate-50 flex items-center gap-2">
              <Mail className="h-4 w-4 text-brand-red" />
              <span>Emails Sent &amp; Communications</span>
              {sentEmails.length > 0 && (
                <span className="text-xs font-bold text-brand-grey bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                  {sentEmails.length}
                </span>
              )}
            </h3>
            <button
              type="button"
              onClick={loadEmails}
              className="text-xs font-semibold text-gray-500 hover:text-brand-red flex items-center gap-1 transition-colors cursor-pointer"
              title="Refresh emails"
            >
              <RefreshCcw className="h-3 w-3" />
              <span>Refresh</span>
            </button>
          </div>

          {sentEmails.length > 0 ? (
            <div className="space-y-2.5">
              {sentEmails.map((em) => (
                <div key={em.name} className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/60 p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-gray-900 dark:text-slate-50 block truncate">{em.subject}</span>
                      <span className="text-xs text-gray-500 dark:text-slate-400 block mt-0.5">
                        To <span className="font-semibold text-gray-700 dark:text-slate-300">{em.recipients}</span> · {formatDateTime(em.creation)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedEmail(expandedEmail === em.name ? null : em.name)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:text-accent-hover transition-colors shrink-0 px-2.5 py-1 rounded-lg border border-accent/20 hover:bg-accent/10 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>{expandedEmail === em.name ? 'Hide Preview' : 'Preview Email'}</span>
                    </button>
                  </div>
                  {expandedEmail === em.name && (
                    <div className="mt-2.5 pt-3 border-t border-gray-200 dark:border-slate-700">
                      <div className="text-xs text-gray-500 dark:text-slate-400 mb-1.5 font-semibold">Email Content Preview:</div>
                      <div
                        className="text-sm text-gray-800 dark:text-slate-100 bg-white dark:bg-slate-800 rounded-xl p-3.5 border border-gray-200 dark:border-slate-700 overflow-x-auto shadow-inner"
                        dangerouslySetInnerHTML={{ __html: em.content }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center border border-dashed border-gray-200 dark:border-slate-700 rounded-xl bg-gray-50/50 dark:bg-slate-900/30">
              <p className="text-xs text-gray-400 dark:text-slate-500">
                No emails sent yet for this candidate. Sent emails (offer letters, interview invites, rejection letters) will appear here for preview.
              </p>
            </div>
          )}
        </div>

        {/* Existing Scheduled Interviews */}
        {scheduledInterviews.length > 0 && (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 dark:text-slate-50 flex items-center gap-2 mb-4">
              <Calendar className="h-4 w-4 text-brand-red" />
              Scheduled Interviews
            </h3>
            <div className="space-y-3">
              {scheduledInterviews.map((iv) => (
                <div key={iv.name} className="flex flex-col p-4 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-sm font-bold text-gray-900 dark:text-slate-50 block">{iv.name}</span>
                      <span className="text-label text-gray-500 dark:text-slate-400 mt-0.5 block flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(iv.scheduled_on)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <span className="text-caption font-bold text-gray-400 dark:text-slate-500 block mb-0.5">Interviewers</span>
                        <div className="text-label font-semibold text-gray-800 dark:text-slate-100 mb-1 max-w-[220px]">
                          {(iv.interviewer_names && iv.interviewer_names.length ? iv.interviewer_names : iv.interviewers || []).join(', ') || 'Not assigned'}
                        </div>
                        <div className="flex -space-x-2 justify-end">
                          {iv.interviewers?.map((emp, i) => (
                            <div key={i} className="w-6 h-6 rounded-full bg-brand-red text-white flex items-center justify-center text-caption font-bold border-2 border-white ring-1 ring-gray-100" title={emp}>
                              {emp.substring(0, 2).toUpperCase()}
                            </div>
                          ))}
                        </div>
                      </div>
                      <Badge variant={['Scheduled', 'Pending'].includes(iv.status) ? 'primary' : iv.status === 'Completed' || iv.status === 'Cleared' ? 'success' : 'default'}>
                        {iv.status}
                      </Badge>
                    </div>
                  </div>
                  {/* Actions: only while interview is pending and has no feedback */}
                  {iv.status === 'Pending' && !(iv.feedbacks && iv.feedbacks.length) && (
                    editingInterview?.id === iv.name ? (
                      <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-slate-700">
                        <div>
                          <label className="block text-label font-bold text-gray-700 dark:text-slate-200 mb-1">Date & Time</label>
                          <input
                            type="datetime-local"
                            value={editingInterview.time}
                            onChange={(e) => setEditingInterview({ ...editingInterview, time: e.target.value })}
                            className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-brand-black dark:text-slate-50 focus:outline-none focus:border-accent"
                          />
                        </div>
                        <div>
                          <label className="block text-label font-bold text-gray-700 dark:text-slate-200 mb-1">Interviewers</label>
                          <EmployeeSelect
                            multiple
                            value={editingInterview.interviewers}
                            onChange={(vals) => setEditingInterview({ ...editingInterview, interviewers: vals })}
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" onClick={() => setEditingInterview(null)}>Close</Button>
                          <Button variant="primary" isLoading={isSavingInterview} onClick={saveInterviewEdit}>Save Changes</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-gray-200 dark:border-slate-700">
                        {onOpenFeedback && (
                          <Button
                            variant="primary"
                            icon={MessageSquare}
                            onClick={() => onOpenFeedback({
                              ...iv,
                              interview_id: iv.name,
                              applicant_name: applicant.applicant_name,
                              job_title: applicant.job_opening_title || applicant.job_title
                            })}
                          >
                            Submit Feedback
                          </Button>
                        )}
                        <Button variant="secondary" onClick={() => startEditInterview(iv)}>Reschedule / Edit</Button>
                        <Button variant="danger" onClick={() => cancelInterview(iv)}>Cancel Interview</Button>
                      </div>
                    )
                  )}
                  {/* Feedbacks Section */}
                  {iv.feedbacks && iv.feedbacks.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700 space-y-2">
                      <span className="text-caption font-bold text-gray-500 dark:text-slate-400 block mb-2">Submitted Feedbacks</span>
                      {iv.feedbacks.map((fb, fidx) => (
                        <div key={fidx} className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-gray-100 dark:border-slate-700">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-label font-bold text-gray-900 dark:text-slate-50">{fb.interviewer}</span>
                            <Badge variant={fb.result === 'Pass' ? 'success' : fb.result === 'Fail' ? 'danger' : 'warning'}>{fb.result}</Badge>
                          </div>
                          <p className="text-label text-gray-600 dark:text-slate-300 italic">"{fb.feedback}"</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Schedule 3-Round Interview Section (Shows if Shortlisted/Replied) */}
        {applicant.stage === 'Replied' && (
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <Video className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-slate-50">Schedule Interview Round</h3>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsSchedulingOpen(!isSchedulingOpen)}
              >
                {isSchedulingOpen ? 'Cancel Scheduling' : 'Schedule Now'}
              </Button>
            </div>

            {isSchedulingOpen && (
              <div className="space-y-4 animate-fade-in bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 mb-1.5">Interview Round</label>
                    <select
                      value={interviewRound}
                      onChange={(e) => setInterviewRound(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-slate-50 focus:border-accent focus:ring-brand-red outline-none"
                    >
                      <option value={1}>Round 1 (Initial Interview)</option>
                      <option value={2}>Round 2 (Technical Interview)</option>
                      <option value={3}>Round 3 (Managerial Interview)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 mb-1.5">Scheduled Date & Time *</label>
                    <DateInput
                      type="datetime-local"
                      value={interviewTime}
                      onChange={(e) => setInterviewTime(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-slate-50 focus:border-accent focus:ring-brand-red outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 mb-1.5">Assign Interviewers * <span className="font-normal text-gray-400 dark:text-slate-500">(select one or more)</span></label>
                  <EmployeeSelect 
                    value={selectedInterviewers}
                    onChange={setSelectedInterviewers}
                    multiple={true}
                    className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-slate-50 focus:border-accent h-32"
                  />
                  <p className="text-caption text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Calendar invites (.ics) will be automatically emailed to all selected interviewers.
                  </p>
                </div>

                {/* Email Invitation Preview & Customization */}
                <div className="space-y-3 border border-gray-200 dark:border-slate-700 rounded-xl p-4 bg-gray-50 dark:bg-slate-900/50">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 block">
                    Email Invitation Preview
                  </span>
                  <div>
                    <label className="block text-label font-bold text-gray-700 dark:text-slate-200 mb-1">Email Subject</label>
                    <input
                      type="text"
                      value={interviewEmailPreview.subject}
                      onChange={(e) => setInterviewEmailPreview({ ...interviewEmailPreview, subject: e.target.value })}
                      className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-slate-50 focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-label font-bold text-gray-700 dark:text-slate-200 mb-1">Optional Agenda / Instructions for Interviewers</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Focus on coding assessment and system design..."
                      value={interviewEmailPreview.notes}
                      onChange={(e) => setInterviewEmailPreview({ ...interviewEmailPreview, notes: e.target.value })}
                      className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm text-gray-900 dark:text-slate-50 focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button 
                    variant="primary" 
                    icon={Calendar} 
                    isLoading={isScheduling}
                    onClick={handleScheduleInterview}
                  >
                    Confirm & Send Invites
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}



        {/* Feedback / Scorecard Summary */}
        {applicant.interview_rating_summary && (
          <div className="bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/30 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-300">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              <span>Interviewer Feedback Summary</span>
            </div>
            <p className="text-sm text-gray-800 dark:text-slate-100 bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
              {formatRatingSummary(applicant.interview_rating_summary)}
            </p>
          </div>
        )}

        {/* Inline CV / Resume Viewer */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-700 dark:text-slate-300 flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-red" />
              <span>Resume / CV Document</span>
            </h4>
            {applicant.resume_attachment && showResumePreview && (
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowResumePreview(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent-hover transition-colors"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  <span>Hide Preview</span>
                </button>
                <span className="text-gray-300 dark:text-slate-600">|</span>
                <a
                  href={applicant.resume_attachment}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-gray-500 hover:text-brand-red dark:text-slate-400 font-semibold flex items-center gap-1 transition-colors"
                >
                  <span>Open</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
                <span className="text-gray-300 dark:text-slate-600">|</span>
                <label className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-white cursor-pointer transition-colors" title="Replace resume">
                  <Upload className="h-3 w-3" />
                  <span>{isUploadingResume ? 'Replacing...' : 'Replace'}</span>
                  <input
                    ref={resumeFileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    disabled={isUploadingResume}
                    onChange={handleResumeUpload}
                  />
                </label>
                <span className="text-gray-300 dark:text-slate-600">|</span>
                <button
                  type="button"
                  disabled={isRemovingResume}
                  onClick={handleRemoveResume}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors disabled:opacity-50"
                  title="Remove resume"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>{isRemovingResume ? 'Removing...' : 'Clear'}</span>
                </button>
              </div>
            )}
          </div>

          {applicant.resume_attachment ? (
            showResumePreview ? (
              <div className="h-[480px] w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 overflow-hidden shadow-inner flex flex-col animate-fade-in">
                <iframe
                  src={applicant.resume_attachment}
                  title="Candidate Resume"
                  className="w-full h-full border-0 bg-white dark:bg-slate-800"
                />
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-brand-red border border-red-100 dark:border-red-500/20 shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-gray-900 dark:text-slate-50 block truncate">
                      {applicant.resume_attachment.split('/').pop() || 'Candidate Resume'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-slate-400 block">PDF / Document attached</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="primary"
                    icon={Eye}
                    onClick={() => setShowResumePreview(true)}
                  >
                    Preview
                  </Button>
                  <a
                    href={applicant.resume_attachment}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Open</span>
                  </a>
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200 cursor-pointer transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{isUploadingResume ? 'Replacing...' : 'Replace'}</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      disabled={isUploadingResume}
                      onChange={handleResumeUpload}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={isRemovingResume}
                    onClick={handleRemoveResume}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{isRemovingResume ? 'Removing...' : 'Clear'}</span>
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="py-12 text-center border border-dashed border-gray-200 dark:border-slate-700 rounded-2xl bg-gray-50 dark:bg-slate-900/40">
              <FileText className="h-8 w-8 text-gray-400 dark:text-slate-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">No resume attached to this application</p>
              <label className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-accent hover:bg-accent-hover text-white cursor-pointer transition-colors">
                <FileText className="h-4 w-4" />
                <span>{isUploadingResume ? 'Uploading...' : 'Upload Resume'}</span>
                <input type="file" accept=".pdf,.doc,.docx" className="hidden" disabled={isUploadingResume} onChange={handleResumeUpload} />
              </label>
              <p className="text-xs text-gray-400 mt-2">PDF, DOC, DOCX up to 5MB</p>
              {resumeError && <p className="mt-2 text-sm text-red-600 font-medium">{resumeError}</p>}
            </div>
          )}
          {applicant.resume_attachment && resumeError && (
            <p className="mt-1 text-xs text-red-600 font-medium">{resumeError}</p>
          )}
        </div>

        {/* 1-Click Action Footer Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-10 bg-white dark:bg-slate-800/95 px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
          {/* If Fresh Applied */}
          {applicant.stage === 'Open' && (
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                variant="primary"
                icon={Send}
                isLoading={isActionLoading}
                onClick={() => onShortlist(applicant)}
              >
                Move to Shortlisted
              </Button>
              <Button
                variant="danger"
                isLoading={isActionLoading}
                onClick={() => handleTriggerDecision('Reject')}
              >
                Reject
              </Button>
            </div>
          )}

          {/* If Interview Completed or Ready for Decision */}
          {applicant.stage === 'Replied' && (
            <div className="flex items-center gap-2.5 w-full justify-end">
              <Button
                variant="primary"
                icon={UserCheck}
                isLoading={isActionLoading}
                onClick={() => handleTriggerDecision('Select')}
              >
                Move to Selected
              </Button>
              <Button
                variant="secondary"
                isLoading={isActionLoading}
                onClick={() => handleTriggerDecision('Bench')}
              >
                Talent Pool / Bench
              </Button>
              <Button
                variant="danger"
                isLoading={isActionLoading}
                onClick={() => handleTriggerDecision('Reject')}
              >
                Reject
              </Button>
            </div>
          )}

          {/* If Candidate is Selected/Accepted. Send Offer Letter opens a
              small dialog where HR uploads the actual offer letter file
              from their machine — nothing is auto-generated or sent without
              a file being picked first. The email is threaded via Job
              Offer's reference_doctype/reference_name so the candidate's
              Gmail reply syncs back into ERPNext automatically through the
              already-configured "ST HR" Email Account (incoming + outgoing
              both enabled — no new credentials needed). Onboard as Employee
              stays a separate, deliberate step HR takes once the candidate
              has actually confirmed acceptance. */}
          {applicant.stage === 'Accepted' && (
            <div className="flex items-center justify-end gap-2.5 w-full">
              <Button
                variant="danger"
                isLoading={isActionLoading}
                onClick={() => handleTriggerDecision('Reject')}
              >
                Reject
              </Button>

              {!applicant.employee && (
                <Button
                  variant="secondary"
                  isLoading={isActionLoading}
                  onClick={() => handleTriggerDecision('Bench')}
                >
                  Talent Pool / Bench
                </Button>
              )}

              <Button
                variant="secondary"
                icon={Send}
                onClick={() => setIsOfferLetterOpen(true)}
              >
                Send Offer Letter
              </Button>

              {applicant.employee ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                  <UserCheck className="h-4 w-4" />
                  Onboarded as {applicant.employee}
                </span>
              ) : (
                <Button
                  variant="primary"
                  icon={UserCheck}
                  isLoading={isOnboarding || isActionLoading}
                  disabled={isOnboarding || isActionLoading}
                  onClick={async () => {
                    if (isOnboarding || isActionLoading) return;
                    setIsOnboarding(true);
                    try {
                      const res = await callApi('st_automation.api.recruitment.onboard_candidate', { applicant_id: applicant.name });
                      addToast(res.message || 'Successfully onboarded as Employee!', 'success');
                      if (onRefresh) {
                        onRefresh();
                      }
                      onClose();
                    } catch (err) {
                      addToast(err.message || 'Failed to onboard candidate', 'error');
                    } finally {
                      setIsOnboarding(false);
                    }
                  }}
                >
                  {isOnboarding ? 'Onboarding Employee...' : 'Onboard as Employee'}
                </Button>
              )}
            </div>
          )}

          {/* If Candidate is on the Bench / Talent Pool — previously a dead
              end with no way forward. Reconsider sends them back into the
              active pipeline (Replied stage) for a fresh decision; Reject
              lets HR formally close out a bench candidate who's no longer
              relevant instead of leaving them on the bench indefinitely. */}
          {applicant.stage === 'Hold' && (
            <div className="flex items-center gap-2.5 w-full justify-end">
              <Button
                variant="primary"
                icon={RefreshCcw}
                isLoading={isActionLoading}
                onClick={() => handleTriggerDecision('Reconsider')}
              >
                Reconsider for New Role
              </Button>
              <Button
                variant="danger"
                isLoading={isActionLoading}
                onClick={() => handleTriggerDecision('Reject')}
              >
                Reject
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Decision Confirmation Modal */}
      {isDecisionOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-50">
              Confirm Hiring Decision: {selectedDecision}
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {selectedDecision === 'Select' && 'This will mark candidate as Selected and move them to the Selected stage.'}
              {selectedDecision === 'Bench' && 'This will move candidate to Talent Pool / Bench and send them a polite "keeping you in mind" email.'}
              {selectedDecision === 'Reconsider' && 'This will move the candidate back into the active pipeline so you can make a fresh Select / Bench / Reject decision for a new role.'}
              {selectedDecision === 'Reject' && 'This will mark candidate as Rejected. Review or edit the email below before it is sent.'}
            </p>
            {selectedDecision === 'Select' && (
              scheduledInterviews.length === 0 ? (
                <p className="mt-3 text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  No interview has been scheduled for this candidate yet.
                </p>
              ) : !scheduledInterviews.some((iv) => iv.feedbacks && iv.feedbacks.length > 0) ? (
                <p className="mt-3 text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  No interview feedback has been submitted yet.
                </p>
              ) : null
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 mb-1">Optional Notes / Reason</label>
              <textarea
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Add any internal decision notes..."
                rows={3}
                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm text-gray-900 dark:text-slate-50 focus:outline-none focus:border-accent focus:ring-1 focus:ring-brand-red"
              />
            </div>

            {selectedDecision === 'Reject' && (
              <div className="space-y-3 border border-gray-200 dark:border-slate-700 rounded-xl p-3 bg-gray-50 dark:bg-slate-900/50">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-slate-200">
                  <input type="checkbox" checked={sendRejectEmail} onChange={(e) => setSendRejectEmail(e.target.checked)} />
                  Send rejection email{rejectEmail.to ? ` to ${rejectEmail.to}` : ''}
                </label>
                {sendRejectEmail && (isLoadingRejectEmail ? (
                  <p className="text-sm text-gray-500">Loading email...</p>
                ) : (
                  <>
                    <div>
                      <label className="block text-label font-bold text-gray-700 dark:text-slate-200 mb-1">Subject</label>
                      <input
                        type="text"
                        value={rejectEmail.subject}
                        onChange={(e) => setRejectEmail({ ...rejectEmail, subject: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-slate-50 focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-label font-bold text-gray-700 dark:text-slate-200 mb-1">Message</label>
                      <textarea
                        rows={8}
                        value={rejectEmail.body}
                        onChange={(e) => setRejectEmail({ ...rejectEmail, body: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm text-gray-900 dark:text-slate-50 focus:outline-none focus:border-accent"
                      />
                    </div>
                  </>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setIsDecisionOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={
                  selectedDecision === 'Select'
                    ? 'success'
                    : selectedDecision === 'Bench'
                      ? 'warning'
                      : selectedDecision === 'Reconsider'
                        ? 'primary'
                        : 'danger'
                }
                isLoading={isActionLoading}
                onClick={confirmDecision}
              >
                Confirm {selectedDecision}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Send Offer Letter — requires an actual file upload, nothing is
          auto-generated. The uploaded file is attached to the email
          exactly as HR provided it. */}
      {isOfferLetterOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-slate-50">Send Offer Letter</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Upload the offer letter file and review the email before sending to <span className="font-semibold text-gray-900 dark:text-slate-100">{applicant.applicant_name}</span>.
            </p>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 mb-1.5">
                Offer Letter Attachment *
              </label>

              {applicant.resume_attachment && useExistingAttachment ? (
                <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/70 dark:bg-emerald-950/20 space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40 shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                          Using Attached Document
                        </span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate block">
                          {applicant.resume_attachment.split('/').pop()}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUseExistingAttachment(false)}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 shrink-0 transition-colors cursor-pointer"
                    >
                      Upload different file
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ This attached file will be emailed to {applicant.applicant_name} as the offer letter.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      ref={offerFileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setOfferLetterFile(e.target.files?.[0] || null)}
                      className="w-full text-sm text-gray-700 dark:text-slate-200 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-gray-100 dark:file:bg-slate-700 file:text-gray-700 dark:file:text-slate-200 hover:file:bg-gray-200 cursor-pointer"
                    />
                    {offerLetterFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setOfferLetterFile(null);
                          if (offerFileInputRef.current) offerFileInputRef.current.value = '';
                        }}
                        className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-2 rounded-lg bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 dark:bg-slate-700 dark:hover:bg-red-950/40 dark:text-slate-300 dark:hover:text-red-400 transition-colors border border-gray-200 dark:border-slate-600 cursor-pointer"
                        title="Clear selected file"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>
                  {offerLetterFile && (
                    <div className="text-xs text-gray-700 dark:text-slate-300 break-all bg-gray-50 dark:bg-slate-900 p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-brand-red shrink-0" />
                        <div className="min-w-0">
                          <span className="font-semibold block text-gray-500 dark:text-slate-400">Selected File:</span>
                          <span className="truncate block font-medium text-gray-900 dark:text-slate-100">{offerLetterFile.name}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setOfferLetterFile(null);
                          if (offerFileInputRef.current) offerFileInputRef.current.value = '';
                        }}
                        className="text-gray-400 hover:text-red-600 shrink-0 p-1 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Remove file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {applicant.resume_attachment && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUseExistingAttachment(true);
                          setOfferLetterFile(null);
                          if (offerFileInputRef.current) offerFileInputRef.current.value = '';
                        }}
                        className="text-xs font-semibold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        ← Use candidate's attached document ({applicant.resume_attachment.split('/').pop()})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Email Preview & Customization */}
            <div className="space-y-3 border border-gray-200 dark:border-slate-700 rounded-xl p-4 bg-gray-50 dark:bg-slate-900/50">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 block">
                Email Preview &amp; Customization
              </span>
              <div>
                <label className="block text-label font-bold text-gray-700 dark:text-slate-200 mb-1">To</label>
                <input
                  type="text"
                  disabled
                  value={applicant.email_id || 'No email on file'}
                  className="w-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-600 dark:text-slate-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-label font-bold text-gray-700 dark:text-slate-200 mb-1">Subject</label>
                <input
                  type="text"
                  value={offerEmail.subject}
                  onChange={(e) => setOfferEmail({ ...offerEmail, subject: e.target.value })}
                  className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-slate-50 focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-label font-bold text-gray-700 dark:text-slate-200 mb-1">Message</label>
                <textarea
                  rows={8}
                  value={offerEmail.body}
                  onChange={(e) => setOfferEmail({ ...offerEmail, body: e.target.value })}
                  className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm text-gray-900 dark:text-slate-50 focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsOfferLetterOpen(false);
                  setOfferLetterFile(null);
                  if (offerFileInputRef.current) offerFileInputRef.current.value = '';
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                icon={Send}
                isLoading={isSendingOffer}
                disabled={(!offerLetterFile && !(useExistingAttachment && applicant.resume_attachment)) || !offerEmail.subject.trim() || !offerEmail.body.trim()}
                onClick={handleSendOfferLetter}
              >
                Send Offer Letter
              </Button>
            </div>
          </div>
        </div>
      )}
    </SlideOver>
  );
}

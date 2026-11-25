import React, { useState } from 'react';
import { 
  Search, Filter, Plus, Calendar, Clock, CheckCircle2, 
  XCircle, FileText, Send, UserCheck, Eye, Star, ChevronRight, UserPlus
} from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { formatDateTime, formatDate } from '../../api/client';

// "[user] Rating: 4/5 | Rec: Pass | Notes: ..." -> "4/5 · Pass"
export function formatRatingSummary(summary) {
  if (!summary) return '';
  const rating = summary.match(/Rating:\s*([\d.]+\/5)/i)?.[1];
  const rec = summary.match(/Rec:\s*([^|]+)/i)?.[1]?.trim();
  if (!rating && !rec) return summary;
  return [rating && `${rating} stars`, rec].filter(Boolean).join(' · ');
}

export function KanbanBoard({
  pipelineData,
  isLoading,
  onRefresh,
  onOpenApplicant,
  onScheduleInterview,
  onShortlist,
  onQuickAdd,
  jobOpenings = [],
  selectedJob,
  setSelectedJob,
  searchQuery,
  setSearchQuery,
  onOpenOffers
}) {
  const [activeTabStage, setActiveTabStage] = useState('active'); // 'active' | 'completed'

  // Active pipeline: one column per decision or business event. Stages are derived on the
  // server from the real records (interviews, offers, email queue, employees).
  const stagesConfig = [
    { id: 'applied', label: 'Applied', border: 'border-brand-red/40', bg: 'bg-red-500/10' },
    { id: 'shortlisted', label: 'Shortlisted', border: 'border-cyan-500/40', bg: 'bg-cyan-500/10' },
    { id: 'interview_scheduled', label: 'Interview Scheduled', border: 'border-purple-500/40', bg: 'bg-purple-500/10' },
    { id: 'interview_completed', label: 'Interview Completed', border: 'border-indigo-500/40', bg: 'bg-indigo-500/10' },
    { id: 'selected', label: 'Selected', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10' },
    { id: 'offer_sent', label: 'Offer Sent', border: 'border-teal-500/40', bg: 'bg-teal-500/10' },
  ];

  const decisionStages = [
    { id: 'hired', label: 'Hired', border: 'border-emerald-600/40', bg: 'bg-emerald-600/10' },
    { id: 'bench', label: 'Talent Pool / Bench', border: 'border-amber-500/40', bg: 'bg-amber-500/10' },
    { id: 'rejected', label: 'Rejected', border: 'border-rose-500/40', bg: 'bg-rose-500/10' },
  ];

  const toneClass = {
    neutral: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-700/60 dark:text-slate-200 dark:border-slate-600',
    info: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-700/60 dark:text-slate-200 dark:border-slate-600',
    warn: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/30',
    bad: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-500/30',
    good: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-700/60 dark:text-slate-200 dark:border-slate-600',
  };

  const allColumns = activeTabStage === 'active' ? stagesConfig : decisionStages;
  const [stageFilter, setStageFilter] = React.useState(null);
  const currentColumns = stageFilter && allColumns.some((c) => c.id === stageFilter) ? allColumns.filter((c) => c.id === stageFilter) : allColumns;
  const stagesData = pipelineData?.board || {};
  const counts = pipelineData?.counts || {};
  const totalCount = allColumns.reduce((sum, col) => sum + (counts[col.id] ?? (stagesData[col.id] || []).length), 0);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-brand-black dark:text-slate-50 tracking-tight">Candidate Pipeline</h2>
          <p className="text-sm text-brand-grey">Streamlined 1-click candidate review, slot booking, and hiring decisions.</p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Stage Filter Switcher */}
          <div className="flex bg-gray-100 dark:bg-slate-800/50 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setActiveTabStage('active')}
              className={`px-3.5 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTabStage === 'active' 
                  ? 'bg-white dark:bg-slate-700 text-brand-black dark:text-slate-50 shadow-sm' 
                  : 'text-brand-grey hover:text-brand-black dark:text-slate-50'
              }`}
            >
              Active Pipeline
            </button>
            <button
              onClick={() => setActiveTabStage('completed')}
              className={`px-3.5 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTabStage === 'completed' 
                  ? 'bg-white dark:bg-slate-700 text-brand-black dark:text-slate-50 shadow-sm' 
                  : 'text-brand-grey hover:text-brand-black dark:text-slate-50'
              }`}
            >
              Decided & Archive
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Job Filter */}
            <select
              aria-label="Filter by job opening"
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-brand-black dark:text-slate-50 focus:outline-none focus:border-accent shrink-0"
            >
              <option value="all">All Job Openings</option>
              {jobOpenings.map((job) => (
                <option key={job.name} value={job.job_title || job.name}>
                  {job.job_title || job.name}
                </option>
              ))}
            </select>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-grey" />
              <input
                type="text"
                placeholder="Search candidates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm font-semibold text-brand-black dark:text-slate-50 placeholder-slate-400 focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>
      </div>

      {pipelineData?.truncated && (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
          Showing the newest {pipelineData.limit} candidates only. Narrow the job opening or search to see the rest.
        </div>
      )}

      {/* Stage Filter Toolbar: clearly labeled interactive filter buttons */}
      <div className="p-2 sm:p-2.5 rounded-2xl bg-gray-50/90 dark:bg-slate-900/60 border border-gray-200/80 dark:border-slate-800 flex flex-wrap items-center gap-2 shadow-xs" role="toolbar" aria-label="Filter pipeline by stage">
        <div className="flex items-center gap-1.5 px-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 shrink-0">
          <Filter className="h-3.5 w-3.5 text-brand-red" />
          <span>Stage Filter:</span>
        </div>

        {/* All Stages chip */}
        <button
          type="button"
          aria-pressed={!stageFilter}
          onClick={() => setStageFilter(null)}
          title="Show all stage columns"
          className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition-all shadow-xs cursor-pointer ${
            !stageFilter
              ? 'bg-brand-red text-white shadow-sm ring-2 ring-brand-red/20'
              : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          <span>All Stages</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${!stageFilter ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'}`}>
            {totalCount}
          </span>
        </button>

        {/* Individual stage filter chips */}
        {allColumns.map((col) => {
          const on = stageFilter === col.id;
          const count = counts[col.id] ?? (stagesData[col.id] || []).length;
          return (
            <button
              key={col.id}
              type="button"
              aria-pressed={on}
              onClick={() => setStageFilter(on ? null : col.id)}
              title={on ? `Currently filtering by ${col.label} (click to show all)` : `Filter to ${col.label} only`}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                on
                  ? 'border border-brand-red bg-brand-red/10 text-brand-red dark:bg-red-950/40 dark:border-red-500 dark:text-red-300 shadow-sm ring-2 ring-brand-red/20 font-bold'
                  : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:border-brand-red/40 hover:bg-red-50/40 dark:hover:bg-slate-700'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${col.bg} border ${col.border}`} />
              <span>{col.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                on ? 'bg-brand-red text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
              }`}>
                {count}
              </span>
              {on && <XCircle className="h-3.5 w-3.5 ml-0.5 text-brand-red hover:text-red-700" />}
            </button>
          );
        })}
      </div>

      <div role="region" aria-label="Candidate pipeline columns" tabIndex={0} className="flex flex-nowrap items-start gap-3 overflow-x-auto pb-4 snap-x hide-scrollbar focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        {currentColumns.map((col) => {
          const items = stagesData[col.id] || [];

          return (
            <div
              key={col.id}
              className={`flex flex-col min-w-[240px] w-[82%] shrink-0 sm:w-auto sm:min-w-[216px] sm:flex-1 sm:basis-[216px] sm:shrink ${currentColumns.length === 1 ? 'sm:max-w-md' : ''} bg-white dark:bg-slate-800/60 rounded-2xl border border-gray-200 dark:border-slate-700/80 p-3 snap-start`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-2 py-2 mb-3 border-b border-gray-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${col.bg} border ${col.border}`} />
                  <h3 className="text-sm font-bold text-gray-800 dark:text-slate-100">{col.label}</h3>
                </div>
                <span className="text-sm font-bold text-brand-grey bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] px-1 pb-2 pt-1 -mx-1 custom-scrollbar pr-1.5">
                {items.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-gray-200 dark:border-slate-700 rounded-xl">
                    <p className="text-sm text-brand-grey">No applicants</p>
                  </div>
                ) : (
                  items.map((applicant) => (
                    <div
                      key={applicant.name}
                      onClick={() => onOpenApplicant(applicant)}
                      className="glass-card glass-card-hover rounded-xl p-3.5 space-y-3 cursor-pointer group border border-gray-100 hover:border-gray-200 dark:border-slate-700"
                    >
                      {/* Top Info */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-bold text-brand-black dark:text-slate-50 group-hover:text-accent transition-colors">
                            {applicant.applicant_name}
                          </h4>
                          {applicant.resume_attachment && (
                            <span className="p-1 rounded-md bg-gray-100 dark:bg-slate-800 text-brand-red" title="Has Resume">
                              <FileText className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-brand-grey truncate mt-0.5">
                          {applicant.job_opening_title || applicant.job_title || 'General Applicant'}
                        </p>
                      </div>

                      {/* Status Details */}
                      {applicant.interview_rating_summary && (
                        <div className="bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md text-caption text-emerald-700 font-medium flex items-center gap-1.5">
                          <Star className="h-3 w-3 text-amber-500 shrink-0 fill-amber-500" />
                          <span>{formatRatingSummary(applicant.interview_rating_summary)}</span>
                        </div>
                      )}

                      {col.id === 'rejected' && (
                        <div className="bg-rose-50 border border-rose-100 p-2 rounded-lg text-label text-rose-700 font-medium">
                          <span className="font-bold">Reason: </span>
                          <span className="line-clamp-3">{applicant.rejection_reason || 'Not recorded'}</span>
                        </div>
                      )}

                      {/* Stage badges (derived from real records) */}
                      {(applicant.pipeline_badges || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {applicant.pipeline_badges.map((b) => (
                            <span key={b.label} className={`inline-flex items-center rounded-md border px-2 py-0.5 text-caption font-semibold ${toneClass[b.tone] || toneClass.neutral}`}>
                              {b.label}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Who the offer went to */}
                      {applicant.offer && (col.id === 'offer_sent' || col.id === 'selected') && (
                        <div className="text-label text-brand-grey space-y-0.5">
                          {applicant.offer.sent_to ? (
                            <div>Offer sent to <span className="font-semibold text-gray-700 dark:text-slate-200 break-all">{applicant.offer.sent_to}</span></div>
                          ) : (
                            <div>Offer {applicant.offer.name}: not yet sent</div>
                          )}
                        </div>
                      )}

                      {/* Employee link on hired cards */}
                      {col.id === 'hired' && applicant.employee && (
                        <div className="text-label text-brand-grey">Employee <span className="font-semibold text-gray-700 dark:text-slate-200">{applicant.employee}</span></div>
                      )}

                      {/* Interview progress */}
                      {col.id === 'interview_completed' && applicant.interview_summary?.count > 0 && (
                        <div className="text-label text-brand-grey">
                          Feedback <span className="font-semibold text-gray-700 dark:text-slate-200">{applicant.interview_summary.feedback_have} of {applicant.interview_summary.feedback_need}</span>
                        </div>
                      )}
                      {col.id === 'interview_scheduled' && applicant.interview_summary?.next_time && (
                        <div className="text-label text-brand-grey flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <span>{formatDateTime(applicant.interview_summary.next_time)}</span>
                        </div>
                      )}

                      {applicant.booked_slot_time && col.id !== 'interview_scheduled' && (
                        <div className="bg-purple-50 border border-purple-100 p-2 rounded-lg text-label text-purple-700 font-medium flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 shrink-0 text-purple-600" />
                          <span className="truncate">{formatDateTime(applicant.booked_slot_time)}</span>
                        </div>
                      )}

                      {/* Quick 1-Click Action Bar */}
                      <div className="pt-2 border-t border-gray-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
                        <span className="text-caption text-brand-grey whitespace-nowrap">
                          {formatDate(applicant.creation)}
                        </span>

                        {col.id === 'applied' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onShortlist(applicant); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-label font-bold whitespace-nowrap bg-accent hover:bg-accent-hover text-white transition-colors"
                          >
                            <Send className="h-3 w-3" />
                            <span>Shortlist</span>
                          </button>
                        )}

                        {col.id === 'shortlisted' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onScheduleInterview(applicant); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-label font-bold whitespace-nowrap bg-accent hover:bg-accent-hover text-white transition-colors"
                          >
                            <Calendar className="h-3 w-3" />
                            <span>Schedule</span>
                          </button>
                        )}

                        {col.id === 'interview_completed' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onOpenApplicant(applicant); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-label font-bold whitespace-nowrap bg-accent hover:bg-accent-hover text-white transition-colors"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Review &amp; decide</span>
                          </button>
                        )}

                        {col.id === 'selected' && onOpenOffers && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onOpenOffers(applicant); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-label font-bold whitespace-nowrap bg-accent hover:bg-accent-hover text-white transition-colors"
                          >
                            <FileText className="h-3 w-3" />
                            <span>Open offer</span>
                          </button>
                        )}

                        {col.id === 'offer_sent' && onOpenOffers && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onOpenOffers(applicant); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-label font-bold whitespace-nowrap bg-accent hover:bg-accent-hover text-white transition-colors"
                          >
                            <UserCheck className="h-3 w-3" />
                            <span>{applicant.offer?.status === 'Accepted' ? 'Complete hiring' : 'View offer'}</span>
                          </button>
                        )}

                        {col.id === 'interview_scheduled' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onOpenApplicant(applicant); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-label font-bold whitespace-nowrap border border-accent/40 text-accent hover:bg-accent-soft dark:hover:bg-accent/15 transition-colors"
                          >
                            <Eye className="h-3 w-3" />
                            <span>View</span>
                          </button>
                        )}

                        {col.id === 'bench' && (
                          <span className="text-label font-bold text-amber-600 flex items-center gap-0.5">
                            Reconsider <ChevronRight className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Scroll indicator when column has multiple cards */}
              {items.length > 3 && (
                <div className="pt-2 pb-0.5 text-center border-t border-gray-100 dark:border-slate-700/60 mt-1 shrink-0">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                    ↕ Scroll to view all ({items.length})
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

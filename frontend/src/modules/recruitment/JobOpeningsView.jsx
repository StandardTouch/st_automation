import React, { useState } from 'react';
import { Search, Briefcase, Globe, Users, Plus, CheckCircle, Clock, Trash2, Pencil } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';

export function JobOpeningsView({ jobOpenings: allJobs = [], onTogglePublish, isLoading, onNewJobOpening, onDeleteJobOpening, onEditJobOpening }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const matches = {
    all: () => true,
    open: (j) => (j.status || 'Open') !== 'Closed',
    closed: (j) => j.status === 'Closed',
    published: (j) => Boolean(j.publish),
  };
  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Open' },
    { id: 'closed', label: 'Closed' },
    { id: 'published', label: 'On careers page' },
  ];
  const q = query.trim().toLowerCase();
  const jobOpenings = allJobs.filter((j) => matches[statusFilter](j) && (!q || `${j.job_title || ''} ${j.name || ''} ${j.designation || ''} ${j.department || ''}`.toLowerCase().includes(q)));
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-brand-black dark:text-slate-50 tracking-tight">Job Openings</h2>
          <p className="text-sm text-brand-grey">Manage open roles and career portal visibility.</p>
        </div>

        <Button variant="primary" icon={Plus} onClick={onNewJobOpening}>
          New Job Opening
        </Button>
      </div>


      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
        {filterOptions.map((o) => {
          const on = statusFilter === o.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              onClick={() => setStatusFilter(o.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-label font-semibold transition-colors ${on ? 'border-accent bg-accent-soft text-accent-hover dark:bg-accent/20 dark:text-red-100' : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:border-gray-400 dark:hover:border-slate-500'}`}
            >
              {o.label}
              <span className="font-bold">{allJobs.filter(matches[o.id]).length}</span>
            </button>
          );
        })}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          aria-label="Search job openings"
          placeholder="Search job openings..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-accent"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
        {jobOpenings.length === 0 ? (
          <div className="col-span-full py-12 text-center border border-dashed border-gray-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800/40">
            <Briefcase className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-brand-grey">{allJobs.length === 0 ? 'No job openings yet. Create one to start receiving applications.' : 'No job openings match this filter.'}</p>
          </div>
        ) : (
          jobOpenings.map((job) => (
            <div
              key={job.name}
              className="group bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-200 dark:border-slate-700 shadow-sm shadow-gray-200/50 space-y-4 hover:shadow-md hover:border-accent/40 transition-all flex flex-col justify-between cursor-pointer"
              onClick={() => onEditJobOpening && onEditJobOpening(job)}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-brand-black dark:text-slate-50 tracking-tight truncate flex-1 min-w-0" title={job.job_title || job.name}>
                    {job.job_title || job.name}
                  </h3>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                    {onEditJobOpening && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditJobOpening(job); }}
                        className="p-1.5 text-gray-400 hover:text-brand-red hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="Edit Job Opening"
                        aria-label={`Edit ${job.job_title || job.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteJobOpening(job.name); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                      title="Delete Job Opening"
                      aria-label={`Delete ${job.job_title || job.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={job.status === 'Closed' ? 'warning' : 'success'}>{job.status || 'Open'}</Badge>
                </div>
                <dl className="text-sm text-brand-grey grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
                  <dt>Department</dt><dd className="text-gray-800 dark:text-slate-100">{job.department || '—'}</dd>
                  <dt>Designation</dt><dd className="text-gray-800 dark:text-slate-100">{job.designation || '—'}</dd>
                  <dt>Vacancies</dt><dd className="text-gray-800 dark:text-slate-100">{job.vacancies > 0 ? job.vacancies : '—'}</dd>
                </dl>
              </div>

              {/* Stats & Actions */}
              <div className="pt-3 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-slate-300">
                  <Users className="h-4 w-4" />
                  <span>{job.applicant_count || 0} Candidates</span>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); onTogglePublish(job.name, !job.publish); }}
                  aria-pressed={!!job.publish}
                  title={job.publish ? 'Visible on the careers page. Click to hide.' : 'Not on the careers page. Click to publish.'}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
                    job.publish
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-gray-100 dark:bg-slate-800 text-brand-grey hover:bg-gray-200 hover:text-brand-black dark:text-slate-50'
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>{job.publish ? 'On careers page' : 'Not published'}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

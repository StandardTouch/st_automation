import React, { useState, useEffect } from 'react';
import { Briefcase } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';

export function QuickAddJobOpeningModal({ isOpen, onClose, onAdd, isSubmitting, departments = [], job = null }) {
  const isEdit = !!job;
  const EMPTY = { job_title: '', department: '', vacancies: 1, publish: false, status: 'Open' };
  const [formData, setFormData] = useState(EMPTY);
  const [error, setError] = useState('');

  // Reset on open; prefill when editing an existing opening.
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setFormData(job ? {
      job_title: job.job_title || '',
      department: job.department || '',
      vacancies: job.vacancies > 0 ? job.vacancies : 1,
      publish: !!job.publish,
      status: job.status || 'Open',
    } : EMPTY);
  }, [isOpen, job?.name]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.job_title.trim()) { setError('Job title is required.'); return; }
    const vac = Number(formData.vacancies);
    if (!Number.isInteger(vac) || vac < 1 || vac > 1000) { setError('Vacancies must be a whole number between 1 and 1000.'); return; }
    setError('');
    onAdd(formData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Job Opening' : 'New Job Opening'}
      subtitle={isEdit ? 'Update the role details, vacancies and visibility.' : "Post a role — a Designation is created automatically if it doesn't exist yet."}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 mb-1.5">Job Title *</label>
          <input
            type="text"
            required
            placeholder="e.g. Senior React Developer"
            value={formData.job_title}
            onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-brand-black dark:text-slate-50 focus:outline-none focus:border-brand-red"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 mb-1.5">Department</label>
            <input
              type="text"
              list="department-options"
              placeholder="e.g. Engineering"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-brand-black dark:text-slate-50 focus:outline-none focus:border-brand-red"
            />
            <datalist id="department-options">
              {departments.map((dept) => (
                <option key={dept} value={dept} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 mb-1.5">Vacancies</label>
            <input
              type="number"
              min="1"
              max="1000"
              step="1"
              value={formData.vacancies}
              onChange={(e) => setFormData({ ...formData, vacancies: e.target.value })}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-brand-black dark:text-slate-50 focus:outline-none focus:border-brand-red"
            />
          </div>
        </div>

        {isEdit && (
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 mb-1.5">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-brand-black dark:text-slate-50 focus:outline-none focus:border-brand-red"
            >
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        )}

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={formData.publish}
            onChange={(e) => setFormData({ ...formData, publish: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 text-brand-red focus:ring-brand-red"
          />
          <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">Publish on career portal right away</span>
        </label>

        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            icon={Briefcase}
            isLoading={isSubmitting}
          >
            {isEdit ? 'Save Changes' : 'Create Job Opening'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

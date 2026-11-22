import React, { useState, useEffect } from 'react';
import { UserPlus, Upload, CheckCircle2 } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';

export function QuickAddApplicantModal({ isOpen, onClose, onAdd, jobOpenings = [], isSubmitting }) {
  const EMPTY_FORM = {
    applicant_name: '',
    email_id: '',
    phone_number: '',
    job_title: '',
    notes: '',
    resume_attachment: '',
  };
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [fileError, setFileError] = useState('');
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateField = (name, value) => {
    const v = (value || '').trim();
    if (name === 'applicant_name') {
      if (!v) return 'Full name is required.';
      if (v.length > 140) return 'Name is too long (max 140 characters).';
    }
    if (name === 'email_id') {
      if (!v) return 'Email address is required.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address.';
    }
    if (name === 'phone_number' && v) {
      let digits = v.replace(/\D/g, '');
      if (digits.length === 12 && digits.startsWith('91') && v.startsWith('+')) digits = digits.slice(2);
      if (digits.length !== 10) return 'Phone number must be exactly 10 digits.';
    }
    if (name === 'job_title' && !v) return 'Select a target job opening.';
    return '';
  };

  const FIELDS = ['applicant_name', 'email_id', 'phone_number', 'job_title'];
  const setField = (name, value) => {
    setFormData((f) => ({ ...f, [name]: value }));
    if (touched[name]) setErrors((er) => ({ ...er, [name]: validateField(name, value) }));
  };
  const blurField = (name) => {
    setTouched((t) => ({ ...t, [name]: true }));
    setErrors((er) => ({ ...er, [name]: validateField(name, formData[name]) }));
  };
  const inputClass = (name) =>
    `w-full bg-gray-50 dark:bg-slate-900 border rounded-xl px-4 py-2.5 text-sm text-brand-black dark:text-slate-50 focus:outline-none ${
      errors[name] ? 'border-red-500 ring-1 ring-red-500 focus:border-red-500' : 'border-gray-200 dark:border-slate-700 focus:border-accent'
    }`;
  const FieldError = ({ name }) =>
    errors[name] ? <p className="mt-1 text-sm text-red-600 font-medium">{errors[name]}</p> : null;

  // Reset every time the modal opens: it used to keep the previous
  // candidate's phone number and job opening pre-filled.
  useEffect(() => {
    if (isOpen) {
      setFormData(EMPTY_FORM);
      setFileError('');
      setErrors({});
      setTouched({});
    }
  }, [isOpen]);

  // Hidden (unpublished) and closed openings must not be offered as targets.
  const selectableJobs = jobOpenings.filter((job) => job.publish && job.status !== 'Closed');

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = {};
    FIELDS.forEach((n) => { next[n] = validateField(n, formData[n]); });
    setErrors(next);
    setTouched({ applicant_name: true, email_id: true, phone_number: true, job_title: true });
    if (Object.values(next).some(Boolean)) return;
    onAdd({ ...formData, applicant_name: formData.applicant_name.trim(), email_id: formData.email_id.trim() });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Add Candidate"
      subtitle="Add a candidate directly into the recruitment pipeline in 1 click."
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 mb-1.5">Candidate Full Name *</label>
          <input
            type="text"
            placeholder="e.g. Sarah Jenkins"
            value={formData.applicant_name}
            onChange={(e) => setField('applicant_name', e.target.value)}
            onBlur={() => blurField('applicant_name')}
            aria-invalid={!!errors.applicant_name}
            className={inputClass('applicant_name')}
          />
          <FieldError name="applicant_name" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 mb-1.5">Email Address *</label>
            <input
              type="email"
              placeholder="sarah@example.com"
              value={formData.email_id}
              onChange={(e) => setField('email_id', e.target.value)}
              onBlur={() => blurField('email_id')}
              aria-invalid={!!errors.email_id}
              className={inputClass('email_id')}
            />
            <FieldError name="email_id" />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 mb-1.5">Phone Number</label>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="9876543210"
              value={formData.phone_number}
              onChange={(e) => setField('phone_number', e.target.value)}
              onBlur={() => blurField('phone_number')}
              aria-invalid={!!errors.phone_number}
              className={inputClass('phone_number')}
            />
            <FieldError name="phone_number" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 mb-1.5">Target Job Opening *</label>
          <select
            value={formData.job_title}
            onChange={(e) => setField('job_title', e.target.value)}
            onBlur={() => blurField('job_title')}
            aria-invalid={!!errors.job_title}
            className={inputClass('job_title')}
          >
            <option value="">{selectableJobs.length ? 'Select Job Opening' : 'No open job openings - create or publish one first'}</option>
            {selectableJobs.map(job => (
              <option key={job.name} value={job.name}>
                {job.job_title || job.name}
              </option>
            ))}
          </select>
          <FieldError name="job_title" />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 mb-1.5">Resume / CV</label>
          <div className="relative w-full border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl px-4 py-6 bg-gray-50 dark:bg-slate-900 text-center hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex flex-col items-center justify-center">
            <Upload className="h-6 w-6 text-brand-grey mb-2" />
            <span className="text-sm text-brand-grey font-medium">Click to upload or drag and drop</span>
            <span className="text-xs text-gray-400 mt-1">PDF, DOCX up to 5MB</span>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                const okExt = /\.(pdf|doc|docx)$/i.test(file.name);
                if (!okExt) {
                  setFileError('Only PDF, DOC or DOCX files are allowed.');
                  e.target.value = '';
                  return;
                }
                if (file.size > 5 * 1024 * 1024) {
                  setFileError('Resume must be 5MB or smaller.');
                  e.target.value = '';
                  return;
                }
                setFileError('');
                setFormData({ ...formData, resume_file: file });
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          {fileError && (
            <p className="mt-2 text-sm text-red-600 font-medium">{fileError}</p>
          )}
          {formData.resume_file && (
            <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {formData.resume_file.name}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 mb-1.5">Optional Notes / Internal Comments</label>
          <textarea
            placeholder="e.g. Referred by Tech Lead, 4 years React experience..."
            rows={2}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm text-brand-black dark:text-slate-50 focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            icon={UserPlus}
            isLoading={isSubmitting}
          >
            Add to Pipeline
          </Button>
        </div>
      </form>
    </Modal>
  );
}

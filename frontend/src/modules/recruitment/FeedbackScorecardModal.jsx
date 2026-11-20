import React, { useState } from 'react';
import { Star, CheckCircle, ThumbsUp, ThumbsDown, Clock, ShieldCheck } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { ratingConflict, conflictExplanationError } from '../../utils/feedbackRules';

export function FeedbackScorecardModal({ isOpen, onClose, interview, onSubmitFeedback, isSubmitting }) {
  const [rating, setRating] = useState(4);
  const [recommendation, setRecommendation] = useState('Pass');
  const [techRating, setTechRating] = useState(4);
  const [commRating, setCommRating] = useState(4);
  const [comments, setComments] = useState('');
  const [conflictExplanation, setConflictExplanation] = useState('');

  if (!interview) return null;

  // A conflicting rating/recommendation is allowed, but only with a written
  // explanation (also enforced by the backend for new submissions).
  const hasConflict = ratingConflict(rating, recommendation);
  const explanationError = conflictExplanationError(rating, recommendation, conflictExplanation);

  const handleSubmit = (e) => {
    e.preventDefault();
    const scorecard = {
      overall_rating: rating,
      tech_rating: techRating,
      comm_rating: commRating,
    };
    if (conflictExplanationError(rating, recommendation, conflictExplanation)) return;
    onSubmitFeedback(interview.interview_id, rating, recommendation, comments, scorecard, ratingConflict(rating, recommendation) ? conflictExplanation.trim() : undefined);
  };

  const recOptions = [
    { id: 'Strong Hire', label: 'Strong Hire', color: 'bg-emerald-600 border-emerald-500' },
    { id: 'Pass', label: 'Pass / Recommended', color: 'bg-brand-red border-brand-red' },
    { id: 'Hold', label: 'Hold / Need Another Round', color: 'bg-amber-600 border-amber-500' },
    { id: 'Fail', label: 'Do Not Recommend', color: 'bg-rose-600 border-rose-500' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Interview Scorecard — ${interview.applicant_name}`}
      subtitle={interview.job_title}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Overall Rating Stars */}
        <div>
          <label className="block text-sm font-bold uppercase tracking-wider text-brand-grey mb-2">
            Overall Rating (1 to 5 Stars) *
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
                className="p-1.5 transition-transform hover:scale-125 focus:outline-none"
              >
                <Star
                  className={`h-7 w-7 ${
                    star <= rating
                      ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                      : 'text-slate-700'
                  }`}
                />
              </button>
            ))}
            <span className="ml-3 text-sm font-heading font-bold text-amber-400">{rating} / 5 Stars</span>
          </div>
        </div>

        {/* Recommendation Radios */}
        <div>
          <label className="block text-sm font-bold uppercase tracking-wider text-brand-grey mb-2">
            Hiring Recommendation *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRecommendation(opt.id)}
                className={`p-3 rounded-xl border text-sm font-bold text-left transition-all flex items-center justify-between ${
                  recommendation === opt.id
                    ? `${opt.color} text-brand-black dark:text-slate-50 shadow-lg`
                    : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-brand-grey hover:text-brand-black dark:text-slate-50'
                }`}
              >
                <span>{opt.label}</span>
                {recommendation === opt.id && <CheckCircle className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-Criteria */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-gray-200 dark:border-slate-700">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 mb-1.5">Technical Competency</label>
            <select
              value={techRating}
              onChange={(e) => setTechRating(Number(e.target.value))}
              className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-brand-black dark:text-slate-50 focus:outline-none focus:border-brand-red"
            >
              <option value={5}>5 - Exceptional</option>
              <option value={4}>4 - Above Average</option>
              <option value={3}>3 - Meets Standard</option>
              <option value={2}>2 - Below Expectation</option>
              <option value={1}>1 - Inadequate</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-slate-200 mb-1.5">Communication & Team Fit</label>
            <select
              value={commRating}
              onChange={(e) => setCommRating(Number(e.target.value))}
              className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-brand-black dark:text-slate-50 focus:outline-none focus:border-brand-red"
            >
              <option value={5}>5 - Excellent</option>
              <option value={4}>4 - Good</option>
              <option value={3}>3 - Acceptable</option>
              <option value={2}>2 - Weak</option>
              <option value={1}>1 - Poor</option>
            </select>
          </div>
        </div>

        {/* Notes / Feedback */}
        <div>
          <label className="block text-sm font-bold uppercase tracking-wider text-brand-grey mb-1.5">
            Key Feedback & Evaluation Notes *
          </label>
          <textarea
            required
            placeholder="Candidate strengths, areas of concern, projects discussed..."
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-sm text-brand-black dark:text-slate-50 focus:outline-none focus:border-brand-red"
          />
        </div>

        {hasConflict && (
          <div role="alert" data-testid="rating-mismatch-warning" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-2">
            <p>Overall rating {rating}/5 does not match "{recommendation === 'Fail' ? 'Do Not Recommend' : recommendation}". Please explain the difference.</p>
            <label htmlFor="conflict-explanation" className="block font-semibold">Why do they differ? *</label>
            <textarea
              id="conflict-explanation"
              data-testid="conflict-explanation"
              rows={2}
              value={conflictExplanation}
              onChange={(e) => setConflictExplanation(e.target.value)}
              aria-invalid={!!explanationError}
              aria-describedby="conflict-explanation-error"
              className="w-full rounded-lg border border-amber-300 bg-white p-2 text-sm text-gray-900"
            />
            {explanationError && <p id="conflict-explanation-error" className="text-xs text-rose-700">{explanationError}</p>}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="success"
            type="submit"
            icon={ShieldCheck}
            isLoading={isSubmitting}
            disabled={!!explanationError}
          >
            Submit Scorecard
          </Button>
        </div>
      </form>
    </Modal>
  );
}

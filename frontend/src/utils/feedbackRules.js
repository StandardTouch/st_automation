// Keep in sync with st_automation/api/recruitment.py (_rating_recommendation_conflict).
export const MIN_CONFLICT_EXPLANATION = 15;
const POSITIVE = ['Strong Hire', 'Strongly Recommend'];
const NEGATIVE = ['Fail', 'Do Not Recommend'];

export function ratingConflict(rating, recommendation) {
  const r = Number(rating);
  return (POSITIVE.includes(recommendation) && r > 0 && r <= 2) ||
    (NEGATIVE.includes(recommendation) && r >= 4);
}

export function conflictExplanationError(rating, recommendation, explanation) {
  if (!ratingConflict(rating, recommendation)) return '';
  return (explanation || '').trim().length >= MIN_CONFLICT_EXPLANATION
    ? ''
    : `Explain why the rating (${rating}/5) and recommendation differ (at least ${MIN_CONFLICT_EXPLANATION} characters).`;
}

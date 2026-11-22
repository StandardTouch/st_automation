import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithToast, axeViolations } from './helpers.jsx';

vi.mock('../../src/api/client', async (orig) => ({ ...(await orig()), callApi: vi.fn() }));
import { callApi } from '../../src/api/client';
import { BulkAssignStructureModal } from '../../src/modules/payroll/BulkAssignStructureModal';
import { FeedbackScorecardModal } from '../../src/modules/recruitment/FeedbackScorecardModal';
import { ratingConflict, conflictExplanationError } from '../../src/utils/feedbackRules';

beforeEach(() => { callApi.mockReset(); });

describe('Bulk salary structure assignment', () => {
  const people = [{ name: 'E1', employee_name: 'Asha', designation: 'Dev' }, { name: 'E2', employee_name: 'Ben' }];
  const setup = ({ structures = [{ name: 'Basic' }], dryRun } = {}) => {
    callApi.mockImplementation((method, params) => {
      if (method.includes('get_unassigned_employees')) return Promise.resolve({ data: people });
      if (method.includes('get_salary_structures')) return Promise.resolve({ data: structures });
      if (method.includes('bulk_assign_salary_structure')) {
        if (Number(params.dry_run)) return Promise.resolve({ data: dryRun || { dry_run: true, valid: true, problems: [], preview: JSON.parse(params.assignments) } });
        return Promise.resolve({ message: 'Created 1', data: { count: 1 } });
      }
      return Promise.resolve({ data: [] });
    });
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    renderWithToast(<BulkAssignStructureModal isOpen onClose={onClose} company="Acme" onSuccess={onSuccess} />);
    return { onSuccess, onClose };
  };

  it('requires selection, structure and base salary before previewing', async () => {
    const user = userEvent.setup();
    setup();
    const preview = await screen.findByRole('button', { name: /preview changes/i });
    expect(preview).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'Select Asha' }));
    expect(preview).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Salary structure'), 'Basic');
    expect(preview).toBeDisabled(); // base missing
    expect(screen.getByTestId('bulk-local-problems')).toHaveTextContent(/base salary/i);
    await user.type(screen.getByLabelText('Base salary for Asha'), '30000');
    expect(preview).toBeEnabled();
  });

  it('previews with a dry run and writes only after explicit confirmation', async () => {
    const user = userEvent.setup();
    const { onSuccess } = setup();
    await screen.findByRole('button', { name: /preview changes/i });
    await user.click(screen.getByRole('checkbox', { name: 'Select Asha' }));
    await user.selectOptions(screen.getByLabelText('Salary structure'), 'Basic');
    await user.type(screen.getByLabelText('Base salary for Asha'), '30000');
    await user.click(screen.getByRole('button', { name: /preview changes/i }));

    const step2 = await screen.findByTestId('bulk-step-2');
    expect(within(step2).getByText(/no assignments have been created yet/i)).toBeInTheDocument();
    const writes = () => callApi.mock.calls.filter(([m, p]) => m.includes('bulk_assign') && !Number(p.dry_run));
    expect(writes()).toHaveLength(0); // preview never writes

    const create = screen.getByRole('button', { name: /create assignments/i });
    expect(create).toBeDisabled();
    await user.click(screen.getByTestId('bulk-confirm'));
    await user.click(create);
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(writes()).toHaveLength(1);
    expect(writes()[0][1]).toMatchObject({ dry_run: 0, confirmed: 1, company: 'Acme' });
  });

  it('shows server validation problems and offers no create button', async () => {
    const user = userEvent.setup();
    setup({ dryRun: { dry_run: true, valid: false, problems: [{ index: 0, employee: 'E1', errors: ['Employee already has a salary structure assignment.'] }], preview: [{ employee: 'E1', salary_structure: 'Basic', base: 30000, from_date: '2026-11-01' }] } });
    await screen.findByRole('button', { name: /preview changes/i });
    await user.click(screen.getByRole('checkbox', { name: 'Select Asha' }));
    await user.selectOptions(screen.getByLabelText('Salary structure'), 'Basic');
    await user.type(screen.getByLabelText('Base salary for Asha'), '30000');
    await user.click(screen.getByRole('button', { name: /preview changes/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already has a salary structure/i);
    expect(screen.queryByTestId('bulk-confirm')).toBeNull();
    expect(screen.getByRole('button', { name: /create assignments/i })).toBeDisabled();
  });

  it('points to structure creation when none exist', async () => {
    setup({ structures: [] });
    expect(await screen.findByRole('alert')).toHaveTextContent(/create one first/i);
  });

  it('step 1 has no axe violations (excluding colour contrast)', async () => {
    setup();
    await screen.findByRole('button', { name: /preview changes/i });
    expect(await axeViolations(document.body)).toEqual([]);
  });
});

describe('Feedback rating vs recommendation', () => {
  it('rule helper matches the backend rule', () => {
    expect(ratingConflict(1, 'Strong Hire')).toBe(true);
    expect(ratingConflict(2, 'Strongly Recommend')).toBe(true);
    expect(ratingConflict(3, 'Strong Hire')).toBe(false);
    expect(ratingConflict(4, 'Fail')).toBe(true);
    expect(ratingConflict(5, 'Do Not Recommend')).toBe(true);
    expect(ratingConflict(3, 'Fail')).toBe(false);
    expect(ratingConflict(1, 'Fail')).toBe(false);
    expect(conflictExplanationError(1, 'Strong Hire', 'short')).not.toBe('');
    expect(conflictExplanationError(1, 'Strong Hire', 'Interviewer mis-clicked the stars')).toBe('');
  });

  const interview = { interview_id: 'INT-1', applicant_name: 'Alice', job_title: 'QA' };
  it('requires an explanation for a conflict and passes it on submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderWithToast(<FeedbackScorecardModal isOpen onClose={() => {}} interview={interview} onSubmitFeedback={onSubmit} isSubmitting={false} />);
    await user.click(screen.getByRole('button', { name: '1 star' }));
    await user.click(screen.getByRole('button', { name: /strong hire/i }));
    const submit = screen.getByRole('button', { name: /submit scorecard/i });
    expect(screen.getByTestId('rating-mismatch-warning')).toBeInTheDocument();
    expect(submit).toBeDisabled();
    await user.type(screen.getByPlaceholderText(/candidate strengths/i), 'Solid answers overall');
    await user.type(screen.getByTestId('conflict-explanation'), 'Stars were clicked by mistake');
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][1]).toBe(1);
    expect(onSubmit.mock.calls[0][2]).toBe('Strong Hire');
    expect(onSubmit.mock.calls[0][5]).toBe('Stars were clicked by mistake');
  });

  it('does not ask for an explanation when rating and recommendation agree', async () => {
    const user = userEvent.setup();
    renderWithToast(<FeedbackScorecardModal isOpen onClose={() => {}} interview={interview} onSubmitFeedback={vi.fn()} isSubmitting={false} />);
    // Nothing is pre-selected: submit stays off until the reviewer chooses both.
    expect(screen.getByRole('button', { name: /submit scorecard/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '4 stars' }));
    await user.click(screen.getByText('Pass / Recommended'));
    expect(screen.queryByTestId('rating-mismatch-warning')).toBeNull();
    expect(screen.getByRole('button', { name: /submit scorecard/i })).toBeEnabled();
  });
});

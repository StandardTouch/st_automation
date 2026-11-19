import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithToast, axeViolations } from './helpers.jsx';

vi.mock('../../src/api/client', async (orig) => ({ ...(await orig()), callApi: vi.fn() }));
import { callApi } from '../../src/api/client';
import { RunPayrollWizard } from '../../src/modules/payroll/RunPayrollWizard';
import { PayrollDashboard } from '../../src/modules/payroll/PayrollDashboard';
import { AssignSalaryStructureModal } from '../../src/modules/payroll/AssignSalaryStructureModal';

const emp = (n) => ({ name: `E${n}`, employee_name: `Person ${n}` });
const eligibility = (eligible, excluded, snapshot = 'S1', not_applicable = []) => ({ data: { eligible, excluded, snapshot, not_applicable } });

beforeEach(() => { callApi.mockReset(); });

const mountWizard = (onExecutePayroll = vi.fn().mockResolvedValue({ successful: [], failed: [] })) => {
  renderWithToast(<RunPayrollWizard company="Acme" month={11} year={2026} onExecutePayroll={onExecutePayroll} onViewSalarySlips={() => {}} onRefresh={() => {}} />);
  return onExecutePayroll;
};

describe('Run payroll rules (UI)', () => {
  it('blocks the run when nobody has a salary structure', async () => {
    callApi.mockResolvedValue(eligibility([], [emp(1), emp(2)]));
    mountWizard();
    expect(await screen.findByTestId('run-payroll-readiness-warning')).toHaveTextContent(/can't run yet/i);
    expect(screen.getByRole('button', { name: /start payroll processing/i })).toBeDisabled();
    expect(screen.queryByTestId('confirm-period')).toBeNull();
  });

  it('lists included and excluded employees and requires period + exclusion acknowledgement', async () => {
    const user = userEvent.setup();
    callApi.mockResolvedValue(eligibility([emp(1), emp(2)], [emp(3)]));
    const run = mountWizard();
    const start = await screen.findByRole('button', { name: /start payroll processing/i });
    expect(screen.getByText(/Included: 2 employees/)).toBeInTheDocument();
    expect(screen.getByText(/Person 3 \(E3\)/)).toBeInTheDocument();
    expect(start).toBeDisabled();

    await user.click(screen.getByTestId('confirm-period'));
    expect(start).toBeDisabled(); // exclusions still not acknowledged
    await user.click(screen.getByTestId('ack-excluded'));
    expect(start).toBeEnabled();

    await user.click(start);
    expect(run).toHaveBeenCalledWith('Acme', '2026-11-01', '2026-11-30', { eligibilitySnapshot: 'S1', acknowledgedExcluded: ['E3'] });
  });

  it('re-checks right before running and drops the confirmation when eligibility changed', async () => {
    const user = userEvent.setup();
    callApi.mockResolvedValueOnce(eligibility([emp(1)], [emp(2)], 'S1'));
    const run = mountWizard();
    const start = await screen.findByRole('button', { name: /start payroll processing/i });
    await user.click(screen.getByTestId('confirm-period'));
    await user.click(screen.getByTestId('ack-excluded'));
    expect(start).toBeEnabled();

    // someone got a structure in the meantime -> new snapshot, different lists
    callApi.mockResolvedValueOnce(eligibility([emp(1), emp(2)], [emp(3)], 'S2'));
    await user.click(start);
    expect(await screen.findByTestId('eligibility-changed')).toHaveTextContent(/changed/i);
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByTestId('ack-excluded')).not.toBeChecked();
    expect(screen.getByTestId('confirm-period')).not.toBeChecked();
    expect(screen.getByRole('button', { name: /start payroll processing/i })).toBeDisabled();
    expect(screen.getByText(/Person 3 \(E3\)/)).toBeInTheDocument();
  });

  it('lists employees who are not payable this period', async () => {
    callApi.mockResolvedValue(eligibility([emp(1)], [], 'S1', [{ name: 'E9', employee_name: 'Zed', reason: 'Relieved before the payroll period' }]));
    mountWizard();
    expect(await screen.findByTestId('not-applicable')).toHaveTextContent(/Zed \(Relieved before the payroll period\)/);
  });

  it('needs only the period confirmation when nobody is excluded', async () => {
    const user = userEvent.setup();
    callApi.mockResolvedValue(eligibility([emp(1)], []));
    mountWizard();
    const start = await screen.findByRole('button', { name: /start payroll processing/i });
    expect(screen.queryByTestId('ack-excluded')).toBeNull();
    await user.click(screen.getByTestId('confirm-period'));
    expect(start).toBeEnabled();
  });

  it('shows an error and keeps the run disabled when eligibility cannot be loaded', async () => {
    callApi.mockRejectedValue(new Error('boom'));
    mountWizard();
    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
    expect(screen.getByRole('button', { name: /start payroll processing/i })).toBeDisabled();
  });

  it('wizard has no axe violations (excluding colour contrast)', async () => {
    callApi.mockResolvedValue(eligibility([emp(1)], [emp(2)]));
    const { container } = (() => { mountWizard(); return { container: document.body }; })();
    await screen.findByTestId('confirm-period');
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe('Payroll dashboard banner', () => {
  const base = { active_employees: 10, assigned_structure_count: 10, missing_structure_count: 0, readiness_score: 100, is_fully_processed: false };
  const show = (summary) => renderWithToast(<PayrollDashboard summary={summary} month={11} year={2026} setMonth={() => {}} setYear={() => {}} onRunPayroll={() => {}} onAssignStructures={() => {}} onViewReadiness={() => {}} />);

  it('says Ready only when everyone has a structure', () => {
    show(base);
    expect(screen.getByTestId('payroll-readiness-pill')).toHaveTextContent('Ready for November 2026');
    expect(screen.getByRole('button', { name: /run payroll now/i })).toBeEnabled();
  });
  it('is blocked with 0 assigned', () => {
    show({ ...base, assigned_structure_count: 0, missing_structure_count: 10, readiness_score: 0 });
    expect(screen.getByTestId('payroll-readiness-pill')).toHaveTextContent('Action needed');
    expect(screen.queryByRole('button', { name: /run payroll now/i })).toBeNull();
    expect(screen.getByRole('button', { name: /set up salary structures/i })).toBeInTheDocument();
  });
  it('is partial with some assigned', () => {
    show({ ...base, assigned_structure_count: 6, missing_structure_count: 4, readiness_score: 60 });
    expect(screen.getByTestId('payroll-readiness-pill')).toHaveTextContent(/partly ready/i);
    expect(screen.getByRole('button', { name: /review & run payroll/i })).toBeInTheDocument();
  });
});

describe('Assign structure modal', () => {
  it('explains the dead end and disables Assign when no structures exist', async () => {
    callApi.mockImplementation((method) => Promise.resolve({ data: method.includes('get_salary_structures') ? [] : [emp(1)] }));
    const onCreate = vi.fn();
    const user = userEvent.setup();
    renderWithToast(<AssignSalaryStructureModal isOpen onClose={() => {}} company="Acme" onCreateStructure={onCreate} />);
    expect(await screen.findByTestId('assign-no-structures')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /assign structure/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /create a salary structure/i }));
    expect(onCreate).toHaveBeenCalled();
  });
});

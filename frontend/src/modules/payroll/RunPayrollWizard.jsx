import React, { useState, useEffect } from 'react';
import { 
  PlayCircle, CheckCircle2, AlertCircle, Users, DollarSign, 
  FileText, ArrowRight, ShieldCheck, RefreshCw, Check
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { AssignSalaryStructureModal } from './AssignSalaryStructureModal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { formatCurrency, formatDate, callApi } from '../../api/client';
import { useToast } from '../../components/common/Toast';
import { payrollApi } from '../../api/payrollApi';

export function RunPayrollWizard({
  company,
  month,
  year,
  onExecutePayroll,
  onViewSalarySlips,
  onRefresh,
  summary = null,
  onOpenSalaryStructures,
  setMonth,
  setYear
}) {
  const { addToast } = useToast();
  // Eligibility comes from the backend (employees with a submitted salary
  // structure). The backend re-checks every rule when the run is requested.
  const [eligibility, setEligibility] = useState({ loading: true, error: '', eligible: [], excluded: [], notApplicable: [], snapshot: '' });
  const [changedNotice, setChangedNotice] = useState('');
  const [ackPartial, setAckPartial] = useState(false);
  const [periodConfirmed, setPeriodConfirmed] = useState(false);
  const [showIncluded, setShowIncluded] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [step, setStep] = useState(1); // 1: Ready to run, 2: Running, 3: Completed Report
  const [result, setResult] = useState(null);
  const [activeReportTab, setActiveReportTab] = useState('success');
  const [isAssignStructureOpen, setIsAssignStructureOpen] = useState(false);
  const [isSubmittingOfficial, setIsSubmittingOfficial] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

  useEffect(() => {
    if (!company) return undefined; // wait for the company so the first request is scoped
    let cancelled = false;
    setEligibility({ loading: true, error: '', eligible: [], excluded: [], notApplicable: [], snapshot: '' });
    setChangedNotice('');
    setAckPartial(false);
    setPeriodConfirmed(false);
    payrollApi.getPayrollEligibility(company, startDate, endDate)
      .then((res) => {
        if (!cancelled) setEligibility({ loading: false, error: '', eligible: res.data?.eligible || [], excluded: res.data?.excluded || [], notApplicable: res.data?.not_applicable || [], snapshot: res.data?.snapshot || '' });
      })
      .catch((err) => {
        if (!cancelled) setEligibility({ loading: false, error: err.message || 'Could not load payroll eligibility', eligible: [], excluded: [], notApplicable: [], snapshot: '' });
      });
    return () => { cancelled = true; };
  }, [company, startDate, endDate]);

  const noneAssigned = !eligibility.loading && !eligibility.error && eligibility.eligible.length === 0;
  const partial = !eligibility.loading && eligibility.eligible.length > 0 && eligibility.excluded.length > 0;
  const canStart = !eligibility.loading && !eligibility.error && eligibility.eligible.length > 0 &&
    periodConfirmed && (eligibility.excluded.length === 0 || ackPartial);

  const monthNames = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleStartPayroll = async () => {
    // Re-check just before running: if anyone's eligibility changed since the
    // lists were shown, the earlier confirmation and acknowledgement no longer
    // apply (the backend rejects a stale snapshot too).
    try {
      const fresh = await payrollApi.getPayrollEligibility(company, startDate, endDate);
      if ((fresh.data?.snapshot || '') !== eligibility.snapshot) {
        setEligibility({ loading: false, error: '', eligible: fresh.data?.eligible || [], excluded: fresh.data?.excluded || [], notApplicable: fresh.data?.not_applicable || [], snapshot: fresh.data?.snapshot || '' });
        setAckPartial(false);
        setPeriodConfirmed(false);
        setChangedNotice('Employee eligibility changed since you opened this page. Review the updated lists and confirm again.');
        return;
      }
    } catch (err) {
      setChangedNotice(err.message || 'Could not re-check eligibility. Nothing was run.');
      return;
    }
    setChangedNotice('');
    setIsExecuting(true);
    setStep(2);
    try {
      const response = await onExecutePayroll(company, startDate, endDate, {
        eligibilitySnapshot: eligibility.snapshot,
        acknowledgedExcluded: eligibility.excluded.map((e) => e.name),
      });
      setResult(response);
      setStep(3);
      setIsSubmitted(false);
    } catch (err) {
      setStep(1);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSubmitOfficial = async () => {
    if (!result?.payroll_entry) return;
    setIsSubmittingOfficial(true);
    try {
      const res = await callApi('st_automation.api.payroll.submit_payroll', {
        payroll_entry_id: result.payroll_entry
      });
      addToast(res.message || 'Payroll submitted officially!', 'success');
      setIsSubmitted(true);
    } catch (err) {
      addToast(err.message || 'Failed to submit payroll', 'error');
    } finally {
      setIsSubmittingOfficial(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading font-bold text-brand-black dark:text-slate-50 tracking-tight">Run Monthly Payroll</h2>
          <p className="text-sm text-brand-grey">
            Execute automated salary slip generation, loan installment deductions, and bonus disbursements.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setIsAssignStructureOpen(true)}
        >
          Assign Structure
        </Button>
      </div>

      {/* Step 1: Pre-run Verification */}
      {step === 1 && (
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border space-y-6 max-w-3xl mx-auto">
          <div className="flex items-center gap-3 border-b border-gray-200 dark:border-slate-700 pb-4">
            <div className="p-3 rounded-2xl bg-indigo-50 text-brand-red border border-indigo-200">
              <PlayCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-brand-black dark:text-slate-50 flex flex-wrap items-center gap-2">
                <span>Period:</span>
                {setMonth && setYear ? (
                  <>
                    <select aria-label="Payroll month" value={month} onChange={(e) => setMonth(Number(e.target.value))} className="bg-transparent border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-0.5 text-base font-bold">
                      {monthNames.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                    <select aria-label="Payroll year" value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-transparent border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-0.5 text-base font-bold">
                      {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </>
                ) : <span>{monthNames[month]} {year}</span>}
              </h3>
              <p className="text-sm text-brand-grey">
                Company: <span className="text-gray-800 dark:text-slate-100 font-semibold">{company || 'Default'}</span> | Dates: <span className="text-gray-800 dark:text-slate-100 font-semibold">{startDate} to {endDate}</span>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-brand-grey">
              What will happen in 1 click:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 flex items-start gap-2.5">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-gray-700 dark:text-slate-200">Fetches all active employees in {company || 'company'}</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 flex items-start gap-2.5">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-gray-700 dark:text-slate-200">Auto-links active loan repayment installments</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 flex items-start gap-2.5">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-gray-700 dark:text-slate-200">Adds pending performance incentives & bonuses</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 flex items-start gap-2.5">
                <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-gray-700 dark:text-slate-200">Generates and submits official Salary Slips</span>
              </div>
            </div>
          </div>

          <div data-testid="run-payroll-eligibility" className="space-y-3 text-sm">
            <h4 className="text-sm font-bold uppercase tracking-wider text-brand-grey">Who is included</h4>
            {eligibility.loading && <p className="text-brand-grey">Checking salary structures…</p>}
            {changedNotice && (
              <p role="alert" data-testid="eligibility-changed" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900">{changedNotice}</p>
            )}
            {eligibility.error && (
              <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-800">{eligibility.error}</p>
            )}
            {!eligibility.loading && !eligibility.error && (
              <>
                {eligibility.eligible.length > 0 && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-emerald-900">
                  <button type="button" onClick={() => setShowIncluded((v) => !v)} aria-expanded={showIncluded} className="font-bold underline-offset-2 hover:underline py-2 -my-2">
                    Included: {eligibility.eligible.length} employee{eligibility.eligible.length === 1 ? '' : 's'}
                  </button>
                  {showIncluded && (
                    <ul className="mt-2 max-h-40 overflow-y-auto list-disc pl-5">
                      {eligibility.eligible.map((e) => <li key={e.name}>{e.employee_name} ({e.name})</li>)}
                    </ul>
                  )}
                </div>
                )}
                {eligibility.excluded.length > 0 && (
                  <div role="alert" data-testid="run-payroll-readiness-warning" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900 space-y-2">
                    <p className="font-bold flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {noneAssigned
                        ? `Payroll can't run yet: none of the ${eligibility.excluded.length} active employees has a salary structure.`
                        : `Excluded: ${eligibility.excluded.length} employee${eligibility.excluded.length === 1 ? '' : 's'} without a salary structure will not get a salary slip.`}
                    </p>
                    <ul className="max-h-40 overflow-y-auto list-disc pl-5">
                      {eligibility.excluded.map((e) => <li key={e.name}>{e.employee_name} ({e.name}){e.reason ? ` — ${e.reason}` : ''}</li>)}
                    </ul>
                    {onOpenSalaryStructures && (
                      <button type="button" onClick={onOpenSalaryStructures} className="underline font-semibold">
                        Open Salary Structures to fix this
                      </button>
                    )}
                    {partial && (
                      <label className="flex items-start gap-2 pt-1 cursor-pointer">
                        <input type="checkbox" data-testid="ack-excluded" checked={ackPartial} onChange={(e) => setAckPartial(e.target.checked)} className="mt-1" />
                        <span>I acknowledge that these {eligibility.excluded.length} employees are excluded from this run.</span>
                      </label>
                    )}
                  </div>
                )}
                {eligibility.notApplicable.length > 0 && (
                  <p className="text-xs text-brand-grey" data-testid="not-applicable">
                    Not payable this period ({eligibility.notApplicable.length}): {eligibility.notApplicable.map((e) => `${e.employee_name} (${e.reason})`).join('; ')}
                  </p>
                )}
                {!noneAssigned && (
                  <label className="flex items-start gap-2 cursor-pointer rounded-xl border border-gray-200 dark:border-slate-700 p-3">
                    <input type="checkbox" data-testid="confirm-period" checked={periodConfirmed} onChange={(e) => setPeriodConfirmed(e.target.checked)} className="mt-1" />
                    <span>I confirm the payroll period is <strong>{monthNames[month]} {year}</strong> ({startDate} to {endDate}).</span>
                  </label>
                )}
              </>
            )}
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-end">
            <Button
              size="lg"
              variant="primary"
              icon={PlayCircle}
              onClick={handleStartPayroll}
              disabled={!canStart}
            >
              Start Payroll Processing
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Processing Live Loader */}
      {step === 2 && (
        <div className="glass-panel rounded-3xl p-12 border text-center space-y-6 max-w-2xl mx-auto">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-brand-red/20 animate-ping" />
            <div className="relative w-16 h-16 rounded-full border-4 border-brand-red border-t-transparent animate-spin flex items-center justify-center">
              <RefreshCw className="h-6 w-6 text-brand-red animate-spin" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-brand-black dark:text-slate-50">Executing Payroll for {monthNames[month]} {year}...</h3>
            <p className="text-sm text-brand-grey">
              Generating salary slips, calculating earnings & deductions, and submitting records...
            </p>
          </div>
        </div>
      )}

      {/* Step 3: Complete Report */}
      {step === 3 && result && (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-emerald-200 bg-emerald-50 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-600 border border-emerald-200">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-heading font-bold text-brand-black dark:text-slate-50">Draft Payroll Generated!</h3>
                  <p className="text-sm text-emerald-600">
                    {result.total_processed} Salary Slips drafted for {monthNames[month]} {year}. Please review before submitting.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  icon={FileText}
                  onClick={onViewSalarySlips}
                >
                  View Drafts
                </Button>
                {!isSubmitted ? (
                  result.total_net_payout > 0 ? (
                    <Button
                      variant="primary"
                      icon={CheckCircle2}
                      isLoading={isSubmittingOfficial}
                      onClick={handleSubmitOfficial}
                    >
                      Submit Official Payroll
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        disabled
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-200 text-gray-400 dark:text-slate-500 text-sm font-bold cursor-not-allowed"
                        title="Cannot submit — all salary slips are ₹0.00. Assign salary structures first."
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Submit Official Payroll
                      </button>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-700 text-sm font-bold whitespace-nowrap">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Submitted Officially
                    </span>
                    <Button
                      variant="secondary"
                      icon={FileText}
                      onClick={onViewSalarySlips}
                    >
                      View Salary Slips
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Metric Breakdown Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/70 border border-gray-200 dark:border-slate-700">
                <span className="text-sm font-bold text-brand-grey block uppercase">Total Gross Payout</span>
                <span className="text-xl font-heading font-bold text-brand-black dark:text-slate-50 mt-1 block">
                  {formatCurrency(result.total_gross)}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/70 border border-gray-200 dark:border-slate-700">
                <span className="text-sm font-bold text-brand-grey block uppercase">Total Deductions & Loans</span>
                <span className="text-xl font-heading font-bold text-rose-600 mt-1 block">
                  {formatCurrency(result.total_deductions)}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/70 border border-gray-200 dark:border-slate-700">
                <span className="text-sm font-bold text-brand-grey block uppercase">Net Payout Amount</span>
                <span className="text-xl font-heading font-bold text-emerald-600 mt-1 block">
                  {formatCurrency(result.total_net_payout)}
                </span>
              </div>
            </div>
          </div>

          {/* Zero Payout Warning Banner */}
          {result.total_net_payout === 0 && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-2xl">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-sm font-bold text-amber-800">All salary slips are ₹0.00 — Submission is blocked</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Your employees do not have a <strong>Salary Structure</strong> assigned, so there is nothing to pay.
                  Click <strong>"Assign Structure"</strong> at the top right, assign a structure, then re-run payroll.
                </p>
              </div>
            </div>
          )}

          {/* Detailed Employee Table */}
          <div className="glass-panel rounded-2xl border p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveReportTab('success')}
                  className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
                    activeReportTab === 'success' ? 'bg-brand-red text-white' : 'text-brand-grey hover:text-brand-black dark:text-slate-50'
                  }`}
                >
                  Succeeded ({result.successful?.length || 0})
                </button>
                {result.failed?.length > 0 && (
                  <button
                    onClick={() => setActiveReportTab('failed')}
                    className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
                      activeReportTab === 'failed' ? 'bg-rose-600 text-white' : 'text-rose-600 hover:text-brand-black dark:text-slate-50'
                    }`}
                  >
                    Action Needed ({result.failed.length})
                  </button>
                )}
              </div>
            </div>

            {/* List Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700 text-brand-grey uppercase font-bold">
                    <th className="pb-3">Employee</th>
                    <th className="pb-3">Gross Pay</th>
                    <th className="pb-3">Deductions</th>
                    <th className="pb-3">Net Payout</th>
                    <th className="pb-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-medium">
                  {activeReportTab === 'success' ? (
                    result.successful?.map((row) => (
                      <tr key={row.salary_slip} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 dark:bg-slate-900">
                        <td className="py-3 text-brand-black dark:text-slate-50 font-bold">{row.employee_name} ({row.employee})</td>
                        <td className="py-3 text-gray-700 dark:text-slate-200">{formatCurrency(row.gross_pay)}</td>
                        <td className="py-3 text-rose-600">{formatCurrency(row.total_deduction)}</td>
                        <td className="py-3 text-emerald-600 font-bold">{formatCurrency(row.net_pay)}</td>
                        <td className="py-3 text-right">
                          <Badge variant={isSubmitted ? "success" : "warning"}>
                            {isSubmitted ? "Submitted" : "Draft"}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    result.failed?.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 dark:bg-slate-900">
                        <td className="py-3 text-brand-black dark:text-slate-50 font-bold">{row.employee_name || row.employee}</td>
                        <td colSpan={3} className="py-3 text-rose-600">{row.error}</td>
                        <td className="py-3 text-right">
                          <Badge variant="danger">Error</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <AssignSalaryStructureModal
        isOpen={isAssignStructureOpen}
        onClose={() => setIsAssignStructureOpen(false)}
        company={company}
        onSuccess={onRefresh}
      />
    </div>
  );
}

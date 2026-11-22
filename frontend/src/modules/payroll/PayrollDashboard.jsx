import React from 'react';
import { 
  DollarSign, Users, CreditCard, Gift, PlayCircle, 
  CheckCircle2, AlertTriangle, FileText, ArrowRight, ShieldCheck, TrendingUp
} from 'lucide-react';
import { StatCard } from '../../components/common/StatCard';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { formatCurrency, formatDate } from '../../api/client';

export function PayrollDashboard({
  summary,
  isLoading,
  month,
  year,
  setMonth,
  setYear,
  onRunPayroll,
  onQuickIncentive,
  onBulkIncentive,
  onNewLoan,
  onViewSalarySlips,
  onAssignStructures,
  onViewReadiness,
  recentStructureAssignments = []
}) {
  const months = [
    { num: 1, name: 'January' }, { num: 2, name: 'February' },
    { num: 3, name: 'March' }, { num: 4, name: 'April' },
    { num: 5, name: 'May' }, { num: 6, name: 'June' },
    { num: 7, name: 'July' }, { num: 8, name: 'August' },
    { num: 9, name: 'September' }, { num: 10, name: 'October' },
    { num: 11, name: 'November' }, { num: 12, name: 'December' }
  ];

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  const readinessScore = summary?.readiness_score || 0;
  const activeEmployees = summary?.active_employees || 0;
  const missingCount = summary?.missing_structure_count ?? 0;
  const assignedCount = summary?.assigned_structure_count || 0;
  // Backend run_payroll_and_report already rejects a run with zero eligible
  // employees, so that case disables the button. Partial coverage is allowed
  // (existing behavior) but is shown as a warning, never as "Ready".
  const readyState = summary?.is_fully_processed
    ? 'done'
    : (!summary || activeEmployees === 0)
      ? 'unknown'
      : assignedCount === 0
        ? 'blocked'
        : missingCount > 0
          ? 'partial'
          : 'ready';
  const monthName = months.find(m => m.num === month)?.name;
  const banner = {
    done: { pill: `Completed for ${monthName} ${year}`, title: 'Payroll Completed for this Period' },
    unknown: { pill: `${monthName} ${year}`, title: 'Monthly Payroll' },
    blocked: { pill: 'Action needed', title: "Payroll isn't ready" },
    partial: { pill: `Partly ready · ${missingCount} need setup`, title: 'Payroll can run for some employees' },
    ready: { pill: `Ready for ${monthName} ${year}`, title: 'Ready to Run Monthly Payroll?' },
  }[readyState];

  return (
    <div className="space-y-6">
      {/* Top Header & Period Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-brand-black dark:text-slate-50 tracking-tight">Payroll Command Center</h2>
          <p className="text-sm text-brand-grey">At-a-glance monthly readiness, incentives, and 1-click execution.</p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-1.5 shadow-md">
          <select
            aria-label="Payroll month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-transparent text-sm font-bold text-brand-black dark:text-slate-50 px-2 py-1 focus:outline-none cursor-pointer"
          >
            {months.map((m) => (
              <option key={m.num} value={m.num} className="bg-white dark:bg-slate-800 text-brand-black dark:text-slate-50">
                {m.name}
              </option>
            ))}
          </select>

          <span className="text-slate-600 font-bold">/</span>

          <select
            aria-label="Payroll year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-transparent text-sm font-bold text-brand-black dark:text-slate-50 px-2 py-1 focus:outline-none cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y} className="bg-white dark:bg-slate-800 text-brand-black dark:text-slate-50">
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Action Banner: Run Payroll */}
      <div className="glass-panel rounded-3xl p-6 border border-brand-red/30 bg-white dark:bg-slate-800 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 z-10 max-w-xl">
          <div
            data-testid="payroll-readiness-pill"
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-bold ${
              readyState === 'ready' || readyState === 'done'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : readyState === 'unknown'
                  ? 'bg-gray-50 border-gray-300 text-gray-700'
                  : 'bg-amber-50 border-amber-300 text-amber-800'
            }`}
          >
            {readyState === 'ready' || readyState === 'done'
              ? <ShieldCheck className="h-3.5 w-3.5" />
              : <AlertTriangle className="h-3.5 w-3.5" />}
            <span>{banner.pill}</span>
          </div>
          <h3 className="text-2xl font-heading font-bold text-brand-black dark:text-slate-50 tracking-tight">
            {banner.title}
          </h3>
          <p className="text-sm text-gray-700 dark:text-slate-200">
            {readyState === 'done' && `Generated and submitted ${summary?.processed_slips_count} salary slips. Total payout: ${formatCurrency(summary?.total_net_payout)}.`}
            {readyState === 'blocked' && `None of the ${activeEmployees} active employees has a salary structure assigned, so payroll cannot run yet.`}
            {readyState === 'partial' && `${missingCount} of ${activeEmployees} active employees have no salary structure and will be skipped.`}
            {readyState === 'ready' && 'Our 1-click runner creates salary slips, adds bonuses, and submits for all active employees.'}
            {readyState === 'unknown' && (isLoading ? 'Loading payroll readiness…' : 'No active employees found for this company.')}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 z-10 w-full md:w-auto">
          {readyState === 'blocked' ? (
            <Button
              size="lg"
              variant="primary"
              icon={Users}
              onClick={onAssignStructures}
              className="shadow-glow w-full sm:w-auto"
            >
              Set up salary structures
            </Button>
          ) : (
            <Button
              size="lg"
              variant="primary"
              icon={PlayCircle}
              onClick={onRunPayroll}
              disabled={readyState === 'unknown'}
              className="shadow-glow w-full sm:w-auto"
            >
              {readyState === 'done' ? 'Re-Run / Review Payroll' : readyState === 'partial' ? 'Review & Run Payroll' : 'Run Payroll Now'}
            </Button>
          )}
          {(readyState === 'blocked' || readyState === 'partial') && (
            <Button
              size="lg"
              variant="secondary"
              icon={ShieldCheck}
              onClick={onViewReadiness}
              className="w-full sm:w-auto"
            >
              View readiness checks
            </Button>
          )}

          {summary?.processed_slips_count > 0 && (
            <Button
              size="lg"
              variant="secondary"
              icon={FileText}
              onClick={onViewSalarySlips}
              className="w-full sm:w-auto"
            >
              View Payslips
            </Button>
          )}
        </div>
      </div>

      {/* Command Center Stat Cards Grid */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${onNewLoan ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        <StatCard
          title="Active Employees"
          value={summary?.active_employees || 0}
          subtitle={`${summary?.assigned_structure_count || 0} assigned salary structures`}
          icon={Users}
          color="indigo"
        />

        <StatCard
          title="Readiness Score"
          value={`${readinessScore}%`}
          subtitle={summary?.missing_structure_count > 0 ? `${summary.missing_structure_count} employees missing structure` : 'All structures verified'}
          icon={readinessScore === 100 ? CheckCircle2 : AlertTriangle}
          color={readinessScore === 100 ? 'emerald' : 'amber'}
        />

        <StatCard
          title="Pending Incentives"
          value={formatCurrency(summary?.total_incentives_amount || 0)}
          subtitle={`${summary?.pending_incentives_count || 0} bonus entries queued`}
          icon={Gift}
          color="cyan"
          onClick={onQuickIncentive}
        />

        {onNewLoan && <StatCard
          title="Active Employee Loans"
          value={summary?.active_loans_count || 0}
          subtitle="Auto-deducting on next payroll"
          icon={CreditCard}
          color="amber"
          onClick={onNewLoan}
        />}
      </div>

      {/* Quick Action Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Quick Incentive Card */}
        <div className="glass-panel rounded-2xl p-5 border space-y-3 hover:border-accent/40 transition-all flex flex-col justify-between">
          <div className="space-y-2">
            <div className="p-2.5 rounded-xl bg-gray-100 text-brand-red border border-gray-200 dark:bg-slate-800 dark:border-slate-700 w-fit">
              <Gift className="h-5 w-5" />
            </div>
            <h4 className="text-base font-bold text-brand-black dark:text-slate-50">Quick Bonus / Incentive</h4>
            <p className="text-sm text-brand-grey">
              Add performance bonus or one-time incentive for an employee in 2 clicks.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button size="sm" variant="primary" onClick={onQuickIncentive}>
              Add Incentive
            </Button>
            <Button size="sm" variant="outline" onClick={onBulkIncentive}>
              Bulk Upload
            </Button>
          </div>
        </div>

        {onNewLoan && (
        <div className="glass-panel rounded-2xl p-5 border space-y-3 hover:border-accent/40 transition-all flex flex-col justify-between">
          <div className="space-y-2">
            <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 w-fit">
              <CreditCard className="h-5 w-5" />
            </div>
            <h4 className="text-base font-bold text-brand-black dark:text-slate-50">Loan & Advance</h4>
            <p className="text-sm text-brand-grey">
              Auto-calculated monthly EMI with optional moratorium and disbursement.
            </p>
          </div>
          <div className="pt-2">
            <Button size="sm" variant="primary" onClick={onNewLoan}>
              New Loan Application
            </Button>
          </div>
        </div>
        )}

        {/* Salary Slip Viewer Card */}
        <div className="glass-panel rounded-2xl p-5 border space-y-3 hover:border-accent/40 transition-all flex flex-col justify-between">
          <div className="space-y-2">
            <div className="p-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 w-fit">
              <FileText className="h-5 w-5" />
            </div>
            <h4 className="text-base font-bold text-brand-black dark:text-slate-50">Salary Slips & Distribution</h4>
            <p className="text-sm text-brand-grey">
              Preview branded PDF payslips, batch download ZIP, or trigger email delivery.
            </p>
          </div>
          <div className="pt-2">
            <Button size="sm" variant="primary" onClick={onViewSalarySlips}>
              Open Payslips Hub
            </Button>
          </div>
        </div>
      </div>

      {/* Recent Salary Structure Assignments — there was a way to *assign*
          a structure (the modal) but nothing
          anywhere showed what had actually been assigned, so there was no
          way to confirm one worked short of running payroll and hoping. */}
      {recentStructureAssignments.length > 0 && (
        <div className="glass-panel rounded-2xl border overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60">
            <h3 className="text-sm font-bold text-brand-black dark:text-slate-50">Recent Salary Structure Assignments</h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700 text-brand-grey font-bold text-label">
                <th className="py-2.5 px-5">Employee</th>
                <th className="py-2.5 px-5">Structure</th>
                <th className="py-2.5 px-5">Base Salary</th>
                <th className="py-2.5 px-5">From</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentStructureAssignments.map((row) => (
                <tr key={row.name} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 dark:bg-slate-900/60 transition-colors">
                  <td className="py-3 px-5">
                    <div className="font-bold text-brand-black dark:text-slate-50">{row.employee_name}</div>
                    <div className="text-label text-brand-grey">{row.employee}</div>
                  </td>
                  <td className="py-3 px-5 text-gray-700 dark:text-slate-200">{row.salary_structure}</td>
                  <td className="py-3 px-5 font-semibold text-emerald-600">{formatCurrency(row.base)}</td>
                  <td className="py-3 px-5 text-brand-grey">{formatDate(row.from_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

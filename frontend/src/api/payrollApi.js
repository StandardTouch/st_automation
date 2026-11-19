import { callApi } from './client';

export const payrollApi = {
  getSummary: (company, month, year) => 
    callApi('st_automation.api.payroll.get_payroll_dashboard_summary', { company, month, year }, 'GET'),
  
  quickAddIncentive: (formData) =>
    callApi('st_automation.api.payroll.quick_add_incentive', {
      employee: formData.employee,
      amount: formData.amount,
      salary_component: formData.salary_component,
      payroll_date: formData.payroll_date,
      notes: formData.notes,
      is_recurring: formData.is_recurring ? 1 : 0,
      from_date: formData.from_date,
      to_date: formData.to_date,
    }),
  
  bulkAddIncentives: (incentivesList) => 
    callApi('st_automation.api.payroll.bulk_add_incentives', { incentives: incentivesList }),
  
  getLoanPreview: (employee, amount, tenureMonths, loanProduct) => 
    callApi('st_automation.api.payroll.get_loan_preview', {
      employee,
      amount,
      tenure_months: tenureMonths,
      loan_product: loanProduct,
    }, 'GET'),
  
  createLoan: (employee, amount, tenure_months, monthly_repayment_amount, loan_product, custom_moratorium = 0, disbursement_date = null, disburse = 1) =>
    callApi('st_automation.api.payroll.create_loan_and_disburse', {
      employee,
      amount,
      tenure_months,
      monthly_repayment_amount,
      loan_product,
      custom_moratorium,
      disbursement_date,
      disburse,
    }, 'POST'),

  disburseLoan: (loan_name, disbursement_date) =>
    callApi('st_automation.api.payroll.disburse_loan', { loan_name, disbursement_date }, 'POST'),
  
  runPayrollAndReport: (company, startDate, endDate, costCenter, eligibilitySnapshot, acknowledgedExcluded = []) => 
    callApi('st_automation.api.payroll.run_payroll_and_report', {
      company,
      start_date: startDate,
      end_date: endDate,
      cost_center: costCenter,
      eligibility_snapshot: eligibilitySnapshot,
      acknowledged_excluded: JSON.stringify(acknowledgedExcluded),
    }),

  getPayrollEligibility: (company, startDate, endDate) =>
    callApi('st_automation.api.payroll.get_payroll_eligibility', { company, start_date: startDate, end_date: endDate }, 'GET'),

  getUnassignedEmployees: (company) =>
    callApi('st_automation.api.payroll.get_unassigned_employees', { company }, 'GET'),

  // dryRun=true never writes. A real write needs dryRun=false AND confirmed=true.
  bulkAssignSalaryStructure: (company, assignments, dryRun = true, confirmed = false) =>
    callApi('st_automation.api.payroll.bulk_assign_salary_structure', {
      company,
      assignments: JSON.stringify(assignments),
      dry_run: dryRun ? 1 : 0,
      confirmed: confirmed ? 1 : 0,
    }),
  
  getSalarySlips: (company, month, year, employee) =>
    callApi('st_automation.api.payroll.get_salary_slips_summary', {
      company,
      month,
      year,
      employee,
    }, 'GET'),

  getActiveLoans: (company) =>
    callApi('st_automation.api.payroll.get_active_loans', { company }, 'GET'),

  getRecentSalaryStructureAssignments: (company) =>
    callApi('st_automation.api.payroll.get_recent_salary_structure_assignments', { company }, 'GET'),
};

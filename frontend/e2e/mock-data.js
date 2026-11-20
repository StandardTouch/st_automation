// Pure mock data shared by the Playwright fixtures and the Lighthouse mock server.
export const PROFILE = {
  is_logged_in: true, user: 'hr@example.com', full_name: 'HR Admin', user_image: '', email: 'hr@example.com',
  roles: ['System Manager'], is_hr_admin: true, is_recruiter: true, is_interviewer: true, is_system_manager: true, is_employee: false,
  default_company: 'Acme', companies: [{ name: 'Acme', company_name: 'Acme', default_currency: 'INR' }],
};

export const summary = (over = {}) => ({
  company: 'Acme', active_employees: 10, assigned_structure_count: 10, missing_structure_count: 0, readiness_score: 100,
  active_loans_count: 0, pending_incentives_count: 0, total_incentives_amount: 0, processed_slips_count: 0,
  total_gross: 0, total_deductions: 0, total_net_payout: 0, is_fully_processed: false, ...over,
});

const emp = (n, extra = {}) => ({ name: `E${n}`, employee_name: `Person ${n}`, ...extra });
export { emp };

export const DEFAULTS = {
  'auth.get_current_user_profile': () => PROFILE,
  'recruitment.get_pipeline': () => ({ stages: { Open: [], Replied: [] } }),
  'recruitment.get_job_openings': () => ({ job_openings: [{ name: 'JO-1', job_title: 'Developer', status: 'Open', department: 'Engineering', designation: 'Developer', vacancies: 2, applicant_count: 3, publish: 1 }] }),
  'recruitment.get_my_interviews': () => ({ interviews: [] }),
  'recruitment.get_departments': () => ({ departments: ['Engineering'] }),
  'payroll.get_payroll_dashboard_summary': () => summary(),
  'payroll.get_salary_slips_summary': () => ({ slips: [] }),
  'payroll.get_active_loans': () => [],
  'payroll.get_recent_salary_structure_assignments': () => [],
  'payroll.get_salary_structures': () => [],
  'payroll.get_active_employees': () => [],
  'payroll.get_unassigned_employees': () => [],
  'payroll.get_payroll_eligibility': () => ({ snapshot: 'SNAP1', eligible: [emp(1)], excluded: [], not_applicable: [] }),
  'salary_structure.list_salary_structures': () => [],
  'salary_structure.list_salary_structure_assignments': () => [],
  'salary_structure.get_form_metadata': () => ({ components: [], companies: ['Acme'], currencies: ['INR'], modes_of_payment: [], letter_heads: [], payroll_frequencies: ['Monthly'] }),
  'diagnostics.check_system_health': () => ({ overall_status: 'healthy', checks: [] }),
  'exit.get_exit_pipeline': () => ({ separations: [] }),
  'onboarding.get_onboarding_pipeline': () => ({ onboardings: [] }),
  'offer_letter.get_offer_letters': () => ({ offers: [] }),
};


import React, { useState, useEffect, useCallback } from 'react';
import { FEATURES } from './config/features';
import { ToastProvider, useToast } from './components/common/Toast';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';

// API
import { diagnosticsApi } from './api/diagnosticsApi';
import { recruitmentApi } from './api/recruitmentApi';
import { payrollApi } from './api/payrollApi';
import { onboardingApi } from './api/onboardingApi';
import { exitApi } from './api/exitApi';
import { uploadFile } from './api/client';

// Onboarding & Exit Views
import { OnboardingPipelineView } from './modules/onboarding/OnboardingPipelineView';
import { OnboardingStatusPage } from './modules/onboarding/OnboardingStatusPage';
import { StartOnboardingModal } from './modules/onboarding/StartOnboardingModal';
import { ExitPipelineView } from './modules/exit/ExitPipelineView';
import { ExitStatusPage } from './modules/exit/ExitStatusPage';
import { StartSeparationModal } from './modules/exit/StartSeparationModal';

// Templates Views
import { TemplateListPage } from './modules/templates/TemplateListPage';
import { TemplateFormPage } from './modules/templates/TemplateFormPage';

// Recruitment Views & Modals
import { KanbanBoard } from './modules/recruitment/KanbanBoard';
import { JobOpeningsView } from './modules/recruitment/JobOpeningsView';
import { MyInterviewsView } from './modules/recruitment/MyInterviewsView';
import { ApplicantDetailModal } from './modules/recruitment/ApplicantDetailModal';
import { SelectCandidateModal } from './modules/recruitment/SelectCandidateModal';
import { QuickAddApplicantModal } from './modules/recruitment/QuickAddApplicantModal';
import { QuickAddJobOpeningModal } from './modules/recruitment/QuickAddJobOpeningModal';
import { FeedbackScorecardModal } from './modules/recruitment/FeedbackScorecardModal';
import { OfferLettersView } from './modules/recruitment/OfferLettersView';
import { offerLetterApi } from './api/offerLetterApi';
import { Careers } from './pages/Careers';

// Payroll Views & Modals
import { PayrollDashboard } from './modules/payroll/PayrollDashboard';
import { RunPayrollWizard } from './modules/payroll/RunPayrollWizard';
import { QuickIncentiveModal } from './modules/payroll/QuickIncentiveModal';
import { BulkIncentiveModal } from './modules/payroll/BulkIncentiveModal';
import { LoanApplicationWizard } from './modules/payroll/LoanApplicationWizard';
import { ActiveLoansView } from './modules/payroll/ActiveLoansView';
import { SalarySlipsView } from './modules/payroll/SalarySlipsView';
import { SalaryStructureView } from './modules/payroll/SalaryStructureView';
import { CommandPalette } from './components/layout/CommandPalette';

// Diagnostics & Public Candidate
import { DiagnosticsView } from './modules/diagnostics/DiagnosticsView';
import { CandidateSlotBooking } from './modules/candidate/CandidateSlotBooking';
import InterviewFeedback from './pages/InterviewFeedback';

// Feedback Module
import { FeedbackPortal } from './modules/feedback/FeedbackPortal';
import { confirmAction, ConfirmHost } from './components/common/ConfirmDialog';

export function AppContent() {
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState(null);
  const [notFoundHash, setNotFoundHash] = useState(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isPublicCandidateMode, setIsPublicCandidateMode] = useState(false);
  const [isInterviewFeedbackMode, setIsInterviewFeedbackMode] = useState(false);
  const [isPublicOnboardingMode, setIsPublicOnboardingMode] = useState(false);
  const [isPublicExitMode, setIsPublicExitMode] = useState(false);
  const [isPublicCareersMode, setIsPublicCareersMode] = useState(false);

  // User & Company Context
  const [userProfile, setUserProfile] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState('');

  // Date/Period State for Payroll
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  // Recruitment Data
  const [pipelineData, setPipelineData] = useState(null);
  const [jobOpenings, setJobOpenings] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [myInterviews, setMyInterviews] = useState([]);
  const [selectedJob, setSelectedJob] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecruitmentLoading, setIsRecruitmentLoading] = useState(false);

  // Payroll Data
  const [payrollSummary, setPayrollSummary] = useState(null);
  const [salarySlips, setSalarySlips] = useState([]);
  const [activeLoans, setActiveLoans] = useState([]);
  const [recentStructureAssignments, setRecentStructureAssignments] = useState([]);
  const [isPayrollLoading, setIsPayrollLoading] = useState(false);

  // Onboarding & Exit Data
  const [onboardingData, setOnboardingData] = useState(null);
  const [exitData, setExitData] = useState(null);
  const [isOnboardingLoading, setIsOnboardingLoading] = useState(false);
  const [isExitLoading, setIsExitLoading] = useState(false);

  // Diagnostics Data
  const [healthData, setHealthData] = useState(null);
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

  // Modal States
  const [activeApplicant, setActiveApplicant] = useState(null);
  // The candidate panel belongs to the screen that opened it: leaving closes it.
  const closePanelOnTab = React.useRef(null);
  useEffect(() => {
    if (closePanelOnTab.current !== null && closePanelOnTab.current !== activeTab) setActiveApplicant(null);
    closePanelOnTab.current = activeTab;
  }, [activeTab]);
  const [openInSchedulingMode, setOpenInSchedulingMode] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isNewJobOpeningOpen, setIsNewJobOpeningOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [isSelectCandidateOpen, setIsSelectCandidateOpen] = useState(false);
  const [isQuickIncentiveOpen, setIsQuickIncentiveOpen] = useState(false);
  const [isBulkIncentiveOpen, setIsBulkIncentiveOpen] = useState(false);
  const [isLoanWizardOpen, setIsLoanWizardOpen] = useState(false);
  const [isStartOnboardingOpen, setIsStartOnboardingOpen] = useState(false);
  const [isStartSeparationOpen, setIsStartSeparationOpen] = useState(false);
  const [activeInterviewForFeedback, setActiveInterviewForFeedback] = useState(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [drawerReloadKey, setDrawerReloadKey] = useState(0);

  // Template State
  // Template editor state lives in the URL hash so a refresh stays on the same
  // list tab or the same form: #/templates/<onboarding|separation>[/new|/edit/<name>]
  const parseTemplateHash = () => {
    const parts = window.location.hash.replace(/^#\/?/, '').split('/');
    if (parts[0] !== 'templates') return { type: null, name: null, listTab: 'Onboarding' };
    const type = parts[1] === 'separation' ? 'Separation' : parts[1] === 'onboarding' ? 'Onboarding' : null;
    if (type && parts[2] === 'new') return { type, name: null, listTab: type };
    if (type && parts[2] === 'edit' && parts[3]) return { type, name: decodeURIComponent(parts.slice(3).join('/')), listTab: type };
    return { type: null, name: null, listTab: type || 'Onboarding' };
  };
  const [editingTemplate, setEditingTemplateState] = useState(() => {
    const t = parseTemplateHash();
    return { type: t.type, name: t.name };
  });
  const [templateListTab, setTemplateListTab] = useState(() => parseTemplateHash().listTab);
  const openTemplateRoute = (hash, state) => {
    window.history.pushState(null, '', hash);
    setEditingTemplateState(state);
  };

  // Offer Letters State
  const [offerLetters, setOfferLetters] = useState([]);
  const [isOfferLettersLoading, setIsOfferLettersLoading] = useState(false);

  // Detect Public Candidate Route or Interview Feedback Route
  useEffect(() => {
    const checkRoute = () => {
      const isBooking = window.location.hash.includes('book-slot') || window.location.pathname.includes('book-slot');
      const searchParams = new URLSearchParams(window.location.search);
      const isFeedback = window.location.pathname.includes('interview-feedback') || searchParams.has('token');
      const isOnboarding = searchParams.has('onboarding_token');
      const isExit = searchParams.has('exit_token');
      const isCareers = window.location.hash.includes('careers') || window.location.pathname.includes('careers');
      
      setIsPublicCandidateMode(isBooking);
      setIsInterviewFeedbackMode(isFeedback);
      setIsPublicOnboardingMode(isOnboarding);
      setIsPublicExitMode(isExit);
      setIsPublicCareersMode(isCareers);
    };
    checkRoute();
    window.addEventListener('hashchange', checkRoute);
    return () => window.removeEventListener('hashchange', checkRoute);
  }, []);

  // Initial Load: User profile & default company
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await diagnosticsApi.getUserProfile();
        setUserProfile(res.data);
        if (res.data?.default_company) {
          setSelectedCompany(res.data.default_company);
        }
        
        // Default tab logic strictly based on roles & permissions
        const profile = res.data;
        const isHR = profile?.is_hr_admin || profile?.is_system_manager;
        const isRecruiter = profile?.is_recruiter || isHR;
        const isInterviewer = profile?.is_interviewer || isRecruiter;
        const isEmployee = profile?.is_employee;

        setActiveTab((prev) => {
          // If already set to a tab that the user has permission to view, keep it
          if (prev) {
            if (prev === 'recruitment-pipeline' || prev === 'job-openings') return isRecruiter ? prev : (isEmployee ? 'salary-slips' : 'staff-feedback');
            if (prev === 'my-interviews') return isInterviewer ? prev : (isEmployee ? 'salary-slips' : 'staff-feedback');
            if (prev === 'payroll-command' || prev === 'run-payroll' || prev === 'loans' || prev === 'onboarding-pipeline' || prev === 'exit-pipeline' || prev === 'templates' || prev === 'diagnostics') {
              return isHR ? prev : (isEmployee ? 'salary-slips' : 'staff-feedback');
            }
            if (prev === 'salary-slips') return (isHR || isEmployee) ? prev : 'staff-feedback';
            return prev;
          }

          // Otherwise pick the best default for the user's role:
          if (isRecruiter) return 'recruitment-pipeline';
          if (isInterviewer) return 'my-interviews';
          if (isEmployee) return 'salary-slips';
          return 'staff-feedback';
        });
      } catch (e) {
        console.error('Failed to load user profile', e);
        setActiveTab((prev) => prev || 'staff-feedback');
      }
    };
    loadProfile();
  }, []);

  // Load Recruitment Data
  const loadRecruitment = useCallback(async () => {
    setIsRecruitmentLoading(true);
    try {
      const [pipeRes, jobsRes, intRes, deptRes] = await Promise.all([
        recruitmentApi.getPipeline(selectedJob, searchQuery, selectedCompany),
        recruitmentApi.getJobOpenings(selectedCompany),
        recruitmentApi.getMyInterviews(),
        recruitmentApi.getDepartments(selectedCompany),
      ]);
      setPipelineData(pipeRes.data);
      setJobOpenings(jobsRes.data?.job_openings || []);
      setDepartments(deptRes.data?.departments || []);
      setMyInterviews(intRes.data?.interviews || []);
    } catch (err) {
      console.error('Error loading recruitment data', err);
    } finally {
      setIsRecruitmentLoading(false);
    }
  }, [selectedJob, searchQuery, selectedCompany]);

  // Load Payroll Data
  const loadPayroll = useCallback(async () => {
    setIsPayrollLoading(true);
    try {
      const [sumRes, slipsRes, loansRes, structuresRes] = await Promise.all([
        payrollApi.getSummary(selectedCompany, month, year),
        payrollApi.getSalarySlips(selectedCompany, month, year),
        FEATURES.loans ? payrollApi.getActiveLoans(selectedCompany) : Promise.resolve({ data: [] }),
        payrollApi.getRecentSalaryStructureAssignments(selectedCompany),
      ]);
      setPayrollSummary(sumRes.data);
      setSalarySlips(slipsRes.data?.slips || []);
      setActiveLoans(loansRes.data || []);
      setRecentStructureAssignments(structuresRes.data || []);
    } catch (err) {
      console.error('Error loading payroll data', err);
    } finally {
      setIsPayrollLoading(false);
    }
  }, [selectedCompany, month, year]);

  // Load Diagnostics
  const loadDiagnostics = useCallback(async () => {
    setIsHealthLoading(true);
    try {
      const res = await diagnosticsApi.checkHealth(selectedCompany);
      setHealthData(res.data);
    } catch (err) {
      console.error('Error loading diagnostics', err);
    } finally {
      setIsHealthLoading(false);
    }
  }, [selectedCompany]);

  // Load Onboarding & Exit
  const loadOnboarding = useCallback(async () => {
    setIsOnboardingLoading(true);
    try {
      const res = await onboardingApi.getPipeline(selectedCompany, 1);
      setOnboardingData(res.data);
    } catch (err) {
      console.error('Error loading onboarding', err);
    } finally {
      setIsOnboardingLoading(false);
    }
  }, [selectedCompany]);

  const loadExit = useCallback(async () => {
    setIsExitLoading(true);
    try {
      const res = await exitApi.getPipeline(selectedCompany, 1);
      setExitData(res.data);
    } catch (err) {
      console.error('Error loading exit pipeline', err);
    } finally {
      setIsExitLoading(false);
    }
  }, [selectedCompany]);

  const loadOfferLetters = useCallback(async () => {
    setIsOfferLettersLoading(true);
    try {
      const res = await offerLetterApi.getOfferLetters(selectedCompany);
      setOfferLetters(res.data?.offers || []);
    } catch (err) {
      console.error('Error loading offer letters', err);
    } finally {
      setIsOfferLettersLoading(false);
    }
  }, [selectedCompany]);

  // Keep the active tab in the URL hash and browser history so the back
  // button / swipe-back moves between HR Ops pages instead of leaving the app
  // (previously it dropped the user onto the Frappe desk).
  const VALID_TABS = [
    'recruitment-pipeline', 'job-openings', 'my-interviews', 'offer-letters',
    'onboarding-pipeline', 'exit-pipeline', 'payroll-command', 'run-payroll',
    ...(FEATURES.loans ? ['loans'] : []), 'salary-structures', 'salary-slips', 'staff-feedback', 'my-feedback', 'feedback-analytics',
    'templates', 'diagnostics',
  ];
  const hashTab = () => {
    const h = window.location.hash.replace(/^#\/?/, '').split('/')[0];
    return VALID_TABS.includes(h) ? h : null;
  };
  // A hash whose first segment is not a known page (typo, stale bookmark) used
  // to be ignored silently. Remember it so a "page not found" notice can show.
  const unknownHash = () => {
    const h = window.location.hash.replace(/^#\/?/, '').split('/')[0];
    if (!h || VALID_TABS.includes(h)) return null;
    if (['book-slot', 'careers', 'feedback', 'onboarding', 'exit'].some((k) => h.includes(k))) return null;
    return window.location.hash;
  };
  useEffect(() => {
    const fromHash = hashTab();
    if (fromHash) setActiveTab((prev) => prev || fromHash);
    setNotFoundHash(unknownHash());
    const onPop = () => {
      const t = hashTab();
      if (t) setActiveTab(t);
      setNotFoundHash(unknownHash());
      const tpl = parseTemplateHash();
      setEditingTemplateState({ type: tpl.type, name: tpl.name });
      setTemplateListTab(tpl.listTab);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (!activeTab || !VALID_TABS.includes(activeTab)) return;
    if (isPublicCandidateMode || isInterviewFeedbackMode || isPublicOnboardingMode || isPublicExitMode || isPublicCareersMode) return;
    const current = hashTab();
    if (current === activeTab) return;
    // First tab selection (no hash yet) replaces the entry so back does not
    // land on a blank duplicate of the same page.
    if (!current) window.history.replaceState(null, '', `#/${activeTab}`);
    else window.history.pushState(null, '', `#/${activeTab}`);
    if (activeTab === 'templates') setEditingTemplateState({ type: null, name: null });
  }, [activeTab, isPublicCandidateMode, isInterviewFeedbackMode, isPublicOnboardingMode, isPublicExitMode, isPublicCareersMode]);

  // Which loader group each tab belongs to. The "initial load" effect below
  // skips the active tab's group because the tab effect already fetches it;
  // before this, both fired on first load and on every company switch (each
  // list endpoint was requested twice, the first time with company='').
  const TAB_GROUPS = {
    recruitment: ['recruitment-pipeline', 'job-openings', 'my-interviews'],
    payroll: ['payroll-command', 'run-payroll', 'loans', 'salary-slips'],
    diagnostics: ['diagnostics'],
    onboarding: ['onboarding-pipeline'],
    exit: ['exit-pipeline'],
    offers: ['offer-letters'],
  };
  const activeTabRef = React.useRef(activeTab);
  activeTabRef.current = activeTab;

  useEffect(() => {
    // Wait for the profile (it carries the default company) so the first
    // request is already scoped to the right company.
    if (!userProfile) return;
    if (!isPublicCandidateMode && !isPublicOnboardingMode && !isPublicExitMode) {
      // Tab ids are 'recruitment-pipeline' etc.; the old checks compared
      // against names that never matched, so these views kept showing data
      // fetched at page load (stale cache) until a full refresh.
      if (['recruitment-pipeline', 'job-openings', 'my-interviews'].includes(activeTab)) loadRecruitment();
      if (['payroll-command', 'run-payroll', 'loans', 'salary-slips'].includes(activeTab)) loadPayroll();
      if (activeTab === 'diagnostics') loadDiagnostics();
      if (activeTab === 'onboarding-pipeline') loadOnboarding();
      if (activeTab === 'exit-pipeline') loadExit();
      if (activeTab === 'offer-letters') loadOfferLetters();
    }
  }, [userProfile, activeTab, isPublicCandidateMode, isPublicOnboardingMode, isPublicExitMode, loadRecruitment, loadPayroll, loadDiagnostics, loadOnboarding, loadExit, loadOfferLetters]);

  // Initial load (and reload of everything on company switch), except the
  // group the active tab already loads.
  const hasActiveTab = !!activeTab;
  useEffect(() => {
    if (!userProfile || !hasActiveTab) return;
    if (!isPublicCandidateMode && !isPublicOnboardingMode && !isPublicExitMode) {
      const t = activeTabRef.current;
      const inTab = (g) => TAB_GROUPS[g].includes(t);
      if (!inTab('recruitment')) loadRecruitment();
      if (!inTab('payroll')) loadPayroll();
      if (!inTab('diagnostics')) loadDiagnostics();
      if (!inTab('onboarding')) loadOnboarding();
      if (!inTab('exit')) loadExit();
      if (!inTab('offers')) loadOfferLetters();
    }
  }, [userProfile, hasActiveTab, isPublicCandidateMode, isPublicOnboardingMode, isPublicExitMode, loadRecruitment, loadPayroll, loadDiagnostics, loadOnboarding, loadExit, loadOfferLetters]);

  // 1-Click Handlers: Recruitment
  const handleShortlist = async (applicant) => {
    setIsActionLoading(true);
    try {
      const res = await recruitmentApi.shortlistAndNotify(applicant.name);
      addToast(res.message || 'Candidate shortlisted.', 'success');
      loadRecruitment();
      // Keep the profile open and refresh its content in place.
      if (activeApplicant?.name === applicant.name) {
        const fresh = await recruitmentApi.getApplicant(applicant.name);
        if (fresh.data) setActiveApplicant(fresh.data);
      }
    } catch (err) {
      addToast(err.message || 'Failed to shortlist candidate', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDecision = async (applicantId, decision, notes, emailSubject, emailBody) => {
    setIsActionLoading(true);
    try {
      const res = await recruitmentApi.recordDecision(applicantId, decision, notes, undefined, undefined, emailSubject, emailBody);
      addToast(res.message || `Decision recorded: ${decision}`, 'success');
      loadRecruitment();
      setActiveApplicant(null);
    } catch (err) {
      addToast(err.message || 'Failed to record decision', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleQuickAddApplicant = async (formData) => {
    setIsActionLoading(true);
    try {
      // The resume File used to be kept in form state and silently dropped:
      // only `resume_attachment` (a URL) reaches the API, so the candidate
      // was created with "No resume attached". Upload first, then pass the URL.
      const { resume_file, ...payload } = formData;
      if (resume_file) {
        const uploaded = await uploadFile(resume_file, { isPrivate: true });
        payload.resume_attachment = uploaded.file_url;
      }
      const res = await recruitmentApi.quickAddApplicant(payload);
      addToast(res.message || 'Candidate added to pipeline!', 'success');
      setIsQuickAddOpen(false);
      loadRecruitment();
    } catch (err) {
      addToast(err.message || 'Failed to add candidate', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSaveJobOpening = async (formData) => {
    setIsActionLoading(true);
    try {
      if (editingJob) {
        const upd = await recruitmentApi.updateJobOpening(editingJob.name, {
          job_title: formData.job_title,
          department: formData.department,
          vacancies: formData.vacancies,
          status: formData.status,
          publish: formData.publish ? 1 : 0,
          description: formData.description,
        });
        addToast(upd.message || 'Job Opening updated!', 'success');
        setIsNewJobOpeningOpen(false);
        setEditingJob(null);
        loadRecruitment();
        return;
      }
      const res = await recruitmentApi.createJobOpening(
        formData.job_title,
        selectedCompany,
        formData.department,
        formData.vacancies,
        formData.publish ? 1 : 0
      );
      addToast(res.message || 'Job Opening created!', 'success');
      setIsNewJobOpeningOpen(false);
      loadRecruitment();
    } catch (err) {
      addToast(err.message || 'Failed to save job opening', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSubmitScorecard = async (interviewId, rating, recommendation, comments, scorecard, conflictExplanation) => {
    setIsActionLoading(true);
    try {
      const res = await recruitmentApi.submitFeedback(interviewId, rating, recommendation, comments, scorecard, conflictExplanation);
      addToast(res.message || 'Interview feedback saved!', 'success');
      setActiveInterviewForFeedback(null);
      setDrawerReloadKey((k) => k + 1); // refresh an open candidate drawer so it shows the new feedback
      loadRecruitment();
    } catch (err) {
      addToast(err.message || 'Failed to save feedback', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleJob = async (jobId, publish) => {
    try {
      await recruitmentApi.toggleJobOpening(jobId, publish);
      addToast('Job visibility updated', 'info');
      loadRecruitment();
    } catch (err) {
      addToast('Failed to update job opening', 'error');
    }
  };

  const handleDeleteJobOpening = async (jobName) => {
    if (!(await confirmAction({ title: 'Delete job opening?', message: 'This job opening will be deleted. Candidates already linked to it stay in the pipeline.', confirmLabel: 'Delete job opening', tone: 'danger' }))) return;
    try {
      await recruitmentApi.deleteJobOpening(jobName);
      addToast('Job Opening deleted successfully', 'success');
      loadRecruitment();
    } catch (err) {
      addToast(err.message || 'Failed to delete Job Opening', 'error');
    }
  };

  // 1-Click Handlers: Payroll
  const handleQuickAddIncentive = async (formData) => {
    setIsActionLoading(true);
    try {
      const res = await payrollApi.quickAddIncentive(formData);
      addToast(res.message || 'Incentive added!', 'success');
      setIsQuickIncentiveOpen(false);
      loadPayroll();
    } catch (err) {
      addToast(err.message || 'Failed to add incentive', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleBulkIncentives = async (incentivesList) => {
    setIsActionLoading(true);
    try {
      const res = await payrollApi.bulkAddIncentives(incentivesList);
      addToast(res.message || 'Bulk incentives created!', 'success');
      setIsBulkIncentiveOpen(false);
      loadPayroll();
    } catch (err) {
      addToast(err.message || 'Failed to submit bulk incentives', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCreateLoan = async (emp, amt, tenure, monthlyAmt, product, moratorium, disbursementDate) => {
    setIsActionLoading(true);
    try {
      const res = await payrollApi.createLoan(emp, amt, tenure, monthlyAmt, product, moratorium, disbursementDate, 0);
      addToast(res.message || 'Loan sanctioned successfully!', 'success');
      loadPayroll();
      return res;
    } catch (err) {
      addToast(err.message || 'Failed to sanction loan', 'error');
      throw err;
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDisburseOnly = async (loanName, disbursementDate) => {
    setIsActionLoading(true);
    try {
      const res = await payrollApi.disburseLoan(loanName, disbursementDate);
      addToast(res.message || 'Loan disbursed successfully!', 'success');
      loadPayroll();
      return res;
    } catch (err) {
      addToast(err.message || 'Failed to disburse loan', 'error');
      throw err;
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleExecutePayroll = async (comp, sDate, eDate, rules = {}) => {
    try {
      const res = await payrollApi.runPayrollAndReport(comp, sDate, eDate, undefined, rules.eligibilitySnapshot, rules.acknowledgedExcluded || []);
      addToast(res.message || 'Payroll completed!', 'success');
      loadPayroll();
      return res.data;
    } catch (err) {
      addToast(err.message || 'Payroll run failed', 'error');
      throw err;
    }
  };

  const handleAutoFix = async (issueId) => {
    setIsFixing(true);
    try {
      const res = await diagnosticsApi.autoFix(issueId, selectedCompany);
      addToast(res.message || 'Fixed successfully!', 'success');
      loadDiagnostics();
      loadPayroll();
    } catch (err) {
      addToast(err.message || 'Auto-fix failed', 'error');
    } finally {
      setIsFixing(false);
    }
  };

  // If candidate opens slot booking link
  if (isPublicCandidateMode || activeTab === 'public-booking-demo') {
    return <CandidateSlotBooking />;
  }

  // If interviewer clicks their feedback link (token in URL)
  if (isInterviewFeedbackMode) {
    return <InterviewFeedback />;
  }

  if (isPublicOnboardingMode) {
    return <OnboardingStatusPage />;
  }

  if (isPublicExitMode) {
    return <ExitStatusPage />;
  }

  if (isPublicCareersMode) {
    return <Careers />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 text-brand-black dark:text-slate-50 flex overflow-x-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userProfile={userProfile}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

      {/* Main App Canvas */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <TopHeader
          userProfile={userProfile}
          setIsMobileOpen={setIsMobileOpen}
          selectedCompany={selectedCompany}
          setSelectedCompany={setSelectedCompany}
          onQuickAddCandidate={() => setIsQuickAddOpen(true)}
          onQuickAddIncentive={() => setIsQuickIncentiveOpen(true)}
          activeTab={activeTab}
        />

        <ConfirmHost />
        <CommandPalette
          userProfile={userProfile}
          onNavigate={(tab) => { setActiveTab(tab); setIsMobileOpen(false); }}
          actions={[
            ...((userProfile?.is_recruiter || userProfile?.is_hr_admin || userProfile?.is_system_manager)
              ? [{ label: 'Add Candidate', run: () => setIsQuickAddOpen(true) }] : []),
            ...((userProfile?.is_hr_admin || userProfile?.is_system_manager) ? [
              { label: 'Quick Incentive', run: () => setIsQuickIncentiveOpen(true) },
              ...(FEATURES.loans ? [{ label: 'New Loan Application', run: () => setIsLoanWizardOpen(true) }] : []),
            ] : []),
          ]}
        />

        {/* View Canvas */}
        <main className="flex-1 p-4 sm:p-6 xl:p-8 max-w-[1680px] w-full mx-auto">
          <h1 className="sr-only">Standard Touch HR Operations</h1>
          {notFoundHash && (
            <div role="alert" data-testid="route-not-found" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <span>
                <strong>Page not found:</strong> <code>{notFoundHash}</code> is not a page in HR Operations. Showing your default page instead.
              </span>
              <button type="button" onClick={() => setNotFoundHash(null)} className="shrink-0 font-semibold underline">Dismiss</button>
            </div>
          )}
          {/* Recruitment Views */}
          {activeTab === 'recruitment-pipeline' && (
            <KanbanBoard
              pipelineData={pipelineData}
              isLoading={isRecruitmentLoading}
              onRefresh={loadRecruitment}
              onOpenApplicant={(app) => setActiveApplicant(app)}
              onScheduleInterview={(app) => {
                setOpenInSchedulingMode(true);
                setActiveApplicant(app);
              }}
              onShortlist={handleShortlist}
              onOpenOffers={() => setActiveTab('offer-letters')}
              onQuickAdd={() => setIsQuickAddOpen(true)}
              jobOpenings={jobOpenings}
              selectedJob={selectedJob}
              setSelectedJob={setSelectedJob}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          )}

          {activeTab === 'job-openings' && (
            <JobOpeningsView
              jobOpenings={jobOpenings}
              onTogglePublish={handleToggleJob}
              isLoading={isRecruitmentLoading}
              onNewJobOpening={() => { setEditingJob(null); setIsNewJobOpeningOpen(true); }}
              onEditJobOpening={(job) => { setEditingJob(job); setIsNewJobOpeningOpen(true); }}
              onDeleteJobOpening={handleDeleteJobOpening}
            />
          )}

          {activeTab === 'my-interviews' && (
            <MyInterviewsView
              interviews={myInterviews}
              onOpenFeedback={(item) => setActiveInterviewForFeedback(item)}
              onOpenCandidate={async (applicant_id) => {
                try {
                  const res = await recruitmentApi.getApplicant(applicant_id);
                  if (res.data) {
                    setActiveApplicant(res.data);
                    setOpenInSchedulingMode(true);
                  }
                } catch (err) {
                  console.error('Failed to load candidate', err);
                  addToast('Failed to load candidate profile', 'error');
                }
              }}
              onScheduleAdHoc={
                (userProfile?.is_hr_admin || userProfile?.is_system_manager)
                  ? () => setIsSelectCandidateOpen(true)
                  : undefined
              }
              isLoading={isRecruitmentLoading}
            />
          )}

          {activeTab === 'offer-letters' && (
            <OfferLettersView
              offers={offerLetters}
              isHR={userProfile?.is_hr_admin || userProfile?.is_system_manager}
              isLoading={isOfferLettersLoading}
              onRefresh={loadOfferLetters}
              selectedCompany={selectedCompany}
            />
          )}
          
          {/* Onboarding & Exit Views */}
          {activeTab === 'onboarding-pipeline' && (
            <OnboardingPipelineView
              pipelineData={onboardingData}
              isLoading={isOnboardingLoading}
              onRefresh={loadOnboarding}
              onStartOnboarding={() => setIsStartOnboardingOpen(true)}
            />
          )}

          {activeTab === 'exit-pipeline' && (
            <ExitPipelineView
              pipelineData={exitData}
              isLoading={isExitLoading}
              onRefresh={loadExit}
              onStartSeparation={() => setIsStartSeparationOpen(true)}
            />
          )}

          {/* Templates Views */}
          {activeTab === 'templates' && (
            editingTemplate.type ? (
              <TemplateFormPage
                key={`${editingTemplate.type}:${editingTemplate.name || 'new'}`}
                templateType={editingTemplate.type}
                templateName={editingTemplate.name}
                onBack={() => openTemplateRoute(`#/templates/${editingTemplate.type.toLowerCase()}`, { type: null, name: null })}
              />
            ) : (
              <TemplateListPage
                initialTab={templateListTab}
                onTabChange={(tab) => {
                  setTemplateListTab(tab);
                  window.history.replaceState(null, '', `#/templates/${tab.toLowerCase()}`);
                }}
                onCreate={(type) => openTemplateRoute(`#/templates/${type.toLowerCase()}/new`, { type, name: null })}
                onEdit={(type, name) => openTemplateRoute(`#/templates/${type.toLowerCase()}/edit/${encodeURIComponent(name)}`, { type, name })}
              />
            )
          )}

          {/* Payroll Views */}
          {activeTab === 'payroll-command' && (
            <PayrollDashboard
              summary={payrollSummary}
              isLoading={isPayrollLoading}
              month={month}
              year={year}
              setMonth={setMonth}
              setYear={setYear}
              onRunPayroll={() => setActiveTab('run-payroll')}
              onQuickIncentive={() => setIsQuickIncentiveOpen(true)}
              onBulkIncentive={() => setIsBulkIncentiveOpen(true)}
              onNewLoan={FEATURES.loans ? () => setIsLoanWizardOpen(true) : undefined}
              onViewSalarySlips={() => setActiveTab('salary-slips')}
              onAssignStructures={() => setActiveTab('salary-structures')}
              onViewReadiness={() => setActiveTab('diagnostics')}
              recentStructureAssignments={recentStructureAssignments}
            />
          )}

          {activeTab === 'run-payroll' && (
            <RunPayrollWizard
              company={selectedCompany}
              month={month}
              year={year}
              onExecutePayroll={handleExecutePayroll}
              onViewSalarySlips={() => setActiveTab('salary-slips')}
              onRefresh={loadPayroll}
              summary={payrollSummary}
              setMonth={setMonth}
              setYear={setYear}
              onOpenSalaryStructures={() => setActiveTab('salary-structures')}
            />
          )}

          {FEATURES.loans && activeTab === 'loans' && (
            <ActiveLoansView
              onLaunchLoanWizard={() => setIsLoanWizardOpen(true)}
              company={selectedCompany}
              loans={activeLoans}
              isLoading={isPayrollLoading}
              onRefresh={loadPayroll}
            />
          )}

          {activeTab === 'salary-structures' && (
            <SalaryStructureView
              company={selectedCompany}
              onChanged={loadPayroll}
            />
          )}

          {activeTab === 'salary-slips' && (
            <SalarySlipsView
              slips={salarySlips}
              isLoading={isPayrollLoading}
              month={month}
              year={year}
              onRefresh={loadPayroll}
            />
          )}

          {activeTab === 'diagnostics' && (
            <DiagnosticsView
              healthData={healthData}
              isLoading={isHealthLoading}
              onRefresh={loadDiagnostics}
              onAutoFix={handleAutoFix}
              isFixing={isFixing}
            />
          )}

          {/* Feedback Module */}
          {(activeTab === 'staff-feedback' || activeTab === 'my-feedback' || activeTab === 'feedback-analytics') && (
            <FeedbackPortal
              viewMode={activeTab}
              selectedCompany={selectedCompany}
              userProfile={userProfile}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}
        </main>
      </div>

      {/* Modals & Slide-overs */}
      <ApplicantDetailModal
        reloadKey={drawerReloadKey}
        isOpen={!!activeApplicant}
        onClose={() => {
          setActiveApplicant(null);
          setOpenInSchedulingMode(false);
        }}
        applicant={activeApplicant}
        onShortlist={handleShortlist}
        onDecision={handleDecision}
        onRefresh={loadRecruitment}
        onResumeAttached={async (name) => {
          const fresh = await recruitmentApi.getApplicant(name);
          if (fresh.data) setActiveApplicant(fresh.data);
        }}
        isActionLoading={isActionLoading}
        initialSchedulingOpen={openInSchedulingMode}
      />

      <SelectCandidateModal
        isOpen={isSelectCandidateOpen}
        onClose={() => setIsSelectCandidateOpen(false)}
        company={selectedCompany}
        onSelect={async (applicant_id) => {
          setIsSelectCandidateOpen(false);
          try {
            const res = await recruitmentApi.getApplicant(applicant_id);
            if (res.data) {
              setActiveApplicant(res.data);
              setOpenInSchedulingMode(true);
            }
          } catch (err) {
            console.error('Failed to load candidate', err);
            addToast('Failed to load candidate profile', 'error');
          }
        }}
      />

      <QuickAddApplicantModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onAdd={handleQuickAddApplicant}
        jobOpenings={jobOpenings}
        isSubmitting={isActionLoading}
      />

      <QuickAddJobOpeningModal
        isOpen={isNewJobOpeningOpen}
        onClose={() => { setIsNewJobOpeningOpen(false); setEditingJob(null); }}
        job={editingJob}
        onAdd={handleSaveJobOpening}
        isSubmitting={isActionLoading}
        departments={departments}
      />

      <FeedbackScorecardModal
        isOpen={!!activeInterviewForFeedback}
        onClose={() => setActiveInterviewForFeedback(null)}
        interview={activeInterviewForFeedback}
        onSubmitFeedback={handleSubmitScorecard}
        isSubmitting={isActionLoading}
      />

      <QuickIncentiveModal
        isOpen={isQuickIncentiveOpen}
        onClose={() => setIsQuickIncentiveOpen(false)}
        onAddIncentive={handleQuickAddIncentive}
        isSubmitting={isActionLoading}
      />

      <BulkIncentiveModal
        isOpen={isBulkIncentiveOpen}
        onClose={() => setIsBulkIncentiveOpen(false)}
        onBulkSubmit={handleBulkIncentives}
        isSubmitting={isActionLoading}
      />

      {FEATURES.loans && <LoanApplicationWizard
        isOpen={isLoanWizardOpen}
        onClose={() => setIsLoanWizardOpen(false)}
        onCreateLoan={handleCreateLoan}
        onDisburseLoan={handleDisburseOnly}
        isSubmitting={isActionLoading}
      />}

      <StartOnboardingModal
        isOpen={isStartOnboardingOpen}
        onClose={() => setIsStartOnboardingOpen(false)}
        company={selectedCompany}
        onSuccess={() => { loadOnboarding(); setIsStartOnboardingOpen(false); }}
      />

      <StartSeparationModal
        isOpen={isStartSeparationOpen}
        onClose={() => setIsStartSeparationOpen(false)}
        company={selectedCompany}
        onSuccess={() => { loadExit(); setIsStartSeparationOpen(false); }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

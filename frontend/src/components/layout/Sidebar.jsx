import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Briefcase, CalendarCheck, 
  DollarSign, PlayCircle, Gift, CreditCard, 
  FileText, FileSignature, Banknote, LayoutTemplate, Activity, ExternalLink, Users2,
  UserPlus, UserMinus, MessageSquare, BarChart3, Heart, Layers,
  LogOut, Monitor, ChevronUp
} from 'lucide-react';
import { getCsrfToken } from '../../api/client';
import { FEATURES } from '../../config/features';

export function buildNavSections(userProfile) {
  const isHR = userProfile?.is_hr_admin || userProfile?.is_system_manager;
  const isRecruiter = userProfile?.is_recruiter || isHR;
  const isInterviewer = userProfile?.is_interviewer || isRecruiter;
  const isEmployee = userProfile?.is_employee;

  return [
    {
      title: 'Recruitment & Contracts',
      visible: isRecruiter || isInterviewer || isEmployee,
      items: [
        { id: 'recruitment-pipeline', label: 'Candidate Pipeline', icon: Users, visible: isRecruiter },
        { id: 'job-openings', label: 'Job Openings', icon: Briefcase, visible: isRecruiter },
        { id: 'my-interviews', label: 'Scheduled Interviews', icon: CalendarCheck, visible: isInterviewer },
        { id: 'offer-letters', label: isHR ? 'Offer Letters & Contracts' : 'My Offer Letter', icon: FileSignature, visible: true },
      ]
    },
    {
      title: 'Onboarding & Separation',
      visible: isHR,
      items: [
        { id: 'onboarding-pipeline', label: 'Onboarding Pipeline', icon: UserPlus, visible: isHR },
        { id: 'exit-pipeline', label: 'Exit Pipeline', icon: UserMinus, visible: isHR },
      ]
    },
    {
      title: 'Payroll & Finance',
      visible: isHR || isEmployee,
      items: [
        { id: 'payroll-command', label: 'Payroll Overview', icon: DollarSign, visible: isHR },
        { id: 'run-payroll', label: 'Run Monthly Payroll', icon: PlayCircle, visible: isHR, badge: 'Wizard' },
        { id: 'salary-structures', label: 'Salary Structures', icon: Layers, visible: isHR },
        { id: 'loans', label: 'Loans & Advances', icon: CreditCard, visible: isHR && FEATURES.loans, badge: '3-Step' },
        { id: 'salary-slips', label: isHR ? 'Salary Slips' : 'My Salary Slips', icon: Banknote, visible: isHR || isEmployee },
      ]
    },
    {
      title: 'Feedback & Culture',
      visible: true,
      items: [
        { id: 'staff-feedback', label: 'Share Feedback', icon: MessageSquare, visible: true },
        { id: 'my-feedback', label: 'My Feedback', icon: Heart, visible: true },
        { id: 'feedback-analytics', label: 'Feedback Analytics', icon: BarChart3, visible: isHR },
      ]
    },
    {
      title: 'System & Tools',
      visible: true,
      items: [
        { id: 'templates', label: 'Template Management', icon: LayoutTemplate, visible: isHR },
        { id: 'diagnostics', label: 'System Readiness', icon: Activity, visible: isHR },
      ]
    }
  ];
}

export function Sidebar({ activeTab, setActiveTab, userProfile, isMobileOpen, setIsMobileOpen }) {
  const navSections = buildNavSections(userProfile);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Close the user menu on outside click or Escape.
  useEffect(() => {
    if (!isUserMenuOpen) return undefined;
    const onDown = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setIsUserMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setIsUserMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isUserMenuOpen]);

  const canUseDesk = !!(userProfile?.is_hr_admin || userProfile?.is_system_manager);

  const handleLogout = async () => {
    try {
      await fetch('/api/method/logout', {
        method: 'POST',
        headers: { 'X-Frappe-CSRF-Token': getCsrfToken() },
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout failed', err);
    }
    window.location.href = '/login';
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={`fixed top-0 left-0 bottom-0 z-40 w-64 bg-white/80 dark:bg-slate-900/80 border-r border-gray-200 dark:border-slate-700/80 flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-200 dark:border-slate-700/80">
          <div className="h-9 w-9 rounded-lg bg-brand-red flex items-center justify-center">
            <Users2 className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col justify-center gap-0.5">
            <div className="font-bold text-brand-black dark:text-slate-50 tracking-tight leading-none text-[16px]">Standard Touch</div>
            <span className="text-micro font-bold text-brand-red leading-none">HR Operations</span>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-5 px-3 space-y-6">
          {navSections.filter(s => s.visible).map((section, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-3 text-caption font-bold text-brand-grey mb-2">
                {section.title}
              </div>

              {section.items.filter(i => i.visible).map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-150 group cursor-pointer text-left ${
                      isActive 
                        ? 'relative bg-accent-soft text-accent-hover dark:bg-accent/20 dark:text-red-100 before:absolute before:inset-y-2 before:start-0 before:w-1 before:rounded-full before:bg-accent' 
                        : 'text-brand-grey hover:text-brand-black dark:text-slate-50 hover:bg-white dark:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${
                        isActive ? 'text-accent dark:text-gray-300' : 'text-brand-grey group-hover:text-accent'
                      }`} />
                      <span className="font-semibold tracking-wide text-[15px] leading-snug break-words min-w-0" title={item.label}>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* User Info Footer — click for account menu */}
        <div ref={userMenuRef} className="relative p-4 border-t border-gray-200 dark:border-slate-700/80 bg-gray-50 dark:bg-slate-900/60">
          {isUserMenuOpen && (
            <div
              role="menu"
              className="absolute bottom-full left-3 right-3 mb-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl py-1.5 z-50"
            >
              {canUseDesk && (
                <a
                  href="/app"
                  role="menuitem"
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold text-gray-800 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  <Monitor className="h-4 w-4 text-brand-grey" />
                  Switch to Desk
                </a>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          )}
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={isUserMenuOpen}
            onClick={() => setIsUserMenuOpen((o) => !o)}
            className="w-full flex items-center gap-3 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors -m-1 p-1"
          >
            <div className="h-9 w-9 rounded-full bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 flex items-center justify-center font-bold text-sm text-brand-red">
              {userProfile?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-brand-black dark:text-slate-50 truncate">{userProfile?.full_name || 'HR Team'}</p>
              <p className="text-xs text-brand-grey truncate" title={userProfile?.email}>{userProfile?.email || 'Logged in'}</p>
            </div>
            <ChevronUp className={`h-4 w-4 text-brand-grey transition-transform ${isUserMenuOpen ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </aside>
    </>
  );
}

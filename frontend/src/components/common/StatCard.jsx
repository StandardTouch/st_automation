import React from 'react';

export function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'indigo', onClick }) {
  // Was `bg-*-950/40` + `text-*-400` on every variant — a dark-mode color
  // pair inside a light-themed app, rendering as low-contrast light-on-light
  // wherever a StatCard appeared (dashboards, recruitment overview, etc.).
  const colorMap = {
    indigo: {
      bg: 'bg-gray-100 border-gray-200 dark:bg-slate-800 dark:border-slate-700 text-brand-red',
      glow: 'hover:border-gray-400 dark:hover:border-slate-500',
    },
    emerald: {
      bg: 'bg-gray-100 border-gray-200 dark:bg-slate-800 dark:border-slate-700 text-gray-600 dark:text-slate-300',
      glow: 'hover:border-gray-400 dark:hover:border-slate-500',
    },
    amber: {
      bg: 'bg-gray-100 border-gray-200 dark:bg-slate-800 dark:border-slate-700 text-gray-600 dark:text-slate-300',
      glow: 'hover:border-gray-400 dark:hover:border-slate-500',
    },
    rose: {
      bg: 'bg-gray-100 border-gray-200 dark:bg-slate-800 dark:border-slate-700 text-gray-600 dark:text-slate-300',
      glow: 'hover:border-gray-400 dark:hover:border-slate-500',
    },
    cyan: {
      bg: 'bg-gray-100 border-gray-200 dark:bg-slate-800 dark:border-slate-700 text-gray-600 dark:text-slate-300',
      glow: 'hover:border-gray-400 dark:hover:border-slate-500',
    },
  };

  const currentTheme = colorMap[color] || colorMap.indigo;

  return (
    <div 
      onClick={onClick}
      className={`glass-panel rounded-2xl p-5 border transition-colors duration-150 ${currentTheme.glow} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-brand-grey">{title}</span>
        {Icon && (
          <div className={`p-2 rounded-xl border ${currentTheme.bg}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-heading font-bold text-brand-black dark:text-slate-50 tracking-tight">{value}</span>
        {trend && (
          <span className="text-sm font-semibold text-emerald-600">
            {trend}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-sm text-brand-grey truncate">{subtitle}</p>
      )}
    </div>
  );
}

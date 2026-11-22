import React from 'react';
import { Loader2 } from 'lucide-react';

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  icon: Icon, 
  isLoading = false, 
  disabled = false, 
  className = '', 
  ...props 
}) {
  const variantStyles = {
    primary: 'bg-accent hover:bg-accent-hover text-white shadow-md active:scale-[0.98] border border-accent/30',
    success: 'bg-emerald-700 hover:bg-emerald-600 text-white shadow-md active:scale-[0.98] border border-emerald-500/30',
    danger: 'bg-transparent border border-rose-500/60 text-rose-700 dark:text-rose-300 hover:bg-rose-600 hover:border-rose-600 hover:text-white active:scale-[0.98]',
    'danger-solid': 'bg-rose-700 hover:bg-rose-600 text-white active:scale-[0.98] border border-rose-500/30',
    warning: 'bg-amber-700 hover:bg-amber-600 text-white shadow-md active:scale-[0.98] border border-amber-500/30',
    secondary: 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-100 border border-gray-300 dark:border-slate-600 active:scale-[0.98]',
    ghost: 'text-brand-grey hover:text-brand-black dark:hover:text-slate-50 hover:bg-gray-100 dark:hover:bg-slate-800/60',
    outline: 'border border-gray-300 dark:border-slate-600 hover:border-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800/60 text-gray-700 dark:text-slate-200 hover:text-brand-black dark:hover:text-slate-50 bg-transparent',
  };

  const sizeStyles = {
    sm: 'px-3.5 py-2 min-h-9 text-sm font-semibold rounded-lg gap-1.5',
    md: 'px-4 py-2 min-h-10 text-sm font-semibold rounded-xl gap-2',
    lg: 'px-5 py-2.5 min-h-11 text-base font-bold rounded-xl gap-2.5',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none ${variantStyles[variant] || variantStyles.primary} ${sizeStyles[size] || sizeStyles.md} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

// Light / dark switch. First visit follows the operating system; a click saves
// the choice in this browser (localStorage "st-theme"). index.html applies it
// before the page paints, so there is no flash.
const isDark = () => document.documentElement.classList.contains('dark');

export function ThemeToggle() {
  const [dark, setDark] = useState(isDark);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystem = (e) => {
      let saved = null;
      try { saved = localStorage.getItem('st-theme'); } catch (err) { /* private mode */ }
      if (!saved) apply(e.matches, false, setDark);
    };
    mq.addEventListener?.('change', onSystem);
    return () => mq.removeEventListener?.('change', onSystem);
  }, []);

  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      type="button"
      onClick={() => apply(!dark, true, setDark)}
      title={label}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-brand-grey hover:border-accent hover:text-accent transition-colors"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function apply(dark, save, setDark) {
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  if (save) {
    try { localStorage.setItem('st-theme', dark ? 'dark' : 'light'); } catch (err) { /* private mode */ }
  }
  setDark(dark);
}

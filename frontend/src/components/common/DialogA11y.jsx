import React, { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Dialog keyboard behaviour: focus moves into the dialog when it opens, Tab and
// Shift+Tab stay inside it, Escape closes it (unless the dialog already handles
// Escape itself: closeOnEscape={false}), and focus returns to whatever opened it.
// Mount only while the dialog is open. Renders a `display: contents` wrapper so
// it does not change layout.
export function DialogA11y({ onClose, closeOnEscape = true, children }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement;
    const root = ref.current;
    const items = () => [...(root?.querySelectorAll(FOCUSABLE) || [])].filter((el) => {
      const st = window.getComputedStyle(el);
      return !el.hidden && st.display !== 'none' && st.visibility !== 'hidden';
    });
    // Prefer the first form field; fall back to the first control (usually the close button).
    const first = root?.querySelector('input:not([type=hidden]):not([type=checkbox]),select,textarea') || items()[0];
    first?.focus();
    // Dialog content often renders after data loads and can replace the focused
    // node; re-assert focus once if it ended up outside the dialog.
    const refocus = setTimeout(() => {
      if (root && !root.contains(document.activeElement)) (items()[0] || null)?.focus();
    }, 300);

    const onKey = (e) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = items();
      if (list.length === 0) return;
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === firstEl || !root.contains(document.activeElement))) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && (document.activeElement === lastEl || !root.contains(document.activeElement))) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(refocus);
      document.removeEventListener('keydown', onKey, true);
      if (previous && document.contains(previous) && typeof previous.focus === 'function') previous.focus();
    };
  }, [closeOnEscape]);

  return <div ref={ref} className="contents">{children}</div>;
}

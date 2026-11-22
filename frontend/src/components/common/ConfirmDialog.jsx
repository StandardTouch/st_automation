import React, { useCallback, useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

// In-app replacement for window.confirm(). A native confirm blocks the whole
// page (and test automation), cannot be styled, and cannot show details.
//
//   if (!(await confirmAction({ title, message, confirmLabel, tone: 'danger' }))) return;
//
// <ConfirmHost /> is mounted once in App. Without a host (unit tests) it
// falls back to window.confirm so callers keep working.
let openDialog = null;

export function confirmAction({ title = 'Please confirm', message = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary' } = {}) {
  if (!openDialog) {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(message || title) : false);
  }
  return new Promise((resolve) => openDialog({ title, message, confirmLabel, cancelLabel, tone, resolve }));
}

export function ConfirmHost() {
  const [state, setState] = useState(null);

  useEffect(() => {
    openDialog = setState;
    return () => { openDialog = null; };
  }, []);

  const close = useCallback((answer) => {
    setState((current) => {
      if (current) current.resolve(answer);
      return null;
    });
  }, []);

  if (!state) return null;
  return (
    <Modal isOpen onClose={() => close(false)} title={state.title} maxWidth="max-w-md">
      {state.message && (
        <p className="text-sm text-brand-grey whitespace-pre-line" data-testid="confirm-message">{state.message}</p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => close(false)} data-testid="confirm-cancel">
          {state.cancelLabel}
        </Button>
        <Button variant={state.tone === 'danger' ? 'danger-solid' : 'primary'} size="sm" onClick={() => close(true)} data-testid="confirm-ok" autoFocus>
          {state.confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

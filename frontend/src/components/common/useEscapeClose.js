import { useEffect } from 'react';

// Close a custom dialog with Escape. The shared <Modal> already does this;
// dialogs with their own markup (Start Onboarding, Initiate Separation, offer
// letter dialogs, ...) use this hook so every dialog behaves the same.
export function useEscapeClose(isOpen, onClose) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);
}

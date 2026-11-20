import React from 'react';
import { render } from '@testing-library/react';
import axe from 'axe-core';
import { ToastProvider } from '../../src/components/common/Toast';

export const renderWithToast = (ui) => render(<ToastProvider>{ui}</ToastProvider>);

// jsdom has no layout/colour engine, so colour-contrast is checked in the real
// browser run (see UX_RETEST_RESULTS.md), not here.
export async function axeViolations(container) {
  const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
  return res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

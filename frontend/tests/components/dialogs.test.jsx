import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../../src/components/common/Modal';
import { DialogA11y } from '../../src/components/common/DialogA11y';
import { axeViolations } from './helpers.jsx';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open it</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Test dialog">
        <input aria-label="First field" />
        <button>Inner action</button>
      </Modal>
    </>
  );
}

describe('Modal keyboard behaviour', () => {
  it('moves focus into the dialog, traps Tab, closes on Escape and returns focus', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open it' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Test dialog' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Tab many times: focus never leaves the dialog.
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('has no axe violations (excluding colour contrast)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open it' }));
    expect(await axeViolations(document.body)).toEqual([]);
  });
});

describe('DialogA11y wrapper (custom dialogs)', () => {
  it('closes on Escape and calls onClose once', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DialogA11y onClose={onClose}><div role="dialog" aria-label="x"><button>ok</button></div></DialogA11y>);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on Escape when the dialog handles it itself', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DialogA11y onClose={onClose} closeOnEscape={false}><button>ok</button></DialogA11y>);
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});

import { createPortal } from 'react-dom';

// Render children directly under <body>. Needed for full-screen dialogs that
// live inside an ancestor with a CSS transform/animation (e.g. <main
// className="animate-fade-in">): such an ancestor becomes the containing block
// for `position: fixed`, so the dialog would be centred in the whole page
// height instead of the visible viewport.
export function Portal({ children }) {
  return createPortal(children, document.body);
}

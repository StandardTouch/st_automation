
class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Global Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "50px", textAlign: "left", color: "red" }}>
          <h2>React App Crashed</h2>
          <pre>{this.state.error?.toString()}</pre>
          <pre style={{ marginTop: "20px" }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children; 
  }
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Date/time inputs only opened their calendar from the tiny icon; clicking the
// text part did nothing. Open the native picker on any click of the field.
document.addEventListener('click', (e) => {
  const t = e.target;
  if (t instanceof HTMLInputElement && ['date', 'datetime-local', 'time', 'month'].includes(t.type) && !t.readOnly && !t.disabled) {
    try { t.showPicker && t.showPicker(); } catch (_) { /* already open or not allowed */ }
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalErrorBoundary><App /></GlobalErrorBoundary>
  </React.StrictMode>,
);

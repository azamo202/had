import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AppProvider } from './store/AppContext.jsx';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) {
    // Log to console only (not sent anywhere in production)
    if (import.meta.env.DEV) console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui', textAlign: 'center', padding: 32, direction: 'rtl' }}>
          <div>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: 20, marginBottom: 8, color: '#1a1a2e' }}>حدث خطأ غير متوقع</h2>
            <p style={{ color: '#6b7280', marginBottom: 24 }}>يرجى تحديث الصفحة والمحاولة مجدداً.</p>
            <button
              onClick={() => window.location.reload()}
              style={{ background: '#00A092', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, fontSize: 15, cursor: 'pointer' }}
            >
              تحديث الصفحة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);

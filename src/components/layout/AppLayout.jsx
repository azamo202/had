import React, { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import GlobalSearch from './GlobalSearch.jsx';
import { useApp } from '../../store/AppContext.jsx';
import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';

function Toasts() {
  const { toasts, dispatch } = useApp();
  const ic = { success: CheckCircle2, error: XCircle, warn: AlertTriangle, info: Info };
  return (
    <div className="toast-wrap">
      {toasts.map((t) => {
        const I = ic[t.kind] || Info;
        const col = t.kind === 'error' ? 'var(--st-delayed)' : t.kind === 'warn' ? 'var(--st-attention)' : t.kind === 'info' ? 'var(--brand)' : 'var(--st-completed)';
        return (
          <div key={t.id} className={`toast ${t.kind}`} onClick={() => dispatch({ type: 'UNTOAST', id: t.id })}>
            <I size={20} style={{ color: col, flexShrink: 0 }} />
            <span style={{ fontSize: 13.5 }}>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AppLayout() {
  const { user, loadingDb } = useApp();
  const location = useLocation();
  const [search, setSearch] = useState(false);

  // Show a full-screen loader while the auth session is being resolved
  if (loadingDb && !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <Loader2 size={40} className="spin" style={{ color: 'var(--brand)' }} />
          <span style={{ color: 'var(--text-3)', fontSize: 14 }}>جاري التحقق من الجلسة...</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-col">
        <Topbar onSearch={() => setSearch(true)} />
        <div className="pattern-strip" />
        <main key={location.pathname}><Outlet /></main>
      </div>
      {search && <GlobalSearch onClose={() => setSearch(false)} />}
      <Toasts />
    </div>
  );
}

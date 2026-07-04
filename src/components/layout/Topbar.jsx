import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Search, Bell, Sun, Moon, Menu, LogOut, ChevronDown, CheckCheck, Home } from 'lucide-react';
import { useApp } from '../../store/AppContext.jsx';
import { ROLES, st } from '../../lib/status.js';
import { Avatar } from '../ui/Primitives.jsx';

const TITLES = {
  '/': 'لوحة المعلومات', '/framework': 'الإطار الاستراتيجي', '/strategic': 'الخطة الاستراتيجية', '/operational': 'الخطة التشغيلية',
  '/objectives': 'الأهداف الاستراتيجية', '/initiatives': 'المبادرات', '/projects': 'المشاريع التشغيلية',
  '/kpis': 'مؤشرات الأداء', '/followup': 'المتابعة الشهرية', '/challenges': 'التحديات',
  '/evidence': 'الشواهد', '/reports': 'التقارير', '/assistant': 'المساعد الذكي',
  '/notifications': 'الإشعارات', '/users': 'إدارة المستخدمين', '/settings': 'الإعدادات',
};

export default function Topbar({ onSearch }) {
  const { theme, dispatch, user, db, toast } = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const ref = useRef();
  const unread = db.notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setNotifOpen(false); setUserOpen(false); } };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    const k = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); onSearch(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onSearch]);

  const title = TITLES[loc.pathname] || 'منصة إدارة ومتابعة الخطة الاستراتيجية والتشغيلية';

  return (
    <header className="topbar">
      <button className="icon-btn" style={{ display: 'none' }} id="mnav" onClick={() => dispatch({ type: 'MOBILE_NAV', open: true })}><Menu size={19} /></button>
      <style>{`@media(max-width:900px){#mnav{display:grid !important}}`}</style>

      <div style={{ minWidth: 0 }}>
        <div className="crumbs"><Link to="/"><Home size={13} /></Link><span className="sep">/</span><span style={{ color: 'var(--text-2)' }}>{title}</span></div>
      </div>

      <div className="topbar-search" onClick={onSearch} style={{ marginInlineStart: 'auto' }}>
        <Search size={17} />
        <span style={{ flex: 1, textAlign: 'start' }}>بحث سريع…</span>
        <span className="topbar-kbd">Ctrl K</span>
      </div>

      <button className="icon-btn" onClick={() => dispatch({ type: 'THEME' })} aria-label="تبديل المظهر">
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      <div ref={ref} style={{ display: 'flex', gap: 14, position: 'relative' }}>
        <button className="icon-btn" onClick={() => { setNotifOpen((o) => !o); setUserOpen(false); }} aria-label="الإشعارات">
          <Bell size={18} />
          {unread > 0 && <span className="dot-badge" />}
        </button>
        {notifOpen && (
          <div className="card" style={{ position: 'absolute', top: 50, insetInlineStart: 0, width: 340, boxShadow: 'var(--shadow-lg)', zIndex: 60, padding: 0, overflow: 'hidden' }}>
            <div className="row between" style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
              <b style={{ fontSize: 14 }}>الإشعارات</b>
              <button className="link" style={{ fontSize: 12, background: 'none', border: 'none' }} onClick={() => { dispatch({ type: 'NOTIF_READ' }); toast('تم تعليم الكل كمقروء'); }}>
                <CheckCheck size={13} style={{ verticalAlign: 'middle' }} /> تعليم الكل
              </button>
            </div>
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              {db.notifications.slice(0, 8).map((n) => {
                const s = st(n.tone);
                return (
                  <div key={n.id} onClick={() => { dispatch({ type: 'NOTIF_READ', id: n.id }); setNotifOpen(false); nav('/notifications'); }}
                    style={{ display: 'flex', gap: 11, padding: '11px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: n.read ? 'transparent' : 'var(--brand-tint)' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 99, background: s.color, marginTop: 5, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</div>
                      <div className="muted" style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.entity}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{n.time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="btn btn-soft" style={{ margin: 12, width: 'calc(100% - 24px)' }} onClick={() => { setNotifOpen(false); nav('/notifications'); }}>عرض جميع الإشعارات</button>
          </div>
        )}

        <button className="user-chip" onClick={() => { setUserOpen((o) => !o); setNotifOpen(false); }}>
          <Avatar text={user?.avatar} name={user?.name} sm />
          <div style={{ textAlign: 'start', lineHeight: 1.2 }} className="hide-sm">
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>{user?.name}</div>
            <div className="muted" style={{ fontSize: 10.5 }}>{ROLES[user?.role]?.label}</div>
          </div>
          <ChevronDown size={15} className="muted" />
        </button>
        {userOpen && (
          <div className="card" style={{ position: 'absolute', top: 50, insetInlineStart: 0, width: 220, boxShadow: 'var(--shadow-lg)', zIndex: 60, padding: 8 }}>
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name}</div>
              <div className="muted" style={{ fontSize: 11 }}>{user?.email}</div>
            </div>
            <button className="nav-item" style={{ color: 'var(--text)', width: '100%' }} onClick={() => { setUserOpen(false); nav('/settings'); }}>الإعدادات</button>
            <button className="nav-item" style={{ color: 'var(--st-delayed)', width: '100%' }} onClick={() => { dispatch({ type: 'LOGOUT' }); nav('/login'); }}>
              <LogOut size={17} /> تسجيل الخروج
            </button>
          </div>
        )}
      </div>
      <style>{`@media(max-width:640px){.hide-sm{display:none}}`}</style>
    </header>
  );
}

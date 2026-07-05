import React from 'react';
import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { NAV } from './nav.js';
import { useApp } from '../../store/AppContext.jsx';
import { can } from '../../lib/status.js';

export default function Sidebar() {
  const { collapsed, dispatch, user, db, mobileNav } = useApp();
  const unread = db.notifications.filter((n) => !n.read).length;

  return (
    <>
      <div className={`sidebar-backdrop ${mobileNav ? 'show' : ''}`} onClick={() => dispatch({ type: 'MOBILE_NAV', open: false })} />
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileNav ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand" style={collapsed ? { padding: '16px 8px', justifyContent: 'center' } : {}}>
          {!collapsed && <img src="/logo.png" alt="هدية" />}
          <button className="icon-btn" style={{ marginInlineStart: collapsed ? 0 : 'auto', width: 32, height: 32, background: 'transparent', border: 'none', color: '#9fcfc7', flexShrink: 0 }}
            onClick={() => dispatch({ type: 'COLLAPSE' })} aria-label="طي القائمة">
            {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <div className="sidebar-scroll">
          {NAV.map((grp, idx) => {
            const items = grp.items.filter((it) => !it.admin || can.admin(user?.role));
            if (!items.length) return null;
            return (
              <div key={grp.section || idx}>
                {grp.section && <div className="nav-section-t">{grp.section}</div>}
                {items.map((it) => (
                  <NavLink key={it.to} to={it.to} end={it.end}
                    onClick={() => dispatch({ type: 'MOBILE_NAV', open: false })}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title={it.label}>
                    <it.icon size={19} />
                    <span className="nav-label">{it.label}</span>
                    {it.badgeKey === 'notif' && unread > 0 && <span className="nav-badge">{unread}</span>}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </div>
        {!collapsed && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,.08)', color: 'rgba(207,233,228,.55)', fontSize: 11 }}>
            الإصدار 1.0 — نموذج أولي تفاعلي
          </div>
        )}
      </aside>
    </>
  );
}

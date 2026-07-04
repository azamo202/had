import React from 'react';
import { st, fmtPct } from '../../lib/status.js';

export function StatusPill({ status, sm }) {
  const s = st(status);
  return (
    <span className={`pill st-${status}`} style={sm ? { padding: '2px 9px', fontSize: 11.5 } : undefined}>
      <span className="pdot" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

export function Progress({ value = 0, color, thin }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`prog ${thin ? 'thin' : ''}`}>
      <span style={{ width: v + '%', background: color }} />
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, delta, deltaTone = 'up', color = 'var(--brand)', bg = 'var(--brand-tint)', onClick }) {
  return (
    <div className={`card stat card-hover ${onClick ? '' : ''}`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="glow" style={{ background: color }} />
      <div className="stat-top">
        <div className="ic" style={{ background: bg, color }}>{Icon && <Icon size={20} />}</div>
        {delta != null && (
          <span className="delta" style={{
            color: deltaTone === 'up' ? 'var(--st-completed)' : deltaTone === 'down' ? 'var(--st-delayed)' : 'var(--text-3)',
            background: deltaTone === 'up' ? 'color-mix(in srgb,var(--st-completed) 12%,transparent)' : deltaTone === 'down' ? 'color-mix(in srgb,var(--st-delayed) 12%,transparent)' : 'var(--surface-2)',
          }}>{delta}</span>
        )}
      </div>
      <div className="val">{value}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

export function Skeleton({ w = '100%', h = 16, r = 8, style }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="empty">
      {Icon && <div className="ic"><Icon size={28} /></div>}
      <h4>{title}</h4>
      {hint && <p style={{ margin: '2px 0 14px' }}>{hint}</p>}
      {action}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t.key} className={`tab ${active === t.key ? 'active' : ''}`} onClick={() => onChange(t.key)}>
          {t.icon}{t.label}{t.count != null && <span className="tag" style={{ marginInlineStart: 6 }}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Chips({ options, value, onChange, all = true }) {
  return (
    <div className="chips">
      {all && <button className={`chip ${!value ? 'on' : ''}`} onClick={() => onChange(null)}>الكل</button>}
      {options.map((o) => (
        <button key={o.value} className={`chip ${value === o.value ? 'on' : ''}`} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Avatar({ name, text, sm }) {
  const t = text || (name ? name.replace(/^(أ\.|م\.|د\.)\s*/, '').split(' ').slice(0, 2).map((w) => w[0]).join(' ') : '؟');
  return <div className={`avatar ${sm ? 'sm' : ''}`}>{t}</div>;
}

export function Ring({ value = 0, size = 120, stroke = 11, color = 'var(--brand)', label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (v / 100) * c}
          style={{ transition: 'stroke-dashoffset .8s var(--ease)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: size * 0.22, fontWeight: 600, lineHeight: 1 }}>{label ?? fmtPct(value)}</div>
          {sub && <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="muted" style={{ fontSize: 11.5 }}>{hint}</span>}
    </div>
  );
}

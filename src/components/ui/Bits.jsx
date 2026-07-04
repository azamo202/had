import React from 'react';
import { Search, ChevronRight, ChevronLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {children && <div className="row wrap" style={{ gap: 10 }}>{children}</div>}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'بحث…' }) {
  return (
    <div style={{ position: 'relative', minWidth: 220, flex: '1 1 220px' }}>
      <Search size={16} style={{ position: 'absolute', insetInlineStart: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
      <input className="inp" style={{ paddingInlineStart: 36 }} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Pager({ page, pages, setPage, total }) {
  if (pages <= 1) return <div className="muted" style={{ fontSize: 12.5, padding: '10px 2px' }}>{total} نتيجة</div>;
  return (
    <div className="row between" style={{ padding: '12px 4px 2px' }}>
      <span className="muted" style={{ fontSize: 12.5 }}>صفحة {page} من {pages} · {total} نتيجة</span>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronRight size={15} /></button>
        <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronLeft size={15} /></button>
      </div>
    </div>
  );
}

export function TrendIcon({ trend, size = 15 }) {
  if (trend === 'up') return <TrendingUp size={size} className="trend-up" />;
  if (trend === 'down') return <TrendingDown size={size} className="trend-down" />;
  return <Minus size={size} className="trend-flat" />;
}

export function Meta({ label, value }) {
  return (
    <div>
      <div className="mini-label">{label}</div>
      <div style={{ fontSize: 14, marginTop: 3, fontWeight: 500 }}>{value ?? '—'}</div>
    </div>
  );
}

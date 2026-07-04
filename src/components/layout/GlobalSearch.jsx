import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Target, Rocket, FolderKanban, Gauge, Building2, Users, FileCheck2, TriangleAlert, CornerDownLeft } from 'lucide-react';
import { useApp } from '../../store/AppContext.jsx';

const TYPES = {
  goal: { icon: Target, label: 'هدف', to: (x) => `/objectives?goal=${x.id}` },
  initiative: { icon: Rocket, label: 'مبادرة', to: (x) => `/initiatives?id=${x.id}` },
  project: { icon: FolderKanban, label: 'مشروع', to: (x) => `/projects?id=${x.id}` },
  kpi: { icon: Gauge, label: 'مؤشر', to: (x) => `/kpis?id=${x.id}` },
  department: { icon: Building2, label: 'إدارة', to: () => `/operational` },
  user: { icon: Users, label: 'مستخدم', to: () => `/users` },
  evidence: { icon: FileCheck2, label: 'شاهد', to: () => `/evidence` },
  challenge: { icon: TriangleAlert, label: 'تحدٍّ', to: () => `/challenges` },
};

export default function GlobalSearch({ onClose }) {
  const { db } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const index = useMemo(() => {
    const idx = [];
    db.goals.forEach((x) => idx.push({ type: 'goal', id: x.id, title: x.name, sub: `الهدف ${x.index}`, raw: x }));
    db.initiatives.forEach((x) => idx.push({ type: 'initiative', id: x.id, title: x.name, sub: x.dept, raw: x }));
    db.projects.forEach((x) => idx.push({ type: 'project', id: x.id, title: x.name, sub: x.dept, raw: x }));
    db.kpis.forEach((x) => idx.push({ type: 'kpi', id: x.id, title: x.name, sub: x.type, raw: x }));
    db.departments.forEach((x) => idx.push({ type: 'department', id: x.id, title: x.name, sub: `${x.projectCount} مشروع`, raw: x }));
    db.users.forEach((x) => idx.push({ type: 'user', id: x.id, title: x.name, sub: x.email, raw: x }));
    db.evidences.forEach((x) => idx.push({ type: 'evidence', id: x.id, title: x.title, sub: x.type, raw: x }));
    db.challenges.forEach((x) => idx.push({ type: 'challenge', id: x.id, title: x.text, sub: x.dept, raw: x }));
    return idx;
  }, [db]);

  const results = useMemo(() => {
    if (!q.trim()) return [];
    const t = q.trim();
    return index.filter((r) => (r.title || '').includes(t) || (r.sub || '').includes(t)).slice(0, 40);
  }, [q, index]);

  const go = (r) => { nav(TYPES[r.type].to(r.raw)); onClose(); };

  return (
    <div className="overlay" style={{ alignItems: 'flex-start', paddingTop: '10vh' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <Search size={20} className="muted" />
          <input ref={ref} className="inp" style={{ border: 'none', padding: 0, fontSize: 16 }} placeholder="ابحث في الأهداف والمبادرات والمشاريع والمؤشرات والشواهد…"
            value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="topbar-kbd">Esc</span>
        </div>
        <div style={{ maxHeight: '52vh', overflow: 'auto', padding: 8 }}>
          {!q.trim() && <div className="empty" style={{ padding: 32 }}><div className="muted">ابدأ الكتابة للبحث الفوري عبر المنصة بالكامل</div></div>}
          {q.trim() && !results.length && <div className="empty" style={{ padding: 32 }}><div className="muted">لا توجد نتائج مطابقة لـ «{q}»</div></div>}
          {results.map((r) => {
            const T = TYPES[r.type];
            return (
              <button key={r.type + r.id} onClick={() => go(r)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, border: 'none', background: 'transparent', textAlign: 'start', color: 'var(--text)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brand-tint)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--brand)', flexShrink: 0 }}><T.icon size={17} /></span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{r.sub}</div>
                </span>
                <span className="tag">{T.label}</span>
                <CornerDownLeft size={14} className="muted" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, Target, CheckCircle2, FolderKanban, AlertTriangle,
  Clock3, ShieldAlert, TrendingUp, ArrowUpRight, FileWarning, Gauge
} from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { st, fmtPct, fmt } from '../lib/status.js';
import { overallStats, makeIndex } from '../lib/select.js';
import { PageHead } from '../components/ui/Bits.jsx';
import { StatCard, Progress, StatusPill } from '../components/ui/Primitives.jsx';

export default function Dashboard() {
  const { db, user } = useApp();
  const nav = useNavigate();
  const s = useMemo(() => overallStats(db), [db]);
  const idx = useMemo(() => makeIndex(db), [db]);

  const topDepartments = useMemo(
    () => [...db.departments].filter((d) => d.projectCount > 0).sort((a, b) => b.progress - a.progress).slice(0, 5),
    [db],
  );

  const importantChallenges = useMemo(() => {
    return (db.challenges || []).filter((c) => c.isImportant === true);
  }, [db]);

  return (
    <div className="page fade-in">
      <PageHead title={`مرحباً، ${user?.name || ''}`} sub="منصة إدارة ومتابعة الخطة الاستراتيجية والتشغيلية">
        <span className="badge" style={{ background: 'var(--brand-tint)', color: 'var(--brand-deep)', border: '1px solid var(--brand-100)' }}>
          <TrendingUp size={14} /> النظرة التنفيذية
        </span>
      </PageHead>

      {/* Top Stats Cards */}
      <div className="stat-grid" style={{ marginBottom: 18, gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <StatCard icon={ClipboardList} label="إنجاز الخطة التشغيلية" value={fmtPct(s.operational)} color="var(--brand-deep)" bg="color-mix(in srgb,var(--brand-deep) 12%,transparent)" />
        <StatCard icon={CheckCircle2} label="مشاريع مكتملة" value={fmt(s.projDone)} color="var(--st-completed)" bg="color-mix(in srgb,var(--st-completed) 13%,transparent)" />
        <StatCard icon={FolderKanban} label="مشاريع تحت التنفيذ" value={fmt(s.projInProgress)} color="var(--st-ontrack)" bg="color-mix(in srgb,var(--st-ontrack) 13%,transparent)" />
        <StatCard icon={AlertTriangle} label="مشاريع متعثرة" value={fmt(s.projDelayed)} color="var(--st-delayed)" bg="color-mix(in srgb,var(--st-delayed) 13%,transparent)" />
        <StatCard icon={Clock3} label="مشاريع لم تُحدّث" value={fmt(s.projNotStarted)} color="var(--st-attention)" bg="color-mix(in srgb,var(--st-attention) 13%,transparent)" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 18 }}>
        
        {/* Strategic Goals Progress */}
        <div className="card pad">
          <div className="card-head">
            <h3 className="row" style={{ gap: 8 }}><Target size={17} style={{ color: 'var(--brand)' }} />نسبة إنجاز الأهداف الاستراتيجية</h3>
          </div>
          <div style={{ display: 'grid', gap: 14 }}>
            {db.goals.map((g) => (
              <div key={g.id}>
                <div className="row between" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{g.name}</span>
                  <b style={{ fontSize: 13, color: st(g.status).color, flexShrink: 0, marginInlineStart: 12 }}>{fmtPct(g.progress)}</b>
                </div>
                <Progress value={g.progress} color={st(g.status).color} thin />
              </div>
            ))}
            {db.goals.length === 0 && <p className="muted" style={{ fontSize: 12.5, textAlign: 'center' }}>لا توجد أهداف مسجلة</p>}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 18, gridTemplateRows: 'auto 1fr' }}>
          
          {/* Top Departments */}
          <div className="card pad">
            <div className="card-head">
              <h3 className="row" style={{ gap: 8 }}><TrendingUp size={17} style={{ color: 'var(--brand)' }} />أكثر الإدارات إنجازاً</h3>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {topDepartments.map((d, n) => (
                <div key={d.id} className="row" style={{ gap: 12 }}>
                  <span className="mini-label" style={{ width: 18, textAlign: 'center' }}>{n + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row between" style={{ marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{d.name}</span>
                      <b style={{ fontSize: 13, color: st(d.status).color }}>{fmtPct(d.progress)}</b>
                    </div>
                    <Progress value={d.progress} color={st(d.status).color} thin />
                  </div>
                </div>
              ))}
              {topDepartments.length === 0 && <p className="muted" style={{ fontSize: 12.5, textAlign: 'center' }}>لا توجد بيانات للإدارات</p>}
            </div>
          </div>

          {/* Top Important Challenges */}
          <div className="card pad">
            <div className="card-head">
              <h3 className="row" style={{ gap: 8 }}><ShieldAlert size={17} style={{ color: 'var(--st-delayed)' }} />التحديات الحرجة</h3>
            </div>
            <div style={{ display: 'grid', gap: 10, maxHeight: 350, overflowY: 'auto' }}>
              {importantChallenges.map((c) => {
                const p = idx.p[c.projectId];
                return (
                  <div key={c.id} style={{ border: '1px solid var(--border)', padding: 12, borderRadius: 10 }}>
                    <div className="row between" style={{ marginBottom: 6 }}>
                      <b style={{ fontSize: 13, color: 'var(--brand)' }}>{p?.name || '—'}</b>
                    </div>
                    <div className="muted" style={{ fontSize: 11.5, marginBottom: 8 }}>{p?.dept || c.dept || '—'}</div>
                    <p style={{ fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>
                      <span className="muted">التحدي: </span> {c.text}
                    </p>
                    {c.support && (
                      <p style={{ fontSize: 12.5, margin: '6px 0 0', lineHeight: 1.5 }}>
                        <span className="muted" style={{ color: 'var(--st-attention)' }}>الدعم المطلوب: </span> {c.support}
                      </p>
                    )}
                  </div>
                );
              })}
              {importantChallenges.length === 0 && (
                <div className="empty" style={{ padding: 20 }}>
                  <div className="muted" style={{ fontSize: 12.5 }}>لا توجد تحديات مصنفة كـ "مهمة" حالياً</div>
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}

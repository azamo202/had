import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import {
  FileBarChart, Printer, FileSpreadsheet, FileText, Download, CheckCircle2, XCircle,
  Clock, Target, Building2, Rocket, FolderKanban, Gauge, TriangleAlert, FileCheck2,
} from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { st, fmtPct, fmt, fmtCurrency, can, APPROVAL_STATUS, fmtVal } from '../lib/status.js';
import { overallStats, makeIndex } from '../lib/select.js';
import { PageHead } from '../components/ui/Bits.jsx';
import { StatCard, EmptyState, Avatar } from '../components/ui/Primitives.jsx';
import { Confirm } from '../components/ui/Overlays.jsx';

const REPORTS = [
  { key: 'monthly', label: 'التقرير التنفيذي الشهري', icon: FileText, desc: 'ملخص شامل لأداء الخطة خلال الشهر' },
  { key: 'dept', label: 'تقرير أداء الإدارات', icon: Building2, desc: 'إنجاز كل إدارة ومشاريعها' },
  { key: 'goal', label: 'تقرير الأهداف الاستراتيجية', icon: Target, desc: 'تقدم الأهداف الثمانية' },
  { key: 'initiative', label: 'تقرير المبادرات', icon: Rocket, desc: 'حالة المبادرات ومشاريعها' },
  { key: 'project', label: 'تقرير المشاريع', icon: FolderKanban, desc: 'قائمة المشاريع وحالتها' },
  { key: 'delayed', label: 'تقرير المشاريع المتعثرة', icon: TriangleAlert, desc: 'المشاريع التي تحتاج تدخلاً' },
  { key: 'kpi', label: 'تقرير مؤشرات الأداء', icon: Gauge, desc: 'تحقق المؤشرات مقابل المستهدف' },
  { key: 'evidence', label: 'تقرير الشواهد', icon: FileCheck2, desc: 'حالة الشواهد ومسار اعتمادها' },
  { key: 'challenges', label: 'تقرير التحديات', icon: TriangleAlert, desc: 'التحديات المرصودة ومعالجتها' },
];

export default function Reports() {
  const { db, user } = useApp();
  const nav = useNavigate();
  const [active, setActive] = useState('monthly');
  const s = useMemo(() => overallStats(db), [db]);
  const isApprover = can.approve(user?.role);

  return (
    <div className="page fade-in">
      <PageHead title="التقارير" sub="توليد وطباعة وتصدير تقارير الأداء الاستراتيجي والتشغيلي">
        <button className="btn btn-ghost btn-sm" onClick={() => window.print()}><Printer size={15} /> طباعة</button>
        <button className="btn btn-ghost btn-sm" onClick={() => exportCsv(db, active)}><FileSpreadsheet size={15} /> تصدير Excel</button>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}><Download size={15} /> تصدير PDF</button>
      </PageHead>
      <div className="grid" style={{ gridTemplateColumns: '300px 1fr', alignItems: 'start', gap: 18 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          {REPORTS.map((r) => (
            <button key={r.key} className="card card-hover" style={{ padding: 13, textAlign: 'start', display: 'flex', gap: 11, alignItems: 'center', border: active === r.key ? '1.5px solid var(--brand)' : '1px solid var(--border)', background: active === r.key ? 'var(--brand-tint)' : 'var(--surface)' }} onClick={() => setActive(r.key)}>
              <span className="ic" style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: active === r.key ? 'var(--brand)' : 'var(--surface-2)', color: active === r.key ? '#fff' : 'var(--brand)', flexShrink: 0 }}><r.icon size={17} /></span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500 }}>{r.label}</span>
                <span className="muted" style={{ fontSize: 11.5 }}>{r.desc}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="card pad" id="report-body">
          <ReportView which={active} db={db} s={s} />
        </div>
      </div>
    </div>
  );
}

function ReportView({ which, db, s }) {
  const idx = useMemo(() => makeIndex(db), [db]);
  const head = (title, sub) => (
    <div style={{ borderBottom: '2px solid var(--brand)', paddingBottom: 14, marginBottom: 18 }}>
      <div className="row between">
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--brand-deep)' }}>{title}</h2>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{sub}</div>
        </div>
        <div style={{ textAlign: 'end' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--brand)' }}>جمعية هدية</div>
          <div className="muted" style={{ fontSize: 11 }}>منصة التخطيط · نموذج أولي 1.0</div>
        </div>
      </div>
    </div>
  );

  if (which === 'monthly') return (
    <div>
      {head('التقرير التنفيذي الشهري', 'ملخص أداء الخطة الاستراتيجية والتشغيلية')}
      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <StatCard icon={Target} label="التقدم الاستراتيجي" value={fmtPct(s.strategic)} />
        <StatCard icon={FolderKanban} label="التقدم التشغيلي" value={fmtPct(s.operational)} />
        <StatCard icon={CheckCircle2} label="مشاريع مكتملة" value={`${s.projDone}/${s.projTotal}`} />
        <StatCard icon={TriangleAlert} label="مشاريع متعثرة" value={s.projDelayed} />
      </div>
      <SimpleTable
        cols={['الهدف', 'التقدم', 'الحالة', 'المشاريع', 'المؤشرات']}
        rows={db.goals.map((g) => [g.name, fmtPct(g.progress), st(g.status).label, g.projectCount, g.kpiCount])}
      />
    </div>
  );

  if (which === 'dept') return (<div>{head('تقرير أداء الإدارات', 'إنجاز الإدارات ومشاريعها')}
    <SimpleTable cols={['الإدارة', 'المدير', 'المشاريع', 'التقدم', 'الحالة']}
      rows={db.departments.filter((d) => d.projectCount > 0).sort((a, b) => b.progress - a.progress).map((d) => [d.name, d.manager, d.projectCount, fmtPct(d.progress), st(d.status).label])} /></div>);

  if (which === 'goal') return (<div>{head('تقرير الأهداف الاستراتيجية', 'تقدم الأهداف الثمانية')}
    <SimpleTable cols={['#', 'الهدف', 'الموازنة', 'التقدم', 'الحالة']}
      rows={db.goals.map((g) => [g.index, g.name, fmtCurrency(g.budget), fmtPct(g.progress), st(g.status).label])} /></div>);

  if (which === 'initiative') return (<div>{head('تقرير المبادرات', 'حالة المبادرات ومشاريعها')}
    <SimpleTable cols={['المبادرة', 'الإدارة', 'المشاريع', 'التقدم', 'الحالة']}
      rows={db.initiatives.map((i) => [i.name, i.dept, i.projectCount, fmtPct(i.progress), st(i.status).label])} /></div>);

  if (which === 'project') return (<div>{head('تقرير المشاريع', 'قائمة المشاريع التشغيلية')}
    <SimpleTable cols={['المشروع', 'الإدارة', 'المسؤول', 'التقدم', 'الحالة']}
      rows={db.projects.map((p) => [p.name, p.dept, p.owner, fmtPct(p.progress), st(p.status).label])} /></div>);

  if (which === 'delayed') return (<div>{head('تقرير المشاريع المتعثرة', 'مشاريع تحتاج تدخلاً عاجلاً')}
    <SimpleTable cols={['المشروع', 'الإدارة', 'المسؤول', 'التقدم', 'الحالة']}
      rows={db.projects.filter((p) => ['delayed', 'attention'].includes(p.status)).sort((a, b) => a.progress - b.progress).map((p) => [p.name, p.dept, p.owner, fmtPct(p.progress), st(p.status).label])} /></div>);

  if (which === 'kpi') return (<div>{head('تقرير مؤشرات الأداء', 'تحقق المؤشرات مقابل المستهدف')}
    <SimpleTable cols={['المؤشر', 'النوع', 'المستهدف', 'المُنجز', 'التحقق', 'الحالة']}
      rows={db.kpis.map((k) => [k.name, k.type, k.target, fmtVal(k.achievedNum, k.targetPct), fmtPct(k.achievement), st(k.status).label])} /></div>);

  if (which === 'evidence') return (<div>{head('تقرير الشواهد', 'حالة الشواهد ومسار اعتمادها')}
    <SimpleTable cols={['الشاهد', 'النوع', 'المشروع', 'المالك', 'الحالة']}
      rows={db.evidences.map((e) => [e.title, e.type, idx.p[e.projectId]?.name || '—', e.owner, st({ approved: 'completed', under_review: 'attention', uploaded: 'on_track', rejected: 'delayed', missing: 'not_started' }[e.status]).label])} /></div>);

  if (which === 'challenges') return (<div>{head('تقرير التحديات', 'التحديات المرصودة ومعالجتها')}
    <SimpleTable cols={['التحدي', 'المشروع', 'الإدارة', 'الخطورة', 'الحالة']}
      rows={db.challenges.map((c) => [c.text, idx.p[c.projectId]?.name || '—', c.dept, { high: 'عالية', medium: 'متوسطة', low: 'منخفضة' }[c.severity], { open: 'مفتوح', in_progress: 'قيد المعالجة', resolved: 'مُعالج' }[c.status]])} /></div>);

  return <EmptyState icon={FileBarChart} title="اختر نوع تقرير" />;
}

function SimpleTable({ cols, rows }) {
  return (
    <div className="tbl-wrap" style={{ border: '1px solid var(--border)' }}>
      <table className="tbl">
        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((cell, j) => <td key={j} style={{ fontSize: 12.5, maxWidth: 300 }}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function exportCsv(db, which) {
  const map = {
    monthly: [['الهدف', 'التقدم', 'الحالة'], db.goals.map((g) => [g.name, g.progress, st(g.status).label])],
    dept: [['الإدارة', 'المدير', 'التقدم'], db.departments.map((d) => [d.name, d.manager, d.progress])],
    goal: [['الهدف', 'الموازنة', 'التقدم'], db.goals.map((g) => [g.name, g.budget, g.progress])],
    initiative: [['المبادرة', 'الإدارة', 'التقدم'], db.initiatives.map((i) => [i.name, i.dept, i.progress])],
    project: [['المشروع', 'الإدارة', 'التقدم', 'الحالة'], db.projects.map((p) => [p.name, p.dept, p.progress, st(p.status).label])],
    delayed: [['المشروع', 'التقدم'], db.projects.filter((p) => ['delayed', 'attention'].includes(p.status)).map((p) => [p.name, p.progress])],
    kpi: [['المؤشر', 'المستهدف', 'المُنجز', 'التحقق'], db.kpis.map((k) => [k.name, k.target, k.achievedNum, k.achievement])],
    evidence: [['الشاهد', 'النوع', 'الحالة'], db.evidences.map((e) => [e.title, e.type, e.status])],
    challenges: [['التحدي', 'الخطورة', 'الحالة'], db.challenges.map((c) => [c.text, c.severity, c.status])],
  };
  const [cols, rows] = map[which] || map.monthly;
  const csv = [cols, ...rows].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `تقرير_${which}.csv`; a.click();
  URL.revokeObjectURL(url);
}

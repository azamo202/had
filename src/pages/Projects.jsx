import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FolderKanban, ArrowRight, Gauge, Rocket, Target, User2, Building2,
  Wallet, CalendarCheck, TriangleAlert, FileCheck2, ArrowUpDown,
} from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { st, fmtPct, fmtCurrency, fmt } from '../lib/status.js';
import { makeIndex, useTable, scopeProjects } from '../lib/select.js';
import { PageHead, SearchBox, Pager, Meta, TrendIcon } from '../components/ui/Bits.jsx';
import { Progress, StatusPill, Avatar, Chips, EmptyState, StatCard, Ring } from '../components/ui/Primitives.jsx';
import { MiniSpark, PALETTE } from '../components/charts/Charts.jsx';

const STATUS_OPTS = [
  { value: 'completed', label: 'مكتمل' }, { value: 'on_track', label: 'على المسار' },
  { value: 'attention', label: 'يحتاج انتباه' }, { value: 'delayed', label: 'متعثر' }, { value: 'not_started', label: 'لم يبدأ' },
];

export default function Projects() {
  const { db, user } = useApp();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const id = sp.get('id');
  const idx = useMemo(() => makeIndex(db), [db]);
  if (id && idx.p[id]) return <Detail p={idx.p[id]} db={db} idx={idx} nav={nav} />;
  return <List db={db} user={user} nav={nav} />;
}

function List({ db, user, nav }) {
  const [statusF, setStatusF] = useState(null);
  const base = useMemo(() => scopeProjects(db, user), [db, user]);
  const rows = useMemo(() => (statusF ? base.filter((p) => p.status === statusF) : base), [base, statusF]);
  const tbl = useTable(rows, { pageSize: 14, initialSort: { key: 'progress', dir: 'desc' } });

  return (
    <div className="page fade-in">
      <PageHead title="المشاريع التشغيلية" sub={`${base.length} مشروع تشغيلي عبر الإدارات`} />
      <div className="card pad" style={{ marginBottom: 14, display: 'grid', gap: 12 }}>
        <SearchBox value={tbl.q} onChange={tbl.setQ} placeholder="بحث في المشاريع…" />
        <Chips options={STATUS_OPTS} value={statusF} onChange={setStatusF} />
      </div>
      {tbl.slice.length === 0 ? <EmptyState icon={FolderKanban} title="لا توجد مشاريع مطابقة" /> : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <th>المشروع</th><th>الإدارة</th><th>المسؤول</th>
              <th className="th-sort" onClick={() => tbl.toggleSort('progress')}>الإنجاز <ArrowUpDown size={12} /></th>
              <th>الحالة</th><th>المؤشرات</th>
            </tr></thead>
            <tbody>
              {tbl.slice.map((p) => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => nav('/projects?id=' + p.id)}>
                  <td style={{ maxWidth: 300 }}><span style={{ fontWeight: 500, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span></td>
                  <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{p.dept}</td>
                  <td><span className="row" style={{ gap: 7 }}><Avatar name={p.owner} sm /><span style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{p.owner}</span></span></td>
                  <td style={{ minWidth: 100 }}><Ring value={p.progress} size={44} color={st(p.status).color} label={<b style={{fontSize: 12, color: st(p.status).color}}>{fmtPct(p.progress)}</b>} /></td>
                  <td><StatusPill status={p.status} sm /></td>
                  <td><span className="tag">{p.kpiCount}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager {...tbl} />
    </div>
  );
}

function Detail({ p, db, idx, nav }) {
  const init = idx.i[p.initiativeId];
  const goal = idx.g[p.goalId];
  const kpis = db.kpis.filter((k) => k.projectId === p.id);
  const challenges = db.challenges.filter((c) => c.projectId === p.id);
  const evidence = db.evidences.filter((e) => e.projectId === p.id);

  return (
    <div className="page fade-in">
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => nav('/projects')}><ArrowRight size={15} /> كل المشاريع</button>

      <div className="card pad" style={{ marginBottom: 18 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div className="row" style={{ gap: 13, minWidth: 0 }}>
            <span className="ic" style={{ width: 52, height: 52, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--brand-tint)', color: 'var(--brand)', flexShrink: 0 }}><FolderKanban size={24} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="mini-label" style={{ marginBottom: 3 }}>{p.id} · {goal?.name}</div>
              <h1 style={{ fontSize: 20, fontWeight: 600 }}>{p.name}</h1>
            </div>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <b style={{ fontSize: 22, color: st(p.status).color }}>{fmtPct(p.progress)}</b>
            <StatusPill status={p.status} />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <Ring value={p.progress} size={80} color={st(p.status).color} />
        </div>
        <div className="grid g-4" style={{ marginTop: 20, gap: 18 }}>
          <Meta label="المبادرة" value={init?.name} />
          <Meta label="الإدارة" value={p.dept} />
          <Meta label="المسؤول" value={p.owner} />
        </div>
        <div className="row" style={{ gap: 10, marginTop: 18 }}>
          <button className="btn btn-primary btn-sm" onClick={() => nav('/followup?project=' + p.id)}><CalendarCheck size={15} /> المتابعة الشهرية</button>
          {init && <button className="btn btn-ghost btn-sm" onClick={() => nav('/initiatives?id=' + init.id)}><Rocket size={14} /> المبادرة</button>}
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 18 }}>
        <StatCard icon={Gauge} label="مؤشرات الأداء" value={kpis.length} />
        <StatCard icon={FileCheck2} label="الشواهد" value={evidence.length} color="var(--brand-deep)" bg="color-mix(in srgb,var(--brand-deep) 12%,transparent)" />
        <StatCard icon={TriangleAlert} label="التحديات" value={challenges.length} color="var(--st-attention)" bg="color-mix(in srgb,var(--st-attention) 15%,transparent)" />
        <StatCard icon={Target} label="المكتملة" value={kpis.filter((k) => k.status === 'completed').length} color="var(--st-completed)" bg="color-mix(in srgb,var(--st-completed) 12%,transparent)" />
      </div>

      <div className="card pad" style={{ marginBottom: 18 }}>
        <div className="card-head"><h3 className="row" style={{ gap: 8 }}><Gauge size={17} style={{ color: 'var(--brand)' }} />مؤشرات الأداء</h3></div>
        {kpis.length === 0 ? <EmptyState icon={Gauge} title="لا توجد مؤشرات لهذا المشروع" /> : (
          <div className="grid g-2">
            {kpis.map((k) => {
              const spark = k.monthly.filter((m) => m.actual != null).map((m) => ({ v: m.actual }));
              return (
                <div key={k.id} className="card pad card-hover" style={{ border: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => nav('/kpis?id=' + k.id)}>
                  <div className="row between" style={{ marginBottom: 8 }}>
                    <span className="tag">{k.type}</span>
                    <StatusPill status={k.status} sm />
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 10, minHeight: 38 }}>{k.name}</div>
                  <div className="row between">
                    <div>
                      <div className="mini-label">المستهدف</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {k.targetRaw != null ? k.targetRaw : (
                          k.targetNum != null ? (k.targetPct ? `${k.targetNum * 100}%` : k.targetNum) : '—'
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div className="mini-label">التحقق</div>
                      <div className="row" style={{ gap: 5, fontSize: 14, fontWeight: 600, color: st(k.status).color }}><TrendIcon trend={k.trend} />{fmtPct(k.achievement)}</div>
                    </div>
                    <div style={{ width: 90, height: 40 }}>{spark.length > 1 && <MiniSpark data={spark} color={st(k.status).color} />}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {challenges.length > 0 && (
        <div className="card pad">
          <div className="card-head"><h3 className="row" style={{ gap: 8 }}><TriangleAlert size={17} style={{ color: 'var(--st-attention)' }} />التحديات</h3></div>
          <div style={{ display: 'grid', gap: 8 }}>
            {challenges.map((c) => (
              <div key={c.id} className="row between" style={{ padding: '10px 12px', borderRadius: 9, background: 'var(--surface-2)' }}>
                <span style={{ fontSize: 13 }}>{c.text || 'تحدٍ في التنفيذ'}</span>
                <span className={`badge st-${c.severity === 'high' ? 'delayed' : c.severity === 'medium' ? 'attention' : 'on_track'}`}>{c.severity === 'high' ? 'مرتفع' : c.severity === 'medium' ? 'متوسط' : 'منخفض'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

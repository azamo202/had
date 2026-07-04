import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Rocket, ArrowRight, FolderKanban, Wallet, Calendar, Building2, Target,
  Gauge, CheckSquare, Square, ArrowUpDown,
} from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { st, fmtPct, fmtCurrency, can } from '../lib/status.js';
import { makeIndex, useTable, scopeProjects } from '../lib/select.js';
import { PageHead, SearchBox, Pager, Meta } from '../components/ui/Bits.jsx';
import { Progress, StatusPill, Chips, EmptyState } from '../components/ui/Primitives.jsx';

const Q = ['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'];

export default function Initiatives() {
  const { db, user } = useApp();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const id = sp.get('id');
  const idx = useMemo(() => makeIndex(db), [db]);

  if (id && idx.i[id]) return <Detail i={idx.i[id]} db={db} idx={idx} nav={nav} />;

  return <List db={db} nav={nav} />;
}

function List({ db, nav }) {
  const [goalF, setGoalF] = useState(null);
  const rows = useMemo(() => (goalF ? db.initiatives.filter((i) => i.goalId === goalF) : db.initiatives), [db, goalF]);
  const tbl = useTable(rows, { pageSize: 12, initialSort: { key: 'progress', dir: 'desc' } });
  const goalOpts = db.goals.map((g) => ({ value: g.id, label: g.name }));

  return (
    <div className="page fade-in">
      <PageHead title="المبادرات الاستراتيجية" sub={`${db.initiatives.length} مبادرة تنفّذ الأهداف الاستراتيجية للجمعية`} />
      <div className="card pad" style={{ marginBottom: 14, display: 'grid', gap: 12 }}>
        <SearchBox value={tbl.q} onChange={tbl.setQ} placeholder="بحث في المبادرات…" />
        <Chips options={goalOpts} value={goalF} onChange={setGoalF} />
      </div>
      {tbl.slice.length === 0 ? (
        <EmptyState icon={Rocket} title="لا توجد مبادرات مطابقة" />
      ) : (
        <div className="grid g-2">
          {tbl.slice.map((i) => (
            <div key={i.id} className="card pad card-hover" style={{ cursor: 'pointer' }} onClick={() => nav('/initiatives?id=' + i.id)}>
              <div className="row between" style={{ marginBottom: 10 }}>
                <span className="row" style={{ gap: 8 }}>
                  <span className="ic" style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--brand-tint)', color: 'var(--brand)' }}><Rocket size={16} /></span>
                  <span className="mini-label">{i.code || i.id} · {idx.g[i.goalId]?.name}</span>
                </span>
                <StatusPill status={i.status} sm />
              </div>
              <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 4, minHeight: 40 }}>{i.name}</div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>{i.dept}</div>
              <div className="row between" style={{ marginBottom: 6 }}>
                <span className="muted" style={{ fontSize: 12 }}>{i.projectCount} مشروع · {i.budget ? fmtCurrency(i.budget) : 'بدون موازنة'}</span>
                <b style={{ fontSize: 13.5, color: st(i.status).color }}>{fmtPct(i.progress)}</b>
              </div>
              <Progress value={i.progress} color={st(i.status).color} />
            </div>
          ))}
        </div>
      )}
      <Pager {...tbl} />
    </div>
  );
}

function Detail({ i, db, idx, nav }) {
  const goal = idx.g[i.goalId];
  const obj = idx.o[i.objectiveId];
  const projects = db.projects.filter((p) => p.initiativeId === i.id);

  return (
    <div className="page fade-in">
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => nav('/initiatives')}><ArrowRight size={15} /> كل المبادرات</button>

      <div className="card pad" style={{ marginBottom: 18 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div className="row" style={{ gap: 13, minWidth: 0 }}>
            <span className="ic" style={{ width: 52, height: 52, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--brand-tint)', color: 'var(--brand)', flexShrink: 0 }}><Rocket size={24} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="mini-label" style={{ marginBottom: 3 }}>{i.code || i.id} · {goal?.name}</div>
              <h1 style={{ fontSize: 20, fontWeight: 600 }}>{i.name}</h1>
            </div>
          </div>
          <div className="row" style={{ gap: 12 }}>
            <b style={{ fontSize: 22, color: st(i.status).color }}>{fmtPct(i.progress)}</b>
            <StatusPill status={i.status} />
          </div>
        </div>
        <Progress value={i.progress} color={st(i.status).color} />

        <div className="grid g-4" style={{ marginTop: 20, gap: 18 }}>
          <Meta label="الإدارة المسؤولة" value={i.dept} />
          <Meta label="الموازنة" value={i.budget ? fmtCurrency(i.budget) : 'بدون موازنة'} />
          <Meta label="الإطار الزمني" value={i.timeframe || '—'} />
          <Meta label="عدد المشاريع" value={i.projectCount} />
        </div>
        <hr className="divider" />
        <div className="grid g-2" style={{ gap: 18 }}>
          <div>
            <div className="mini-label" style={{ marginBottom: 6 }}>الهدف الفرعي</div>
            <div style={{ fontSize: 13.5 }}>{obj?.name || i.sub}</div>
          </div>
          <div>
            <div className="mini-label" style={{ marginBottom: 8 }}>التوزيع الربعي</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {[i.q1, i.q2, i.q3, i.q4].map((on, n) => (
                <span key={n} className="row" style={{ gap: 6, fontSize: 12.5, padding: '5px 10px', borderRadius: 8, background: on ? 'var(--brand-tint)' : 'var(--surface-2)', color: on ? 'var(--brand-deep)' : 'var(--text-3)' }}>
                  {on ? <CheckSquare size={14} /> : <Square size={14} />}{Q[n]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid g-2" style={{ marginBottom: 18 }}>
        <div className="card pad">
          <div className="mini-label" style={{ marginBottom: 8 }}>مؤشر الكفاءة (المخرجات)</div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{i.effKpi || '—'}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>المستهدف: <b>{i.effTgt || '—'}</b></div>
        </div>
        <div className="card pad">
          <div className="mini-label" style={{ marginBottom: 8 }}>مؤشر الفعالية (الأثر)</div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{i.effectKpi || '—'}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>المستهدف: <b>{i.effectTgt || '—'}</b></div>
        </div>
      </div>

      <div className="card pad">
        <div className="card-head"><h3 className="row" style={{ gap: 8 }}><FolderKanban size={17} style={{ color: 'var(--brand)' }} />المشاريع التشغيلية</h3><span className="card-sub">{projects.length} مشروع</span></div>
        <div className="tbl-wrap" style={{ border: 'none' }}>
          <table className="tbl">
            <thead><tr><th>المشروع</th><th>الإدارة</th><th>الإنجاز</th><th>الحالة</th><th>المؤشرات</th></tr></thead>
            <tbody>
              {projects.map((p) => {
                 const pk = db.kpis.filter(k => k.projectId === p.id);
                 return (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => nav('/projects?id=' + p.id)}>
                  <td style={{ fontWeight: 500, maxWidth: 340 }}><span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span></td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{p.dept}</td>
                  <td style={{ minWidth: 120 }}><div className="row" style={{ gap: 8 }}><b style={{ fontSize: 12.5, color: st(p.status).color, width: 42 }}>{fmtPct(p.progress)}</b><div style={{ flex: 1 }}><Progress value={p.progress} color={st(p.status).color} thin /></div></div></td>
                  <td><StatusPill status={p.status} sm /></td>
                  <td><span className="tag">{pk.length}</span></td>
                </tr>
                 );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

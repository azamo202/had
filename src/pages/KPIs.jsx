import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Gauge, ArrowRight, Target, Rocket, FolderKanban, Building2, User2,
  TriangleAlert, FileCheck2, History, ArrowUpDown,
} from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { st, fmtPct, fmtCurrency, fmt, fmtVal } from '../lib/status.js';
import { makeIndex, useTable, scopeKpis } from '../lib/select.js';
import { PageHead, SearchBox, Pager, Meta, TrendIcon } from '../components/ui/Bits.jsx';
import { Progress, StatusPill, Chips, EmptyState, Ring, StatusPill as SP } from '../components/ui/Primitives.jsx';
import { TrendArea, PALETTE } from '../components/charts/Charts.jsx';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const STATUS_OPTS = [
  { value: 'completed', label: 'مكتمل' }, { value: 'on_track', label: 'على المسار' },
  { value: 'attention', label: 'يحتاج انتباه' }, { value: 'delayed', label: 'متعثر' }, { value: 'not_started', label: 'لم يبدأ' },
];

export default function KPIs() {
  const { db, user } = useApp();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const id = sp.get('id');
  const idx = useMemo(() => makeIndex(db), [db]);
  if (id && idx.k[id]) return <Detail k={idx.k[id]} db={db} idx={idx} nav={nav} />;
  return <List db={db} user={user} nav={nav} />;
}

function List({ db, user, nav }) {
  const [statusF, setStatusF] = useState(null);
  const [typeF, setTypeF] = useState(null);
  const base = useMemo(() => scopeKpis(db, user), [db, user]);
  const rows = useMemo(
    () => base.filter((k) => (!statusF || k.status === statusF) && (!typeF || k.type === typeF)),
    [base, statusF, typeF],
  );
  const tbl = useTable(rows, { pageSize: 12, initialSort: { key: 'achievement', dir: 'desc' } });

  return (
    <div className="page fade-in">
      <PageHead title="مؤشرات الأداء" sub={`${base.length} مؤشر أداء رئيسي لقياس تحقق المستهدفات`} />
      <div className="card pad" style={{ marginBottom: 14, display: 'grid', gap: 12 }}>
        <SearchBox value={tbl.q} onChange={tbl.setQ} placeholder="بحث في المؤشرات…" />
        <Chips options={STATUS_OPTS} value={statusF} onChange={setStatusF} />
        <Chips options={[{ value: 'نسبة', label: 'نسبة' }, { value: 'عدد', label: 'عدد' }]} value={typeF} onChange={setTypeF} />
      </div>
      {tbl.slice.length === 0 ? <EmptyState icon={Gauge} title="لا توجد مؤشرات مطابقة" /> : (
        <div className="grid g-3">
          {tbl.slice.map((k) => (
            <div key={k.id} className="card pad card-hover" style={{ cursor: 'pointer' }} onClick={() => nav('/kpis?id=' + k.id)}>
              <div className="row between" style={{ marginBottom: 10 }}>
                <span className="tag">{k.type}</span>
                <StatusPill status={k.status} sm />
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 12, minHeight: 40 }}>{k.name}</div>
              <div className="row between" style={{ alignItems: 'flex-end' }}>
                <div>
                  <div className="mini-label">المستهدف</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{k.target}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="row" style={{ gap: 5, fontSize: 17, fontWeight: 600, color: st(k.status).color }}><TrendIcon trend={k.trend} />{fmtPct(k.achievement)}</div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}><Progress value={k.achievement ?? 0} color={st(k.status).color} thin /></div>
            </div>
          ))}
        </div>
      )}
      <Pager {...tbl} />
    </div>
  );
}

function Detail({ k, db, idx, nav }) {
  const project = idx.p[k.projectId];
  const init = idx.i[k.initiativeId];
  const goal = idx.g[k.goalId];
  const challenges = db.challenges.filter((c) => c.kpiId === k.id);
  const evidence = db.evidences.filter((e) => e.kpiId === k.id);
  const history = k.monthly.filter((m) => m.actual != null);
  const trend = history.map((m) => ({ name: MONTHS[m.month - 1] || String(m.month), value: m.actual }));

  return (
    <div className="page fade-in">
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }} onClick={() => nav('/kpis')}><ArrowRight size={15} /> كل المؤشرات</button>

      <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', marginBottom: 18 }}>
        <div className="card pad">
          <div className="row between" style={{ marginBottom: 14 }}>
            <span className="row" style={{ gap: 9 }}>
              <span className="ic" style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--brand-tint)', color: 'var(--brand)' }}><Gauge size={21} /></span>
              <span><span className="mini-label">{k.id} · {k.type}</span></span>
            </span>
            <StatusPill status={k.status} />
          </div>
          <h1 style={{ fontSize: 19, fontWeight: 600, marginBottom: 18 }}>{k.name}</h1>
          <div className="grid g-4" style={{ gap: 18 }}>
            <Meta label="المستهدف (من الخطة)" value={k.target} />
            <Meta label="القيمة الأساسية" value={k.baseline || '—'} />
            <Meta label="المُنجز الكلي" value={fmtVal(k.achievedNum, k.targetPct)} />
            <Meta label="المالك" value={k.owner} />
          </div>
          <hr className="divider" />
          <div className="grid g-3" style={{ gap: 12 }}>
            <LinkTile icon={Target} label={`الهدف ${goal?.index}`} onClick={() => nav('/objectives?goal=' + goal?.id)} />
            <LinkTile icon={Rocket} label={init?.name} onClick={() => nav('/initiatives?id=' + init?.id)} />
            <LinkTile icon={FolderKanban} label={project?.name} onClick={() => nav('/projects?id=' + project?.id)} />
          </div>
        </div>
        <div className="card pad" style={{ display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <div className="mini-label" style={{ marginBottom: 10 }}>نسبة التحقق</div>
          <Ring value={k.achievement ?? 0} size={168} color={st(k.status).color} label={fmtPct(k.achievement)} sub={st(k.status).label} />
          <div className="muted row" style={{ gap: 6, marginTop: 12, fontSize: 12.5 }}>الاتجاه <TrendIcon trend={k.trend} /></div>
        </div>
      </div>

      {trend.length > 1 && (
        <div className="card pad" style={{ marginBottom: 18 }}>
          <div className="card-head"><h3 className="row" style={{ gap: 8 }}><History size={17} style={{ color: 'var(--brand)' }} />تطور الأداء الشهري</h3></div>
          <TrendArea data={trend} keys={[{ key: 'value', name: k.name, color: st(k.status).color }]} height={230} />
        </div>
      )}

      <div className="grid g-2" style={{ marginBottom: 18 }}>
        <div className="card pad">
          <div className="card-head"><h3 className="row" style={{ gap: 8 }}><History size={16} />سجل القياسات الشهرية</h3></div>
          {history.length === 0 ? <EmptyState icon={History} title="لا توجد قياسات مسجّلة" /> : (
            <div className="tbl-wrap" style={{ border: 'none' }}>
              <table className="tbl">
                <thead><tr><th>الشهر</th><th>المُنجز</th><th>التحدي</th></tr></thead>
                <tbody>
                  {history.map((m, n) => (
                    <tr key={n}><td>{dispMonth(MONTHS[m.month - 1] || m.month)}</td><td><b>{fmtVal(m.actual, k.targetPct)}</b></td><td className="muted" style={{ fontSize: 12 }}>{m.challenge || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
          <div className="card pad">
            <div className="card-head"><h3 className="row" style={{ gap: 8 }}><TriangleAlert size={16} style={{ color: 'var(--st-attention)' }} />التحديات</h3><span className="tag">{challenges.length}</span></div>
            {challenges.length === 0 ? <p className="muted" style={{ fontSize: 12.5 }}>لا توجد تحديات مسجّلة.</p> : (
              <div style={{ display: 'grid', gap: 7 }}>
                {challenges.slice(0, 4).map((c) => (
                  <div key={c.id} className="row between" style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)', fontSize: 12.5 }}>
                    <span>{dispMonth(c.month)} · {c.text || 'تحدٍ'}</span>
                    <span className={`badge st-${c.severity === 'high' ? 'delayed' : c.severity === 'medium' ? 'attention' : 'on_track'}`}>{c.severity === 'high' ? 'مرتفع' : c.severity === 'medium' ? 'متوسط' : 'منخفض'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card pad">
            <div className="card-head"><h3 className="row" style={{ gap: 8 }}><FileCheck2 size={16} style={{ color: 'var(--brand)' }} />الشواهد</h3><span className="tag">{evidence.length}</span></div>
            {evidence.length === 0 ? <p className="muted" style={{ fontSize: 12.5 }}>لا توجد شواهد مرفقة.</p> : (
              <div style={{ display: 'grid', gap: 7 }}>
                {evidence.map((e) => (
                  <div key={e.id} className="row between" style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)', fontSize: 12.5 }}>
                    <span>{e.title}</span>
                    <StatusPill status={evStatusToKey(e.status)} sm />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkTile({ icon: Icon, label, onClick }) {
  return (
    <button className="card-hover" style={{ display: 'grid', gap: 6, padding: 12, borderRadius: 10, background: 'var(--surface-2)', textAlign: 'start' }} onClick={onClick}>
      <Icon size={16} style={{ color: 'var(--brand)' }} />
      <span style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label || '—'}</span>
    </button>
  );
}

function evStatusToKey(s) {
  return { approved: 'completed', under_review: 'on_track', uploaded: 'on_track', rejected: 'delayed', missing: 'not_started' }[s] || 'not_started';
}

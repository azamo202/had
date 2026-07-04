import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Goal, Rocket, Target, ChevronLeft } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { st, fmtPct } from '../lib/status.js';
import { makeIndex } from '../lib/select.js';
import { PageHead } from '../components/ui/Bits.jsx';
import { Progress, StatusPill } from '../components/ui/Primitives.jsx';

export default function Objectives() {
  const { db } = useApp();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const goalParam = sp.get('goal');
  const [active, setActive] = useState(goalParam || 'all');
  useEffect(() => { if (goalParam) setActive(goalParam); }, [goalParam]);

  const idx = useMemo(() => makeIndex(db), [db]);
  const goals = active === 'all' ? db.goals : db.goals.filter((g) => g.id === active);

  const objProgress = (objId) => {
    const inits = db.initiatives.filter((i) => i.objectiveId === objId);
    if (!inits.length) return { p: 0, status: 'not_started' };
    const p = inits.reduce((s, i) => s + i.progress, 0) / inits.length;
    return { p, status: st(inits[0].status) && p >= 100 ? 'completed' : p >= 70 ? 'on_track' : p >= 40 ? 'attention' : p > 0 ? 'delayed' : 'not_started' };
  };

  return (
    <div className="page fade-in">
      <PageHead title="الأهداف الاستراتيجية" sub="الأهداف الفرعية المنبثقة عن الأهداف الاستراتيجية الرئيسية" />

      <div className="chips" style={{ marginBottom: 18 }}>
        <button className={`chip ${active === 'all' ? 'on' : ''}`} onClick={() => setActive('all')}>كل الأهداف</button>
        {db.goals.map((g) => (
          <button key={g.id} className={`chip ${active === g.id ? 'on' : ''}`} onClick={() => setActive(g.id)}>الهدف {g.index}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 18 }}>
        {goals.map((g) => {
          const objs = db.objectives.filter((o) => o.goalId === g.id);
          return (
            <div key={g.id} className="card pad">
              <div className="row between" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div className="row" style={{ gap: 13, minWidth: 0 }}>
                  <span className="hex-emblem" style={{ background: `color-mix(in srgb,${st(g.status).color} 14%,transparent)`, color: st(g.status).color, width: 44, height: 44, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, flexShrink: 0 }}>{g.index}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15.5 }}>{g.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{objs.length} أهداف فرعية · {g.initiativeCount} مبادرة</div>
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => nav('/strategic')}>عرض في الخطة <ChevronLeft size={14} /></button>
              </div>

              <div className="grid g-2">
                {objs.map((o) => {
                  const inits = db.initiatives.filter((i) => i.objectiveId === o.id);
                  const pr = objProgress(o.id);
                  return (
                    <div key={o.id} className="card pad card-hover" style={{ border: '1px solid var(--border)' }}>
                      <div className="row between" style={{ marginBottom: 10 }}>
                        <span className="row" style={{ gap: 8 }}><Goal size={16} style={{ color: 'var(--brand)' }} /><span className="mini-label">{o.id}</span></span>
                        <StatusPill status={pr.status} sm />
                      </div>
                      <div style={{ fontWeight: 500, fontSize: 13.5, marginBottom: 12, minHeight: 38 }}>{o.name}</div>
                      <div className="row between" style={{ marginBottom: 6 }}>
                        <span className="muted" style={{ fontSize: 12 }}>متوسط الإنجاز</span>
                        <b style={{ fontSize: 13, color: st(pr.status).color }}>{fmtPct(pr.p)}</b>
                      </div>
                      <Progress value={pr.p} color={st(pr.status).color} thin />
                      <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
                        {inits.map((i) => (
                          <button key={i.id} className="row between" style={{ padding: '7px 9px', borderRadius: 8, background: 'var(--surface-2)', textAlign: 'start' }} onClick={() => nav('/initiatives?id=' + i.id)}>
                            <span className="row" style={{ gap: 7, minWidth: 0 }}><Rocket size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} /><span style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{i.name}</span></span>
                            <b style={{ fontSize: 12, color: st(i.status).color }}>{fmtPct(i.progress)}</b>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

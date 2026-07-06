import React, { useState } from 'react';
import { ChevronLeft, Rocket, FolderKanban, Building2, Target, Coins, Layers } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { fmtCurrency } from '../lib/status.js';
import { PageHead } from '../components/ui/Bits.jsx';

export default function OperationalPlan() {
  const { db } = useApp();
  const [path, setPath] = useState([{ level: 'goals', item: null }]);

  const current = path[path.length - 1];

  const navigateTo = (level, item) => {
    setPath([...path, { level, item }]);
  };

  const navigateBack = (index) => {
    setPath(path.slice(0, index + 1));
  };

  return (
    <div className="page fade-in">
      <PageHead title="الخطة التشغيلية" sub="مرجع هيكلي يوضح ارتباط المشاريع التشغيلية بالمبادرات والأهداف الاستراتيجية" />

      {/* Breadcrumb Navigation */}
      <div className="row" style={{ gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {path.map((p, idx) => {
          const isLast = idx === path.length - 1;
          let label = 'الأهداف الاستراتيجية';
          if (p.level === 'initiatives') label = p.item.name;
          if (p.level === 'projects') label = p.item.name;
          
          return (
            <React.Fragment key={idx}>
              <button 
                onClick={() => navigateBack(idx)}
                style={{
                  background: 'none', border: 'none', padding: 0, 
                  color: isLast ? 'var(--brand-deep)' : 'var(--text-3)',
                  fontWeight: isLast ? 700 : 500,
                  fontSize: 15, cursor: isLast ? 'default' : 'pointer',
                  transition: 'color 0.2s',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start'
                }}
                className={!isLast ? "hover-brand" : ""}
              >
                {p.level !== 'goals' && (
                  <span style={{ fontSize: 11, opacity: 0.7, marginBottom: 2, fontWeight: 500 }}>
                    {p.level === 'initiatives' ? 'المبادرات الاستراتيجية' : 'المشاريع التشغيلية'}
                  </span>
                )}
                <span>{label}</span>
              </button>
              {!isLast && <ChevronLeft size={16} style={{ color: 'var(--text-4)' }} />}
            </React.Fragment>
          );
        })}
      </div>

      <div className="fade-in" key={current.level + (current.item?.id || 'root')}>
        
        {/* Section Title Indicator */}
        <div className="row" style={{ marginBottom: 20, gap: 10, background: 'var(--bg)', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-tint)', display: 'grid', placeItems: 'center' }}>
            <Layers size={20} style={{ color: 'var(--brand)' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-deep)', margin: 0 }}>
              {current.level === 'goals' && "الأهداف الاستراتيجية الرئيسية"}
              {current.level === 'initiatives' && "المبادرات الاستراتيجية التابعة للهدف الاستراتيجي"}
              {current.level === 'projects' && "المشاريع التشغيلية التابعة للمبادرة"}
            </h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 4, margin: 0 }}>
              {current.level === 'goals' && "تصفح الأهداف الاستراتيجية لاستعراض مبادراتها"}
              {current.level === 'initiatives' && "انقر على أي مبادرة لاستعراض المشاريع التشغيلية الخاصة بها"}
              {current.level === 'projects' && "قائمة المشاريع المخصصة لتحقيق مستهدفات هذه المبادرة"}
            </p>
          </div>
        </div>

        {/* Level 1: Goals */}
        {current.level === 'goals' && (
          <div style={{ display: 'grid', gap: 16 }}>
            {db.goals.map((g) => (
              <button 
                key={g.id}
                className="row between card-hover" 
                style={{ 
                  width: '100%', padding: '24px', textAlign: 'start', 
                  background: 'var(--bg)', color: 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 14, cursor: 'pointer'
                }} 
                onClick={() => navigateTo('initiatives', g)}
              >
                <div className="row" style={{ gap: 18, minWidth: 0 }}>
                  <div style={{ 
                    background: 'var(--brand-tint)', color: 'var(--brand)', 
                    width: 54, height: 54, borderRadius: 12, display: 'grid', placeItems: 'center', 
                    fontWeight: 700, fontSize: 22, flexShrink: 0 
                  }}>
                    {g.index || g.code?.replace(/\D/g, '') || '-'}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 17 }}>{g.name}</div>
                </div>
                <ChevronLeft size={24} style={{ color: 'var(--brand)', opacity: 0.5 }} />
              </button>
            ))}
          </div>
        )}

        {/* Level 2: Initiatives */}
        {current.level === 'initiatives' && (
          <div style={{ display: 'grid', gap: 12 }}>
            {db.initiatives.filter(i => i.goalId === current.item.id).map((i) => (
              <button 
                key={i.id}
                className="row between card-hover" 
                style={{ 
                  width: '100%', padding: '20px 24px', textAlign: 'start', 
                  background: 'var(--bg)', color: 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer'
                }} 
                onClick={() => navigateTo('projects', i)}
              >
                <div className="row" style={{ gap: 16, minWidth: 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg-2)', color: 'var(--brand)', display: 'grid', placeItems: 'center', flexShrink: 0, border: '1px solid var(--border)' }}>
                    <Rocket size={20} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{i.name}</div>
                </div>
                <ChevronLeft size={20} style={{ color: 'var(--brand)', opacity: 0.5 }} />
              </button>
            ))}
            {db.initiatives.filter(i => i.goalId === current.item.id).length === 0 && (
              <div className="muted" style={{ padding: 24, textAlign: 'center', background: 'var(--bg)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                لا توجد مبادرات مسجلة لهذا الهدف الاستراتيجي.
              </div>
            )}
          </div>
        )}

        {/* Level 3: Projects */}
        {current.level === 'projects' && (
          <div style={{ display: 'grid', gap: 16 }}>
            {db.projects.filter(p => p.initiativeId === current.item.id).map((p) => {
              const pKpis = db.kpis.filter(k => k.projectId === p.id);
              const progress = Math.min(p.progress ?? 0, 100);

              // colour matched to status
              const statusColor =
                p.status === 'completed'   ? '#10b981' :
                p.status === 'on_track'    ? '#3b82f6' :
                p.status === 'attention'   ? '#f59e0b' :
                p.status === 'delayed'     ? '#ef4444' : '#9ca3af';

              // SVG circular progress constants
              const R = 26;
              const CIRC = 2 * Math.PI * R;
              const dash = (progress / 100) * CIRC;

              return (
                <div key={p.id} className="card pad" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>

                  {/* ── Header row: icon + name/dept/cost + progress circle ─── */}
                  <div style={{ display: 'flex', gap: 14, marginBottom: 16, alignItems: 'flex-start' }}>
                    {/* folder icon */}
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--brand-tint)', color: 'var(--brand-deep)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <FolderKanban size={22} />
                    </div>

                    {/* name + dept + cost */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--brand-deep)' }}>{p.name}</h4>
                      <div className="row muted" style={{ gap: 6, fontSize: 13 }}>
                        <Building2 size={14} /> {p.dept || 'غير محدد'}
                      </div>
                      {p.executionCost != null && p.executionCost > 0 && (
                        <div className="row" style={{ gap: 6, fontSize: 13, marginTop: 8, color: 'var(--text-2)' }}>
                          <Coins size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} />
                          <span>تكلفة التنفيذ:</span>
                          <b style={{ color: 'var(--brand-deep)' }}>{fmtCurrency(p.executionCost)}</b>
                        </div>
                      )}
                    </div>

                    {/* circular progress indicator */}
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <svg width={68} height={68} viewBox="0 0 68 68">
                        {/* track */}
                        <circle cx={34} cy={34} r={R} fill="none" stroke="var(--border)" strokeWidth={5.5} />
                        {/* progress arc — rotated so it starts from 12 o'clock */}
                        <circle
                          cx={34} cy={34} r={R} fill="none"
                          stroke={statusColor} strokeWidth={5.5}
                          strokeDasharray={`${dash} ${CIRC}`}
                          strokeLinecap="round"
                          transform="rotate(-90 34 34)"
                          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(.4,0,.2,1)' }}
                        />
                        {/* percentage label */}
                        <text
                          x={34} y={38}
                          textAnchor="middle"
                          style={{ fill: statusColor, fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans, inherit)' }}
                        >
                          {Math.round(progress)}%
                        </text>
                      </svg>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>الإنجاز</span>
                    </div>
                  </div>

                  {/* ── KPI section: all indicators ──────────────────────── */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="row muted" style={{ gap: 6, fontSize: 12.5, fontWeight: 600 }}>
                      <Target size={14} />
                      {pKpis.length > 1
                        ? `مؤشرات قياس المشروع (${pKpis.length})`
                        : 'مؤشر قياس المشروع'}
                    </div>

                    {pKpis.length > 0 ? (
                      pKpis.map((kpi) => (
                        <div
                          key={kpi.id}
                          style={{ background: 'var(--bg-2)', padding: '10px 14px', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}
                        >
                          <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.5 }}>{kpi.name}</div>
                          <div style={{ background: 'rgba(0,0,0,0.04)', padding: '5px 10px', borderRadius: 6, fontSize: 12.5, display: 'inline-block', alignSelf: 'flex-start' }}>
                            <span className="muted">المستهدف السنوي: </span>
                            <b>
                              {kpi.targetRaw ||
                                (kpi.targetNum != null
                                  ? kpi.targetPct ? `${kpi.targetNum * 100}%` : kpi.targetNum
                                  : '—')}
                            </b>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ background: 'var(--bg-2)', padding: '10px 14px', borderRadius: 8, color: 'var(--text-3)', fontSize: 13, textAlign: 'center' }}>
                        لا يوجد مؤشر مسجل
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
            {db.projects.filter(p => p.initiativeId === current.item.id).length === 0 && (
              <div className="muted" style={{ padding: 24, textAlign: 'center', background: 'var(--bg)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                لا توجد مشاريع تشغيلية مسجلة لهذه المبادرة.
              </div>
            )}
          </div>
        )}

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .hover-brand:hover { color: var(--brand) !important; }
      `}} />
    </div>
  );
}

import React, { useState } from 'react';
import { Target, Rocket, Calendar, CheckCircle2, Building2, Coins, Clock, ChevronLeft, Layers } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { fmtCurrency } from '../lib/status.js';
import { PageHead } from '../components/ui/Bits.jsx';
import { Modal } from '../components/ui/Overlays.jsx';

export default function StrategicPlan() {
  const { db } = useApp();
  const [path, setPath] = useState([{ level: 'goals', item: null }]);
  const [selectedInit, setSelectedInit] = useState(null);

  const current = path[path.length - 1];

  const navigateTo = (level, item) => {
    setPath([...path, { level, item }]);
  };

  const navigateBack = (index) => {
    setPath(path.slice(0, index + 1));
  };

  return (
    <div className="page fade-in">
      <PageHead title="الخطة الاستراتيجية" sub="التسلسل الهرمي لأهداف ومبادرات الجمعية" />

      {/* Breadcrumb Navigation */}
      <div className="row" style={{ gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {path.map((p, idx) => {
          const isLast = idx === path.length - 1;
          const label = p.level === 'goals' ? 'الأهداف الاستراتيجية' : p.item.name;

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
                    {p.level === 'objectives' ? 'الأهداف الفرعية' : 'المبادرات الاستراتيجية'}
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
              {current.level === 'objectives' && "الأهداف الفرعية التابعة للهدف المحدد"}
              {current.level === 'initiatives' && "المبادرات الاستراتيجية التابعة للهدف الفرعي"}
            </h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 4, margin: 0 }}>
              {current.level === 'goals' && "تصفح الأهداف الرئيسية للمنظمة"}
              {current.level === 'objectives' && "انقر على أي هدف فرعي لاستعراض المبادرات الخاصة به"}
              {current.level === 'initiatives' && "تتضمن المشاريع المخصصة لتحقيق هذا الهدف الفرعي"}
            </p>
          </div>
        </div>

        {/* Level 1: Goals */}
        {current.level === 'goals' && (
          <div style={{ display: 'grid', gap: 16 }}>
            {db.goals.map((g) => {
              const goalIndex = parseInt(g.index || g.sort_order || g.code?.replace(/\D/g, '') || '1', 10);
              return (
                <button
                  key={g.id}
                  className={`row between card-hover goal-card-hover-effect goal-card-${((goalIndex - 1) % 8) + 1}`}
                  style={{
                    width: '100%', padding: '24px', textAlign: 'start',
                    color: 'var(--text)',
                    borderRadius: 14, cursor: 'pointer'
                  }}
                  onClick={() => navigateTo('objectives', g)}
                >
                  <div className="row" style={{ gap: 18, minWidth: 0 }}>
                    <div className="goal-index" style={{
                      width: 54, height: 54, borderRadius: 12, display: 'grid', placeItems: 'center',
                      fontWeight: 700, fontSize: 22, flexShrink: 0
                    }}>
                      {g.index || g.code?.replace(/\D/g, '') || '-'}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 17 }}>{g.name}</div>
                  </div>
                  <ChevronLeft size={24} style={{ color: 'var(--theme-base, var(--brand))', opacity: 0.8 }} />
                </button>
              );
            })}
          </div>
        )}

        {/* Level 2: Objectives */}
        {current.level === 'objectives' && (
          <div style={{ display: 'grid', gap: 12 }}>
            {db.objectives.filter(o => o.goalId === current.item.id).map((o) => (
              <button
                key={o.id}
                className="row between card-hover"
                style={{
                  width: '100%', padding: '20px 24px', textAlign: 'start',
                  background: 'var(--bg)', color: 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 12, cursor: 'pointer'
                }}
                onClick={() => navigateTo('initiatives', o)}
              >
                <div className="row" style={{ gap: 16, minWidth: 0 }}>
                  <div style={{
                    background: 'var(--bg-2)', color: 'var(--text-2)',
                    padding: '6px 12px', borderRadius: 8, fontWeight: 600, fontSize: 14, border: '1px solid var(--border)'
                  }}>
                    {o.code || '-'}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{o.name}</div>
                </div>
                <ChevronLeft size={20} style={{ color: 'var(--brand)', opacity: 0.5 }} />
              </button>
            ))}
            {db.objectives.filter(o => o.goalId === current.item.id).length === 0 && (
              <div className="muted" style={{ padding: 24, textAlign: 'center', background: 'var(--bg)', borderRadius: 12, border: '1px dashed var(--border)' }}>
                لا توجد أهداف فرعية مسجلة لهذا الهدف الاستراتيجي.
              </div>
            )}
          </div>
        )}

        {/* Level 3: Initiatives */}
        {current.level === 'initiatives' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {db.initiatives.filter(i => i.objectiveId === current.item.id).map((i) => (
              <button
                key={i.id}
                className="row card-hover"
                style={{
                  padding: '20px', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 12, cursor: 'pointer', textAlign: 'start', gap: 16, alignItems: 'flex-start'
                }}
                onClick={() => setSelectedInit(i)}
              >
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--brand-tint)', color: 'var(--brand-deep)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Rocket size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>{i.name}</div>
                  <div className="muted row" style={{ gap: 6, fontSize: 13, marginTop: 8 }}>
                    <Building2 size={14} /> {i.dept || 'الإدارة غير محددة'}
                  </div>
                </div>
              </button>
            ))}
            {db.initiatives.filter(i => i.objectiveId === current.item.id).length === 0 && (
              <div className="muted" style={{ padding: 24, textAlign: 'center', background: 'var(--bg)', borderRadius: 12, border: '1px dashed var(--border)', gridColumn: '1 / -1' }}>
                لا توجد مبادرات مرتبطة بهذا الهدف الفرعي.
              </div>
            )}
          </div>
        )}

      </div>

      {selectedInit && <InitiativeModal init={selectedInit} onClose={() => setSelectedInit(null)} />}

      <style dangerouslySetInnerHTML={{
        __html: `
        .hover-brand:hover { color: var(--brand) !important; }
      `}} />
    </div>
  );
}

function InitiativeModal({ init, onClose }) {
  const quarters = [
    { id: 'q1', label: 'الربع الأول', active: init.q1 },
    { id: 'q2', label: 'الربع الثاني', active: init.q2 },
    { id: 'q3', label: 'الربع الثالث', active: init.q3 },
    { id: 'q4', label: 'الربع الرابع', active: init.q4 },
  ];

  return (
    <Modal title="تفاصيل المبادرة الاستراتيجية" onClose={onClose} width={650}>
      <div style={{ display: 'grid', gap: 24, padding: '10px 0' }}>

        {/* Header */}
        <div style={{ background: 'var(--brand-tint)', padding: 20, borderRadius: 12, border: '1px solid var(--brand-100)' }}>
          <div className="row" style={{ gap: 10, marginBottom: 8, color: 'var(--brand-deep)' }}>
            <Rocket size={20} />
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{init.name}</h3>
          </div>
          <div className="row" style={{ gap: 6, color: 'var(--brand)', fontSize: 13, fontWeight: 500 }}>
            <Building2 size={15} /> الإدارة المُنَفِّذة: {init.dept || 'غير محدد'}
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ border: '1px solid var(--border)', padding: 16, borderRadius: 10 }}>
            <div className="row muted" style={{ gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
              <Target size={15} /> مؤشر الكفاءة
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, minHeight: 42 }}>
              {init.effKpi || '—'}
            </div>
            <div style={{ background: 'var(--bg-2)', padding: '6px 10px', borderRadius: 6, display: 'inline-block', fontSize: 13 }}>
              <span className="muted">المستهدف: </span> <b>{init.effTgt || '—'}</b>
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', padding: 16, borderRadius: 10 }}>
            <div className="row muted" style={{ gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
              <CheckCircle2 size={15} /> مؤشر الفاعلية
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, minHeight: 42 }}>
              {init.effectKpi || '—'}
            </div>
            <div style={{ background: 'var(--bg-2)', padding: '6px 10px', borderRadius: 6, display: 'inline-block', fontSize: 13 }}>
              <span className="muted">المستهدف: </span> <b>{init.effectTgt || '—'}</b>
            </div>
          </div>
        </div>

        {/* Budget & Timeframe */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="row" style={{ gap: 12, border: '1px solid var(--border)', padding: '16px', borderRadius: 10 }}>
            <div style={{ background: 'color-mix(in srgb,var(--st-completed) 15%,transparent)', color: 'var(--st-completed)', width: 40, height: 40, borderRadius: 8, display: 'grid', placeItems: 'center' }}>
              <Coins size={20} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 2 }}>ميزانية المبادرة</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{fmtCurrency(init.budget)}</div>
            </div>
          </div>

          <div className="row" style={{ gap: 12, border: '1px solid var(--border)', padding: '16px', borderRadius: 10 }}>
            <div style={{ background: 'color-mix(in srgb,var(--st-attention) 15%,transparent)', color: 'var(--st-attention)', width: 40, height: 40, borderRadius: 8, display: 'grid', placeItems: 'center' }}>
              <Clock size={20} />
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 2 }}>مدة التنفيذ</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{init.timeframe || '—'}</div>
            </div>
          </div>
        </div>

        {/* Quarters */}
        <div>
          <div className="row muted" style={{ gap: 6, marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
            <Calendar size={16} /> الأرباع السنوية للتنفيذ
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {quarters.map((q) => (
              <div
                key={q.id}
                style={{
                  padding: 12, textAlign: 'center', borderRadius: 8, fontWeight: 600, fontSize: 13,
                  background: q.active ? 'var(--brand)' : 'var(--bg-2)',
                  color: q.active ? '#fff' : 'var(--text-3)',
                  border: q.active ? 'none' : '1px dashed var(--border)',
                }}
              >
                {q.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

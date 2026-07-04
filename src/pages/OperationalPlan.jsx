import React, { useState } from 'react';
import { ChevronLeft, Rocket, FolderKanban, Building2, Target, Coins } from 'lucide-react';
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
                  transition: 'color 0.2s'
                }}
                className={!isLast ? "hover-brand" : ""}
              >
                {label}
              </button>
              {!isLast && <ChevronLeft size={16} style={{ color: 'var(--text-4)' }} />}
            </React.Fragment>
          );
        })}
      </div>

      <div className="fade-in" key={current.level + (current.item?.id || 'root')}>

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
              const mainKpi = pKpis[0];
              
              return (
                <div key={p.id} className="card pad" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <div className="row" style={{ gap: 14, marginBottom: 16 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--brand-tint)', color: 'var(--brand-deep)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <FolderKanban size={22} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--brand-deep)' }}>{p.name}</h4>
                      <div className="row muted" style={{ gap: 6, fontSize: 13 }}>
                        <Building2 size={14} /> {p.dept || 'غير محدد'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {/* KPI Info */}
                    <div style={{ background: 'var(--bg-2)', padding: 12, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div className="row muted" style={{ gap: 6, fontSize: 12.5, fontWeight: 600 }}>
                        <Target size={14} /> مؤشر قياس المشروع
                      </div>
                      <div style={{ fontSize: 13.5, fontWeight: 500, minHeight: 38 }}>
                        {mainKpi ? mainKpi.name : 'لا يوجد مؤشر مسجل'}
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.04)', padding: '6px 10px', borderRadius: 6, display: 'inline-block', fontSize: 12.5, marginTop: 'auto' }}>
                        <span className="muted">المستهدف السنوي: </span> 
                        <b>{mainKpi ? (mainKpi.targetRaw || mainKpi.targetNum || '—') : '—'}</b>
                      </div>
                    </div>

                    {/* Budget Info */}
                    <div style={{ background: 'var(--bg-2)', padding: 12, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                      <div className="row muted" style={{ gap: 6, fontSize: 12.5, fontWeight: 600 }}>
                        <Coins size={14} /> تكلفة المشروع
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand-deep)', marginTop: 4 }}>
                        {p.cost != null ? fmtCurrency(p.cost) : 'غير محدد'}
                      </div>
                    </div>
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

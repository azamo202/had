import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, XCircle, AlertCircle, FileText, ExternalLink, Filter,
  MessageSquare, Paperclip, LifeBuoy, TriangleAlert, Building2,
  Gauge, Calendar, ChevronLeft, X
} from 'lucide-react';
import { useApp, sendNotification } from '../store/AppContext.jsx';
import { APPROVAL_STATUS, fmt, fmtPct, dispMonth } from '../lib/status.js';
import { Avatar, Progress } from '../components/ui/Primitives.jsx';
import { supabase } from '../lib/supabaseClient.js';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function makeIndex(db) {
  const p = {};
  (db.projects || []).forEach(x => { p[x.id] = x; });
  const g = {};
  (db.goals || []).forEach(x => { g[x.id] = x; });
  const i = {};
  (db.initiatives || []).forEach(x => { i[x.id] = x; });
  return { p, g, i };
}

// ─── مودال تفاصيل الطلب ─────────────────────────────────────────────────────
function RequestDetailModal({ ap, db, idx, onClose, onDecide }) {
  const [reason, setReason] = useState('');
  const [deciding, setDeciding] = useState(null); // 'approved' | 'needs_modification' | 'rejected'
  // criticality state for approval: null | 'critical' | 'non_critical'
  const [criticality, setCriticality] = useState(null);
  const [criticalText, setCriticalText] = useState('');

  const project = idx.p[ap.projectId];
  const goal = idx.g[project?.goalId];
  const initiative = idx.i[project?.initiativeId];
  const mIndex = MONTHS.indexOf(ap.month) + 1;
  const pkpis = db.kpis.filter(k => k.projectId === ap.projectId);
  const activeKpis = pkpis.filter(k => k.monthly?.find(x => x.month === mIndex && x.target != null));

  const decisionConfig = {
    approved: { label: 'تأكيد الاعتماد', bg: 'var(--st-completed)', icon: CheckCircle2 },
    needs_modification: { label: 'إرسال طلب التعديل', bg: 'var(--st-attention)', icon: AlertCircle },
    rejected: { label: 'تأكيد الرفض', bg: '#7f1d1d', icon: XCircle },
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '32px 16px', overflowY: 'auto'
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--bg)', borderRadius: 20, width: '100%', maxWidth: 780,
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          background: 'var(--brand-tint)', padding: '20px 28px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <div className="row" style={{ gap: 10, marginBottom: 6 }}>
              <span className={`badge ${APPROVAL_STATUS[ap.status]?.cls || 'st-attention'} lg`}>
                {APPROVAL_STATUS[ap.status]?.label || ap.status}
              </span>
              <span className="muted" style={{ fontSize: 13 }}>
                <Calendar size={13} style={{ display: 'inline', marginInlineEnd: 4 }} />
                {dispMonth(ap.month)}
              </span>
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--brand-deep)', margin: 0 }}>
              {project?.name || 'مشروع غير محدد'}
            </h2>
            <div className="muted row" style={{ gap: 6, fontSize: 12.5, marginTop: 4 }}>
              <Building2 size={13} />
              {project?.dept || '—'}
              {goal && <><span style={{ opacity: 0.4 }}>·</span>{goal.name}</>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 6 }}>
            <X size={22} />
          </button>
        </div>

        <div style={{ padding: '24px 28px', display: 'grid', gap: 20 }}>

          {/* مقدم الطلب */}
          <div className="row" style={{ gap: 12, background: 'var(--bg-2)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)' }}>
            <Avatar name={ap.submittedBy} sm />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{ap.submittedBy}</div>
              <div className="muted" style={{ fontSize: 12 }}>مقدم الطلب</div>
            </div>
          </div>

          {/* مؤشرات الأداء للشهر */}
          {activeKpis.length > 0 && (
            <div>
              <div className="row muted" style={{ gap: 6, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                <Gauge size={15} /> مؤشرات الأداء — شهر {dispMonth(ap.month)}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {activeKpis.map(k => {
                  const mData = k.monthly.find(x => x.month === mIndex) || {};
                  const isPct = String(k.targetRaw || '').includes('%');
                  const pct = mData.target > 0 ? Math.min(100, Math.round((mData.actual / mData.target) * 100)) : 0;
                  return (
                    <div key={k.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', background: 'var(--bg)' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>{k.name}</div>
                      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        <div style={{ background: 'var(--bg-2)', padding: '8px 12px', borderRadius: 8, textAlign: 'center' }}>
                          <div className="muted" style={{ fontSize: 11 }}>المستهدف</div>
                          <div style={{ fontWeight: 700, fontSize: 16 }}>{mData.target ?? '—'}{isPct ? '%' : ''}</div>
                        </div>
                        <div style={{ background: 'color-mix(in srgb, var(--brand) 8%, var(--bg-2))', padding: '8px 12px', borderRadius: 8, textAlign: 'center', border: '1px solid color-mix(in srgb, var(--brand) 20%, var(--border))' }}>
                          <div className="brand" style={{ fontSize: 11, fontWeight: 600 }}>المنجز</div>
                          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--brand-deep)' }}>
                            {mData.actual != null ? mData.actual : 'لم يُدخل'}{isPct && mData.actual != null ? '%' : ''}
                          </div>
                        </div>
                        <div style={{ background: 'var(--bg-2)', padding: '8px 12px', borderRadius: 8, textAlign: 'center' }}>
                          <div className="muted" style={{ fontSize: 11 }}>نسبة الإنجاز</div>
                          <div style={{ fontWeight: 700, fontSize: 16, color: pct >= 70 ? 'var(--st-completed)' : 'var(--st-delayed)' }}>{mData.actual != null ? pct + '%' : '—'}</div>
                        </div>
                      </div>
                      {mData.actual != null && <Progress value={pct} color={pct >= 70 ? 'var(--st-completed)' : 'var(--st-delayed)'} thin style={{ marginTop: 8 }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* التحديات */}
          {ap.challenges && (
            <div style={{ background: 'color-mix(in srgb, var(--st-delayed) 7%, var(--bg))', border: '1px solid color-mix(in srgb, var(--st-delayed) 20%, var(--border))', borderRadius: 12, padding: '14px 18px' }}>
              <div className="row" style={{ gap: 8, marginBottom: 8, color: 'var(--st-delayed)', fontWeight: 600, fontSize: 13.5 }}>
                <TriangleAlert size={16} /> التحديات
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>{ap.challenges}</p>
            </div>
          )}

          {/* الدعم المطلوب */}
          {ap.support && (
            <div style={{ background: 'color-mix(in srgb, var(--st-attention) 7%, var(--bg))', border: '1px solid color-mix(in srgb, var(--st-attention) 25%, var(--border))', borderRadius: 12, padding: '14px 18px' }}>
              <div className="row" style={{ gap: 8, marginBottom: 8, color: 'var(--st-attention)', fontWeight: 600, fontSize: 13.5 }}>
                <LifeBuoy size={16} /> الدعم المطلوب
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7 }}>{ap.support}</p>
            </div>
          )}

          {/* الشاهد */}
          {ap.evLink && (
            <div style={{ background: 'color-mix(in srgb, var(--brand) 6%, var(--bg))', border: '1px solid color-mix(in srgb, var(--brand) 20%, var(--border))', borderRadius: 12, padding: '14px 18px' }}>
              <div className="row" style={{ gap: 8, marginBottom: 10, color: 'var(--brand-deep)', fontWeight: 600, fontSize: 13.5 }}>
                <Paperclip size={16} /> شاهد الإنجاز
              </div>
              <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
                {ap.evType && <span className="badge st-on_track" style={{ fontSize: 12 }}>{ap.evType}</span>}
                {ap.evDesc && <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{ap.evDesc}</span>}
              </div>
              <a
                href={ap.evLink}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, color: 'var(--brand)', fontWeight: 600, fontSize: 13, textDecoration: 'none', background: 'var(--brand-tint)', padding: '6px 14px', borderRadius: 8, border: '1px solid var(--brand-100)' }}
              >
                <ExternalLink size={14} /> فتح رابط الشاهد
              </a>
            </div>
          )}

          {/* ملاحظات الاستراتيجية */}
          {ap.comments?.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
              <div className="row muted" style={{ gap: 8, marginBottom: 10, fontWeight: 600, fontSize: 13 }}>
                <MessageSquare size={15} /> ملاحظات مكتب الاستراتيجية
              </div>
              {ap.comments.map((cm, i) => (
                <div key={i} style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '8px 12px', marginBottom: 6, fontSize: 13 }}>
                  <span className="muted">{cm.by}: </span>{cm.text}
                </div>
              ))}
            </div>
          )}

          {/* أزرار القرار */}
          {ap.status === 'pending' && (
            deciding === 'approved' ? (
              /* ──── خطوة الاعتماد: تصنيف الحرجية ──── */
              <div style={{ border: '2px solid var(--st-completed)', borderRadius: 14, padding: 20, display: 'grid', gap: 18, background: 'color-mix(in srgb, var(--st-completed) 4%, var(--bg))' }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--st-completed)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={18} /> تصنيف مستوى الحرجية
                </div>

                {/* بطاقتا الاختيار */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {/* حرج */}
                  <button
                    onClick={() => setCriticality('critical')}
                    style={{
                      border: `2px solid ${criticality === 'critical' ? '#ef4444' : 'var(--border)'}`,
                      borderRadius: 12, padding: '16px 12px', cursor: 'pointer',
                      background: criticality === 'critical' ? 'color-mix(in srgb, #ef4444 10%, var(--bg))' : 'var(--bg)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: criticality === 'critical' ? '#ef4444' : 'var(--bg-2)',
                      display: 'grid', placeItems: 'center',
                      transition: 'all 0.2s'
                    }}>
                      <TriangleAlert size={22} style={{ color: criticality === 'critical' ? '#fff' : 'var(--text-3)' }} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: criticality === 'critical' ? '#ef4444' : 'var(--text)' }}>حرج</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.4 }}>يظهر في قسم التحديات الحرجة للإدارة العليا</div>
                    {criticality === 'critical' && (
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#ef4444', display: 'grid', placeItems: 'center' }}>
                        <CheckCircle2 size={16} style={{ color: '#fff' }} />
                      </div>
                    )}
                  </button>

                  {/* غير حرج */}
                  <button
                    onClick={() => { setCriticality('non_critical'); setCriticalText(''); }}
                    style={{
                      border: `2px solid ${criticality === 'non_critical' ? 'var(--st-completed)' : 'var(--border)'}`,
                      borderRadius: 12, padding: '16px 12px', cursor: 'pointer',
                      background: criticality === 'non_critical' ? 'color-mix(in srgb, var(--st-completed) 8%, var(--bg))' : 'var(--bg)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: criticality === 'non_critical' ? 'var(--st-completed)' : 'var(--bg-2)',
                      display: 'grid', placeItems: 'center',
                      transition: 'all 0.2s'
                    }}>
                      <CheckCircle2 size={22} style={{ color: criticality === 'non_critical' ? '#fff' : 'var(--text-3)' }} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14.5, color: criticality === 'non_critical' ? 'var(--st-completed)' : 'var(--text)' }}>غير حرج</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.4 }}>لا يظهر في لوحة التحديات الحرجة</div>
                    {criticality === 'non_critical' && (
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--st-completed)', display: 'grid', placeItems: 'center' }}>
                        <CheckCircle2 size={16} style={{ color: '#fff' }} />
                      </div>
                    )}
                  </button>
                </div>

                {/* حقل التحديات الحرجة (إجباري عند اختيار حرج) */}
                {criticality === 'critical' && (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TriangleAlert size={14} /> وصف التحدي الحرج (إجباري)
                    </div>
                    <textarea
                      className="txta"
                      value={criticalText}
                      onChange={e => setCriticalText(e.target.value)}
                      placeholder="اكتب وصفاً واضحاً للتحدي الحرج الذي يواجه هذا المشروع..."
                      style={{ minHeight: 90, borderColor: criticalText.trim() ? 'var(--border)' : '#ef4444' }}
                      autoFocus
                    />
                    {!criticalText.trim() && (
                      <div style={{ fontSize: 12, color: '#ef4444' }}>⚠ هذا الحقل إجباري عند اختيار «حرج»</div>
                    )}
                  </div>
                )}

                <div className="row" style={{ gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <button className="btn btn-ghost" onClick={() => { setDeciding(null); setCriticality(null); setCriticalText(''); }}>إلغاء</button>
                  <button
                    className="btn"
                    disabled={!criticality || (criticality === 'critical' && !criticalText.trim())}
                    style={{ background: 'var(--st-completed)', color: '#fff', border: 'none', fontWeight: 600, opacity: (!criticality || (criticality === 'critical' && !criticalText.trim())) ? 0.5 : 1 }}
                    onClick={() => {
                      onDecide(ap, 'approved', criticalText.trim(), criticality === 'critical');
                      setDeciding(null); setCriticality(null); setCriticalText('');
                    }}
                  >
                    <CheckCircle2 size={16} /> تأكيد الاعتماد
                  </button>
                </div>
              </div>
            ) : deciding ? (
              /* ──── رفض / طلب تعديل ──── */
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'grid', gap: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>أسباب / ملاحظات (إجباري):</div>
                <textarea
                  className="txta"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="اكتب ملاحظاتك هنا..."
                  style={{ minHeight: 90 }}
                  autoFocus
                />
                <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost" onClick={() => { setDeciding(null); setReason(''); }}>إلغاء</button>
                  <button
                    className="btn"
                    disabled={!reason.trim()}
                    style={{ background: decisionConfig[deciding].bg, color: '#fff', border: 'none' }}
                    onClick={() => { onDecide(ap, deciding, reason, false); setDeciding(null); setReason(''); }}
                  >
                    {decisionConfig[deciding].label}
                  </button>
                </div>
              </div>
            ) : (
              <div className="row" style={{ gap: 10, paddingTop: 4 }}>
                <button className="btn" style={{ flex: 1, background: 'var(--st-completed)', color: '#fff', border: 'none', fontWeight: 600 }} onClick={() => setDeciding('approved')}>
                  <CheckCircle2 size={16} /> قبول واعتماد
                </button>
                <button className="btn btn-soft" style={{ flex: 1, color: 'var(--st-attention)', fontWeight: 600 }} onClick={() => setDeciding('needs_modification')}>
                  <AlertCircle size={16} /> طلب تعديل
                </button>
                <button className="btn" style={{ flex: 1, background: '#7f1d1d', color: '#fff', border: 'none', fontWeight: 600 }} onClick={() => setDeciding('rejected')}>
                  <XCircle size={16} /> رفض
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── الكارد المصغّر ──────────────────────────────────────────────────────────
function RequestCard({ ap, idx, db, onClick }) {
  const project = idx.p[ap.projectId];
  const mIndex = MONTHS.indexOf(ap.month) + 1;
  const pkpis = db.kpis.filter(k => k.projectId === ap.projectId);
  const activeKpis = pkpis.filter(k => k.monthly?.find(x => x.month === mIndex && x.target != null));

  return (
    <div
      className="card card-hover"
      style={{ padding: 0, cursor: 'pointer', overflow: 'hidden' }}
      onClick={onClick}
    >
      {/* Card Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8, marginBottom: 6 }}>
            <span className={`badge ${APPROVAL_STATUS[ap.status]?.cls || 'st-attention'}`} style={{ fontSize: 11 }}>
              {APPROVAL_STATUS[ap.status]?.label || ap.status}
            </span>
            <span className="muted" style={{ fontSize: 12 }}>{dispMonth(ap.month)}</span>
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.4, color: 'var(--brand-deep)' }} className="truncate">
            {project?.name || 'مشروع غير معروف'}
          </div>
          <div className="muted row" style={{ gap: 5, fontSize: 12, marginTop: 4 }}>
            <Building2 size={12} />
            {project?.dept || ap.dept || '—'}
          </div>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <Avatar name={ap.submittedBy} sm />
          <div className="muted" style={{ fontSize: 10.5, marginTop: 4, maxWidth: 60, lineHeight: 1.3 }}>{ap.submittedBy}</div>
        </div>
      </div>

      {/* KPI Summary */}
      {activeKpis.length > 0 && (
        <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
          {activeKpis.map(k => {
            const mData = k.monthly.find(x => x.month === mIndex) || {};
            const isPct = String(k.targetRaw || '').includes('%');
            const pct = mData.target > 0 && mData.actual != null ? Math.min(100, Math.round((mData.actual / mData.target) * 100)) : null;
            return (
              <div key={k.id} style={{ marginBottom: 6 }}>
                <div className="row between" style={{ fontSize: 12, marginBottom: 4 }}>
                  <span className="muted truncate" style={{ maxWidth: '60%' }}>{k.name}</span>
                  <span style={{ fontWeight: 700, color: pct != null ? (pct >= 70 ? 'var(--st-completed)' : 'var(--st-delayed)') : 'var(--text-3)', fontSize: 12 }}>
                    {mData.actual != null ? `${mData.actual}${isPct ? '%' : ''} / ${mData.target}${isPct ? '%' : ''}` : 'لم يُدخل'}
                  </span>
                </div>
                {pct != null && <Progress value={pct} color={pct >= 70 ? 'var(--st-completed)' : 'var(--st-delayed)'} thin />}
              </div>
            );
          })}
        </div>
      )}

      {/* Badges row */}
      <div className="row" style={{ padding: '10px 20px', gap: 8, flexWrap: 'wrap' }}>
        {ap.challenges && (
          <span className="row" style={{ gap: 4, fontSize: 11.5, color: 'var(--st-delayed)', background: 'color-mix(in srgb, var(--st-delayed) 10%, transparent)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
            <TriangleAlert size={12} /> تحديات
          </span>
        )}
        {ap.support && (
          <span className="row" style={{ gap: 4, fontSize: 11.5, color: 'var(--st-attention)', background: 'color-mix(in srgb, var(--st-attention) 10%, transparent)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
            <LifeBuoy size={12} /> دعم مطلوب
          </span>
        )}
        {ap.evLink && (
          <span className="row" style={{ gap: 4, fontSize: 11.5, color: 'var(--brand)', background: 'var(--brand-tint)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
            <Paperclip size={12} /> شاهد
          </span>
        )}
        <span style={{ marginInlineStart: 'auto', color: 'var(--text-4)' }}>
          <ChevronLeft size={16} />
        </span>
      </div>
    </div>
  );
}

// ─── الصفحة الرئيسية ─────────────────────────────────────────────────────────
export default function UpdateRequests() {
  const { db, user, dispatch, toast } = useApp();
  const idx = useMemo(() => makeIndex(db), [db]);
  const [filter, setFilter] = useState('pending');
  const [selected, setSelected] = useState(null); // الطلب المفتوح في المودال

  if (user?.role !== 'strategy_office' && user?.role !== 'strategy') {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center', marginTop: 40 }}>
        <AlertCircle size={48} className="muted" style={{ margin: '0 auto 16px' }} />
        <h3>غير مصرح لك بالوصول</h3>
        <p className="muted">هذه الصفحة مخصصة لمدير المنصة فقط.</p>
      </div>
    );
  }

  const allRequests = (db.approvals || []).filter(a => a.status !== 'draft');
  const filtered = filter === 'all' ? allRequests : allRequests.filter(a => a.status === filter);

  const decide = async (ap, decision, comment, isCritical = false) => {
    try {
      const { error } = await supabase.from('monthly_updates')
        .update({
          status: decision,
          rejection_reason: comment || null,
          approver_id: user.id,
          approval_date: new Date().toISOString()
        })
        .eq('id', ap.id);

      if (error) throw error;

      dispatch({ type: 'APPROVAL_DECIDE', id: ap.id, decision, by: user.name, comment });

      // تُضاف التحديات الحرجة في لوحة المعلومات فقط إذا تم تصنيف الطلب كـ "حرج"
      if (decision === 'approved' && isCritical && comment && comment.trim()) {
        const project = idx.p[ap.projectId] || {};
        dispatch({
          type: 'UPSERT',
          entity: 'challenges',
          item: {
            id: 'C_db_' + ap.id,
            projectId: ap.projectId,
            kpiId: null,
            text: comment.trim(),
            dept: project.dept || ap.dept,
            severity: 'high',
            status: 'open',
            isImportant: true
          }
        });
      }

      const { data: updateRow } = await supabase
        .from('monthly_updates').select('created_by').eq('id', ap.id).single();

      if (updateRow?.created_by) {
        const project = idx.p[ap.projectId] || { name: 'مشروع غير معروف' };
        const notifType = decision === 'approved' ? 'update_approved' : 'update_rejected';
        const titleMap = {
          approved: `تم اعتماد تحديث شهر ${dispMonth(ap.month)}: ${project.name}`,
          rejected: `تم رفض تحديث شهر ${dispMonth(ap.month)}: ${project.name}`,
          needs_modification: `تم طلب تعديل تحديث شهر ${dispMonth(ap.month)}: ${project.name}`,
        };
        const bodyMap = {
          approved: `قام ${user.name} باعتماد تحديثك لشهر ${dispMonth(ap.month)} لمشروع "${project.name}".`,
          rejected: `قام ${user.name} برفض تحديثك لشهر ${dispMonth(ap.month)}${comment ? ': ' + comment : ''}. يرجى معالجة الملاحظات وإعادة الإرسال.`,
          needs_modification: `طلب ${user.name} تعديل تحديثك لشهر ${dispMonth(ap.month)}${comment ? ': ' + comment : ''}. يرجى معالجة الملاحظات وإعادة الإرسال.`,
        };
        await sendNotification({
          userId: updateRow.created_by,
          type: notifType,
          title: titleMap[decision] || titleMap.rejected,
          body: bodyMap[decision] || bodyMap.rejected,
          projectId: ap.projectId,
        });
      }

      toast(
        decision === 'approved' ? 'تم اعتماد التحديث' : decision === 'rejected' ? 'تم رفض التحديث' : 'تم طلب التعديل',
        decision === 'approved' ? 'success' : 'attention'
      );
      setSelected(null);
    } catch (err) {
      console.error(err);
      toast('حدث خطأ أثناء الاتصال بالخادم', 'error');
    }
  };

  return (
    <div className="fade-in">
      <div className="row between" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <FileText className="brand" /> طلبات التحديثات
          </h1>
          <p className="muted" style={{ marginTop: 6 }}>مراجعة واعتماد تحديثات الإنجاز الشهري لجميع الإدارات</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '4px 16px', marginBottom: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--brand)' }}>
          <Filter size={16} /> <span style={{ fontWeight: 500 }}>تصفية:</span>
        </div>
        {['pending', 'approved', 'needs_modification', 'rejected', 'all'].map(k => (
          <button
            key={k}
            className={`btn btn-sm ${filter === k ? 'btn-primary' : 'btn-soft'}`}
            style={{ borderRadius: 20 }}
            onClick={() => setFilter(k)}
          >
            {k === 'all' ? 'الكل' : (APPROVAL_STATUS[k]?.label || k)}{' '}
            ({k === 'all' ? allRequests.length : allRequests.filter(a => a.status === k).length})
          </button>
        ))}
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <CheckCircle2 size={48} className="muted" style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <h3 className="muted">لا توجد طلبات {filter !== 'all' ? (APPROVAL_STATUS[filter]?.label || '') : ''}</h3>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filtered.map(ap => (
            <RequestCard
              key={ap.id}
              ap={ap}
              idx={idx}
              db={db}
              onClick={() => setSelected(ap)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <RequestDetailModal
          ap={selected}
          db={db}
          idx={idx}
          onClose={() => setSelected(null)}
          onDecide={decide}
        />
      )}
    </div>
  );
}

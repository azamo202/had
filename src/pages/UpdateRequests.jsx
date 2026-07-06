import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, AlertCircle, FileText, ExternalLink, Filter } from 'lucide-react';
import { useApp, sendNotification } from '../store/AppContext.jsx';
import { APPROVAL_STATUS, fmt } from '../lib/status.js';
import { Avatar } from '../components/ui/Primitives.jsx';
import { Confirm, Modal } from '../components/ui/Overlays.jsx';
import { supabase } from '../lib/supabaseClient.js';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليه', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function makeIndex(db) {
  const p = {};
  (db.projects || []).forEach(x => { p[x.id] = x; });
  return { p };
}

export default function UpdateRequests() {
  const { db, user, dispatch, toast } = useApp();
  const nav = useNavigate();
  const idx = useMemo(() => makeIndex(db), [db]);
  const [filter, setFilter] = useState('pending'); // pending, approved, rejected, needs_modification
  const [actionPrompt, setActionPrompt] = useState(null); // null or { item, action: 'approved' | 'rejected' | 'needs_modification' }
  const [reason, setReason] = useState('');

  // Restrict to Strategy Manager
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

  const decide = async (ap, decision, comment) => {
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

      if (error) throw error;

      dispatch({ type: 'APPROVAL_DECIDE', id: ap.id, decision, by: user.name, comment });

      if (decision === 'approved' && comment && comment.trim()) {
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

      // Send real notification to the original submitter
      const { data: updateRow } = await supabase
        .from('monthly_updates')
        .select('created_by')
        .eq('id', ap.id)
        .single();

      if (updateRow?.created_by) {
        const notifType = decision === 'approved' ? 'update_approved' : 'update_rejected';
        const project = idx.p[ap.projectId] || { name: 'مشروع غير معروف' };
        const titleMap = {
          approved: `تم اعتماد تحديث شهر ${ap.month}: ${project.name}`,
          rejected: `تم رفض تحديث شهر ${ap.month}: ${project.name}`,
          needs_modification: `تم طلب تعديل تحديث شهر ${ap.month}: ${project.name}`,
        };
        const bodyMap = {
          approved: `قام ${user.name} باعتماد تحديثك لشهر ${ap.month} لمشروع "${project.name}".`,
          rejected: `قام ${user.name} برفض تحديثك لشهر ${ap.month}${comment ? ': ' + comment : ''}. يرجى معالجة الملاحظات وإعادة الإرسال.`,
          needs_modification: `طلب ${user.name} تعديل تحديثك لشهر ${ap.month}${comment ? ': ' + comment : ''}. يرجى معالجة الملاحظات وإعادة الإرسال.`,
        };
        await sendNotification({
          userId: updateRow.created_by,
          type: notifType,
          title: titleMap[decision] || titleMap.rejected,
          body: bodyMap[decision] || bodyMap.rejected,
          projectId: ap.projectId,
        });
      }
      toast(decision === 'approved' ? 'تم اعتماد التحديث' : (decision === 'rejected' ? 'تم رفض التحديث' : 'تم طلب التعديل'), decision === 'approved' ? 'success' : 'attention');
      setActionPrompt(null);
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

      <div className="card" style={{ padding: '4px 16px', marginBottom: 24, display: 'flex', gap: 16 }}>
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
            {k === 'all' ? 'الكل' : (APPROVAL_STATUS[k]?.label || k)} ({k === 'all' ? allRequests.length : allRequests.filter(a => a.status === k).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <CheckCircle2 size={48} className="muted" style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <h3 className="muted">لا توجد طلبات {filter !== 'all' ? (APPROVAL_STATUS[filter]?.label || '') : ''}</h3>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
          {filtered.map(ap => (
            <div key={ap.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="row between">
                <span className={`badge ${APPROVAL_STATUS[ap.status]?.cls || 'st-attention'}`}>
                  {APPROVAL_STATUS[ap.status]?.label || ap.status}
                </span>
                <span className="muted" style={{ fontSize: 12 }}>{ap.month}</span>
              </div>
              
              <div className="row" style={{ gap: 12, minWidth: 0, cursor: 'pointer' }} onClick={() => nav('/followup?project=' + ap.projectId)}>
                <Avatar name={ap.submittedBy} sm />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }} className="truncate">
                    {idx.p[ap.projectId]?.name || 'مشروع غير معروف'}
                  </div>
                  <div className="muted truncate" style={{ fontSize: 12, marginTop: 4 }}>
                    {ap.submittedBy} · {ap.dept}
                  </div>
                </div>
              </div>

              {/* KPI Details for the Month */}
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                <strong style={{ display: 'block', marginBottom: 8, fontSize: 13, color: 'var(--brand-deep)' }}>المنجزات المدخلة (مؤشرات الأداء):</strong>
                {(() => {
                  const mIndex = MONTHS.indexOf(ap.month) + 1;
                  const pkpis = db.kpis.filter(k => k.projectId === ap.projectId);
                  const activeKpis = pkpis.filter(k => k.monthly?.find(x => x.month === mIndex && x.target != null));
                  
                  if (activeKpis.length === 0) return <div className="muted" style={{ fontSize: 12 }}>لا توجد بيانات مؤشرات لهذا الشهر.</div>;
                  
                  return (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {activeKpis.map(k => {
                        const mData = k.monthly.find(x => x.month === mIndex) || {};
                        const isPct = String(k.targetRaw || '').includes('%');
                        const actual = mData.actual ?? 'لم يُدخل';
                        const target = mData.target ?? '—';
                        
                        return (
                          <div key={k.id} className="row between" style={{ fontSize: 12.5, background: '#fff', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                            <span style={{ fontWeight: 500, flex: 1 }}>{k.name}</span>
                            <div className="row" style={{ gap: 12, flexShrink: 0 }}>
                              <span className="muted">الهدف: {target}{isPct && target !== '—' ? '%' : ''}</span>
                              <span style={{ fontWeight: 700, color: mData.actual != null ? 'var(--brand)' : 'var(--st-delayed)' }}>
                                المنجز: {actual}{isPct && mData.actual != null ? '%' : ''}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {ap.note && (
                <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, fontSize: 13, color: 'var(--text)' }}>
                  <strong style={{ display: 'block', marginBottom: 4, color: 'var(--muted)' }}>ملاحظات مقدم الطلب:</strong>
                  {ap.note}
                </div>
              )}
              


              {ap.status === 'pending' && (
                <div className="row" style={{ gap: 8, marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <button className="btn btn-sm" style={{ flex: 1, background: 'var(--st-completed)', color: '#fff', border: 'none' }} onClick={() => setActionPrompt({ item: ap, action: 'approved' })}>
                    <CheckCircle2 size={14} /> قبول
                  </button>
                  <button className="btn btn-sm btn-soft" style={{ flex: 1, color: 'var(--st-attention)' }} onClick={() => setActionPrompt({ item: ap, action: 'needs_modification' })}>
                    <AlertCircle size={14} /> طلب تعديل
                  </button>
                  <button className="btn btn-sm" style={{ flex: 1, background: '#7f1d1d', color: '#fff', border: 'none' }} onClick={() => setActionPrompt({ item: ap, action: 'rejected' })}>
                    <XCircle size={14} /> رفض
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {actionPrompt && (
        <Modal 
          title={actionPrompt.action === 'approved' ? "اعتماد التحديث" : (actionPrompt.action === 'rejected' ? "رفض التحديث" : "طلب تعديل")} 
          onClose={() => { setActionPrompt(null); setReason(''); }}
        >
          <div style={{ padding: '10px 0 20px', display: 'grid', gap: 16 }}>
            <p className="muted" style={{ fontSize: 14, margin: 0 }}>
              {actionPrompt.action === 'approved' 
                ? "التحديات الحرجة (تظهر للإدارة العليا في لوحة المعلومات - اختياري):"
                : (actionPrompt.action === 'rejected' ? "يرجى كتابة سبب الرفض." : "يرجى كتابة ملاحظات التعديل المطلوبة ليتمكن مدير الإدارة من مراجعتها وتصحيحها.")}
            </p>
            <textarea 
              className="txta" 
              placeholder={actionPrompt.action === 'approved' ? "لخص أهم التحديات هنا..." : "اكتب الملاحظات هنا..."} 
              value={reason} 
              onChange={(e) => setReason(e.target.value)}
              style={{ minHeight: actionPrompt.action === 'approved' ? 80 : 120 }}
              autoFocus
            />
            <div className="row" style={{ justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => { setActionPrompt(null); setReason(''); }}>إلغاء</button>
              <button 
                className="btn btn-primary" 
                onClick={() => { decide(actionPrompt.item, actionPrompt.action, reason); setReason(''); }} 
                disabled={actionPrompt.action !== 'approved' && !reason.trim()} 
                style={{ background: actionPrompt.action === 'approved' ? 'var(--st-completed)' : (actionPrompt.action === 'rejected' ? '#7f1d1d' : 'var(--st-delayed)') }}
              >
                {actionPrompt.action === 'approved' ? "تأكيد الاعتماد" : (actionPrompt.action === 'rejected' ? "تأكيد الرفض" : "إرسال طلب التعديل")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

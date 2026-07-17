import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarCheck, Save, Send, FolderKanban, Gauge, Lock, Building2,
  CheckCircle2, Info, TriangleAlert, FileCheck2, ChevronLeft, Target, Calendar,
  Check, X, ExternalLink, XCircle
} from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { sendNotification } from '../store/AppContext.jsx';
import { st, fmtPct, can, APPROVAL_STATUS, dispMonth } from '../lib/status.js';
import { scopeProjects, makeIndex } from '../lib/select.js';
import { PageHead } from '../components/ui/Bits.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { StatusPill, Field, EmptyState, Progress } from '../components/ui/Primitives.jsx';
import { Modal } from '../components/ui/Overlays.jsx';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const EV_TYPES = ['تقرير', 'محضر', 'خطاب', 'عرض تقديمي', 'ملف PDF', 'ملف Excel', 'صور', 'رابط', 'أخرى'];

export default function MonthlyFollowup() {
  const { db, user, dispatch, toast } = useApp();
  const [sp] = useSearchParams();
  const idx = useMemo(() => makeIndex(db), [db]);

  const isManager = user?.role === 'manager';
  const isStrategy = user?.role === 'strategy_office';
  const isCEO = user?.role === 'ceo';
  const editable = can.edit(user?.role);

  // Drill-down State
  const [path, setPath] = useState([{ level: 'goals', item: null }]);
  const current = path[path.length - 1];

  const navigateTo = (level, item) => setPath([...path, { level, item }]);
  const navigateBack = (index) => {
    setPath(path.slice(0, index + 1));
    if (index < 3) setSelectedPid(null);
  };

  // Scoped Data
  const projects = useMemo(() => scopeProjects(db, user), [db, user]);

  const allowedGoalIds = new Set(projects.map(p => p.goalId));
  const allowedInitIds = new Set(projects.map(p => p.initiativeId));

  const allowedGoals = db.goals.filter(g => allowedGoalIds.has(g.id));
  const allowedInits = db.initiatives.filter(i => allowedInitIds.has(i.id));

  // Project State
  const [selectedPid, setSelectedPid] = useState(sp.get('project') || null);
  const project = selectedPid ? idx.p[selectedPid] : null;
  const kpis = project ? db.kpis.filter((k) => k.projectId === project.id) : [];

  const [month, setMonth] = useState('يوليو');
  const [notes, setNotes] = useState('');
  const [support, setSupport] = useState('');
  const [evType, setEvType] = useState(EV_TYPES[0]);
  const [evOther, setEvOther] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evLink, setEvLink] = useState('');

  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [criticalChallenge, setCriticalChallenge] = useState('');

  // Initial setup if query param exists
  useEffect(() => {
    const pid = sp.get('project');
    if (pid && idx.p[pid]) {
      const p = idx.p[pid];
      const i = idx.i[p.initiativeId];
      const g = idx.g[p.goalId];
      if (g && i && p) {
        setPath([
          { level: 'goals', item: null },
          { level: 'initiatives', item: g },
          { level: 'projects', item: i },
          { level: 'form', item: p }
        ]);
        setSelectedPid(p.id);
      }
    }
  }, [sp, idx]);

  const approval = project ? db.approvals.find((a) => a.projectId === project.id && a.month === month) : null;
  const isLocked = approval?.status === 'pending' || approval?.status === 'approved';
  const canEditInputs = (isManager || isStrategy) && !isLocked;

  let lockedReason = 'مغلق للتعديل';
  if (!isManager && !isStrategy) {
    lockedReason = 'مغلق (للقراءة فقط)';
  } else if (approval?.status === 'pending') {
    lockedReason = 'مغلق لطلب المراجعة';
  } else if (approval?.status === 'approved') {
    lockedReason = 'مغلق (التحديث معتمد)';
  }

  // Sync form state when month or approval changes
  useEffect(() => {
    if (approval) {
      setNotes(approval.challenges || '');
      setSupport(approval.support || '');
      setEvLink(approval.evLink || '');
      setEvType(approval.evType || EV_TYPES[0]);
      setEvDesc(approval.evDesc || '');
      if (approval.evType && !EV_TYPES.includes(approval.evType)) {
        setEvType('أخرى');
        setEvOther(approval.evType);
      } else {
        setEvOther('');
      }
    } else {
      setNotes(''); setSupport(''); setEvLink(''); setEvDesc('');
    }
  }, [month, approval]);

  // Month active logic (active if any KPI has a target for that month)
  const isMonthActive = (mStr) => {
    const mNum = MONTHS.indexOf(mStr) + 1;
    return kpis.some(k => {
      const mData = k.monthly?.find(x => x.month === mNum);
      return mData && mData.target != null && mData.target !== '';
    });
  };

  const calcProgress = (actual, target) => {
    if (target == null || target === 0) return 0;
    let pct = (actual / target) * 100;
    if (pct > 100) pct = 100;
    if (pct < 0) pct = 0;
    return pct;
  };

  const getCurrentMonthProgress = () => {
    if (!kpis || kpis.length === 0) return 0;
    
    if (month === 'h1') {
      let sum = 0, count = 0;
      kpis.forEach(k => {
        const h1MonthlyData = [1,2,3,4,5,6].map(mn => k.monthly?.find(x => x.month === mn) || {});
        const lastTarget = h1MonthlyData.slice().reverse().find(md => md.target != null)?.target ?? null;
        const lastActual = h1MonthlyData.slice().reverse().find(md => md.actual != null)?.actual ?? null;
        if (k.h1ProjectProgress != null) {
          sum += k.h1ProjectProgress;
          count++;
        } else if (lastTarget != null || lastActual != null) {
          sum += calcProgress(lastActual, lastTarget);
          count++;
        }
      });
      return count > 0 ? sum / count : 0;
    }

    const monthNum = MONTHS.indexOf(month) + 1;
    let sum = 0, count = 0;
    kpis.forEach(k => {
      const m = k.monthly?.find(x => x.month === monthNum);
      if (m && (m.target != null || m.actual != null)) {
        sum += calcProgress(m.actual, m.target);
        count++;
      }
    });
    return count > 0 ? sum / count : 0;
  };

  const getMonthStatusColor = (mStr) => {
    if (!project) return 'transparent';
    const app = db.approvals.find(a => a.projectId === project.id && a.month === mStr);
    if (!app) return 'transparent';
    if (app.status === 'draft') return 'var(--gold)';
    if (app.status === 'pending') return 'var(--brand)';
    if (app.status === 'approved') return 'var(--st-completed)';
    if (app.status === 'rejected') return 'var(--st-delayed)';
    if (app.status === 'needs_modification') return 'var(--st-attention)';
    return 'transparent';
  };

  // Form actions
  const handleActualChange = async (kpiId, raw, isPct) => {
    if (!canEditInputs) return;
    const val = raw === '' ? null : Number(raw);

    // Validation
    if (val != null) {
      if (isPct && (val < 0 || val > 100)) {
        toast('قيمة النسبة المئوية يجب أن تكون بين 0 و 100', 'error');
        return;
      }
      if (!isPct && val < 0) {
        toast('القيمة يجب أن تكون موجبة', 'error');
        return;
      }
    }

    const numVal = Number.isNaN(val) ? null : val;
    const monthNum = MONTHS.indexOf(month) + 1;
    dispatch({ type: 'KPI_MONTH', kpiId, month: monthNum, patch: { actual: numVal } });

    // Update the actual value
    const { error: indError } = await supabase.from('indicator_monthly_values')
      .update({ achieved_value: numVal })
      .eq('indicator_id', kpiId)
      .eq('month', monthNum);

    // Ensure a monthly_updates record exists so this value isn't treated as 'imported'
    const { error: updError } = await supabase.from('monthly_updates')
      .upsert({
        project_id: project.id,
        reporting_month: monthNum,
        reporting_year: new Date().getFullYear(),
        status: approval?.status || 'draft',
        created_by: user.id
      }, { onConflict: 'project_id, reporting_year, reporting_month', ignoreDuplicates: true });

    if (indError || updError) {
      console.error(indError, updError);
      toast('حدث خطأ أثناء الاتصال بالخادم، لم يتم الحفظ', 'error');
    }
  };

  const submit = async (draft) => {
    if (!project || !canEditInputs) return;

    // Required Evidence and Challenges for non-draft
    if (!draft) {
      if (!evLink.trim()) {
        toast('رابط الشاهد إلزامي عند إرسال التحديث للمراجعة', 'error');
        return;
      }
      if (getCurrentMonthProgress() < 70 && !notes.trim()) {
        toast('كتابة التحديات إجبارية لأن نسبة الإنجاز أقل من 70%', 'error');
        return;
      }
    }

    try {
      const monthInt = MONTHS.indexOf(month) + 1;

      // Ensure all current KPI values are flushed to Supabase before submitting
      await Promise.all(kpis.map(async k => {
        const mData = k.monthly.find(x => x.month === monthInt);
        if (mData && mData.actual !== undefined) {
          await supabase.from('indicator_monthly_values')
            .update({ achieved_value: mData.actual })
            .eq('indicator_id', k.id)
            .eq('month', monthInt);
        }
      }));

      // تخزين كل ما أرسله المستخدم كـ JSON في حقل notes
      const submissionPayload = JSON.stringify({
        challenges: notes.trim(),
        support: support.trim(),
        evLink: evLink.trim(),
        evType: evType === 'أخرى' ? (evOther || 'أخرى') : evType,
        evDesc: evDesc.trim(),
      });

      const { data: upsertData, error } = await supabase.from('monthly_updates').upsert({
        project_id: project.id,
        reporting_month: monthInt,
        reporting_year: new Date().getFullYear(),
        notes: submissionPayload,
        status: draft ? 'draft' : 'pending',
        created_by: user.id
      }, { onConflict: 'project_id, reporting_year, reporting_month' }).select('id').single();

      if (error) throw error;

      dispatch({
        type: 'SUBMIT_APPROVAL', projectId: project.id, goalId: project.goalId, dept: project.dept,
        month, by: user.name, draft,
        note: submissionPayload,
      });

      // Dispatch evidence
      if (evLink.trim()) {
        dispatch({
          type: 'UPSERT', entity: 'evidences',
          item: {
            id: 'EV' + Date.now(), kpiId: kpis[0]?.id || null, projectId: project.id, goalId: project.goalId,
            type: evType === 'أخرى' ? (evOther || 'أخرى') : evType, status: 'under_review',
            month, title: evDesc.slice(0, 60), desc: evDesc, hasFile: !!evLink, link: evLink, owner: user.name,
          },
        });
      }

      // ─── Send real notifications when submitting for review ───
      if (!draft) {
        const updateId = upsertData?.id || null;
        // Find all strategy_office users in the DB
        const strategyUsers = db.users.filter(u => u.role === 'strategy_office');
        await Promise.all(strategyUsers.map(su =>
          sendNotification({
            userId: su.id,
            type: 'approval_pending',
            title: `طلب مراجعة جديد: ${project.name}`,
            body: `أرسل ${user.name} تحديث شهر ${dispMonth(month)} لمشروع "${project.name}" بانتظار موافقتك.`,
            entityId: updateId,
            projectId: project.id,
          })
        ));
      }

      toast(draft ? 'تم حفظ التحديث كمسودة' : 'تم إرسال التحديث لمكتب الاستراتيجية للمراجعة', draft ? 'attention' : 'success');
    } catch (err) {
      console.error(err);
      toast('حدث خطأ أثناء الاتصال بالخادم', 'error');
    }
  };

  const decide = async (decision) => {
    try {
      const monthInt = MONTHS.indexOf(month) + 1;
      const decisionLabel = decision === 'approved' ? 'معتمد' : 'مطلوب التعديل';

      // Persist decision to Supabase
      const { error } = await supabase.from('monthly_updates')
        .update({
          status: decision,
          ...(decision === 'needs_modification' && rejectReason ? { rejection_reason: rejectReason } : {})
        })
        .eq('project_id', project.id)
        .eq('reporting_month', monthInt);

      if (error) throw error;

      dispatch({ type: 'APPROVAL_DECIDE', id: approval.id, decision, comment: rejectReason, by: user.name });

      if (decision === 'approved' && criticalChallenge.trim()) {
        dispatch({
          type: 'UPSERT',
          entity: 'challenges',
          item: {
            id: 'C_db_' + approval.id,
            projectId: project.id,
            kpiId: null,
            text: criticalChallenge.trim(),
            dept: project.dept || user.dept,
            severity: 'high',
            status: 'open',
            isImportant: true
          }
        });
      }

      // ─── Send real notification to the original submitter ───
      // Find the submitter in db.users by name (approval.submittedBy) or fetch from Supabase
      const { data: updateRow } = await supabase
        .from('monthly_updates')
        .select('created_by')
        .eq('project_id', project.id)
        .eq('reporting_month', monthInt)
        .single();

      if (updateRow?.created_by) {
        const notifType = decision === 'approved' ? 'update_approved' : 'update_rejected';
        const titleMap = {
          approved: `تم اعتماد تحديث شهر ${dispMonth(month)}: ${project.name}`,
          needs_modification: `طلب تعديل لتحديث شهر ${dispMonth(month)}: ${project.name}`,
        };
        const bodyMap = {
          approved: `قام ${user.name} باعتماد تحديثك لشهر ${dispMonth(month)} لمشروع "${project.name}".`,
          needs_modification: `أرسل ${user.name} ملاحظات لتعديل تحديثك لشهر ${dispMonth(month)}${rejectReason ? ': ' + rejectReason : ''}. يرجى معالجة الملاحظات وإعادة الإرسال.`,
        };
        await sendNotification({
          userId: updateRow.created_by,
          type: notifType,
          title: titleMap[decision],
          body: bodyMap[decision],
          projectId: project.id,
        });
      }

      toast(decision === 'approved' ? 'تم الاعتماد بنجاح' : 'تم إرسال طلب التعديل بنجاح', decision === 'approved' ? 'success' : 'attention');
    } catch (err) {
      console.error(err);
      toast('حدث خطأ أثناء حفظ القرار', 'error');
    }
    setShowRejectBox(false);
    setRejectReason('');
  };

  const withdrawRequest = async () => {
    if (!approval) return;
    try {
      const monthInt = MONTHS.indexOf(month) + 1;
      const { error } = await supabase.from('monthly_updates')
        .update({ status: 'draft' })
        .eq('project_id', project.id)
        .eq('reporting_month', monthInt);

      if (error) throw error;

      dispatch({ type: 'APPROVAL_DECIDE', id: approval.id, decision: 'draft', by: user.name });
      toast('تم سحب الطلب بنجاح، يمكنك الآن التعديل وإعادة الإرسال', 'success');
    } catch (err) {
      console.error(err);
      toast('حدث خطأ أثناء سحب الطلب', 'error');
    }
  };



  return (
    <div className="page fade-in">
      <PageHead title="المتابعة الشهرية" sub="إدخال ومراجعة المنجزات والتحديات للمشاريع التشغيلية">
        {isCEO && <span className="badge st-not_started"><Lock size={13} /> صلاحية اطّلاع فقط (الرئيس التنفيذي)</span>}
        {isStrategy && <span className="badge st-attention"><CheckCircle2 size={13} /> صلاحية مراجعة واعتماد</span>}
      </PageHead>

      {/* Breadcrumb Navigation */}
      <div className="row" style={{ gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {path.map((p, idx) => {
          const isLast = idx === path.length - 1;
          let label = 'الأهداف الاستراتيجية';
          if (p.level === 'initiatives') label = p.item.name;
          if (p.level === 'projects') label = p.item.name;
          if (p.level === 'form') label = p.item.name;

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
            {allowedGoals.map((g) => {
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
                  onClick={() => navigateTo('initiatives', g)}
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
            {allowedGoals.length === 0 && <EmptyState icon={Target} title="لا توجد أهداف متاحة" hint="لا يوجد لديك صلاحية على مشاريع." />}
          </div>
        )}

        {/* Level 2: Initiatives */}
        {current.level === 'initiatives' && (
          <div style={{ display: 'grid', gap: 12 }}>
            {allowedInits.filter(i => i.goalId === current.item.id).map((i) => (
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
                    <FolderKanban size={20} />
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{i.name}</div>
                </div>
                <ChevronLeft size={20} style={{ color: 'var(--brand)', opacity: 0.5 }} />
              </button>
            ))}
          </div>
        )}

        {/* Level 3: Projects */}
        {current.level === 'projects' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {projects.filter(p => p.initiativeId === current.item.id).map((p) => (
              <button
                key={p.id}
                className="row card-hover"
                style={{
                  padding: '20px', background: 'var(--bg)', border: '1px solid var(--border)',
                  borderRadius: 12, cursor: 'pointer', textAlign: 'start', gap: 16, alignItems: 'flex-start'
                }}
                onClick={() => {
                  setSelectedPid(p.id);
                  navigateTo('form', p);
                }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--brand-tint)', color: 'var(--brand-deep)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Target size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>{p.name}</div>
                  <div className="muted row" style={{ gap: 6, fontSize: 13, marginTop: 8 }}>
                    <Building2 size={14} /> {p.dept || 'الإدارة غير محددة'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Level 4: Form */}
        {current.level === 'form' && project && (
          <div style={{ display: 'grid', gap: 24 }}>

            {/* Logs */}
            {approval?.status === 'approved' && (
              <div className="row" style={{ background: 'color-mix(in srgb, var(--st-completed) 15%, transparent)', border: '1px solid var(--st-completed)', padding: '16px 20px', borderRadius: 12, color: 'var(--st-completed)', gap: 12 }}>
                <CheckCircle2 size={24} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>تحديث معتمد (مغلق)</div>
                  <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>تم الاعتماد بواسطة: {approval.comments?.[approval.comments.length - 1]?.by || 'مكتب الاستراتيجية'}</div>
                </div>
              </div>
            )}

            {approval?.status === 'rejected' && (
              <div className="row" style={{ background: 'color-mix(in srgb, var(--st-delayed) 10%, transparent)', border: '1px solid var(--st-delayed)', padding: '16px 20px', borderRadius: 12, color: 'var(--st-delayed)', gap: 12 }}>
                <TriangleAlert size={24} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>تحديث مرفوض</div>
                  <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>السبب: {approval.comments?.[approval.comments.length - 1]?.text || 'غير محدد'}</div>
                </div>
              </div>
            )}

            {approval?.status === 'needs_modification' && (
              <div className="row" style={{ background: 'color-mix(in srgb, var(--st-attention) 10%, transparent)', border: '1px solid var(--st-attention)', padding: '16px 20px', borderRadius: 12, color: 'var(--st-attention)', gap: 12 }}>
                <TriangleAlert size={24} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>طلب تعديل</div>
                  <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>ملاحظات المراجعة: {approval.comments?.[approval.comments.length - 1]?.text || 'غير محدد'}</div>
                </div>
              </div>
            )}

            {/* 1. Project Static Info */}
            <div style={{ background: 'var(--brand-tint)', padding: 24, borderRadius: 14, border: '1px solid var(--brand-100)' }}>
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="row" style={{ gap: 12, marginBottom: 12, color: 'var(--brand-deep)' }}>
                    <FolderKanban size={24} />
                    <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{project.name}</h2>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: 14, fontWeight: 500 }}>
                    <span className="muted">الهدف الاستراتيجي:</span>
                    <span>{idx.g[project.goalId]?.name || '—'}</span>

                    <span className="muted">المبادرة:</span>
                    <span>{idx.i[project.initiativeId]?.name || '—'}</span>

                    <span className="muted">الإدارة المُنَفِّذة:</span>
                    <span>{project.dept || '—'}</span>
                  </div>
                </div>
                {approval && <span className={`badge ${APPROVAL_STATUS[approval.status]?.cls} lg`}>{APPROVAL_STATUS[approval.status]?.label}</span>}
              </div>
            </div>

            {/* 2. Months UI */}
            <div className="card pad" style={{ padding: 20 }}>
              <h3 className="row" style={{ gap: 8, marginBottom: 16, fontSize: 16, color: 'var(--brand-deep)' }}><Calendar size={18} />أشهر المتابعة والتنفيذ</h3>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>

                {/* ── النصف الأول 2026 special button ───────────── */}
                {(() => {
                  const h1Months = [1, 2, 3, 4, 5, 6];
                  const h1HasData = h1Months.some(mn =>
                    kpis.some(k => {
                      const mData = k.monthly?.find(x => x.month === mn);
                      return mData && (mData.target != null || mData.actual != null);
                    })
                  );
                  const isH1Selected = month === 'h1';
                  return (
                    <button
                      onClick={() => setMonth('h1')}
                      title="النصف الأول 2026 (يناير - يونيو)"
                      style={{
                        padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13,
                        background: isH1Selected ? 'var(--brand)' : 'var(--bg)',
                        color: isH1Selected ? '#fff' : 'var(--brand-deep)',
                        border: `1px solid ${isH1Selected ? 'var(--brand)' : 'var(--brand)'}`,
                        cursor: 'pointer', opacity: 1,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        minWidth: 90, lineHeight: 1.3
                      }}
                    >
                      <Calendar size={15} style={{ marginBottom: 2 }} />
                      النصف الأول
                      <span style={{ fontSize: 11, opacity: 0.8 }}>2026</span>
                    </button>
                  );
                })()}

                {/* ── يوليو → ديسمبر individual months ─────────── */}
                {['يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'].map((m) => {
                  const active = isMonthActive(m);
                  const isSelected = month === m;
                  const statusColor = getMonthStatusColor(m);

                  let bg = 'var(--bg-2)';
                  let color = 'var(--text-3)';
                  let border = '1px solid var(--border)';
                  let cursor = 'default';
                  let opacity = 0.6;

                  if (active || true) { // always clickable — user can enter data
                    cursor = 'pointer';
                    opacity = 1;
                    if (isSelected) {
                      bg = 'var(--brand)';
                      color = '#fff';
                      border = '1px solid var(--brand)';
                    } else {
                      bg = 'var(--bg)';
                      color = 'var(--text)';
                    }
                  }

                  return (
                    <button
                      key={m}
                      onClick={() => setMonth(m)}
                      style={{
                        padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: 14,
                        background: bg, color: color, border: border, cursor: cursor, opacity: opacity,
                        transition: 'all 0.2s', minWidth: 70, textAlign: 'center', position: 'relative'
                      }}
                    >
                      {dispMonth(m)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. KPIs */}
            <div className="card pad" style={{ padding: 24 }}>
              <div className="card-head" style={{ marginBottom: 20 }}>
                <h3 className="row" style={{ gap: 8, fontSize: 17 }}><Gauge size={20} style={{ color: 'var(--brand)' }} />
                  {month === 'h1' ? 'ملخص النصف الأول 2026 (يناير — يونيو)' : `مؤشرات المشروع — شهر ${dispMonth(month)}`}
                </h3>
              </div>

              {/* H1 Summary View */}
              {month === 'h1' && (
                <div style={{ display: 'grid', gap: 20 }}>
                  {kpis.length === 0 ? <EmptyState icon={Gauge} title="لا توجد مؤشرات" /> : kpis.map(k => {
                    const isPct = k.targetPct || String(k.targetRaw || '').includes('%') || String(k.name || '').includes('نسبة');

                    // Compute H1 values from monthly data (months 1–6)
                    const h1MonthlyData = [1,2,3,4,5,6].map(mn => k.monthly?.find(x => x.month === mn) || {});
                    const hasAnyH1Target = h1MonthlyData.some(md => md.target != null && md.target !== '');
                    const isNotScheduled = !hasAnyH1Target;

                    // Sum or last non-null value: use last non-null target (cumulative KPI)
                    const lastTarget = h1MonthlyData.slice().reverse().find(md => md.target != null)?.target ?? null;
                    const lastActual = h1MonthlyData.slice().reverse().find(md => md.actual != null)?.actual ?? null;

                    return (
                      <div key={k.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 20, background: 'var(--bg)' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--brand-deep)' }}>
                          {k.name} {isPct ? <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>(نسبة مئوية)</span> : ''}
                        </div>
                        {isNotScheduled ? (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px',
                            background: 'var(--bg-2)', borderRadius: 10,
                            border: '1px dashed var(--border)', color: 'var(--text-3)',
                            fontSize: 14, fontWeight: 600
                          }}>
                            <span style={{ fontSize: 20 }}>📅</span>
                            غير مجدول في النصف الأول
                          </div>
                        ) : (
                          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                            <div style={{ background: 'var(--bg-2)', padding: 14, borderRadius: 10 }}>
                              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>المستهدف (النصف الأول)</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>{lastTarget ?? '—'} {isPct && lastTarget != null ? '%' : ''}</div>
                            </div>
                            <div style={{ background: 'color-mix(in srgb, var(--brand) 5%, var(--bg-2))', padding: 14, borderRadius: 10, border: '1px solid color-mix(in srgb, var(--brand) 15%, var(--border))' }}>
                              <div className="brand" style={{ fontSize: 13, marginBottom: 6, fontWeight: 600 }}>المنجز (النصف الأول)</div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--brand-deep)' }}>{lastActual ?? '—'} {isPct && lastActual != null ? '%' : ''}</div>
                            </div>
                            <div style={{ background: 'var(--bg-2)', padding: 14, borderRadius: 10 }}>
                              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>نسبة إنجاز المشروع</div>
                              <div className="row between" style={{ marginBottom: 6 }}>
                                <b style={{ fontSize: 18, color: 'var(--brand-deep)' }}>
                                  {k.h1ProjectProgress != null ? `${k.h1ProjectProgress}%` : fmtPct(calcProgress(lastActual, lastTarget))}
                                </b>
                              </div>
                              <Progress value={k.h1ProjectProgress ?? calcProgress(lastActual, lastTarget)} color="var(--brand)" thin />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Normal month KPI view */}
              {month !== 'h1' && (
                kpis.length === 0 ? <EmptyState icon={Gauge} title="لا توجد مؤشرات" /> : (
                  <div style={{ display: 'grid', gap: 16 }}>
                    {kpis.map((k) => {
                      const monthNum = MONTHS.indexOf(month) + 1;
                      const m = k.monthly.find((x) => x.month === monthNum) || {};
                      const isPct = k.targetPct || String(k.targetRaw || '').includes('%') || String(k.name || '').includes('نسبة');
                      const progressPct = calcProgress(m.actual, m.target);

                      return (
                        <div key={k.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 20, background: 'var(--bg)' }}>
                          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--brand-deep)' }}>
                            {k.name} {isPct ? <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>(نسبة مئوية)</span> : ''}
                          </div>

                          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>

                            <div style={{ background: 'var(--bg-2)', padding: 14, borderRadius: 10 }}>
                              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>المستهدف الشهري (للقراءة)</div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>{m.target ?? '—'} {isPct && m.target != null ? '%' : ''}</div>
                            </div>

                            <div style={{ background: 'var(--brand-tint)', padding: 14, borderRadius: 10, border: '1px solid var(--brand-100)' }}>
                              <div className="brand" style={{ fontSize: 13, marginBottom: 6, fontWeight: 600 }}>المنجز (قابل للتعديل)</div>
                              <div className="row" style={{ gap: 8 }}>
                                <input
                                  key={`kpi-${k.id}-${m.actual}`}
                                  type="number"
                                  className="inp"
                                  disabled={!canEditInputs || m.target == null}
                                  defaultValue={m.actual ?? ''}
                                  placeholder={(canEditInputs && m.target != null) ? "أدخل المنجز..." : "—"}
                                  min={0}
                                  max={isPct ? 100 : undefined}
                                  style={{
                                    background: (canEditInputs && m.target != null) ? '#fff' : '#f1f5f9',
                                    color: (canEditInputs && m.target != null) ? 'var(--text)' : 'var(--text-3)',
                                    cursor: (canEditInputs && m.target != null) ? 'text' : 'not-allowed',
                                    fontSize: 16, fontWeight: 700, padding: '8px 12px', flex: 1
                                  }}
                                  onBlur={(e) => handleActualChange(k.id, e.target.value, isPct)}
                                />
                                {isPct && <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--brand-deep)' }}>%</span>}
                              </div>
                            </div>

                            <div style={{ background: 'var(--bg-2)', padding: 14, borderRadius: 10 }}>
                              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>نسبة الإنجاز (تلقائي)</div>
                              <div className="row between" style={{ marginBottom: 6 }}>
                                <b style={{ fontSize: 18, color: 'var(--brand-deep)' }}>{fmtPct(progressPct)}</b>
                              </div>
                              <Progress value={progressPct} color="var(--brand)" thin />
                            </div>

                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>

            {/* 4. Challenges and Support */}
            <div className="card pad" style={{ padding: 24 }}>
              <div className="card-head" style={{ marginBottom: 20 }}>
                <h3 className="row" style={{ gap: 8, fontSize: 17 }}><Info size={20} style={{ color: 'var(--brand)' }} />التحديات والدعم المطلوب</h3>
              </div>

              <div style={{ display: 'grid', gap: 20 }}>
                <Field label={`التحديات ${getCurrentMonthProgress() < 70 ? '(إجباري)' : '(اختياري)'} — ${notes.length}/250`}>
                  <textarea
                    className="txta"
                    disabled={!canEditInputs}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={canEditInputs ? "اكتب جميع التحديات التي واجهتك أثناء التنفيذ هذا الشهر..." : lockedReason}
                    style={{
                      minHeight: 100,
                      background: canEditInputs ? '#fff' : '#f1f5f9',
                      cursor: canEditInputs ? 'text' : 'not-allowed',
                      color: canEditInputs ? 'inherit' : 'var(--text-3)'
                    }}
                    maxLength={250}
                  />
                </Field>

                <Field label={`الدعم المطلوب (اختياري) — ${support.length}/250`}>
                  <textarea
                    className="txta"
                    disabled={!canEditInputs}
                    value={support}
                    onChange={(e) => setSupport(e.target.value)}
                    placeholder={canEditInputs ? "اكتب أي دعم تحتاجه لإنجاح المشروع..." : lockedReason}
                    style={{
                      minHeight: 100,
                      background: canEditInputs ? '#fff' : '#f1f5f9',
                      cursor: canEditInputs ? 'text' : 'not-allowed',
                      color: canEditInputs ? 'inherit' : 'var(--text-3)'
                    }}
                    maxLength={250}
                  />
                </Field>
              </div>
            </div>

            {/* 5. Evidence */}
            <div className="card pad" style={{ padding: 24 }}>
              <div className="card-head" style={{ marginBottom: 20 }}>
                <h3 className="row" style={{ gap: 8, fontSize: 17 }}><FileCheck2 size={20} style={{ color: 'var(--brand)' }} />شواهد الإنجاز</h3>
              </div>

              <div className="grid g-2" style={{ gap: 16 }}>
                <Field label="نوع الشاهد">
                  <select className="sel" disabled={!canEditInputs} value={evType} onChange={(e) => setEvType(e.target.value)} style={{ background: canEditInputs ? '#fff' : '#f1f5f9', cursor: canEditInputs ? 'pointer' : 'not-allowed', color: canEditInputs ? 'inherit' : 'var(--text-3)' }}>
                    {EV_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>

                {evType === 'أخرى' && (
                  <Field label="اكتب نوع الشاهد">
                    <input className="inp" disabled={!canEditInputs} value={evOther} onChange={(e) => setEvOther(e.target.value)} placeholder={canEditInputs ? "مثال: فاتورة ضريبية" : ""} style={{ background: canEditInputs ? '#fff' : '#f1f5f9', cursor: canEditInputs ? 'text' : 'not-allowed', color: canEditInputs ? 'inherit' : 'var(--text-3)' }} />
                  </Field>
                )}

                <Field label="رابط الملف المرجعي (SharePoint, OneDrive أو غيره)" hint="رابط الشاهد إلزامي عند إرسال التحديث للمراجعة">
                  <div className="row" style={{ gap: 8 }}>
                    <input className="inp" disabled={!canEditInputs} type="url" value={evLink} onChange={(e) => setEvLink(e.target.value)} placeholder={canEditInputs ? "https://..." : lockedReason} style={{ flex: 1, background: canEditInputs ? '#fff' : '#f1f5f9', cursor: canEditInputs ? 'text' : 'not-allowed', color: canEditInputs ? 'inherit' : 'var(--text-3)' }} />
                    {evLink && (
                      <a href={evLink} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ padding: '0 12px' }} title="فتح الشاهد">
                        <ExternalLink size={18} style={{ color: 'var(--brand)' }} /> فتح الملف
                      </a>
                    )}
                  </div>
                </Field>

                <Field label="وصف الشاهد">
                  <input className="inp" disabled={!canEditInputs} value={evDesc} onChange={(e) => setEvDesc(e.target.value)} placeholder={canEditInputs ? "وصف مختصر لمحتوى الملف" : lockedReason} style={{ background: canEditInputs ? '#fff' : '#f1f5f9', cursor: canEditInputs ? 'text' : 'not-allowed', color: canEditInputs ? 'inherit' : 'var(--text-3)' }} />
                </Field>
              </div>
            </div>

            {/* Actions for Manager */}
            {canEditInputs && (
              <div className="card pad row between" style={{ flexWrap: 'wrap', gap: 12, position: 'sticky', bottom: 12, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', zIndex: 10 }}>
                <span className="muted row" style={{ gap: 7, fontSize: 13, fontWeight: 500 }}><CheckCircle2 size={16} style={{ color: 'var(--brand)' }} />يرجى إرفاق رابط الشاهد قبل الإرسال.</span>
                <div className="row" style={{ gap: 12 }}>
                  <button className="btn btn-ghost" onClick={() => submit(true)}><Save size={16} /> حفظ كمسودة</button>
                  <button className="btn btn-primary" onClick={() => submit(false)} style={{ padding: '12px 24px', fontSize: 15 }}><Send size={18} /> إرسال للمراجعة</button>
                </div>
              </div>
            )}

            {/* Re-submit action for rejected or needs_modification */}
            {(isManager || isStrategy) && (approval?.status === 'rejected' || approval?.status === 'needs_modification') && (
              <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', bottom: 12, background: 'color-mix(in srgb, var(--brand) 5%, rgba(255,255,255,0.95))', backdropFilter: 'blur(8px)', zIndex: 10, border: '1px solid var(--brand)' }}>
                {approval.comments?.length > 0 && (
                  <div style={{ background: 'rgba(255,255,255,0.7)', padding: '12px 16px', borderRadius: 8, border: '1px dashed var(--brand)' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--st-delayed)' }}>ملاحظات التعديل المطلوبة:</div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {approval.comments.map((c, idx) => (
                        <div key={idx} style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5 }}>
                          <span className="muted" style={{ fontWeight: 600, marginInlineEnd: 6 }}>{c.by}:</span>
                          {c.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {isStrategy ? (
                  <div className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--brand-deep)' }}>
                    <Info size={16} />لقد قمت بطلب تعديل على هذا التحديث. الطلب الآن بانتظار تجاوب مدير الإدارة لمعالجة الملاحظات.
                  </div>
                ) : (
                  <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
                    <span className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--brand-deep)' }}><TriangleAlert size={16} />يرجى معالجة الملاحظات وتصحيح المنجزات أو التحديات ثم إعادة الإرسال للمراجعة.</span>
                    <button className="btn btn-primary" onClick={() => submit(false)} style={{ padding: '12px 24px', fontSize: 15 }}><Send size={18} /> إعادة إرسال للمراجعة</button>
                  </div>
                )}
              </div>
            )}

            {/* Withdraw action for pending */}
            {isManager && approval?.status === 'pending' && (
              <div className="card pad row between" style={{ flexWrap: 'wrap', gap: 12, position: 'sticky', bottom: 12, background: 'color-mix(in srgb, var(--st-attention) 5%, rgba(255,255,255,0.95))', backdropFilter: 'blur(8px)', zIndex: 10, border: '1px solid var(--st-attention)' }}>
                <span className="row" style={{ gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--st-attention)' }}><Info size={16} />الطلب حالياً قيد المراجعة. إذا أرسلته بالخطأ أو أردت التعديل، يمكنك سحب الطلب.</span>
                <button className="btn btn-ghost" onClick={withdrawRequest} style={{ padding: '12px 24px', fontSize: 15, color: 'var(--st-delayed)', border: '1px solid var(--border)' }}><XCircle size={18} /> سحب الطلب للتعديل</button>
              </div>
            )}

            {/* Actions for Strategy Office */}
            {isStrategy && approval?.status === 'pending' && (
              <div className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', bottom: 12, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', zIndex: 10, border: '2px solid var(--brand)' }}>
                {!showRejectBox ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
                      <span className="brand row" style={{ gap: 7, fontSize: 14, fontWeight: 600 }}><Info size={16} />بانتظار مراجعتك واعتمادك.</span>
                    </div>
                    <div>
                      <p className="muted" style={{ fontSize: 13, marginBottom: 8, marginTop: 0 }}>التحديات الحرجة (تظهر للإدارة العليا في لوحة المعلومات - اختياري):</p>
                      <textarea
                        className="txta"
                        placeholder="لخص أهم التحديات هنا ليتم عرضها في لوحة المعلومات..."
                        value={criticalChallenge}
                        onChange={(e) => setCriticalChallenge(e.target.value)}
                        style={{ minHeight: 60 }}
                      />
                    </div>
                    <div className="row" style={{ gap: 12, justifyContent: 'flex-end', marginTop: 4 }}>
                      <button className="btn btn-ghost" onClick={() => setShowRejectBox(true)} style={{ color: 'var(--st-delayed)', border: '1px solid var(--border)' }}><X size={18} /> طلب تعديل</button>
                      <button className="btn btn-primary" onClick={() => decide('approved')} style={{ padding: '12px 24px', fontSize: 15, background: 'var(--st-completed)' }}><Check size={18} /> قبول التحديث</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fade .2s ease' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--st-delayed)' }}>طلب تعديل على الإنجاز</div>
                    <p className="muted" style={{ fontSize: 13, margin: 0 }}>يرجى كتابة ملاحظات التعديل المطلوبة ليتمكن مدير الإدارة من مراجعتها وتصحيحها.</p>
                    <textarea
                      className="txta"
                      placeholder="اكتب ملاحظات التعديل هنا..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      style={{ minHeight: 90 }}
                      autoFocus
                    />
                    <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
                      <button className="btn btn-ghost" onClick={() => { setShowRejectBox(false); setRejectReason(''); }}>إلغاء</button>
                      <button className="btn btn-primary" onClick={() => decide('needs_modification')} disabled={!rejectReason.trim()} style={{ background: 'var(--st-delayed)' }}>إرسال طلب التعديل</button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>


      <style dangerouslySetInnerHTML={{
        __html: `
        .hover-brand:hover { color: var(--brand) !important; }
      `}} />
    </div>
  );
}

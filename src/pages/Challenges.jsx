import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TriangleAlert, Plus, FolderKanban, Filter } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { st, can, CHALLENGE_SEV, CHALLENGE_STATUS, uid } from '../lib/status.js';
import { makeIndex, useTable } from '../lib/select.js';
import { PageHead, SearchBox, Pager } from '../components/ui/Bits.jsx';
import { Chips, EmptyState, StatCard, Field } from '../components/ui/Primitives.jsx';
import { Modal } from '../components/ui/Overlays.jsx';

const SEV_OPTS = [{ value: 'high', label: 'عالية' }, { value: 'medium', label: 'متوسطة' }, { value: 'low', label: 'منخفضة' }];
const STAT_OPTS = [{ value: 'open', label: 'مفتوح' }, { value: 'in_progress', label: 'قيد المعالجة' }, { value: 'resolved', label: 'مُعالج' }];

export default function Challenges() {
  const { db, user, dispatch, toast } = useApp();
  const nav = useNavigate();
  const idx = useMemo(() => makeIndex(db), [db]);
  const [sevF, setSevF] = useState(null);
  const [statF, setStatF] = useState(null);
  const [add, setAdd] = useState(false);
  const editable = can.edit(user?.role);

  const rows = useMemo(
    () => db.challenges.filter((c) => (!sevF || c.severity === sevF) && (!statF || c.status === statF)),
    [db, sevF, statF],
  );
  const tbl = useTable(rows, { pageSize: 12 });

  const counts = {
    open: db.challenges.filter((c) => c.status === 'open').length,
    in_progress: db.challenges.filter((c) => c.status === 'in_progress').length,
    resolved: db.challenges.filter((c) => c.status === 'resolved').length,
    high: db.challenges.filter((c) => c.severity === 'high').length,
  };

  const setStatus = (c, status) => {
    dispatch({ type: 'UPSERT', entity: 'challenges', item: { ...c, status } });
    toast('تم تحديث حالة التحدي');
  };

  return (
    <div className="page fade-in">
      <PageHead title="التحديات والمعوقات" sub="التحديات المرصودة أثناء تنفيذ المشاريع ومتابعة معالجتها">
        {editable && <button className="btn btn-primary btn-sm" onClick={() => setAdd(true)}><Plus size={15} /> تسجيل تحدٍّ</button>}
      </PageHead>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <StatCard icon={TriangleAlert} label="تحديات مفتوحة" value={counts.open} color="var(--st-delayed)" bg="color-mix(in srgb,var(--st-delayed) 12%,transparent)" />
        <StatCard icon={Filter} label="قيد المعالجة" value={counts.in_progress} color="var(--st-attention)" bg="color-mix(in srgb,var(--st-attention) 15%,transparent)" />
        <StatCard icon={TriangleAlert} label="مُعالجة" value={counts.resolved} color="var(--st-completed)" bg="color-mix(in srgb,var(--st-completed) 12%,transparent)" />
        <StatCard icon={TriangleAlert} label="عالية الخطورة" value={counts.high} />
      </div>

      <div className="card pad" style={{ marginBottom: 14, display: 'grid', gap: 12 }}>
        <SearchBox value={tbl.q} onChange={tbl.setQ} placeholder="بحث في التحديات…" />
        <div className="row wrap" style={{ gap: 16 }}>
          <div><div className="mini-label" style={{ marginBottom: 6 }}>الخطورة</div><Chips options={SEV_OPTS} value={sevF} onChange={setSevF} /></div>
          <div><div className="mini-label" style={{ marginBottom: 6 }}>الحالة</div><Chips options={STAT_OPTS} value={statF} onChange={setStatF} /></div>
        </div>
      </div>

      {tbl.slice.length === 0 ? (
        <EmptyState icon={TriangleAlert} title="لا توجد تحديات مطابقة" hint="التحديات تُسجّل من خلال المتابعة الشهرية أو يدوياً" />
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>التحدي</th><th>المشروع</th><th>الإدارة</th><th>التصنيف (مهم/غير مهم)</th><th>الخطورة</th><th>الحالة</th></tr></thead>
            <tbody>
              {tbl.slice.map((c) => (
                <tr key={c.id}>
                  <td style={{ maxWidth: 320 }}>
                    <div>{c.text}</div>
                    {c.support && <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>الدعم المطلوب: {c.support}</div>}
                  </td>
                  <td className="link" style={{ cursor: 'pointer', fontSize: 12.5 }} onClick={() => nav('/projects?id=' + c.projectId)}>{idx.p[c.projectId]?.name || '—'}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{c.dept}</td>
                  <td>
                    {can.approve(user?.role) ? (
                      <select className="sel" style={{ padding: '3px 6px', fontSize: 11.5, borderColor: c.isImportant ? 'var(--st-delayed)' : 'var(--border)' }} value={c.isImportant ? 'true' : 'false'} onChange={(e) => { dispatch({ type: 'UPSERT', entity: 'challenges', item: { ...c, isImportant: e.target.value === 'true' } }); toast('تم تحديث تصنيف التحدي'); }}>
                        <option value="true">مهم</option>
                        <option value="false">غير مهم</option>
                      </select>
                    ) : <span className={`badge ${c.isImportant ? 'st-delayed' : 'st-flat'}`}>{c.isImportant ? 'مهم' : 'غير مهم'}</span>}
                  </td>
                  <td><span className={`badge ${CHALLENGE_SEV[c.severity]?.cls}`}>{CHALLENGE_SEV[c.severity]?.label}</span></td>
                  <td>
                    {editable ? (
                      <select className="sel" style={{ padding: '3px 6px', fontSize: 11.5 }} value={c.status} onChange={(e) => setStatus(c, e.target.value)}>
                        {STAT_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : <span className={`badge ${CHALLENGE_STATUS[c.status]?.cls}`}>{CHALLENGE_STATUS[c.status]?.label}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager {...tbl} />

      {add && <AddChallenge db={db} onClose={() => setAdd(false)} onSave={(item) => { dispatch({ type: 'UPSERT', entity: 'challenges', item }); toast('تم تسجيل التحدي'); setAdd(false); }} />}
    </div>
  );
}

function AddChallenge({ db, onClose, onSave }) {
  const [projectId, setProjectId] = useState(db.projects[0]?.id || '');
  const [text, setText] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [month, setMonth] = useState(db.monthlyMonths[7]);
  const p = db.projects.find((x) => x.id === projectId);

  return (
    <Modal title="تسجيل تحدٍّ جديد" subtitle="أضف تحدياً واجه تنفيذ أحد المشاريع" onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        <button className="btn btn-primary" disabled={!text.trim()} onClick={() => onSave({ id: uid('CH'), projectId, initiativeId: p?.initiativeId, goalId: p?.goalId, dept: p?.dept, month, text: text.trim(), severity, status: 'open', kpiId: null })}>حفظ</button>
      </>}>
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="المشروع">
          <select className="sel" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {db.projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Field label="وصف التحدي"><textarea className="txta" value={text} onChange={(e) => setText(e.target.value)} placeholder="اشرح التحدي…" /></Field>
        <div className="grid g-2" style={{ gap: 14 }}>
          <Field label="الخطورة"><select className="sel" value={severity} onChange={(e) => setSeverity(e.target.value)}><option value="high">عالية</option><option value="medium">متوسطة</option><option value="low">منخفضة</option></select></Field>
          <Field label="الشهر"><select className="sel" value={month} onChange={(e) => setMonth(e.target.value)}>{db.monthlyMonths.map((m) => <option key={m} value={m}>{m}</option>)}</select></Field>
        </div>
      </div>
    </Modal>
  );
}

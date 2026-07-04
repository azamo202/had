import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCheck2, Plus, Upload, Link2, CheckCircle2, XCircle, Clock, FolderKanban, Paperclip,
} from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { st, can, EVIDENCE_STATUS, uid } from '../lib/status.js';
import { makeIndex, useTable } from '../lib/select.js';
import { PageHead, SearchBox, Pager } from '../components/ui/Bits.jsx';
import { Chips, EmptyState, StatCard, Field, Avatar } from '../components/ui/Primitives.jsx';
import { Modal, Confirm } from '../components/ui/Overlays.jsx';

const STATUS_OPTS = [
  { value: 'approved', label: 'معتمد' }, { value: 'under_review', label: 'قيد المراجعة' },
  { value: 'uploaded', label: 'مرفوع' }, { value: 'rejected', label: 'مرفوض' }, { value: 'missing', label: 'مفقود' },
];

export default function Evidence() {
  const { db, user, dispatch, toast } = useApp();
  const nav = useNavigate();
  const idx = useMemo(() => makeIndex(db), [db]);
  const [statusF, setStatusF] = useState(null);
  const [typeF, setTypeF] = useState(null);
  const [add, setAdd] = useState(false);
  const [decide, setDecide] = useState(null); // {ev, action}
  const isApprover = can.approve(user?.role);
  const editable = can.edit(user?.role);

  const rows = useMemo(
    () => db.evidences.filter((e) => (!statusF || e.status === statusF) && (!typeF || e.type === typeF)),
    [db, statusF, typeF],
  );
  const tbl = useTable(rows, { pageSize: 12 });

  const counts = Object.fromEntries(Object.keys(EVIDENCE_STATUS).map((k) => [k, db.evidences.filter((e) => e.status === k).length]));

  const setStatus = (e, status) => {
    dispatch({ type: 'UPSERT', entity: 'evidences', item: { ...e, status } });
    toast(status === 'approved' ? 'تم اعتماد الشاهد' : status === 'rejected' ? 'تم رفض الشاهد' : 'تم تحديث الحالة', status === 'rejected' ? 'attention' : 'success');
    setDecide(null);
  };

  return (
    <div className="page fade-in">
      <PageHead title="إدارة الشواهد" sub="الشواهد والمخرجات الداعمة لإنجاز المشاريع ومسار اعتمادها">
        {editable && <button className="btn btn-primary btn-sm" onClick={() => setAdd(true)}><Plus size={15} /> إضافة شاهد</button>}
      </PageHead>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <StatCard icon={CheckCircle2} label="معتمد" value={counts.approved || 0} color="var(--st-completed)" bg="color-mix(in srgb,var(--st-completed) 12%,transparent)" />
        <StatCard icon={Clock} label="قيد المراجعة" value={counts.under_review || 0} color="var(--st-attention)" bg="color-mix(in srgb,var(--st-attention) 15%,transparent)" />
        <StatCard icon={Upload} label="مرفوع" value={counts.uploaded || 0} color="var(--brand-deep)" bg="color-mix(in srgb,var(--brand-deep) 12%,transparent)" />
        <StatCard icon={XCircle} label="مفقود / مرفوض" value={(counts.missing || 0) + (counts.rejected || 0)} color="var(--st-delayed)" bg="color-mix(in srgb,var(--st-delayed) 12%,transparent)" />
      </div>

      <div className="card pad" style={{ marginBottom: 14, display: 'grid', gap: 12 }}>
        <SearchBox value={tbl.q} onChange={tbl.setQ} placeholder="بحث في الشواهد…" />
        <div className="row wrap" style={{ gap: 16 }}>
          <div><div className="mini-label" style={{ marginBottom: 6 }}>الحالة</div><Chips options={STATUS_OPTS} value={statusF} onChange={setStatusF} /></div>
        </div>
        <Chips options={db.evidenceTypes.map((t) => ({ value: t, label: t }))} value={typeF} onChange={setTypeF} />
      </div>

      {tbl.slice.length === 0 ? (
        <EmptyState icon={FileCheck2} title="لا توجد شواهد مطابقة" hint="تُضاف الشواهد من خلال المتابعة الشهرية أو مباشرة من هنا" />
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>الشاهد</th><th>النوع</th><th>المشروع</th><th>المرفق</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {tbl.slice.map((e) => (
                <tr key={e.id}>
                  <td style={{ maxWidth: 260 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{e.title}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>{e.owner} · {e.month}</div>
                  </td>
                  <td><span className="tag">{e.type}</span></td>
                  <td className="link" style={{ cursor: 'pointer', fontSize: 12.5 }} onClick={() => nav('/projects?id=' + e.projectId)}>{idx.p[e.projectId]?.name || '—'}</td>
                  <td>{e.hasFile ? <span className="row" style={{ gap: 5, fontSize: 12, color: 'var(--brand)' }}><Paperclip size={13} />ملف</span> : e.link ? <span className="row" style={{ gap: 5, fontSize: 12, color: 'var(--brand)' }}><Link2 size={13} />رابط</span> : <span className="muted" style={{ fontSize: 12 }}>—</span>}</td>
                  <td><span className={`badge ${EVIDENCE_STATUS[e.status]?.cls}`}>{EVIDENCE_STATUS[e.status]?.label}</span></td>
                  <td>
                    {isApprover && (e.status === 'under_review' || e.status === 'uploaded') && (
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn btn-soft btn-sm" onClick={() => setStatus(e, 'approved')}><CheckCircle2 size={13} /> اعتماد</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDecide({ ev: e })}><XCircle size={13} /> رفض</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager {...tbl} />

      {add && <AddEvidence db={db} user={user} onClose={() => setAdd(false)} onSave={(item) => { dispatch({ type: 'UPSERT', entity: 'evidences', item }); toast('تمت إضافة الشاهد بحالة قيد المراجعة'); setAdd(false); }} />}
      {decide && <Confirm title="رفض الشاهد" message="سيتم إرجاع الشاهد لمقدّمه مع إمكانية إعادة الرفع. هل تريد المتابعة؟" confirmLabel="رفض الشاهد" danger onConfirm={() => setStatus(decide.ev, 'rejected')} onClose={() => setDecide(null)} />}
    </div>
  );
}

function AddEvidence({ db, user, onClose, onSave }) {
  const [projectId, setProjectId] = useState(db.projects[0]?.id || '');
  const [type, setType] = useState(db.evidenceTypes[0]);
  const [other, setOther] = useState('');
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('file'); // file | link
  const [link, setLink] = useState('');
  const p = db.projects.find((x) => x.id === projectId);

  return (
    <Modal title="إضافة شاهد" subtitle="أرفق ملفاً أو رابطاً كدليل على الإنجاز" onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
        <button className="btn btn-primary" disabled={!title.trim()} onClick={() => onSave({
          id: uid('EV'), kpiId: null, projectId, goalId: p?.goalId, type: type === 'أخرى' ? (other || 'أخرى') : type,
          status: 'under_review', month: db.monthlyMonths[7], title: title.trim(), desc: '',
          hasFile: source === 'file', link: source === 'link' ? link : '', owner: user.name,
        })}>حفظ الشاهد</button>
      </>}>
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="المشروع"><select className="sel" value={projectId} onChange={(e) => setProjectId(e.target.value)}>{db.projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        <Field label="عنوان الشاهد"><input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: تقرير إنجاز المرحلة الأولى" /></Field>
        <Field label="نوع الشاهد"><select className="sel" value={type} onChange={(e) => setType(e.target.value)}>{db.evidenceTypes.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
        {type === 'أخرى' && <Field label="حدّد النوع"><input className="inp" value={other} onChange={(e) => setOther(e.target.value)} placeholder="اكتب نوع الشاهد" /></Field>}
        <Field label="طريقة الإرفاق">
          <div className="row" style={{ gap: 10 }}>
            <button className={`btn btn-sm ${source === 'file' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSource('file')}><Upload size={14} /> ملف</button>
            <button className={`btn btn-sm ${source === 'link' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSource('link')}><Link2 size={14} /> رابط</button>
          </div>
        </Field>
        {source === 'file'
          ? <div style={{ border: '1.5px dashed var(--border)', borderRadius: 12, padding: 22, textAlign: 'center', color: 'var(--text-3)' }}><Upload size={22} /><div style={{ fontSize: 12.5, marginTop: 6 }}>اسحب الملف هنا أو اضغط للاختيار (نموذج أولي)</div></div>
          : <Field label="الرابط"><input className="inp" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" /></Field>}
      </div>
    </Modal>
  );
}

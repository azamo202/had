import React, { useState, useMemo } from 'react';
import { Users, Plus, Shield, Mail, Building2, Check, X, Pencil, Lock, Loader2 } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { ROLES, can, uid } from '../lib/status.js';
import { useTable, makeIndex } from '../lib/select.js';
import { PageHead, SearchBox, Pager } from '../components/ui/Bits.jsx';
import { Avatar, Chips, EmptyState, StatCard, Field, EmptyState as ES } from '../components/ui/Primitives.jsx';
import { Modal } from '../components/ui/Overlays.jsx';
import { supabase } from '../lib/supabaseClient.js';

const ROLE_OPTS = Object.entries(ROLES).map(([value, r]) => ({ value, label: r.label }));

export default function UsersPage() {
  const { db, user, dispatch, toast } = useApp();
  const admin = can.manageUsers(user?.role);
  const [roleF, setRoleF] = useState(null);
  const [edit, setEdit] = useState(null); // user obj or {} for new
  const [loading, setLoading] = useState(false);

  const rows = useMemo(() => (roleF ? db.users.filter((u) => u.role === roleF) : db.users), [db, roleF]);
  const tbl = useTable(rows || [], { pageSize: 10 });

  if (!admin) return (
    <div className="page fade-in">
      <PageHead title="إدارة المستخدمين" />
      <EmptyState icon={Lock} title="صلاحية غير متاحة" hint="هذه الصفحة متاحة لمكتب الاستراتيجية فقط" />
    </div>
  );

  const save = async (u, password) => {
    setLoading(true);
    try {
      if (!u.id) {
        let legacyRole = u.role;
        if (u.role === 'strategy_office') legacyRole = 'strategy_manager';
        if (u.role === 'manager') legacyRole = 'dept_manager';

        // Create new user via Edge Function
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            email: u.email,
            password: password,
            name: u.name,
            roleName: legacyRole,
            dept: u.dept
          }
        });

        if (error) {
          let errorMsg = error.message;
          try {
            if (error.context) {
              const errBody = await error.context.json();
              errorMsg = errBody.error || errorMsg;
            }
          } catch (e) { }
          throw new Error(errorMsg || 'فشل في إنشاء المستخدم');
        }

        // Add to local state immediately
        const newU = { ...u, id: data.id, active: true };
        dispatch({ type: 'UPSERT', entity: 'users', item: newU });
        toast('تمت إضافة المستخدم بنجاح');
      } else {
        // Just update existing user in DB (only full_name, dept allowed here for simplicity, roles need admin key usually but let's assume they update public.users)
        let realRoleName = u.role;
        if (u.role === 'strategy_office') realRoleName = 'مدير المنصة';
        else if (u.role === 'ceo') realRoleName = 'المدير التنفيذي';
        else if (u.role === 'manager') realRoleName = 'مدير ادارة';

        // First get role ID
        const { data: rolesData } = await supabase.from('roles').select('id').eq('name', realRoleName).single();
        if (rolesData) {
          const { error } = await supabase.from('users').update({
            full_name: u.name,
            dept: u.dept || null,
            role_id: rolesData.id
          }).eq('id', u.id);

          if (error) throw error;
        }

        dispatch({ type: 'UPSERT', entity: 'users', item: u });
        toast('تم تحديث بيانات المستخدم');
      }
      setEdit(null);
    } catch (err) {
      console.error(err);
      toast(err.message || 'حدث خطأ غير متوقع', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (u) => {
    try {
      const nextActive = !u.active;
      const { error } = await supabase.from('users').update({ active: nextActive }).eq('id', u.id);
      if (error) throw error;
      dispatch({ type: 'UPSERT', entity: 'users', item: { ...u, active: nextActive } });
      toast('تم تحديث حالة المستخدم');
    } catch (err) {
      toast('فشل تحديث الحالة', 'error');
    }
  };

  const deleteUser = async (u) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المستخدم نهائياً؟')) return;
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId: u.id }
      });
      if (error) {
        let errorMsg = error.message;
        try {
          if (error.context) {
            const errBody = await error.context.json();
            errorMsg = errBody.error || errorMsg;
          }
        } catch (e) { }
        throw new Error(errorMsg || 'فشل الحذف');
      }
      dispatch({ type: 'DELETE', entity: 'users', id: u.id });
      toast('تم حذف المستخدم بنجاح');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const byRole = Object.fromEntries(Object.keys(ROLES).map((r) => [r, (db.users || []).filter((u) => u.role === r).length]));

  return (
    <div className="page fade-in">
      <PageHead title="إدارة المستخدمين" sub="إدارة حسابات المستخدمين وصلاحياتهم">
        <button className="btn btn-primary btn-sm" onClick={() => setEdit({ id: null, name: '', email: '', role: 'viewer', dept: null, active: true })}><Plus size={15} /> مستخدم جديد</button>
      </PageHead>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <StatCard icon={Users} label="إجمالي المستخدمين" value={(db.users || []).length} />
        <StatCard icon={Shield} label="مدراء وصلاحيات كاملة" value={byRole.ceo + byRole.strategy_manager} color="var(--brand-deep)" bg="color-mix(in srgb,var(--brand-deep) 12%,transparent)" />
        <StatCard icon={Building2} label="مدراء الإدارات" value={byRole.dept_manager} color="var(--gold)" bg="color-mix(in srgb,var(--gold) 18%,transparent)" />
        <StatCard icon={Users} label="نشِط" value={(db.users || []).filter((u) => u.active).length} color="var(--st-completed)" bg="color-mix(in srgb,var(--st-completed) 12%,transparent)" />
      </div>

      <div className="card pad" style={{ marginBottom: 14, display: 'grid', gap: 12 }}>
        <SearchBox value={tbl.q} onChange={tbl.setQ} placeholder="بحث بالاسم أو البريد…" />
        <Chips options={ROLE_OPTS} value={roleF} onChange={setRoleF} />
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>المستخدم</th><th>البريد</th><th>الدور</th><th>الإدارة</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            {tbl.slice.map((u) => (
              <tr key={u.id}>
                <td><span className="row" style={{ gap: 9 }}><Avatar name={u.name} text={u.avatar} /><b style={{ fontSize: 13 }}>{u.name}</b></span></td>
                <td className="muted" style={{ fontSize: 12.5 }}>{u.email}</td>
                <td><span className="badge" style={{ background: 'var(--brand-tint)', color: 'var(--brand-deep)' }}><Shield size={12} />{ROLES[u.role]?.label}</span></td>
                <td className="muted" style={{ fontSize: 12 }}>{u.dept || '—'}</td>
                <td>
                  <button className={`badge ${u.active ? 'st-completed' : 'st-not_started'}`} onClick={() => toggleActive(u)} style={{ cursor: 'pointer' }} disabled={loading}>
                    {u.active ? <><Check size={12} /> نشِط</> : <><X size={12} /> موقوف</>}
                  </button>
                </td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEdit(u)} disabled={loading}><Pencil size={13} /></button>
                    {u.email !== user?.email && (
                      <button className="btn btn-ghost btn-sm" onClick={() => deleteUser(u)} disabled={loading} style={{ color: 'var(--st-delayed)' }}><X size={15} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager {...tbl} />

      {edit && <EditUser db={db} u={edit} onClose={() => setEdit(null)} onSave={save} loading={loading} />}
    </div>
  );
}

function EditUser({ db, u, onClose, onSave, loading }) {
  const [f, setF] = useState({ ...u });
  const [pw, setPw] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const isNew = !u.id;
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const needsDept = f.role === 'manager';

  const handleSave = () => {
    onSave({
      ...f,
      avatar: f.avatar || f.name.replace(/^(أ\.|م\.|د\.)\s*/, '').split(' ').slice(0, 2).map((w) => w[0]).join(' '),
      dept: needsDept ? f.dept : null,
    }, pw);
  };

  const isSaveDisabled = !f.name.trim() || !f.email.trim() || (isNew && (pw.length < 6 || pw !== pwConfirm)) || loading;

  return (
    <Modal title={isNew ? 'مستخدم جديد' : 'تعديل مستخدم'} subtitle={isNew ? "إنشاء حساب مستخدم جديد" : "تحديث بيانات المستخدم"} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={loading}>إلغاء</button>
        <button className="btn btn-primary" disabled={isSaveDisabled} onClick={handleSave}>
          {loading ? <><Loader2 size={15} className="spin" /> جاري الحفظ...</> : 'حفظ التغييرات'}
        </button>
      </>}>
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="الاسم"><input className="inp" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="الاسم الكامل" disabled={loading} /></Field>
        <Field label="البريد الإلكتروني"><input className="inp" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="name@hadiyah.org.sa" disabled={!isNew || loading} /></Field>
        {isNew && (
          <>
            <Field label="كلمة المرور (6 أحرف على الأقل)">
              <input className="inp" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" disabled={loading} />
            </Field>
            <Field label="تأكيد كلمة المرور">
              <input className="inp" type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} placeholder="••••••••" disabled={loading} />
              {pw && pwConfirm && pw !== pwConfirm && <span style={{ color: 'var(--st-delayed)', fontSize: 12, marginTop: 4 }}>كلمة المرور غير متطابقة</span>}
            </Field>
          </>
        )}
        <Field label="الدور">
          <select className="sel" value={f.role} onChange={(e) => set('role', e.target.value)} disabled={loading}>
            {ROLE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        {needsDept && (
          <Field label="الإدارة">
            <select className="sel" value={f.dept || ''} onChange={(e) => set('dept', e.target.value)} disabled={loading}>
              <option value="">— اختر —</option>
              {db.departments?.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </Field>
        )}
      </div>
    </Modal>
  );
}

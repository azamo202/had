import React, { useState } from 'react';
import {
  Settings as SettingsIcon, SlidersHorizontal, Palette, FileCheck2, RotateCcw,
  Sun, Moon, Save, Plus, X, Shield, Info,
} from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { can, DEFAULT_RULES, ROLES } from '../lib/status.js';
import { PageHead } from '../components/ui/Bits.jsx';
import { Field, StatusPill } from '../components/ui/Primitives.jsx';
import ImportExcel from '../components/ImportExcel.jsx';

export default function Settings() {
  const { rules, theme, dispatch, toast, user, db } = useApp();
  const admin = can.admin(user?.role);
  const [r, setR] = useState(rules);
  const [reset, setReset] = useState(false);

  const saveRules = () => {
    dispatch({ type: 'RULES', rules: r });
    toast('تم حفظ قواعد الحالة وإعادة احتساب المؤشرات');
  };
  
  const handleResetData = async () => {
    try {
      const { error: e1 } = await supabase.from('indicator_monthly_values')
        .update({ achieved_value: null, achieved_value_raw: null, updates_notes: null, evidence: null })
        .not('indicator_id', 'is', null);
      
      if (e1) throw e1;
      
      toast('تمت إعادة تعيين البيانات بنجاح، سيتم تحديث الصفحة...', 'success');
      setReset(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error(err);
      toast('حدث خطأ أثناء إعادة التعيين', 'error');
      setReset(false);
    }
  };

  return (
    <div className="page fade-in">
      <PageHead title="الإعدادات" sub="ضبط قواعد النظام والمظهر والبيانات" />

      {/* Appearance */}
      <div className="card pad" style={{ marginBottom: 18 }}>
        <div className="card-head"><h3 className="row" style={{ gap: 8 }}><Palette size={17} style={{ color: 'var(--brand)' }} />المظهر</h3></div>
        <div className="row" style={{ gap: 12 }}>
          <button className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => theme !== 'light' && dispatch({ type: 'THEME' })}><Sun size={16} /> فاتح</button>
          <button className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => theme !== 'dark' && dispatch({ type: 'THEME' })}><Moon size={16} /> داكن</button>
        </div>
      </div>

      {!admin ? (
        <div className="card pad">
          <div className="row" style={{ gap: 10, color: 'var(--text-2)' }}><Shield size={17} /><span style={{ fontSize: 13.5 }}>إعدادات النظام المتقدمة متاحة لمكتب الاستراتيجية والرئيس التنفيذي فقط.</span></div>
        </div>
      ) : (
        <>
          {/* Status rules */}
          <div className="card pad" style={{ marginBottom: 18 }}>
            <div className="card-head"><h3 className="row" style={{ gap: 8 }}><SlidersHorizontal size={17} style={{ color: 'var(--brand)' }} />قواعد احتساب الحالة</h3>
              <span className="card-sub">حدود نسبة التحقق التي تُحدد لون وحالة المؤشر</span></div>
            <div className="grid g-3" style={{ gap: 16 }}>
              <Field label="مكتمل (≥ %)" hint="90%-100% → مكتمل">
                <input className="inp" type="number" value={r.completed} onChange={(e) => setR({ ...r, completed: +e.target.value })} />
              </Field>
              <Field label="قيد التنفيذ (≥ %)" hint="70%-89% → قيد التنفيذ">
                <input className="inp" type="number" value={r.on_track} onChange={(e) => setR({ ...r, on_track: +e.target.value })} />
              </Field>
              <Field label="متأخر (≥ %)" hint="50%-69% → متأخر | أقل من ذلك → متعثر">
                <input className="inp" type="number" value={r.attention} onChange={(e) => setR({ ...r, attention: +e.target.value })} />
              </Field>
            </div>
            <div className="row between" style={{ marginTop: 16, flexWrap: 'wrap', gap: 12 }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <StatusPill status="completed" sm /><StatusPill status="on_track" sm /><StatusPill status="attention" sm /><StatusPill status="delayed" sm />
              </div>
              <div className="row" style={{ gap: 10 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setR(DEFAULT_RULES)}><RotateCcw size={14} /> الافتراضي</button>
                <button className="btn btn-primary btn-sm" onClick={saveRules}><Save size={15} /> حفظ القواعد</button>
              </div>
            </div>
          </div>



        </>
      )}
    </div>
  );
}

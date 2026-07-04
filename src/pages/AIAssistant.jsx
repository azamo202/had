import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Send, Sparkles, User2 } from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { st, fmtPct, fmt, fmtCurrency } from '../lib/status.js';
import { overallStats, makeIndex } from '../lib/select.js';
import { PageHead } from '../components/ui/Bits.jsx';

const SUGGESTIONS = [
  'ما ملخص أداء الخطة؟',
  'ما المشاريع المتعثرة؟',
  'ما المؤشرات المتأخرة عن المستهدف؟',
  'ما الشواهد الناقصة؟',
  'ما أفضل الإدارات أداءً؟',
  'ما التحديات المفتوحة؟',
];

export default function AIAssistant() {
  const { db, user } = useApp();
  const nav = useNavigate();
  const s = useMemo(() => overallStats(db), [db]);
  const idx = useMemo(() => makeIndex(db), [db]);
  const [msgs, setMsgs] = useState([
    { role: 'bot', text: `مرحباً ${user?.name?.split(' ').slice(0, 2).join(' ') || ''} 👋 أنا مساعد منصة هدية. اسألني عن أداء الخطة، المشاريع المتعثرة، المؤشرات، الشواهد أو التحديات.` },
  ]);
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const answer = (q) => {
    const t = q.trim();
    const low = t.replace(/\s+/g, '');
    if (/ملخص|أداء|الخطة|عام|وضع/.test(t))
      return `ملخص أداء الخطة:\n• التقدم الاستراتيجي: ${fmtPct(s.strategic)}\n• التقدم التشغيلي: ${fmtPct(s.operational)}\n• المشاريع المكتملة: ${s.projDone} من ${s.projTotal}\n• المشاريع المتعثرة: ${s.projDelayed}\n• متوسط تحقق المؤشرات: ${fmtPct(s.kpiAvg)}\n• طلبات اعتماد معلّقة: ${s.pendingApprovals} · تحديات مفتوحة: ${s.openChallenges}`;
    if (/متعثر|متأخر.*مشروع|أسوأ|تدخل/.test(t)) {
      const d = db.projects.filter((p) => ['delayed', 'attention'].includes(p.status)).sort((a, b) => a.progress - b.progress).slice(0, 5);
      return 'أبرز المشاريع المتعثرة:\n' + d.map((p) => `• ${p.name} (${fmtPct(p.progress)}) — ${p.dept}`).join('\n');
    }
    if (/مؤشر/.test(t)) {
      const k = db.kpis.filter((x) => ['delayed', 'attention'].includes(x.status)).sort((a, b) => (a.achievement ?? 999) - (b.achievement ?? 999)).slice(0, 5);
      return 'مؤشرات متأخرة عن المستهدف:\n' + k.map((x) => `• ${x.name} — ${fmtPct(x.achievement)}`).join('\n');
    }
    if (/شاهد|شواهد|دليل|أدلة/.test(t)) {
      const miss = db.evidences.filter((e) => ['missing', 'rejected'].includes(e.status));
      const rev = db.evidences.filter((e) => e.status === 'under_review').length;
      return `حالة الشواهد:\n• معتمدة: ${db.evidences.filter((e) => e.status === 'approved').length}\n• قيد المراجعة: ${rev}\n• ناقصة/مرفوضة: ${miss.length}` + (miss.length ? '\n\nتحتاج متابعة:\n' + miss.slice(0, 4).map((e) => `• ${e.title} (${idx.p[e.projectId]?.name || ''})`).join('\n') : '');
    }
    if (/إدار|قسم|أفضل|ترتيب/.test(t)) {
      const d = [...db.departments].filter((x) => x.projectCount > 0).sort((a, b) => b.progress - a.progress).slice(0, 5);
      return 'أفضل الإدارات أداءً:\n' + d.map((x, i) => `${i + 1}. ${x.name} — ${fmtPct(x.progress)}`).join('\n');
    }
    if (/تحدي|تحديات|معوق|مخاطر/.test(t)) {
      const c = db.challenges.filter((x) => x.status !== 'resolved');
      return `التحديات المفتوحة: ${c.length}\n` + c.slice(0, 5).map((x) => `• ${x.text} — ${x.dept}`).join('\n');
    }
    if (/موازنة|ميزانية|تكلفة|مالي/.test(t)) {
      const tot = db.goals.reduce((a, g) => a + (g.budget || 0), 0);
      const top = [...db.goals].sort((a, b) => (b.budget || 0) - (a.budget || 0)).slice(0, 3);
      return `إجمالي موازنة الخطة: ${fmtCurrency(tot)}\nأعلى الأهداف موازنةً:\n` + top.map((g) => `• ${g.name}: ${fmtCurrency(g.budget)}`).join('\n');
    }
    if (/هدف|أهداف/.test(t))
      return 'تقدم الأهداف الاستراتيجية:\n' + db.goals.map((g) => `• الهدف ${g.index}: ${fmtPct(g.progress)} (${st(g.status).label})`).join('\n');
    return 'يمكنني مساعدتك في: ملخص الأداء، المشاريع المتعثرة، المؤشرات المتأخرة، الشواهد الناقصة، ترتيب الإدارات، التحديات، والموازنات. جرّب أحد الاقتراحات بالأسفل.';
  };

  const send = (q) => {
    const text = (q ?? input).trim();
    if (!text) return;
    setMsgs((m) => [...m, { role: 'user', text }]);
    setInput('');
    setTimeout(() => setMsgs((m) => [...m, { role: 'bot', text: answer(text) }]), 350);
  };

  return (
    <div className="page fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      <PageHead title="المساعد الذكي" sub="مساعد تحليلي يجيب عن أسئلتك حول بيانات الخطة (نموذج أولي)" />

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {msgs.map((m, i) => (
            <div key={i} className="row" style={{ gap: 10, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
              <span className="ic" style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0, background: m.role === 'user' ? 'var(--surface-2)' : 'var(--brand)', color: m.role === 'user' ? 'var(--text)' : '#fff' }}>
                {m.role === 'user' ? <User2 size={16} /> : <Bot size={17} />}
              </span>
              <div style={{ maxWidth: '76%', padding: '11px 15px', borderRadius: 14, background: m.role === 'user' ? 'var(--brand-tint)' : 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {m.text}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div style={{ borderTop: '1px solid var(--border)', padding: 14 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {SUGGESTIONS.map((sug) => (
              <button key={sug} className="chip" onClick={() => send(sug)}><Sparkles size={12} style={{ marginInlineEnd: 4 }} />{sug}</button>
            ))}
          </div>
          <div className="row" style={{ gap: 10 }}>
            <input className="inp" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="اكتب سؤالك…" />
            <button className="btn btn-primary" onClick={() => send()}><Send size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

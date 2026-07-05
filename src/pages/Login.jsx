import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { Mail, Lock, ArrowLeft, ShieldCheck, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
  const { db, user, dispatch } = useApp();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  // If user is already authenticated and state is populated, redirect to home
  useEffect(() => {
    if (user) {
      nav('/', { replace: true });
    }
  }, [user, nav]);

  const login = async (e) => {
    e?.preventDefault();
    setErr('');

    if (!email || !pw) {
      setErr('الرجاء إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pw
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErr('البريد الإلكتروني أو كلمة المرور غير صحيحة');
        } else {
          setErr(error.message);
        }
        setLoading(false);
        return;
      }

      if (data?.user) {
        // AppContext will handle fetching the public.user record via onAuthStateChange listener
        // But we just let it load here.
        nav('/');
      }
    } catch (e) {
      setErr('حدث خطأ غير متوقع. حاول مرة أخرى.');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.05fr 1fr' }} className="login-grid">
      {/* brand side */}
      <div style={{ background: 'linear-gradient(150deg,#063f39,#00A092 130%)', color: '#fff', padding: '54px 56px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} className="login-hero">
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'url(/pattern.png)', backgroundSize: 'auto 120px', backgroundRepeat: 'repeat', opacity: 0.06 }} />
        <div style={{ position: 'absolute', width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle,#84D3A4 0%,transparent 70%)', opacity: 0.18, top: -160, insetInlineStart: -120 }} />
        <img src="/logo.png" alt="هدية" style={{ height: 60, filter: 'brightness(0) invert(1)', alignSelf: 'flex-start', position: 'relative' }} />
        <div style={{ marginTop: 'auto', position: 'relative' }}>
          <h1 style={{ fontSize: 40, lineHeight: 1.2, color: '#fff', maxWidth: 460 }}>منصة إدارة ومتابعة الخطة التشغيلية التنفيذية</h1>
        </div>
        <div style={{ marginTop: 30, fontSize: 12.5, opacity: 0.75, position: 'relative' }}>
          الإصدار 1.0
        </div>
      </div>

      {/* form side */}
      <div style={{ display: 'grid', placeItems: 'center', padding: 40, background: 'var(--bg)' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <h2 style={{ fontSize: 26 }}>تسجيل الدخول</h2>
          <p className="t2" style={{ marginTop: 6, marginBottom: 24 }}>مرحبًا بك. أدخل بيانات حسابك للمتابعة.</p>

          <form onSubmit={login} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            <div className="field">
              <label>البريد الإلكتروني</label>
              <div style={{ position: 'relative' }}>
                <Mail size={17} style={{ position: 'absolute', insetInlineStart: 12, top: 13, color: 'var(--text-3)' }} />
                <input
                  className="inp inp-lg"
                  style={{ paddingInlineStart: 38 }}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErr(''); }}
                  placeholder="you@hadiyah.org.sa"
                  disabled={loading}
                />
              </div>
            </div>
            <div className="field">
              <label>كلمة المرور</label>
              <div style={{ position: 'relative' }}>
                <Lock size={17} style={{ position: 'absolute', insetInlineStart: 12, top: 13, color: 'var(--text-3)' }} />
                <input
                  className="inp inp-lg"
                  style={{ paddingInlineStart: 38 }}
                  type={show ? 'text' : 'password'}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="icon-btn"
                  style={{ position: 'absolute', insetInlineEnd: 6, top: 5, width: 34, height: 34, border: 'none', background: 'transparent' }}
                  onClick={() => setShow((s) => !s)}
                  disabled={loading}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {err && <div className="badge st-delayed" style={{ padding: '8px 12px' }}>{err}</div>}

            <button
              className="btn btn-primary inp-lg"
              type="submit"
              style={{ justifyContent: 'center', marginTop: 4, gap: 10 }}
              disabled={loading}
            >
              {loading ? (
                <>جاري تسجيل الدخول <Loader2 size={17} className="spin" /></>
              ) : (
                <>تسجيل الدخول <ArrowLeft size={17} /></>
              )}
            </button>
          </form>

        </div>
      </div>
      <style>{`@media(max-width:860px){.login-grid{grid-template-columns:1fr !important}.login-hero{display:none !important}}`}</style>
    </div>
  );
}

function Stat({ n, l }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{l}</div>
    </div>
  );
}

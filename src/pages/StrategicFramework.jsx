import React from 'react';
import { Eye, Target, Heart, Layers, Goal } from 'lucide-react';
import { PageHead } from '../components/ui/Bits.jsx';

export default function StrategicFramework() {
  const colors = {
    brand: 'var(--brand)',
    brandTint: '#e6f7f5',
    brandDeep: '#063f39',
    grayLabel: '#6b7280',
    grayLabelDeep: '#4b5563',
    grayBox: '#f8f9fa',
    grayBorder: '#e5e7eb',
    grayText: '#374151'
  };

  return (
    <div className="page fade-in">
      <PageHead title="الإطار الإستراتيجي" sub="منظومة التوجه الاستراتيجي (بيت الاستراتيجية)" />

      <style>{`
        .strat-box {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .strat-box::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 3px;
          background: var(--brand);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .strat-box:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px -8px rgba(0,0,0,0.08), 0 4px 8px -4px rgba(0,0,0,0.04) !important;
          border-color: var(--brand) !important;
        }
        .strat-box.brand-hover:hover::before { opacity: 1; }

        .strat-roof {
          background: linear-gradient(135deg, #063f39, #00A092);
          position: relative;
        }
        .strat-roof::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url(/pattern.png);
          background-size: 140px;
          opacity: 0.08;
          border-radius: 28px 28px 0 0;
          pointer-events: none;
        }
        .strat-pill {
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.4s ease;
        }
        .strat-pill:hover {
          transform: scale(1.03) translateY(-2px);
          box-shadow: 0 15px 35px rgba(0,160,146,0.25) !important;
        }
        .label-gradient {
          background: linear-gradient(135deg, var(--brand), #028378);
          box-shadow: inset 0 2px 4px rgba(255,255,255,0.2);
        }
        .label-gray {
          background: linear-gradient(135deg, #8A929A, #6b7280);
          box-shadow: inset 0 2px 4px rgba(255,255,255,0.2);
        }
      `}</style>

      <div style={{ maxWidth: 1140, margin: '0 auto', fontFamily: 'var(--font-sans)', paddingBottom: 40 }}>
        
        {/* Vision (Roof) */}
        <div className="strat-roof" style={{ 
          color: '#fff', 
          borderRadius: '28px 28px 0 0', 
          padding: '48px 40px',
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,160,146,0.15)',
          borderBottom: '3px solid rgba(255,255,255,0.15)'
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 22, fontWeight: 800, marginBottom: 24, textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
            <Eye size={26} opacity={0.9} /> الرؤية
          </div>
          <br/>
          <div className="strat-pill" style={{ 
            background: '#fff', 
            color: colors.brandDeep, 
            padding: '20px 48px', 
            borderRadius: 99, 
            fontSize: 20, 
            fontWeight: 800, 
            display: 'inline-block', 
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            border: `1px solid rgba(255,255,255,0.8)`,
            position: 'relative',
            zIndex: 1
          }}>
            ريادة التميز والابتكار في خدمة ضيوف الرحمن، وإثراء تجربتهم الإيمانية والثقافية
          </div>
        </div>

        {/* Main Body */}
        <div style={{ 
          background: '#fff', 
          padding: '32px', 
          borderRadius: '0 0 28px 28px', 
          boxShadow: '0 10px 40px rgba(0,0,0,0.05)',
          display: 'grid',
          gap: '20px',
          border: '1px solid #f1f3f5',
          borderTop: 'none'
        }}>
          
          {/* Mission */}
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 16 }}>
            <div className="label-gradient" style={{ color: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, fontSize: 16 }}>
              <Target size={20} opacity={0.8} /> الرسالة
            </div>
            <div className="strat-box" style={{ background: 'linear-gradient(to right, #ffffff, #f4fdfc)', border: `1px solid #d1eae6`, borderRadius: 12, padding: '24px 32px', textAlign: 'center', color: colors.brandDeep, fontWeight: 700, fontSize: 17, lineHeight: 1.6, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              تعظيم المنافع الإيمانية والتنموية في رحلة الحاج والمعتمر والزائر عبر منظومة مستدامة من الخدمات المبتكرة والشراكات التكاملية والقدرات المؤسسية.
            </div>
          </div>

          {/* Core Values */}
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 16 }}>
            <div className="label-gray" style={{ color: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, fontSize: 15 }}>
              <Heart size={20} opacity={0.8} /> القيم الحاكمة
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              {['العطاء', 'التسامح', 'الإتقان', 'الإبداع والابتكار', 'التعاون'].map(v => (
                <div key={v} className="strat-box" style={{ background: '#fff', border: `1px solid ${colors.grayBorder}`, borderRadius: 12, padding: '16px 8px', textAlign: 'center', color: colors.grayText, fontWeight: 700, fontSize: 15, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                  {v}
                </div>
              ))}
            </div>
          </div>

          {/* Strategic Pillars */}
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 16 }}>
            <div className="label-gradient" style={{ color: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700, fontSize: 15, textAlign: 'center' }}>
              <Layers size={20} opacity={0.8} /> الركائز الإستراتيجية
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {['(1) تعظيم المنافع الإيمانية والتنموية', '(2) الابتكار في المنتجات والخدمات', '(3) التميز المؤسسي', '(4) الاستدامة المالية'].map(v => (
                <div key={v} className="strat-box brand-hover" style={{ background: colors.brandTint, border: `1px solid #b7e3de`, borderRadius: 12, padding: '20px 12px', textAlign: 'center', color: colors.brandDeep, fontWeight: 700, fontSize: 14, display: 'grid', placeItems: 'center', lineHeight: 1.5 }}>
                  {v}
                </div>
              ))}
            </div>
          </div>

          <div style={{ margin: '16px 0', height: 1, background: 'linear-gradient(to right, transparent, #e5e7eb, transparent)' }} />

          {/* Strategic Goals Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: colors.brandDeep, fontWeight: 800, fontSize: 20, marginBottom: 8 }}>
            <Goal size={24} style={{ color: colors.brand }} /> الأهداف الإستراتيجية
          </div>

          {/* Goals Matrix */}
          <div style={{ display: 'grid', gridTemplateColumns: '48px 140px 1fr', gap: 16 }}>
            
            {/* Mahawer (Perspectives) Vertical Label */}
            <div style={{ gridRow: '1 / span 4', background: '#f8fafc', border: `1px solid #e2e8f0`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.02)' }}>
               <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: 800, color: colors.grayLabelDeep, fontSize: 16, letterSpacing: 4 }}>
                 المحاور
               </div>
            </div>

            {/* Row 1: Beneficiaries */}
            <div className="label-gray" style={{ color: '#fff', borderRadius: 12, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 15 }}>
              المستفيدين
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {['1. تقديم تجربة إيمانية وثقافية ثرية للقاصدين.', '2. تعظيم المنافع الإيمانية والتنموية في رحلة الحاج والمعتمر والزائر.', '3. التكامل مع الجهات ذات العلاقة بخدمة ضيوف الرحمن.'].map(v => (
                <div key={v} className="strat-box" style={{ background: '#fff', border: `1px solid ${colors.grayBorder}`, borderRadius: 12, padding: '20px 16px', textAlign: 'center', color: colors.grayText, fontWeight: 600, fontSize: 13.5, display: 'grid', placeItems: 'center', lineHeight: 1.6, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                  {v}
                </div>
              ))}
            </div>

            {/* Row 2: Operations */}
            <div className="label-gradient" style={{ color: '#fff', borderRadius: 12, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 15 }}>
              العمليات
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {['4. بناء منظومة ريادية في الابتكار وتطوير الأعمال.', '5. تطوير كفاءة سلاسل الإمداد واستدامتها.', '6. تعزيز المكانة المتميزة للجمعية.'].map(v => (
                <div key={v} className="strat-box brand-hover" style={{ background: colors.brandTint, border: `1px solid #b7e3de`, borderRadius: 12, padding: '20px 16px', textAlign: 'center', color: colors.brandDeep, fontWeight: 600, fontSize: 13.5, display: 'grid', placeItems: 'center', lineHeight: 1.6 }}>
                  {v}
                </div>
              ))}
            </div>

            {/* Row 3: Enablers */}
            <div className="label-gray" style={{ color: '#fff', borderRadius: 12, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 15 }}>
              الممكنات
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {['7. تطوير القدرات التنظيمية والرقمية وفق معايير التميز المؤسسي.', '8. تمكين الكفاءات الوظيفية والتطوعية المتخصصة.'].map(v => (
                <div key={v} className="strat-box" style={{ background: '#fff', border: `1px solid ${colors.grayBorder}`, borderRadius: 12, padding: '20px 16px', textAlign: 'center', color: colors.grayText, fontWeight: 600, fontSize: 13.5, display: 'grid', placeItems: 'center', lineHeight: 1.6, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                  {v}
                </div>
              ))}
            </div>

            {/* Row 4: Sustainability */}
            <div className="label-gradient" style={{ color: '#fff', borderRadius: 12, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 15 }}>
              الاستدامة
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
              <div className="strat-box brand-hover" style={{ background: colors.brandTint, border: `1px solid #b7e3de`, borderRadius: 12, padding: '20px 16px', textAlign: 'center', color: colors.brandDeep, fontWeight: 600, fontSize: 13.5, display: 'grid', placeItems: 'center', lineHeight: 1.6 }}>
                9. تنمية الموارد المالية والأصول الوقفية والاستثمارية.
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

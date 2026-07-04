import React, { useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

function useEsc(onClose) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

export function Modal({ title, subtitle, onClose, children, footer, wide }) {
  useEsc(onClose);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <div className="card-sub" style={{ marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, subtitle, onClose, children, footer }) {
  useEsc(onClose);
  return (
    <>
      <div className="overlay" style={{ background: 'rgba(6,25,22,.4)' }} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()} />
      <div className="drawer">
        <div className="drawer-head">
          <div>
            <h3 style={{ fontSize: 17 }}>{title}</h3>
            {subtitle && <div className="card-sub" style={{ marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="modal-foot" style={{ position: 'static' }}>{footer}</div>}
      </div>
    </>
  );
}

export function Confirm({ title, message, confirmLabel = 'تأكيد', danger, onConfirm, onClose }) {
  useEsc(onClose);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-body" style={{ textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, display: 'grid', placeItems: 'center', margin: '4px auto 14px', background: danger ? 'color-mix(in srgb,var(--st-delayed) 12%,transparent)' : 'var(--brand-tint)', color: danger ? 'var(--st-delayed)' : 'var(--brand)' }}>
            <AlertTriangle size={26} />
          </div>
          <h3>{title}</h3>
          <p className="t2" style={{ margin: '8px 0 20px' }}>{message}</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn btn-ghost" onClick={onClose}>إلغاء</button>
            <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => { onConfirm?.(); onClose?.(); }}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

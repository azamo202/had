import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, FolderKanban, Gauge, FileWarning, Clock, XCircle, CalendarClock,
} from 'lucide-react';
import { useApp } from '../store/AppContext.jsx';
import { st } from '../lib/status.js';
import { PageHead } from '../components/ui/Bits.jsx';
import { Chips, EmptyState } from '../components/ui/Primitives.jsx';

const TYPE_META = {
  project_delayed: { icon: FolderKanban, label: 'مشروع متعثر', tone: 'delayed' },
  kpi_overdue: { icon: Gauge, label: 'مؤشر متأخر', tone: 'attention' },
  evidence_missing: { icon: FileWarning, label: 'شاهد ناقص', tone: 'delayed' },
  approval_pending: { icon: Clock, label: 'اعتماد معلّق', tone: 'on_track' },
  update_rejected: { icon: XCircle, label: 'تحديث مرفوض', tone: 'delayed' },
  update_due: { icon: CalendarClock, label: 'تحديث مستحق', tone: 'attention' },
};

const TYPE_TARGET = {
  project_delayed: (n) => '/projects?id=' + n.entityId,
  kpi_overdue: (n) => '/kpis?id=' + n.entityId,
  evidence_missing: () => '/evidence',
  approval_pending: () => '/reports',
  update_rejected: (n) => '/followup?project=' + n.entityId,
  update_due: (n) => '/followup?project=' + n.entityId,
};

export default function Notifications() {
  const { db, dispatch, toast } = useApp();
  const nav = useNavigate();
  const [filter, setFilter] = useState(null); // null|unread|read

  const rows = useMemo(() => {
    if (filter === 'unread') return db.notifications.filter((n) => !n.read);
    if (filter === 'read') return db.notifications.filter((n) => n.read);
    return db.notifications;
  }, [db, filter]);
  const unread = db.notifications.filter((n) => !n.read).length;

  const open = (n) => {
    dispatch({ type: 'NOTIF_READ', id: n.id });
    const to = TYPE_TARGET[n.type]?.(n);
    if (to) nav(to);
  };

  return (
    <div className="page fade-in">
      <PageHead title="مركز الإشعارات" sub={`${unread} إشعار غير مقروء`}>
        {unread > 0 && <button className="btn btn-ghost btn-sm" onClick={() => { dispatch({ type: 'NOTIF_READ' }); toast('تم تعليم الكل كمقروء'); }}><CheckCheck size={15} /> تعليم الكل كمقروء</button>}
      </PageHead>

      <div style={{ marginBottom: 16 }}>
        <Chips options={[{ value: 'unread', label: 'غير مقروء' }, { value: 'read', label: 'مقروء' }]} value={filter} onChange={setFilter} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Bell} title="لا توجد إشعارات" hint="ستظهر هنا التنبيهات المتعلقة بالمشاريع والمؤشرات والاعتمادات" />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((n) => {
            const meta = TYPE_META[n.type] || { icon: Bell, label: 'إشعار', tone: 'on_track' };
            const c = st(meta.tone).color;
            return (
              <button key={n.id} className="card card-hover" style={{ padding: 15, textAlign: 'start', display: 'flex', gap: 13, alignItems: 'center', borderInlineStart: n.read ? '1px solid var(--border)' : `3px solid ${c}`, opacity: n.read ? 0.72 : 1 }} onClick={() => open(n)}>
                <span className="ic" style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: `color-mix(in srgb,${c} 13%,transparent)`, color: c, flexShrink: 0 }}><meta.icon size={19} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row between">
                    <span style={{ fontSize: 13.5, fontWeight: 500 }}>{n.title}</span>
                    {!n.read && <span style={{ width: 8, height: 8, borderRadius: 99, background: c, flexShrink: 0 }} />}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{meta.label} · {n.entity} · {n.time}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

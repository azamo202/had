import {
  LayoutDashboard, Compass, Target, ClipboardList, CalendarCheck, Users, Settings, FileSpreadsheet
} from 'lucide-react';

export const NAV = [
  { section: '', items: [
    { to: '/', label: 'لوحة المعلومات', icon: LayoutDashboard, end: true },
    { to: '/framework', label: 'الإطار الاستراتيجي', icon: Compass },
    { to: '/strategic', label: 'الخطة الاستراتيجية', icon: Target },
    { to: '/operational', label: 'الخطة التشغيلية', icon: ClipboardList },
    { to: '/followup', label: 'المتابعة الشهرية', icon: CalendarCheck },
  ]},
  { section: 'الإدارة', items: [
    { to: '/users', label: 'إدارة المستخدمين', icon: Users },
    { to: '/import', label: 'استيراد البيانات', icon: FileSpreadsheet },
    { to: '/settings', label: 'الإعدادات', icon: Settings },
  ]},
];

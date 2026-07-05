// ============ Status, formatting, roles ============

export const STATUS = {
  completed:   { key: 'completed',   label: 'مكتمل',        color: 'var(--st-completed)' },
  on_track:    { key: 'on_track',    label: 'على المسار',   color: 'var(--st-ontrack)' },
  attention:   { key: 'attention',   label: 'يحتاج متابعة', color: 'var(--st-attention)' },
  delayed:     { key: 'delayed',     label: 'متأخر / حرج',  color: 'var(--st-delayed)' },
  not_started: { key: 'not_started', label: 'لم يبدأ',      color: 'var(--st-notstarted)' },
};

// editable thresholds (Settings > Status Rules)
export const DEFAULT_RULES = { completed: 100, on_track: 70, attention: 40 };

export function statusFromPct(pct, hasData = true, rules = DEFAULT_RULES) {
  if (!hasData || pct === null || pct === undefined) return 'not_started';
  if (pct >= rules.completed) return 'completed';
  if (pct >= rules.on_track) return 'on_track';
  if (pct >= rules.attention) return 'attention';
  return 'delayed';
}

export const st = (k) => STATUS[k] || STATUS.not_started;

export const ROLES = {
  ceo: { label: 'الرئيس التنفيذي', short: 'الرئيس التنفيذي' },
  strategy_office: { label: 'مدير المنصة', short: 'مدير المنصة' },
  manager: { label: 'ممثل إدارة / مسؤول تحديث (جهة تنفيذية)', short: 'ممثل إدارة' },
};

// permission helpers
export const can = {
  edit:    (r) => r === 'strategy_office' || r === 'manager',
  approve: (r) => r === 'strategy_office',
  admin:   (r) => r === 'strategy_office',
  manageUsers: (r) => r === 'strategy_office',
};

// number formatting (Arabic-Indic optional; keep western for clarity)
export function fmt(n) {
  if (n === null || n === undefined || n === '') return '—';
  if (typeof n !== 'number') return String(n);
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
}
export function fmtVal(n, isPct) {
  if (n === null || n === undefined || n === '') return '—';
  const v = typeof n !== 'number' ? String(n) : n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  return isPct ? v + '%' : v;
}
export function fmtCurrency(n) {
  if (!n && n !== 0) return '—';
  return fmt(n) + ' ﷼';
}
export function fmtPct(n) {
  if (n === null || n === undefined) return '—';
  return Math.round(n) + '%';
}
export function compact(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' مليار';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' مليون';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' ألف';
  return fmt(n);
}
export const clampPct = (p) => (p === null || p === undefined ? null : Math.max(0, Math.min(140, p)));

export const EVIDENCE_STATUS = {
  approved:     { label: 'معتمد',        cls: 'st-completed' },
  uploaded:     { label: 'مرفوع',        cls: 'st-on_track' },
  under_review: { label: 'قيد المراجعة', cls: 'st-attention' },
  missing:      { label: 'مفقود',        cls: 'st-delayed' },
  rejected:     { label: 'مرفوض',        cls: 'st-delayed' },
};
export const APPROVAL_STATUS = {
  pending:  { label: 'بانتظار المراجعة', cls: 'st-attention' },
  approved: { label: 'معتمد',            cls: 'st-completed' },
  rejected: { label: 'مرفوض',            cls: 'st-delayed' },
  needs_modification: { label: 'طلب تعديل', cls: 'st-attention' },
  draft:    { label: 'مسودة',            cls: 'st-not_started' },
};
export const CHALLENGE_SEV = {
  high:   { label: 'عالية',   cls: 'st-delayed' },
  medium: { label: 'متوسطة',  cls: 'st-attention' },
  low:    { label: 'منخفضة',  cls: 'st-on_track' },
};
export const CHALLENGE_STATUS = {
  open:        { label: 'مفتوح',      cls: 'st-delayed' },
  in_progress: { label: 'قيد المعالجة', cls: 'st-attention' },
  resolved:    { label: 'مُعالج',     cls: 'st-completed' },
};

export const uid = (p = 'X') => p + Math.random().toString(36).slice(2, 8);

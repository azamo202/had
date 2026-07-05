import { useMemo, useState } from 'react';

// ---- role-based visibility ---------------------------------------------
export function scopeProjects(db, user) {
  if (!user) return [];
  if (user.role === 'ceo' || user.role === 'strategy_office') return db.projects;
  if (user.role === 'manager') return db.projects.filter((p) => p.dept === user.dept);
  return db.projects;
}

export function scopeKpis(db, user) {
  const pids = new Set(scopeProjects(db, user).map((p) => p.id));
  return db.kpis.filter((k) => pids.has(k.projectId));
}

// ---- lookups ------------------------------------------------------------
export function makeIndex(db) {
  const g = Object.fromEntries(db.goals.map((x) => [x.id, x]));
  const o = Object.fromEntries(db.objectives.map((x) => [x.id, x]));
  const i = Object.fromEntries(db.initiatives.map((x) => [x.id, x]));
  const p = Object.fromEntries(db.projects.map((x) => [x.id, x]));
  const k = Object.fromEntries(db.kpis.map((x) => [x.id, x]));
  const d = Object.fromEntries(db.departments.map((x) => [x.id, x]));
  return { g, o, i, p, k, d };
}

// ---- aggregate stats ----------------------------------------------------
export function overallStats(db) {
  const withData = db.kpis.filter((k) => k.achievement != null);
  const kpiAvg = withData.length ? withData.reduce((s, k) => s + Math.min(120, k.achievement), 0) / withData.length : 0;
  const projDone = db.projects.filter((p) => p.status === 'completed').length;
  const projDelayed = db.projects.filter((p) => p.status === 'delayed').length;
  const projNotStarted = db.projects.filter((p) => p.status === 'not_started').length;
  const projInProgress = db.projects.filter((p) => p.status === 'on_track' || p.status === 'attention').length;
  const strategic = db.goals.length ? db.goals.reduce((s, g) => s + g.progress, 0) / db.goals.length : 0;
  const operational = db.projects.length ? db.projects.reduce((s, p) => s + p.progress, 0) / db.projects.length : 0;
  return {
    strategic: Math.round(strategic * 10) / 10,
    operational: Math.round(operational * 10) / 10,
    kpiAvg: Math.round(kpiAvg * 10) / 10,
    projDone, projDelayed, projNotStarted, projInProgress,
    projTotal: db.projects.length,
    kpiTotal: db.kpis.length,
    missingEvidence: (db.evidences || []).filter((e) => e.status === 'missing').length,
    pendingApprovals: (db.approvals || []).filter((a) => a.status === 'pending').length,
    openChallenges: (db.challenges || []).filter((c) => c.status === 'open').length,
  };
}

export const statusCounts = (arr) => {
  const c = { completed: 0, on_track: 0, attention: 0, delayed: 0, not_started: 0 };
  arr.forEach((x) => { c[x.status] = (c[x.status] || 0) + 1; });
  return c;
};

// ---- generic table hook: search + sort + paginate -----------------------
export function useTable(rows, { pageSize = 10, initialSort = null } = {}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState(initialSort); // { key, dir }
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let r = rows;
    if (q.trim()) {
      const t = q.trim();
      r = r.filter((row) => JSON.stringify(Object.values(row)).includes(t));
    }
    if (sort) {
      r = [...r].sort((a, b) => {
        const av = a[sort.key], bv = b[sort.key];
        const na = typeof av === 'number', nb = typeof bv === 'number';
        let cmp;
        if (na && nb) cmp = av - bv;
        else cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'ar');
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return r;
  }, [rows, q, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages);
  const slice = filtered.slice((cur - 1) * pageSize, cur * pageSize);

  const toggleSort = (key) =>
    setSort((s) => (s && s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  return { q, setQ: (v) => { setQ(v); setPage(1); }, sort, toggleSort, page: cur, pages, setPage, slice, total: filtered.length };
}

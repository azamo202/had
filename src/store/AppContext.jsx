import React, { createContext, useContext, useEffect, useMemo, useReducer, useCallback, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { DEFAULT_RULES, statusFromPct, clampPct, uid } from '../lib/status.js';

// ─── Notification helper: inserts a row into Supabase notifications table ───
export async function sendNotification({ userId, type, title, body = '', entityId = null, projectId = null }) {
  if (!userId) return;
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    entity_id: entityId,
    project_id: projectId,
    read: false,
  });
  if (error) console.error('[sendNotification]', error);
}

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const LS = 'hadiyah_state_v1';

function loadPersisted() {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function recomputeKpi(k, rules, approvals) {
  const has = k.targetNum != null && k.targetNum > 0;

  // هل هذا مؤشر نسبة مئوية تراكمية؟ (مثال: نسبة تفعيل الشراكات)
  const isPctKpi = k.targetPct || String(k.targetRaw || '').includes('%') || String(k.name || '').includes('نسبة');

  // المستهدف السنوي الفعلي (إذا كان مخزناً كعشري 0.9 نحوّله إلى 90)
  const effectiveTarget = (isPctKpi && k.targetNum > 0 && k.targetNum <= 1)
    ? k.targetNum * 100
    : k.targetNum;

  // ── دالة مساعدة: هل المنجز معتمد؟ ─────────────────────────────
  const isApproved = (m) => {
    const appRecord = approvals?.find(a => a.projectId === k.projectId && a.monthNum === m.month);
    return appRecord ? appRecord.status === 'approved' : true; // لا يوجد سجل = مستورد من الإكسل
  };

  // ── حساب المنجز الكلي ────────────────────────────────────────────
  // للمؤشرات التراكمية (نسبة مئوية): نأخذ آخر قيمة معتمدة فقط
  // للمؤشرات التجميعية (عدد، مبلغ): نجمع H1 الكلي + أشهر H2 بشكل تراكمي
  let totalActual = 0;

  if (isPctKpi) {
    // تراكمي: السبتمبر=70% يعني "وصلنا 70% حتى الآن" وليس إضافة
    const allMonths = [...(k.monthly || [])].sort((a, b) => a.month - b.month);
    const lastApproved = [...allMonths].reverse().find(m => m.actual != null && m.actual !== '' && isApproved(m));
    totalActual = lastApproved ? Number(lastApproved.actual) : 0;
  } else {
    // تجميعي: منجز H1 (مخزن في يونيو شهر 6) + مجموع أشهر H2 المعتمدة
    const h1Entry = (k.monthly || []).find(m => m.month === 6);
    const h1Actual = (h1Entry && h1Entry.actual != null) ? Number(h1Entry.actual) : 0;

    const h2Actual = (k.monthly || [])
      .filter(m => m.month >= 7 && m.month <= 12 && m.actual != null && m.actual !== '' && isApproved(m))
      .reduce((s, m) => s + Number(m.actual), 0);

    totalActual = h1Actual + h2Actual;
  }

  const pct = has ? clampPct((totalActual / effectiveTarget) * 100) : null;

  // ── لأغراض العرض في صفحة المتابعة (H1 / H2) ────────────────────
  let h1Pct = null;
  if (k.h1ProjectProgress != null) {
    h1Pct = clampPct(k.h1ProjectProgress);
  } else if (has) {
    const h1Monthly = (k.monthly || []).filter(m => m.month >= 1 && m.month <= 6);
    const lastH1Target = [...h1Monthly].reverse().find(m => m.target != null)?.target ?? null;
    const lastH1Actual = [...h1Monthly].reverse().find(m => m.actual != null)?.actual ?? null;
    h1Pct = (lastH1Target != null && lastH1Target > 0 && lastH1Actual != null)
      ? clampPct((lastH1Actual / lastH1Target) * 100)
      : 0;
  }

  const h2Pct = has && pct != null ? clampPct(pct) : 0; // للعرض فقط

  return { ...k, achievedNum: totalActual, achievement: pct, h1Pct, h2Pct, status: statusFromPct(pct, has, rules) };
}


function rollup(db, rules) {
  if (!db || !db.goals) return db;
  const kpis = (db.kpis || []).map((k) => recomputeKpi(k, rules, db.approvals));
  const projects = (db.projects || []).map((p) => {
    const allPk = kpis.filter((k) => k.projectId === p.id);
    const pk = allPk.filter((k) => k.achievement != null);
    const prog = pk.length ? Math.min(120, Math.round((pk.reduce((s, k) => s + k.achievement, 0) / pk.length) * 10) / 10) : 0;
    return { ...p, progress: prog, status: statusFromPct(prog, pk.length > 0, rules), kpiCount: allPk.length };
  });
  const initiatives = (db.initiatives || []).map((i) => {
    const ip = projects.filter((p) => p.initiativeId === i.id);
    const prog = ip.length ? Math.round((ip.reduce((s, p) => s + p.progress, 0) / ip.length) * 10) / 10 : 0;
    return { ...i, progress: prog, status: statusFromPct(prog, ip.length > 0, rules), projectCount: ip.length };
  });
  const goals = (db.goals || []).map((g) => {
    const gp = projects.filter((p) => p.goalId === g.id);
    const prog = gp.length ? Math.round((gp.reduce((s, p) => s + p.progress, 0) / gp.length) * 10) / 10 : 0;
    return { ...g, progress: prog, status: statusFromPct(prog, gp.length > 0, rules) };
  });
  const departments = (db.departments || []).map((d) => {
    const dp = projects.filter((p) => p.dept === d.name);
    const prog = dp.length ? Math.round((dp.reduce((s, p) => s + p.progress, 0) / dp.length) * 10) / 10 : 0;
    return { ...d, progress: prog, projectCount: dp.length, status: statusFromPct(prog, dp.length > 0, rules) };
  });
  return {
    ...db,
    evidences: db.evidences || [],
    challenges: db.challenges || [],
    approvals: db.approvals || [],
    notifications: db.notifications || [],
    kpis, projects, initiatives, goals, departments
  };
}

function initState() {
  const persisted = loadPersisted();
  const rules = persisted?.rules || DEFAULT_RULES;
  const initialDb = {
    goals: [], objectives: [], initiatives: [], projects: [], kpis: [], departments: [], approvals: [], evidenceTypes: [], notifications: [], evidences: [], challenges: []
  };
  const db = rollup(persisted?.db || initialDb, rules);
  return {
    user: persisted?.user || null,
    theme: persisted?.theme || 'light',
    collapsed: persisted?.collapsed || false,
    rules,
    db,
    toasts: [],
    mobileNav: false,
  };
}

function reducer(state, a) {
  switch (a.type) {
    case 'LOGIN': return { ...state, user: a.user };
    case 'LOGOUT': {
      supabase.auth.signOut();
      try { localStorage.removeItem(LS); } catch { /* ignore */ }
      return { ...state, user: null };
    }
    case 'THEME': return { ...state, theme: state.theme === 'light' ? 'dark' : 'light' };
    case 'COLLAPSE': return { ...state, collapsed: !state.collapsed };
    case 'MOBILE_NAV': return { ...state, mobileNav: a.open ?? !state.mobileNav };
    case 'TOAST': return { ...state, toasts: [...state.toasts, { id: uid('t'), ...a.toast }] };
    case 'UNTOAST': return { ...state, toasts: state.toasts.filter((t) => t.id !== a.id) };
    case 'RULES': {
      const rules = { ...state.rules, ...a.rules };
      return { ...state, rules, db: rollup(state.db, rules) };
    }
    case 'SET_DB': {
      const mergedDb = { ...state.db, ...a.db };
      if (a.db.challenges && state.db.challenges) {
        const localChallenges = state.db.challenges.filter(c => !String(c.id).startsWith('C_db_'));
        mergedDb.challenges = [...localChallenges, ...a.db.challenges];
      }
      return { ...state, db: rollup(mergedDb, state.rules) };
    }
    case 'KPI_MONTH': {
      const kpis = state.db.kpis.map((k) => {
        if (k.id !== a.kpiId) return k;
        // Ensure the month slot exists
        const monthly = k.monthly.map((m) => (m.month === a.month ? { ...m, ...a.patch } : m));
        // If the month wasn't in the array yet, add it
        const exists = k.monthly.some(m => m.month === a.month);
        const finalMonthly = exists ? monthly : [...monthly, { month: a.month, ...a.patch }];
        return { ...k, monthly: finalMonthly };
      });
      return { ...state, db: rollup({ ...state.db, kpis }, state.rules) };
    }
    // Refresh specific KPI monthly values from Supabase payload
    case 'REFRESH_KPI_MONTHLY': {
      const { indicatorId, month, achieved_value } = a;
      const kpis = state.db.kpis.map((k) => {
        if (k.id !== indicatorId) return k;
        const exists = k.monthly.some(m => m.month === month);
        const monthly = exists
          ? k.monthly.map(m => m.month === month ? { ...m, actual: achieved_value } : m)
          : [...k.monthly, { month, actual: achieved_value }];
        return { ...k, monthly };
      });
      return { ...state, db: rollup({ ...state.db, kpis }, state.rules) };
    }
    case 'UPSERT': {
      const list = state.db[a.entity] || [];
      const exists = list.some((x) => x.id === a.item.id);
      const next = exists ? list.map((x) => (x.id === a.item.id ? { ...x, ...a.item } : x)) : [...list, a.item];
      return { ...state, db: rollup({ ...state.db, [a.entity]: next }, state.rules) };
    }
    case 'DELETE': {
      const list = state.db[a.entity] || [];
      const next = list.filter((x) => x.id !== a.id);
      return { ...state, db: rollup({ ...state.db, [a.entity]: next }, state.rules) };
    }
    case 'SUBMIT_APPROVAL': {
      const approvals = [...state.db.approvals];
      const idx = approvals.findIndex((x) => x.projectId === a.projectId && x.month === a.month);
      const monthNum = MONTHS.indexOf(a.month) + 1;
      const rec = {
        id: idx >= 0 ? approvals[idx].id : uid('AP'),
        projectId: a.projectId, goalId: a.goalId, dept: a.dept, month: a.month, monthNum,
        status: a.draft ? 'draft' : 'pending', submittedBy: a.by, note: a.note || 'تحديث الإنجاز الشهري', comments: [],
      };
      if (idx >= 0) approvals[idx] = rec; else approvals.push(rec);
      return { ...state, db: rollup({ ...state.db, approvals }, state.rules) };
    }
    case 'APPROVAL_DECIDE': {
      const approvals = state.db.approvals.map((x) =>
        x.id === a.id ? { ...x, status: a.decision, comments: [...(x.comments || []), ...(a.comment ? [{ by: a.by, text: a.comment, decision: a.decision }] : [])] } : x
      );
      return { ...state, db: rollup({ ...state.db, approvals }, state.rules) };
    }
    case 'SET_EVTYPES': {
      return { ...state, db: { ...state.db, evidenceTypes: a.list } };
    }
    case 'NOTIF_READ': {
      const notifications = (state.db.notifications || []).map((n) => (a.id ? (n.id === a.id ? { ...n, read: true } : n) : { ...n, read: true }));
      // Persist to Supabase in background (fire-and-forget)
      if (a.id) {
        supabase.from('notifications').update({ read: true }).eq('id', a.id).then(({ error }) => { if (error) console.error('[NOTIF_READ]', error); });
      } else {
        supabase.from('notifications').update({ read: true }).eq('read', false).then(({ error }) => { if (error) console.error('[NOTIF_READ_ALL]', error); });
      }
      return { ...state, db: { ...state.db, notifications } };
    }
    case 'ADD_NOTIFICATION': {
      const notifications = [...(state.db.notifications || []), a.notification];
      return { ...state, db: { ...state.db, notifications } };
    }
    case 'REMOVE_NOTIFICATION': {
      const notifications = (state.db.notifications || []).filter(n => n.id !== a.id);
      return { ...state, db: { ...state.db, notifications } };
    }
    case 'RESET': {
      localStorage.removeItem(LS);
      supabase.auth.signOut();
      return { ...initState(), user: null, theme: state.theme };
    }
    default: return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const [loadingDb, setLoadingDb] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  useEffect(() => {
    const { user, theme, collapsed, rules, db } = state;
    try { localStorage.setItem(LS, JSON.stringify({ user, theme, collapsed, rules, db })); } catch { /* quota */ }
  }, [state.user, state.theme, state.collapsed, state.rules, state.db]);

  const toast = useCallback((msg, kind = 'success') => {
    const id = uid('t');
    dispatch({ type: 'TOAST', toast: { message: msg, kind, id } });
    setTimeout(() => dispatch({ type: 'UNTOAST', id }), 3400);
  }, []);

  // Fetch Full User Profile
  const fetchUserProfile = async (authUser) => {
    if (!authUser) {
      dispatch({ type: 'LOGIN', user: null });
      return;
    }

    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*, roles(name, permissions), organization_units(name)')
        .eq('id', authUser.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return;
      }

      // Map roles to new frontend role names for V1
      let frontendRole = 'manager';
      const roleName = userData?.roles?.name;
      if (roleName === 'مدير الاستراتيجية' || roleName === 'مدير المنصة') frontendRole = 'strategy_office';
      if (roleName === 'المدير التنفيذي') frontendRole = 'ceo';
      if (roleName === 'مدير ادارة' || roleName === 'رئيس قسم' || roleName === 'مدير مكتب') frontendRole = 'manager';

      dispatch({
        type: 'LOGIN',
        user: {
          id: userData.id,
          name: userData.full_name,
          email: userData.email,
          role: frontendRole,
          realRoleName: roleName,
          permissions: userData.roles?.permissions,
          dept: userData.organization_units?.name || null
        }
      });
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  };

  // Auth State Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUserProfile(session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchUserProfile(session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ─── Real Notifications from Supabase ───────────────────────────────────
  const realtimeChannelRef = useRef(null);

  const fetchNotifications = useCallback(async (userId) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(80);
    if (error) { console.error('[fetchNotifications]', error); return; }
    const mapped = (data || []).map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body || '',
      entityId: n.entity_id,
      projectId: n.project_id,
      time: new Date(n.created_at).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' }),
      read: n.read,
    }));
    dispatch({ type: 'SET_DB', db: { notifications: mapped } });
  }, []);

  useEffect(() => {
    const userId = state.user?.id;
    if (!userId) {
      // Clean up any old channel when user logs out
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      return;
    }

    // Initial fetch
    fetchNotifications(userId);

    // Subscribe to Realtime inserts for this user's notifications
    const channel = supabase
      .channel(`notifications:user:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new;
          const mapped = {
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body || '',
            entityId: n.entity_id,
            projectId: n.project_id,
            time: new Date(n.created_at).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' }),
            read: false,
          };
          dispatch({ type: 'ADD_NOTIFICATION', notification: mapped });
          // Also show a toast
          dispatch({ type: 'TOAST', toast: { message: n.title, kind: 'attention' } });
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      realtimeChannelRef.current = null;
    };
  }, [state.user?.id, fetchNotifications]);

  // ─── Realtime: indicator_monthly_values — update progress instantly ─────
  const kpiRealtimeRef = useRef(null);
  useEffect(() => {
    if (!state.user?.id) return;

    if (kpiRealtimeRef.current) {
      supabase.removeChannel(kpiRealtimeRef.current);
    }

    const ch = supabase
      .channel('kpi-monthly-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'indicator_monthly_values' },
        (payload) => {
          const { indicator_id, month, achieved_value } = payload.new;
          dispatch({
            type: 'REFRESH_KPI_MONTHLY',
            indicatorId: indicator_id,
            month,
            achieved_value
          });
        }
      )
      .on(
        'postgres_changes',
        // When strategy office approves — re-fetch everything for full consistency
        { event: 'UPDATE', schema: 'public', table: 'monthly_updates' },
        async (payload) => {
          if (payload.new.status === 'approved' || payload.new.status === 'rejected') {
            // Re-fetch monthly values to ensure all changes are reflected
            const { data } = await supabase
              .from('indicator_monthly_values')
              .select('*')
              .eq('month', payload.new.reporting_month);
            if (data) {
              // Batch update all KPIs for this month
              const kpisUpdated = (data || []).reduce((acc, mv) => {
                acc[mv.indicator_id] = mv.achieved_value;
                return acc;
              }, {});
              Object.entries(kpisUpdated).forEach(([indicatorId, achieved_value]) => {
                dispatch({
                  type: 'REFRESH_KPI_MONTHLY',
                  indicatorId,
                  month: payload.new.reporting_month,
                  achieved_value
                });
              });
            }
          }
        }
      )
      .subscribe();

    kpiRealtimeRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      kpiRealtimeRef.current = null;
    };
  }, [state.user?.id]);

  // Fetch Supabase Data on Mount
  useEffect(() => {
    async function fetchData() {
      // Only fetch if authenticated
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoadingDb(false);
        return;
      }

      setLoadingDb(true);
      try {
        const [
          { data: goalsData },
          { data: objectivesData },
          { data: initiativesData },
          { data: projectsData },
          { data: indicatorsData },
          { data: monthlyValuesData },
          { data: orgUnitsData },
          { data: usersData },
          { data: monthlyUpdatesData }
        ] = await Promise.all([
          supabase.from('strategic_goals').select('*'),
          supabase.from('strategic_objectives').select('*'),
          supabase.from('strategic_initiatives').select('*, organization_units(name)'),
          supabase.from('operational_projects').select('*, organization_units(name)'),
          supabase.from('project_indicators').select('*'),
          supabase.from('indicator_monthly_values').select('*'),
          supabase.from('organization_units').select('*'),
          supabase.from('users').select('*, roles(name), organization_units(name)'),
          supabase.from('monthly_updates').select('*, users!monthly_updates_created_by_fkey(full_name)')
        ]);

        const mappedGoals = (goalsData || []).map(g => ({
          id: g.id,
          name: g.name,
          code: g.code,
        }));

        const mappedObjectives = (objectivesData || []).map(o => ({
          id: o.id,
          goalId: o.strategic_goal_id,
          name: o.name,
          code: o.code
        }));

        const mappedInitiatives = (initiativesData || []).map(i => {
          const obj = objectivesData?.find(o => o.id === i.strategic_objective_id);
          return {
            id: i.id,
            objectiveId: i.strategic_objective_id,
            goalId: obj?.strategic_goal_id,
            name: i.name,
            code: i.code,
            dept: i.organization_units?.name || '',
            timeframe: i.execution_week_label || i.execution_weeks,
            budget: i.budget_total || ((i.budget_makkah || 0) + (i.budget_madinah || 0)),
            effKpi: i.efficiency_indicator_name,
            effTgt: i.efficiency_target,
            effTgtPct: i.efficiency_target_is_percentage,
            effectKpi: i.effectiveness_indicator_name,
            effectTgt: i.effectiveness_target,
            effectTgtPct: i.effectiveness_target_is_percentage,
            week: i.execution_week_label,
            q1: i.q1, q2: i.q2, q3: i.q3, q4: i.q4
          };
        });

        const mappedProjects = (projectsData || []).map(p => {
          const init = initiativesData?.find(i => i.id === p.initiative_id);
          const obj = objectivesData?.find(o => o.id === init?.strategic_objective_id);
          return {
            id: p.id,
            initiativeId: p.initiative_id,
            goalId: obj?.strategic_goal_id,
            name: p.project_name,
            dept: p.organization_units?.name || '',
            executionCost: p.execution_cost ?? null,
          };
        });

        const mappedKpis = (indicatorsData || []).map(ind => {
          const monthlies = (monthlyValuesData || []).filter(mv => mv.indicator_id === ind.id);
          // ensure 12 months array for frontend
          const monthlyArr = [];
          for (let m = 1; m <= 12; m++) {
            const mv = monthlies.find(x => x.month === m);
            monthlyArr.push({
              month: m,
              target: mv ? (mv.target_value_raw || mv.target_value) : null,
              targetPct: mv ? mv.target_is_percentage : false,
              actual: mv ? mv.achieved_value : null,
              actualPct: mv ? mv.achieved_is_percentage : false,
              notes: mv ? mv.updates_notes : '',
              evidence: mv ? mv.evidence : ''
            });
          }
          // Extract H1 project progress stored in month-6 notes
          const m6 = monthlies.find(x => x.month === 6);
          const m6Notes = m6?.updates_notes || '';
          const h1ProgressMatch = m6Notes.match(/h1_project_progress:(\d+)/);
          const h1ProjectProgress = h1ProgressMatch ? Number(h1ProgressMatch[1]) : null;

          return {
            id: ind.id,
            projectId: ind.project_id,
            name: ind.indicator_name,
            baselineNum: ind.baseline_value,
            targetNum: ind.annual_target,
            targetRaw: ind.target_raw,
            targetPct: ind.kpi_target_is_percentage,
            monthly: monthlyArr,
            h1ProjectProgress
          };
        });

        const mappedDepartments = (orgUnitsData || []).map(org => ({
          id: org.id,
          name: org.name
        }));

        const mappedUsers = (usersData || []).map(u => {
          let frontendRole = 'manager';
          const roleName = u.roles?.name;
          if (roleName === 'مدير الاستراتيجية' || roleName === 'مدير المنصة') frontendRole = 'strategy_office';
          else if (roleName === 'الرئيس التنفيذي') frontendRole = 'ceo';
          else if (roleName === 'مدير ادارة' || roleName === 'رئيس قسم' || roleName === 'مدير مكتب') frontendRole = 'manager';

          return {
            id: u.id,
            name: u.full_name,
            email: u.email,
            role: frontendRole,
            dept: u.organization_units?.name || null,
            active: u.active,
            avatar: u.full_name?.replace(/^(أ\.|م\.|د\.)\s*/, '').split(' ').slice(0, 2).map((w) => w[0]).join(' ')
          };
        });

        const mappedApprovals = (monthlyUpdatesData || []).map(upd => {
          const p = mappedProjects.find(x => x.id === upd.project_id);
          // تحليل بيانات الإرسال المخزنة كـ JSON
          let parsedNote = {};
          try {
            if (upd.notes && upd.notes.trim().startsWith('{')) {
              parsedNote = JSON.parse(upd.notes);
            } else {
              parsedNote = { challenges: upd.notes || '' };
            }
          } catch { parsedNote = { challenges: upd.notes || '' }; }

          return {
            id: upd.id,
            projectId: upd.project_id,
            goalId: p?.goalId,
            dept: p?.dept,
            month: MONTHS[upd.reporting_month - 1] || String(upd.reporting_month),
            monthNum: upd.reporting_month,
            status: upd.status || 'pending',
            submittedBy: upd.users?.full_name || 'غير محدد',
            note: upd.notes,
            challenges: parsedNote.challenges || '',
            support: parsedNote.support || '',
            evLink: parsedNote.evLink || '',
            evType: parsedNote.evType || '',
            evDesc: parsedNote.evDesc || '',
            comments: (upd.rejection_reason && upd.status !== 'approved') ? [{ by: 'الاستراتيجية', text: upd.rejection_reason, decision: 'rejected' }] : []
          };
        });

        const fetchedChallenges = (monthlyUpdatesData || [])
          .filter(upd => upd.status === 'approved' && upd.rejection_reason && upd.rejection_reason.trim())
          .map(upd => {
            const p = mappedProjects.find(x => x.id === upd.project_id);
            return {
              id: 'C_db_' + upd.id,
              projectId: upd.project_id,
              kpiId: null,
              text: upd.rejection_reason,
              dept: p?.dept || '',
              severity: 'high',
              status: 'open',
              isImportant: true
            };
          });

        dispatch({
          type: 'SET_DB',
          db: {
            goals: mappedGoals,
            objectives: mappedObjectives,
            initiatives: mappedInitiatives,
            projects: mappedProjects,
            departments: mappedDepartments,
            users: mappedUsers,
            kpis: mappedKpis,
            approvals: mappedApprovals,
            challenges: fetchedChallenges
          }
        });
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error fetching data from Supabase:', err);
        toast('حدث خطأ أثناء جلب البيانات من الخادم. يرجى تحديث الصفحة.', 'error');
      } finally {
        setLoadingDb(false);
      }
    }

    // Refetch when user logs in
    if (state.user) {
      fetchData();
    } else {
      setLoadingDb(false);
    }
  }, [state.user, toast]);

  const value = useMemo(() => ({ ...state, dispatch, toast, loadingDb }), [state, toast, loadingDb]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

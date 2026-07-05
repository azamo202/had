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

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليه', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const LS = 'hadiyah_state_v1';

function loadPersisted() {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function recomputeKpi(k, rules) {
  const has = k.targetNum != null && k.targetNum > 0;
  const monthlySum = (k.monthly || []).reduce((s, m) => s + (m.actual != null ? m.actual : 0), 0);
  const achieved = has ? (k.baselineNum || 0) + monthlySum : null;
  const pct = has ? clampPct((achieved / k.targetNum) * 100) : null;
  return { ...k, achievedNum: achieved, achievement: pct, status: statusFromPct(pct, has, rules) };
}

function rollup(db, rules) {
  if (!db || !db.goals) return db;
  const kpis = (db.kpis || []).map((k) => recomputeKpi(k, rules));
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
      return { ...state, db: rollup({ ...state.db, ...a.db }, state.rules) };
    }
    case 'KPI_MONTH': {
      const kpis = state.db.kpis.map((k) => {
        if (k.id !== a.kpiId) return k;
        const monthly = k.monthly.map((m) => (m.month === a.month ? { ...m, ...a.patch } : m));
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
      const rec = {
        id: idx >= 0 ? approvals[idx].id : uid('AP'),
        projectId: a.projectId, goalId: a.goalId, dept: a.dept, month: a.month,
        status: a.draft ? 'draft' : 'pending', submittedBy: a.by, note: a.note || 'تحديث الإنجاز الشهري', comments: [],
      };
      if (idx >= 0) approvals[idx] = rec; else approvals.push(rec);
      return { ...state, db: { ...state.db, approvals } };
    }
    case 'APPROVAL_DECIDE': {
      const approvals = state.db.approvals.map((x) =>
        x.id === a.id ? { ...x, status: a.decision, comments: [...(x.comments || []), ...(a.comment ? [{ by: a.by, text: a.comment, decision: a.decision }] : [])] } : x
      );
      return { ...state, db: { ...state.db, approvals } };
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
            dept: p.organization_units?.name || ''
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
          return {
            id: ind.id,
            projectId: ind.project_id,
            name: ind.indicator_name,
            baselineNum: ind.baseline_value,
            targetNum: ind.annual_target,
            targetRaw: ind.target_raw,
            targetPct: ind.kpi_target_is_percentage,
            monthly: monthlyArr
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
          return {
            id: upd.id,
            projectId: upd.project_id,
            goalId: p?.goalId,
            dept: p?.dept,
            month: MONTHS[upd.reporting_month - 1] || String(upd.reporting_month),
            status: upd.status || 'pending',
            submittedBy: upd.users?.full_name || 'غير محدد',
            note: upd.notes,
            comments: upd.rejection_reason ? [{ by: 'الاستراتيجية', text: upd.rejection_reason, decision: 'rejected' }] : []
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
            approvals: mappedApprovals
          }
        });
      } catch (err) {
        console.error('Error fetching data from Supabase:', err);
        toast('حدث خطأ أثناء جلب البيانات من الخادم', 'error');
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

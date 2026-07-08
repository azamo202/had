import React, { useState, useRef } from 'react';
import * as xlsx from 'xlsx';
import { supabase } from '../lib/supabaseClient.js';
import { useApp } from '../store/AppContext.jsx';
import { Upload, AlertCircle, CheckCircle2, Loader2, Database, Trash2 } from 'lucide-react';
import { PageHead } from './ui/Bits.jsx';

// Normalization utilities
const normalizeSpace = (str) => {
  if (str == null) return null;
  // Remove Arabic diacritics (Tashkeel) to ensure matching works even if the Excel has them
  let s = String(str).replace(/[\u0617-\u061A\u064B-\u0652]/g, '').trim().replace(/\s+/g, ' ');
  return s === '' || s === 'None' || s === '-' ? null : s;
};

const isCheck = (val) => {
  if (!val) return false;
  const s = String(val).trim();
  // ✔ (U+2714), ✓ (U+2713), ✔︎ (U+2714 + U+FE0E variation selector), or text booleans
  return s.includes('\u2714') || s.includes('\u2713') || s.includes('✔') || s.includes('✓') || s === 'true' || s === '1' || s.toLowerCase() === 'yes';
};

const parseNumeric = (val) => {
  const str = normalizeSpace(val);
  if (!str) return null;
  const cleanStr = str.replace(/,/g, '');
  let matches = cleanStr.match(/-?\d+(\.\d+)?([eE][+-]?\d+)?/);
  if (matches) {
    let num = parseFloat(matches[0]);
    if (str.includes('%')) num = num / 100;
    if (str.includes('M') || str.includes('مليون')) num *= 1000000;
    if (str.includes('K') || str.includes('ألف')) num *= 1000;
    return num;
  }
  return null;
};

const extractBudget = (val) => {
  // Goal 1 has sometimes two budgets Makkah/Madinah in one string or two columns.
  // We'll just sum or take the first numeric.
  return parseNumeric(val) || 0;
};

const isPct = (val, name = '') => {
  const vStr = (val || '').toString();
  if (vStr.includes('%')) return true;
  if (name && name.includes('نسبة')) return true;
  return false;
};

const ARABIC_NUM = { 'الأول': 1, 'الثاني': 2, 'الثالث': 3, 'الرابع': 4, 'الخامس': 5, 'السادس': 6, 'السابع': 7, 'الثامن': 8, 'التاسع': 9, 'العاشر': 10 };

export default function ImportExcel() {
  const { user, toast, dispatch } = useApp();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [stats, setStats] = useState(null);
  const fileRef = useRef(null);

  const processExcel = async (file) => {
    setLoading(true);
    setProgress('جاري قراءة الملف...');
    setStats(null);
    try {
      const data = await file.arrayBuffer();
      const workbook = xlsx.read(data, { cellDates: true });

      const getCellValue = (cell) => {
        if (!cell || cell.v == null) return null;
        if (typeof cell.v === 'number' && cell.w && typeof cell.w === 'string' && cell.w.includes('%')) {
          return cell.w;
        }
        return cell.v;
      };

      const extractedData = {
        goals: new Map(),
        objectives: new Map(),
        initiatives: new Map(),
        projects: new Map(),
        indicators: new Map(),
        monthly: new Map()
      };

      const deptsSet = new Set();
      let totalRows = 0;

      for (const sheetName of workbook.SheetNames) {
        if (!sheetName.includes('الهدف')) continue;
        setProgress(`جاري تحليل ورقة: ${sheetName}...`);

        let goalNumber = 0;
        for (const [k, v] of Object.entries(ARABIC_NUM)) {
          if (sheetName.includes(k)) goalNumber = v;
        }

        const sheet = workbook.Sheets[sheetName];
        if (!sheet || !sheet['!ref']) continue;

        // 1. Build a fully populated 2D Grid with Merged Cells filled
        const range = xlsx.utils.decode_range(sheet['!ref']);
        const grid = [];
        for (let R = range.s.r; R <= range.e.r; R++) {
          const row = [];
          for (let C = range.s.c; C <= range.e.c; C++) {
            let val = null;
            let inMerge = false;
            if (sheet['!merges']) {
              for (let m of sheet['!merges']) {
                if (R >= m.s.r && R <= m.e.r && C >= m.s.c && C <= m.e.c) {
                  inMerge = true;
                  if (C === m.s.c) {
                    for (let r = m.s.r; r <= m.e.r; r++) {
                      for (let c = m.s.c; c <= m.e.c; c++) {
                        let cell = sheet[xlsx.utils.encode_cell({ r, c })];
                        if (cell && cell.v != null && String(cell.v).trim() !== '') {
                          val = getCellValue(cell);
                          break;
                        }
                      }
                      if (val != null) break;
                    }
                  } else {
                    val = null; // prevent horizontal duplication
                  }
                  break;
                }
              }
            }
            if (!inMerge) {
              let cell = sheet[xlsx.utils.encode_cell({ r: R, c: C })];
              val = getCellValue(cell);
            }
            row.push(val);
          }
          grid.push(row);
        }

        if (grid.length < 4) continue; // Need headers + data

        // 2. Discover Columns Dynamically
        let gIdx = -1, oIdx = -1, iIdx = -1, effKpiIdx = -1, effTgtIdx = -1;
        let effectKpiIdx = -1, effectTgtIdx = -1, deptIdx = -1, budgetIdx = -1, makkahIdx = -1, madinahIdx = -1;
        let weekIdx = -1, projIdx = -1, indNameIdx = -1, indTgtIdx = -1, indBaseIdx = -1, projCostIdx = -1;
        let q1Idx = -1, q2Idx = -1, q3Idx = -1, q4Idx = -1;
        const monthIdxs = {};

        // We scan first 3 rows to find column signatures
        let currentMonthNum = -1;
        for (let c = 0; c < grid[0].length; c++) {
          const h0 = normalizeSpace(grid[0][c]) || '';
          const h1 = normalizeSpace(grid[1]?.[c]) || '';
          const h2 = normalizeSpace(grid[2]?.[c]) || '';
          const fullHead = h0 + ' ' + h1 + ' ' + h2;

          if (h0.includes('الهدف الاستراتيجي')) gIdx = c;
          else if (h0.includes('الهدف الفرعي')) oIdx = c;
          else if (h0.includes('المبادرة الاستراتيجية')) iIdx = c;
          else if (h0.includes('مؤشر الكفاءة')) { effKpiIdx = c; effTgtIdx = c + 1; }
          else if (h0.includes('مؤشر الفعالية')) { effectKpiIdx = c; effectTgtIdx = c + 1; }
          else if (h0.includes('الإدارة / القسم') || h0.includes('القطاع / الإدارة')) deptIdx = c;
          else if (projCostIdx === -1 && (fullHead.includes('تكلفة التنفيذ') || h0.includes('تكلفة التنفيذ') || h1.includes('تكلفة التنفيذ'))) projCostIdx = c;
          else if (budgetIdx === -1 && (fullHead.includes('ميزانية المبادرة') || fullHead.includes('تكلفة') || fullHead.includes('ميزانية'))) {
            makkahIdx = c;
            madinahIdx = c + 1;
            budgetIdx = c;
          }
          else if (h0.includes('النطاق الزمني')) weekIdx = c;
          else if (h0.includes('المشاريع التشغيلية')) projIdx = c;
          else if (h0.includes('مؤشر القياس')) indNameIdx = c;
          else if (h0.includes('خط الأساس')) indBaseIdx = c;
          // Annual target: the FIRST المستهدف column that comes right after مؤشر القياس.
          // Lock it once found so monthly sub-headers don't overwrite it.
          else if (indTgtIdx === -1 && h0.includes('المستهدف') && indNameIdx >= 0 && c > indNameIdx && !h0.includes('الشهري') && !h1.includes('يناير') && !h1.includes('فبراير') && !h1.includes('مارس')) {
            indTgtIdx = c;
          }

          if (h1.includes('الربع 1')) q1Idx = c;
          else if (h1.includes('الربع 2')) q2Idx = c;
          else if (h1.includes('الربع 3')) q3Idx = c;
          else if (h1.includes('الربع 4')) q4Idx = c;

          const mNamesMap = {
            'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4, 'مايو': 5, 'يونيو': 6,
            'يوليه': 7, 'يوليو': 7, 'أغسطس': 8, 'سبتمبر': 9, 'أكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12
          };

          let mNumMatched = -1;
          for (const [mName, mNum] of Object.entries(mNamesMap)) {
            if (h1.includes(mName) || h0.includes(mName)) {
              mNumMatched = mNum;
              break;
            }
          }

          if (mNumMatched !== -1) {
            currentMonthNum = mNumMatched;
          } else if (h0 !== '') {
            // Reached a new main column that is not a month, clear context
            currentMonthNum = -1;
          }

          if (currentMonthNum !== -1) {
            const mNum = currentMonthNum;
            if (!monthIdxs[mNum]) {
              // Initialize with -1 meaning “not found”
              monthIdxs[mNum] = { tgt: -1, actual: -1, chal: -1, ev: -1 };
            }
            // Classify each sub-column by its explicit header name
            if (fullHead.includes('المنجز') || fullHead.includes('الفعلي') || fullHead.includes('المحقق')) {
              monthIdxs[mNum].actual = c;
            } else if (fullHead.includes('تحديات') || fullHead.includes('ملاحظات')) {
              monthIdxs[mNum].chal = c;
            } else if (fullHead.includes('شواهد') || fullHead.includes('رابط') || fullHead.includes('الشواهد')) {
              monthIdxs[mNum].ev = c;
            } else if (fullHead.includes('المستهدف') || monthIdxs[mNum].tgt === -1) {
              // If it explicitly says target, or if it's the first column of the month and nothing else matched
              if (fullHead.includes('المستهدف')) {
                monthIdxs[mNum].tgt = c;
              } else if (monthIdxs[mNum].tgt === -1 && !fullHead.includes('المنجز') && !fullHead.includes('تحديات') && !fullHead.includes('شواهد')) {
                monthIdxs[mNum].tgt = c;
              }
            }
          }
        }

        const isMergeDup = (R, C) => {
          if (!sheet['!merges']) return false;
          for (let m of sheet['!merges']) {
            if (R >= m.s.r && R <= m.e.r && C >= m.s.c && C <= m.e.c) {
              return R > m.s.r;
            }
          }
          return false;
        };

        // 3. Extract Rows
        let lastProjName = null;
        for (let r = 3; r < grid.length; r++) {
          const row = grid[r];

          const gName = normalizeSpace(row[gIdx]);
          const oName = normalizeSpace(row[oIdx]);
          const iName = normalizeSpace(row[iIdx]);
          const rawPName = normalizeSpace(row[projIdx]);

          if (rawPName) lastProjName = rawPName;
          const pName = lastProjName;

          // Spacer row detection: if all key fields are empty
          if (!gName && !oName && !iName && !pName) continue;
          if (!gName || !iName || !pName) continue; // invalid data row

          totalRows++;

          // Goals
          if (!extractedData.goals.has(gName)) {
            extractedData.goals.set(gName, { name: gName, code: `G${goalNumber || extractedData.goals.size + 1}`, sort_order: goalNumber || extractedData.goals.size });
          }

          // Objectives
          const objKey = `${gName}|${oName}`;
          if (oName && !extractedData.objectives.has(objKey)) {
            extractedData.objectives.set(objKey, { name: oName, code: `O${extractedData.objectives.size + 1}`, goalRef: gName });
          }

          // Initiatives
          const initKey = `${objKey}|${iName}`;
          let dName = normalizeSpace(row[deptIdx]) || 'غير محدد';
          deptsSet.add(dName);

          if (!extractedData.initiatives.has(initKey)) {
            extractedData.initiatives.set(initKey, {
              name: iName,
              code: `I${extractedData.initiatives.size + 1}`,
              objRef: objKey,
              deptRef: dName,
              budgetMakkah: 0,
              budgetMadinah: 0,
              budget: 0,
              effKpi: normalizeSpace(row[effKpiIdx]),
              effTgt: normalizeSpace(row[effTgtIdx]),
              effectKpi: normalizeSpace(row[effectKpiIdx]),
              effectTgt: normalizeSpace(row[effectTgtIdx]),
              week: normalizeSpace(row[weekIdx]),
              q1: isCheck(row[q1Idx]),
              q2: isCheck(row[q2Idx]),
              q3: isCheck(row[q3Idx]),
              q4: isCheck(row[q4Idx]),
            });
          }

          // ── Accumulate per-initiative fields across multiple rows ────────────
          // Quarters: The Excel uses vertically-merged cells for q1–q4 at the
          // initiative level. Due to how merges are propagated, a checkmark may
          // appear on any row belonging to the initiative (not always row 0).
          // We OR-accumulate so no quarter is ever lost.
          const curInit = extractedData.initiatives.get(initKey);
          if (!curInit.q1 && q1Idx >= 0 && isCheck(row[q1Idx])) curInit.q1 = true;
          if (!curInit.q2 && q2Idx >= 0 && isCheck(row[q2Idx])) curInit.q2 = true;
          if (!curInit.q3 && q3Idx >= 0 && isCheck(row[q3Idx])) curInit.q3 = true;
          if (!curInit.q4 && q4Idx >= 0 && isCheck(row[q4Idx])) curInit.q4 = true;
          // KPI fields: also fill if missing (first non-null value wins)
          if (!curInit.effKpi && effKpiIdx >= 0) { const v = normalizeSpace(row[effKpiIdx]); if (v) curInit.effKpi = v; }
          if (!curInit.effTgt && effTgtIdx >= 0) { const v = normalizeSpace(row[effTgtIdx]); if (v) curInit.effTgt = v; }
          if (!curInit.effectKpi && effectKpiIdx >= 0) { const v = normalizeSpace(row[effectKpiIdx]); if (v) curInit.effectKpi = v; }
          if (!curInit.effectTgt && effectTgtIdx >= 0) { const v = normalizeSpace(row[effectTgtIdx]); if (v) curInit.effectTgt = v; }
          if (!curInit.week && weekIdx >= 0) { const v = normalizeSpace(row[weekIdx]); if (v) curInit.week = v; }

          // Accumulate initiative budget from any row belonging to it
          const currentInit = extractedData.initiatives.get(initKey);
          const rowMakkah = makkahIdx >= 0 && !isMergeDup(r, makkahIdx) ? extractBudget(row[makkahIdx]) : (budgetIdx >= 0 && !isMergeDup(r, budgetIdx) ? extractBudget(row[budgetIdx]) : 0);
          const rowMadinah = madinahIdx >= 0 && !isMergeDup(r, madinahIdx) ? extractBudget(row[madinahIdx]) : 0;
          currentInit.budgetMakkah += rowMakkah;
          currentInit.budgetMadinah += rowMadinah;
          currentInit.budget = currentInit.budgetMakkah + currentInit.budgetMadinah;

          // Projects
          const projKey = `${initKey}|${pName}`;
          const projCost = projCostIdx >= 0 && !isMergeDup(r, projCostIdx) ? parseNumeric(row[projCostIdx]) : null;
          if (!extractedData.projects.has(projKey)) {
            extractedData.projects.set(projKey, {
              name: pName,
              initRef: initKey,
              deptRef: dName,
              cost: projCost || 0
            });
          } else if (projCost && projCost > 0) {
            // update cost if not yet set (cost is usually on the first data row)
            const existingProj = extractedData.projects.get(projKey);
            if (!existingProj.cost) existingProj.cost = projCost;
          }

          // Indicators
          const indName = normalizeSpace(row[indNameIdx]);
          if (indName) {
            const indKey = `${projKey}|${indName}`;
            const indTgtRaw = normalizeSpace(row[indTgtIdx]);

            if (!extractedData.indicators.has(indKey)) {
              extractedData.indicators.set(indKey, {
                name: indName,
                projRef: projKey,
                baseline: parseNumeric(row[indBaseIdx]) || 0,
                target_raw: indTgtRaw,
                target_numeric: parseNumeric(indTgtRaw)
              });
            }

            // Monthly Values — import TARGET and ACTUAL (if present) from Excel.
            // If المنجز column exists and has data, it will be stored.
            // If it's empty, achieved_value stays null (= 0% progress in the UI).
            for (let m = 1; m <= 12; m++) {
              const mCols = monthIdxs[m];
              if (mCols) {
                const mTgtRaw = mCols.tgt >= 0 ? normalizeSpace(row[mCols.tgt]) : null;
                const mActRaw = mCols.actual >= 0 ? normalizeSpace(row[mCols.actual]) : null;
                const chal = mCols.chal >= 0 ? normalizeSpace(row[mCols.chal]) : null;
                const ev = mCols.ev >= 0 ? normalizeSpace(row[mCols.ev]) : null;

                if (mTgtRaw || mActRaw || chal || ev) {
                  const mKey = `${indKey}|${m}`;
                  if (!extractedData.monthly.has(mKey)) {
                    extractedData.monthly.set(mKey, {
                      indRef: indKey,
                      month: m,
                      target_raw: mTgtRaw,
                      target_numeric: parseNumeric(mTgtRaw),
                      achieved_raw: mActRaw,         // null if column is empty/missing
                      achieved_numeric: parseNumeric(mActRaw), // null if empty → 0% progress
                      notes: chal || '',
                      evidence: ev || ''
                    });
                  }
                }
              }
            }
          }
        }
      }

      setProgress('جاري مسح البيانات السابقة...');
      const { error: delErr } = await supabase.from('strategic_goals').delete().not('id', 'is', null);
      if (delErr) throw delErr;

      setProgress('جاري مزامنة الإدارات والأهداف...');

      // Upsert Departments
      const { data: dbDepts, error: dErr } = await supabase.from('organization_units').upsert(
        Array.from(deptsSet).map(d => ({ name: d, type: 'إدارة' })),
        { onConflict: 'name' }
      ).select('id, name');
      if (dErr) throw dErr;
      const deptMap = new Map(dbDepts.map(d => [d.name, d.id]));

      // Upsert Goals
      const { data: dbGoals, error: gErr } = await supabase.from('strategic_goals').upsert(
        Array.from(extractedData.goals.values()),
        { onConflict: 'name' }
      ).select('id, name');
      if (gErr) throw gErr;
      const goalMap = new Map(dbGoals.map(g => [g.name, g.id]));

      setProgress('جاري مزامنة الأهداف الفرعية...');
      // Upsert Objectives
      const objPayload = Array.from(extractedData.objectives.entries()).map(([k, v]) => ({
        name: v.name,
        code: v.code,
        strategic_goal_id: goalMap.get(v.goalRef)
      }));
      const { data: dbObjs, error: oErr } = await supabase.from('strategic_objectives').upsert(
        objPayload, { onConflict: 'name, strategic_goal_id' }
      ).select('id, name, strategic_goal_id');
      if (oErr) throw oErr;

      const objMap = new Map(dbObjs.map(o => {
        const gName = Array.from(goalMap.entries()).find(e => e[1] === o.strategic_goal_id)?.[0];
        return [`${gName}|${o.name}`, o.id];
      }));

      setProgress('جاري مزامنة المبادرات...');
      const initPayload = Array.from(extractedData.initiatives.entries()).map(([k, v]) => ({
        name: v.name,
        code: v.code,
        strategic_objective_id: objMap.get(v.objRef),
        organization_unit_id: deptMap.get(v.deptRef),
        efficiency_indicator_name: v.effKpi,
        efficiency_target: v.effTgt,
        efficiency_target_is_percentage: isPct(v.effTgt, v.effKpi),
        effectiveness_indicator_name: v.effectKpi,
        effectiveness_target: v.effectTgt,
        effectiveness_target_is_percentage: isPct(v.effectTgt, v.effectKpi),
        budget_makkah: v.budgetMakkah,
        budget_madinah: v.budgetMadinah,
        execution_week_label: v.week, execution_weeks: v.week ? parseInt(v.week.replace(/\D/g, '')) || 0 : 0,
        q1: v.q1, q2: v.q2, q3: v.q3, q4: v.q4
      }));

      // Batch upsert initiatives in chunks of 100 to avoid request size limits
      const dbInits = [];
      for (let i = 0; i < initPayload.length; i += 100) {
        const { data, error } = await supabase.from('strategic_initiatives').upsert(
          initPayload.slice(i, i + 100), { onConflict: 'name, strategic_objective_id' }
        ).select('id, name, strategic_objective_id');
        if (error) throw error;
        dbInits.push(...data);
      }
      const initMap = new Map(dbInits.map(i => {
        const oKey = Array.from(objMap.entries()).find(e => e[1] === i.strategic_objective_id)?.[0];
        return [`${oKey}|${i.name}`, i.id];
      }));

      setProgress('جاري مزامنة المشاريع التشغيلية...');
      const projPayload = Array.from(extractedData.projects.entries()).map(([k, v]) => ({
        project_name: v.name,
        initiative_id: initMap.get(v.initRef),
        organization_unit_id: deptMap.get(v.deptRef),
        execution_cost: v.cost || null
      }));

      const dbProjs = [];
      for (let i = 0; i < projPayload.length; i += 100) {
        const { data, error } = await supabase.from('operational_projects').upsert(
          projPayload.slice(i, i + 100), { onConflict: 'project_name, initiative_id' }
        ).select('id, project_name, initiative_id');
        if (error) throw error;
        dbProjs.push(...data);
      }
      const projMap = new Map(dbProjs.map(p => {
        const iKey = Array.from(initMap.entries()).find(e => e[1] === p.initiative_id)?.[0];
        return [`${iKey}|${p.project_name}`, p.id];
      }));

      setProgress('جاري مزامنة المؤشرات (قد يستغرق بعض الوقت)...');
      const indPayload = Array.from(extractedData.indicators.entries()).map(([k, v]) => ({
        indicator_name: v.name,
        project_id: projMap.get(v.projRef),
        baseline_value: v.baseline,
        baseline_year: 2025,
        target_raw: v.target_raw,
        annual_target: v.target_numeric,
        kpi_target_is_percentage: isPct(v.target_raw, v.name)
      }));

      const dbInds = [];
      for (let i = 0; i < indPayload.length; i += 100) {
        const { data, error } = await supabase.from('project_indicators').upsert(
          indPayload.slice(i, i + 100), { onConflict: 'indicator_name, project_id' }
        ).select('id, indicator_name, project_id');
        if (error) throw error;
        dbInds.push(...data);
      }
      const indMap = new Map(dbInds.map(i => {
        const pKey = Array.from(projMap.entries()).find(e => e[1] === i.project_id)?.[0];
        return [`${pKey}|${i.indicator_name}`, i.id];
      }));

      setProgress('جاري مزامنة المستهدفات والإنجازات الشهرية...');
      const monthlyPayload = Array.from(extractedData.monthly.values()).map(m => ({
        indicator_id: indMap.get(m.indRef),
        month: m.month,
        year: 2026,
        target_value_raw: m.target_raw,
        target_value: m.target_numeric,
        target_is_percentage: isPct(m.target_raw, extractedData.indicators.get(m.indRef)?.name),
        achieved_value_raw: m.achieved_raw,
        achieved_value: m.achieved_numeric,
        achieved_is_percentage: m.achieved_raw ? isPct(m.achieved_raw, extractedData.indicators.get(m.indRef)?.name) : false,
        updates_notes: m.notes,
        evidence: m.evidence
      }));

      for (let i = 0; i < monthlyPayload.length; i += 500) {
        const { error } = await supabase.from('indicator_monthly_values').upsert(
          monthlyPayload.slice(i, i + 500), { onConflict: 'indicator_id, month' }
        );
        if (error) throw error;
      }

      // Generate approved monthly_updates for any month that has an achieved_value
      setProgress('جاري اعتماد إنجازات المشاريع السابقة...');
      const updatesMap = new Map();
      for (const m of extractedData.monthly.values()) {
        if (m.achieved_numeric != null) {
          const indId = indMap.get(m.indRef);
          const projId = dbInds.find(ind => ind.id === indId)?.project_id;
          if (projId) {
            const key = `${projId}|${m.month}`;
            if (!updatesMap.has(key)) {
              updatesMap.set(key, {
                project_id: projId,
                reporting_month: m.month,
                reporting_year: 2026,
                status: 'approved',
                notes: 'تم استيراده من ملف الخطة واعتماده تلقائياً',
                created_by: user?.id || null
              });
            }
          }
        }
      }

      const updatesPayload = Array.from(updatesMap.values());
      for (let i = 0; i < updatesPayload.length; i += 500) {
        const { error } = await supabase.from('monthly_updates').upsert(
          updatesPayload.slice(i, i + 500), { onConflict: 'project_id, reporting_year, reporting_month' }
        );
        if (error) throw error;
      }

      setStats({
        goals: extractedData.goals.size,
        inits: extractedData.initiatives.size,
        projects: extractedData.projects.size,
        indicators: extractedData.indicators.size
      });

      toast('تم استيراد الخطة الاستراتيجية وتحديثها بنجاح!', 'success');
      setProgress('تم الانتهاء بنجاح.');

      // Force reload to refresh global state properly after successful upserts
      setTimeout(() => window.location.reload(), 3000);

    } catch (err) {
      console.error(err);
      toast(err.message || 'حدث خطأ أثناء الاستيراد', 'error');
      setProgress('فشل الاستيراد.');
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm('تنبيه: سيتم مسح كافة البيانات السابقة للأهداف والمشاريع واستبدالها بالبيانات الجديدة من هذا الملف بالكامل. هل أنت متأكد من رغبتك في مسح البيانات وإعادة الاستيراد؟')) {
      e.target.value = '';
      return;
    }
    processExcel(file);
  };

  const handleDeleteAllData = async () => {
    if (!window.confirm('تنبيه خطير: سيتم مسح كافة البيانات من قاعدة البيانات (الأهداف، المبادرات، المشاريع، المؤشرات) نهائياً. هل أنت متأكد من رغبتك في الاستمرار؟')) {
      return;
    }

    // تأكيد إضافي للأمان
    if (!window.confirm('هل أنت متأكد تماماً؟ هذا الإجراء لا يمكن التراجع عنه وسيحذف كافة البيانات الحالية.')) {
      return;
    }

    setLoading(true);
    setProgress('جاري مسح جميع البيانات...');

    try {
      const { error: delErr } = await supabase.from('strategic_goals').delete().not('id', 'is', null);
      if (delErr) throw delErr;

      toast('تم مسح جميع البيانات بنجاح', 'success');
      setProgress('تم مسح البيانات بنجاح.');

      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      console.error(err);
      toast(err.message || 'حدث خطأ أثناء مسح البيانات', 'error');
      setProgress('فشل مسح البيانات.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card pad" style={{ display: 'grid', gap: 16 }}>
      <PageHead title="محرك الاستيراد الذكي (Excel)" sub="يرجى رفع ملف الخطة التشغيلية المحدثة للجمعية" />

      <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
        هذا المحرك مصمم خصيصاً ليقرأ الخلايا المدمجة، ويتعرف على الأعمدة ديناميكياً (مهما اختلف ترتيبها)،
        ويستخرج مئات المؤشرات ومستهدفاتها الشهرية. سيتم <b>مسح كافة البيانات السابقة</b> وإعادة بناء الهيكل
        الاستراتيجي من هذا الملف للحصول على أحدث نسخة نظيفة ومحدثة.
      </p>

      <div style={{ padding: 12, borderRadius: 6, background: 'color-mix(in srgb, var(--st-attention) 10%, transparent)', color: 'var(--st-attention)', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
        <AlertCircle size={16} />
        <b>المحرك سيمسح البيانات:</b> سيتم استبدال كامل المشاريع والمبادرات ببيانات هذا الملف.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileChange}
          disabled={loading}
          ref={fileRef}
          style={{ display: 'none' }}
          id="excel-upload"
        />
        <label htmlFor="excel-upload" className="btn btn-primary" style={{ cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? <><Loader2 size={16} className="spin" /> {progress}</> : 'اختر ملف الإكسل وارفع'}
        </label>

        <button
          onClick={handleDeleteAllData}
          disabled={loading}
          style={{
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#dc2626',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 500
          }}
        >
          <Trash2 size={16} />
          مسح جميع البيانات
        </button>

        {loading && <span className="muted" style={{ fontSize: 13 }}>{progress}</span>}
      </div>

      {stats && (
        <div style={{ marginTop: 12, padding: 14, background: 'var(--surface-1)', borderRadius: 8 }}>
          <div className="row" style={{ gap: 6, color: 'var(--st-completed)', marginBottom: 12 }}><CheckCircle2 size={16} /> <b>تقرير الاستيراد (QA Report)</b></div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, textAlign: 'center' }}>
            <div><div className="mini-label">الأهداف</div><div style={{ fontSize: 16, fontWeight: 600 }}>{stats.goals}</div></div>
            <div><div className="mini-label">المبادرات</div><div style={{ fontSize: 16, fontWeight: 600 }}>{stats.inits}</div></div>
            <div><div className="mini-label">المشاريع</div><div style={{ fontSize: 16, fontWeight: 600 }}>{stats.projects}</div></div>
            <div><div className="mini-label">المؤشرات</div><div style={{ fontSize: 16, fontWeight: 600 }}>{stats.indicators}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

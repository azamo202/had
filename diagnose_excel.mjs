/**
 * Deep Excel Diagnostic Script
 * Finds exact problems with quarters, targets, and missing data
 */
import * as xlsx from 'xlsx';
import { readFileSync } from 'fs';

const filePath = 'الخطة التشغيلية المحدثة الأخيرة (1).xlsx';
const data = readFileSync(filePath);
const workbook = xlsx.read(data, { cellDates: true });

const normalizeSpace = (str) => {
  if (str == null) return null;
  let s = String(str).replace(/[\u0617-\u061A\u064B-\u0652]/g, '').trim().replace(/\s+/g, ' ');
  return s === '' || s === 'None' || s === '-' ? null : s;
};

const getCellValue = (cell) => {
  if (!cell || cell.v == null) return null;
  if (typeof cell.v === 'number' && cell.w && typeof cell.w === 'string' && cell.w.includes('%')) return cell.w;
  return cell.v;
};

const isCheck = (val) => {
  if (!val) return false;
  const s = String(val).trim();
  return s.includes('✔') || s.includes('✓') || s === 'true' || s === '1' || s.toLowerCase() === 'yes';
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

const problems = {
  missingTargets: [],
  quarterMismatch: [],
  missingQuarterData: [],
  partialMonthly: [],
  missingIndName: [],
  rawQuarterValues: []
};

const allProjects = [];

for (const sheetName of workbook.SheetNames) {
  if (!sheetName.includes('الهدف')) continue;

  const sheet = workbook.Sheets[sheetName];
  if (!sheet || !sheet['!ref']) continue;

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
              val = null;
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

  if (grid.length < 4) continue;

  let gIdx=-1, oIdx=-1, iIdx=-1, projIdx=-1, indNameIdx=-1, indTgtIdx=-1, indBaseIdx=-1;
  let effKpiIdx=-1, effTgtIdx=-1, effectKpiIdx=-1, effectTgtIdx=-1;
  let q1Idx=-1, q2Idx=-1, q3Idx=-1, q4Idx=-1;
  let deptIdx=-1, projCostIdx=-1, weekIdx=-1;
  const monthIdxs = {};

  let currentMonthNum = -1;
  for (let c = 0; c < (grid[1] || []).length; c++) {
    const h0 = normalizeSpace(grid[0][c]) || '';
    const h1 = normalizeSpace(grid[1]?.[c]) || '';
    const h2 = normalizeSpace(grid[2]?.[c]) || '';
    const fullHead = h0 + ' ' + h1 + ' ' + h2;

    if (h0.includes('الهدف الاستراتيجي')) gIdx = c;
    else if (h0.includes('الهدف الفرعي')) oIdx = c;
    else if (h0.includes('المبادرة الاستراتيجية')) iIdx = c;
    else if (h0.includes('مؤشر الكفاءة')) { effKpiIdx = c; effTgtIdx = c + 1; }
    else if (h0.includes('مؤشر الفعالية')) { effectKpiIdx = c; effectTgtIdx = c + 1; }
    else if (h0.includes('الإدارة') || h0.includes('القطاع')) deptIdx = c;
    else if (projCostIdx === -1 && fullHead.includes('تكلفة التنفيذ')) projCostIdx = c;
    else if (h0.includes('النطاق الزمني')) weekIdx = c;
    else if (h0.includes('المشاريع التشغيلية')) projIdx = c;
    else if (h0.includes('مؤشر القياس')) indNameIdx = c;
    else if (h0.includes('خط الأساس')) indBaseIdx = c;
    else if (h0.includes('المستهدف') && indNameIdx >= 0 && c > indNameIdx && !h0.includes('الشهري')) {
      indTgtIdx = c;
    }

    if (h1.includes('الربع 1') || h1.includes('الربع الأول') || h0.includes('الربع 1')) q1Idx = c;
    else if (h1.includes('الربع 2') || h1.includes('الربع الثاني') || h0.includes('الربع 2')) q2Idx = c;
    else if (h1.includes('الربع 3') || h1.includes('الربع الثالث') || h0.includes('الربع 3')) q3Idx = c;
    else if (h1.includes('الربع 4') || h1.includes('الربع الرابع') || h0.includes('الربع 4')) q4Idx = c;

    const mNamesMap = {
      'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4, 'مايو': 5, 'يونيو': 6,
      'يوليه': 7, 'يوليو': 7, 'أغسطس': 8, 'سبتمبر': 9, 'أكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12
    };

    let mNumMatched = -1;
    for (const [mName, mNum] of Object.entries(mNamesMap)) {
      if (h1.includes(mName) || h0.includes(mName)) { mNumMatched = mNum; break; }
    }

    if (mNumMatched !== -1) {
      currentMonthNum = mNumMatched;
    } else if (h0 !== '') {
      currentMonthNum = -1;
    }

    if (currentMonthNum !== -1) {
      const mNum = currentMonthNum;
      if (!monthIdxs[mNum]) monthIdxs[mNum] = { tgt: -1, actual: -1, chal: -1, ev: -1 };
      if (fullHead.includes('المنجز') || fullHead.includes('الفعلي') || fullHead.includes('المحقق')) {
        monthIdxs[mNum].actual = c;
      } else if (fullHead.includes('تحديات') || fullHead.includes('ملاحظات')) {
        monthIdxs[mNum].chal = c;
      } else if (fullHead.includes('شواهد') || fullHead.includes('رابط')) {
        monthIdxs[mNum].ev = c;
      } else {
        if (fullHead.includes('المستهدف')) monthIdxs[mNum].tgt = c;
        else if (monthIdxs[mNum].tgt === -1) monthIdxs[mNum].tgt = c;
      }
    }
  }

  // Check raw quarter header values to understand what's in the cells
  const rawQuarterSamples = [];
  let lastProjName = null;

  for (let r = 3; r < grid.length; r++) {
    const row = grid[r];
    const gName = normalizeSpace(row[gIdx]);
    const oName = normalizeSpace(row[oIdx]);
    const iName = normalizeSpace(row[iIdx]);
    const rawPName = normalizeSpace(row[projIdx]);
    if (rawPName) lastProjName = rawPName;
    const pName = lastProjName;
    const indName = normalizeSpace(row[indNameIdx]);
    const indTgt = normalizeSpace(row[indTgtIdx]);

    if (!gName && !oName && !iName && !pName) continue;
    if (!gName || !iName || !pName) continue;

    // Track raw quarter values
    const q1Raw = q1Idx >= 0 ? row[q1Idx] : undefined;
    const q2Raw = q2Idx >= 0 ? row[q2Idx] : undefined;
    const q3Raw = q3Idx >= 0 ? row[q3Idx] : undefined;
    const q4Raw = q4Idx >= 0 ? row[q4Idx] : undefined;

    // Check if quarters have non-checkmark values (could be text)
    if (rawQuarterSamples.length < 5) {
      rawQuarterSamples.push({
        sheet: sheetName, row: r, proj: pName,
        q1: q1Raw, q2: q2Raw, q3: q3Raw, q4: q4Raw,
        q1Check: isCheck(q1Raw), q2Check: isCheck(q2Raw), q3Check: isCheck(q3Raw), q4Check: isCheck(q4Raw)
      });
    }

    // Problem 1: Missing indicator target
    if (indName && !indTgt) {
      problems.missingTargets.push({
        sheet: sheetName, row: r, goal: gName, initiative: iName, project: pName,
        indicator: indName, indTgtCol: indTgtIdx
      });
    }

    // Problem 2: Quarter says true/false but Excel has text values
    const hasAnyQuarter = isCheck(q1Raw) || isCheck(q2Raw) || isCheck(q3Raw) || isCheck(q4Raw);
    const hasAnyNonNullQuarter = q1Raw != null || q2Raw != null || q3Raw != null || q4Raw != null;
    
    if (hasAnyNonNullQuarter && !hasAnyQuarter) {
      // Has some quarter data but none are checkmarks
      problems.rawQuarterValues.push({
        sheet: sheetName, row: r, proj: pName,
        q1: q1Raw, q2: q2Raw, q3: q3Raw, q4: q4Raw
      });
    }

    // Build project record
    const monthlyData = {};
    let monthlyWithTarget = 0;
    for (const [m, cols] of Object.entries(monthIdxs)) {
      const tgt = cols.tgt >= 0 ? normalizeSpace(row[cols.tgt]) : null;
      const act = cols.actual >= 0 ? normalizeSpace(row[cols.actual]) : null;
      if (tgt || act) {
        monthlyData[m] = { tgt, act };
        if (tgt) monthlyWithTarget++;
      }
    }

    allProjects.push({
      sheet: sheetName, row: r,
      goal: gName, objective: oName, initiative: iName, project: pName,
      indicator: indName, indTgt,
      q1: isCheck(q1Raw), q2: isCheck(q2Raw), q3: isCheck(q3Raw), q4: isCheck(q4Raw),
      q1Raw, q2Raw, q3Raw, q4Raw,
      monthlyCount: monthlyWithTarget,
      monthlyData,
      dept: deptIdx >= 0 ? normalizeSpace(row[deptIdx]) : null,
      effKpi: effKpiIdx >= 0 ? normalizeSpace(row[effKpiIdx]) : null,
      effTgt: effTgtIdx >= 0 ? normalizeSpace(row[effTgtIdx]) : null,
      effectKpi: effectKpiIdx >= 0 ? normalizeSpace(row[effectKpiIdx]) : null,
      effectTgt: effectTgtIdx >= 0 ? normalizeSpace(row[effectTgtIdx]) : null,
    });
  }

  problems.rawQuarterValues.push(...rawQuarterSamples.map(s => ({ ...s, _type: 'sample' })));
}

// =================== REPORT ===================
console.log('\n');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║           تقرير تشخيص ملف الإكسل - المشاكل المكتشفة        ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

console.log(`📊 إجمالي صفوف البيانات: ${allProjects.length}`);

// Unique projects/indicators
const uniqueProjects = new Set(allProjects.map(p => `${p.initiative}|${p.project}`));
const uniqueInds = new Set(allProjects.filter(p => p.indicator).map(p => `${p.initiative}|${p.project}|${p.indicator}`));
console.log(`📁 مشاريع فريدة: ${uniqueProjects.size}`);
console.log(`📈 مؤشرات فريدة: ${uniqueInds.size}`);

// Projects with their quarter data
console.log('\n═══════════════════════════════════════');
console.log('🔍 مشكلة 1: مشاريع بدون مستهدف للمؤشر');
console.log('═══════════════════════════════════════');
const missingTgtProjs = allProjects.filter(p => p.indicator && !p.indTgt);
if (missingTgtProjs.length === 0) {
  console.log('✅ لا توجد مشكلة - جميع المؤشرات لها مستهدفات');
} else {
  missingTgtProjs.slice(0, 10).forEach(p => {
    console.log(`  ⚠️  [${p.sheet}] صف ${p.row}: "${p.project}" → مؤشر: "${p.indicator}" — مستهدف: غير موجود`);
  });
  if (missingTgtProjs.length > 10) console.log(`  ... و${missingTgtProjs.length - 10} حالات أخرى`);
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('🔍 مشكلة 2: قيم الأرباع الخام في الإكسل (كيف يُخزّنها الإكسل؟)');
console.log('═══════════════════════════════════════════════════════════');
// Show first 10 quarter sample rows
const sampledQuarterRows = allProjects.slice(0, 10);
sampledQuarterRows.forEach(p => {
  console.log(`  [${p.sheet}] صف ${p.row}: "${p.project}"`);
  console.log(`    Q1_خام="${p.q1Raw}" (isCheck=${p.q1}) | Q2_خام="${p.q2Raw}" (isCheck=${p.q2}) | Q3_خام="${p.q3Raw}" (isCheck=${p.q3}) | Q4_خام="${p.q4Raw}" (isCheck=${p.q4})`);
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('🔍 مشكلة 3: مشاريع مرتبطة بربع واحد فقط بينما لها مستهدفات شهرية في أكثر من ربع');
console.log('═══════════════════════════════════════════════════════════');

// Group by project and check if months span multiple quarters
const projectGroups = new Map();
for (const p of allProjects) {
  const key = `${p.initiative}|${p.project}`;
  if (!projectGroups.has(key)) {
    projectGroups.set(key, { ...p, rows: [] });
  }
  projectGroups.get(key).rows.push(p);
}

let quarterMismatchCount = 0;
for (const [key, proj] of projectGroups.entries()) {
  const monthsWithTargets = new Set();
  for (const row of proj.rows) {
    for (const [m, mData] of Object.entries(row.monthlyData)) {
      if (mData.tgt) monthsWithTargets.add(parseInt(m));
    }
  }
  const months = Array.from(monthsWithTargets).sort((a, b) => a - b);
  
  // Determine which quarters months fall in
  const quartersFromMonths = new Set();
  for (const m of months) {
    if (m <= 3) quartersFromMonths.add(1);
    else if (m <= 6) quartersFromMonths.add(2);
    else if (m <= 9) quartersFromMonths.add(3);
    else quartersFromMonths.add(4);
  }
  
  const activeQuartersInExcel = [proj.q1, proj.q2, proj.q3, proj.q4].filter(Boolean).length;
  const quartersFromMonthsCount = quartersFromMonths.size;

  if (activeQuartersInExcel !== quartersFromMonthsCount && months.length > 0) {
    quarterMismatchCount++;
    if (quarterMismatchCount <= 15) {
      console.log(`  ⚠️  "${proj.project}" (${proj.sheet})`);
      console.log(`    أرباع الإكسل المعلّمة: Q1=${proj.q1} Q2=${proj.q2} Q3=${proj.q3} Q4=${proj.q4} → ${activeQuartersInExcel} ربع`);
      console.log(`    أرباع مشتقة من الأشهر (${months.join(',')}): ${quartersFromMonthsCount} ربع [${Array.from(quartersFromMonths).join(',')}]`);
    }
  }
}
if (quarterMismatchCount === 0) console.log('✅ لا توجد تعارض في الأرباع');
else console.log(`\n  إجمالي حالات التعارض: ${quarterMismatchCount}`);

console.log('\n═══════════════════════════════════════════════════════════');
console.log('🔍 مشكلة 4: مشاريع بدون مؤشر قياس');
console.log('═══════════════════════════════════════════════════════════');
const noIndicatorProjs = Array.from(projectGroups.values()).filter(proj => !proj.rows.some(r => r.indicator));
if (noIndicatorProjs.length === 0) {
  console.log('✅ جميع المشاريع لها مؤشرات');
} else {
  noIndicatorProjs.slice(0, 10).forEach(p => {
    console.log(`  ⚠️  [${p.sheet}] "${p.project}" — لا يوجد مؤشر قياس`);
  });
  if (noIndicatorProjs.length > 10) console.log(`  ... و${noIndicatorProjs.length - 10} حالات أخرى`);
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('🔍 مشكلة 5: مشاريع لها مستهدفات فصلية فقط (لا شهرية)');
console.log('═══════════════════════════════════════════════════════════');
const quarterlyOnlyProjs = Array.from(projectGroups.values()).filter(proj => {
  const months = new Set();
  proj.rows.forEach(r => Object.keys(r.monthlyData).forEach(m => months.add(parseInt(m))));
  const quarterlyMonths = [3, 6, 9, 12];
  const nonQuarterlyMonths = Array.from(months).filter(m => !quarterlyMonths.includes(m));
  return months.size > 0 && nonQuarterlyMonths.length === 0;
});
console.log(`  مشاريع لها مستهدفات ربع سنوية فقط (لا شهرية): ${quarterlyOnlyProjs.length}`);
quarterlyOnlyProjs.slice(0, 5).forEach(p => {
  const months = new Set();
  p.rows.forEach(r => Object.keys(r.monthlyData).forEach(m => months.add(parseInt(m))));
  console.log(`  📋 "${p.project}" — أشهر: [${Array.from(months).sort((a,b)=>a-b).join(', ')}]`);
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('📋 ملخص كامل لجميع المشاريع والأرباع');
console.log('═══════════════════════════════════════════════════════════');
let sheetSummary = {};
for (const p of allProjects) {
  if (!sheetSummary[p.sheet]) sheetSummary[p.sheet] = { projects: new Set(), indicators: new Set(), rows: 0 };
  sheetSummary[p.sheet].projects.add(`${p.initiative}|${p.project}`);
  if (p.indicator) sheetSummary[p.sheet].indicators.add(`${p.initiative}|${p.project}|${p.indicator}`);
  sheetSummary[p.sheet].rows++;
}
for (const [sheet, stats] of Object.entries(sheetSummary)) {
  console.log(`  ${sheet}: ${stats.projects.size} مشروع, ${stats.indicators.size} مؤشر, ${stats.rows} صف`);
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('🔍 مشكلة 6: كيف يُقرأ عمود المستهدف السنوي للمؤشر؟');
console.log('       (هل هناك تشابك مع عمود مستهدف الفعالية؟)');
console.log('═══════════════════════════════════════════════════════════');
// Show first project from each sheet to see the target column situation
const seenSheets = new Set();
for (const p of allProjects) {
  if (!seenSheets.has(p.sheet)) {
    seenSheets.add(p.sheet);
    console.log(`\n  [${p.sheet}] المشروع: "${p.project}"`);
    console.log(`    مؤشر الكفاءة: "${p.effKpi}" → مستهدف: "${p.effTgt}"`);
    console.log(`    مؤشر الفعالية: "${p.effectKpi}" → مستهدف: "${p.effectTgt}"`);
    console.log(`    مؤشر القياس: "${p.indicator}" → مستهدف سنوي: "${p.indTgt}"`);
  }
}

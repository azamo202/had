/**
 * Verify that the fixed logic correctly accumulates quarters per initiative.
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

// NEW isCheck — same as the fixed version
const isCheck = (val) => {
  if (!val) return false;
  const s = String(val).trim();
  return s.includes('\u2714') || s.includes('\u2713') || s.includes('✔') || s.includes('✓') || s === 'true' || s === '1' || s.toLowerCase() === 'yes';
};

const ARABIC_NUM = { 'الأول': 1, 'الثاني': 2, 'الثالث': 3, 'الرابع': 4, 'الخامس': 5, 'السادس': 6, 'السابع': 7, 'الثامن': 8 };

const initiatives = new Map();
const projects = new Map();
const indicators = new Map();
const monthly = new Map();

for (const sheetName of workbook.SheetNames) {
  if (!sheetName.includes('الهدف')) continue;

  let goalNumber = 0;
  for (const [k, v] of Object.entries(ARABIC_NUM)) {
    if (sheetName.includes(k)) goalNumber = v;
  }

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
  let deptIdx=-1, projCostIdx=-1, weekIdx=-1, makkahIdx=-1, madinahIdx=-1, budgetIdx=-1;
  const monthIdxs = {};
  let currentMonthNum = -1;

  for (let c = 0; c < (grid[0] || []).length; c++) {
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
    else if (budgetIdx === -1 && (fullHead.includes('ميزانية المبادرة') || fullHead.includes('تكلفة') || fullHead.includes('ميزانية'))) {
      makkahIdx = c; madinahIdx = c + 1; budgetIdx = c;
    }
    else if (h0.includes('النطاق الزمني')) weekIdx = c;
    else if (h0.includes('المشاريع التشغيلية')) projIdx = c;
    else if (h0.includes('مؤشر القياس')) indNameIdx = c;
    else if (h0.includes('خط الأساس')) indBaseIdx = c;
    // FIXED: Lock indTgtIdx once found
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
      if (h1.includes(mName) || h0.includes(mName)) { mNumMatched = mNum; break; }
    }
    if (mNumMatched !== -1) currentMonthNum = mNumMatched;
    else if (h0 !== '') currentMonthNum = -1;

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

  let lastProjName = null;
  for (let r = 3; r < grid.length; r++) {
    const row = grid[r];
    const gName = normalizeSpace(row[gIdx]);
    const oName = normalizeSpace(row[oIdx]);
    const iName = normalizeSpace(row[iIdx]);
    const rawPName = normalizeSpace(row[projIdx]);
    if (rawPName) lastProjName = rawPName;
    const pName = lastProjName;
    if (!gName && !oName && !iName && !pName) continue;
    if (!gName || !iName || !pName) continue;

    const objKey = `${gName}|${oName}`;
    const initKey = `${objKey}|${iName}`;
    const projKey = `${initKey}|${pName}`;

    if (!initiatives.has(initKey)) {
      initiatives.set(initKey, {
        name: iName, sheet: sheetName,
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

    // FIXED: Accumulate quarters and KPI fields
    const curInit = initiatives.get(initKey);
    if (!curInit.q1 && q1Idx >= 0 && isCheck(row[q1Idx])) curInit.q1 = true;
    if (!curInit.q2 && q2Idx >= 0 && isCheck(row[q2Idx])) curInit.q2 = true;
    if (!curInit.q3 && q3Idx >= 0 && isCheck(row[q3Idx])) curInit.q3 = true;
    if (!curInit.q4 && q4Idx >= 0 && isCheck(row[q4Idx])) curInit.q4 = true;
    if (!curInit.effKpi && effKpiIdx >= 0) { const v = normalizeSpace(row[effKpiIdx]); if (v) curInit.effKpi = v; }
    if (!curInit.effTgt && effTgtIdx >= 0) { const v = normalizeSpace(row[effTgtIdx]); if (v) curInit.effTgt = v; }
    if (!curInit.effectKpi && effectKpiIdx >= 0) { const v = normalizeSpace(row[effectKpiIdx]); if (v) curInit.effectKpi = v; }
    if (!curInit.effectTgt && effectTgtIdx >= 0) { const v = normalizeSpace(row[effectTgtIdx]); if (v) curInit.effectTgt = v; }
    if (!curInit.week && weekIdx >= 0) { const v = normalizeSpace(row[weekIdx]); if (v) curInit.week = v; }

    if (!projects.has(projKey)) {
      projects.set(projKey, { name: pName, initKey, sheet: sheetName });
    }

    const indName = normalizeSpace(row[indNameIdx]);
    const indTgtRaw = normalizeSpace(row[indTgtIdx]);
    if (indName) {
      const indKey = `${projKey}|${indName}`;
      if (!indicators.has(indKey)) {
        indicators.set(indKey, { name: indName, target: indTgtRaw, projKey, sheet: sheetName });
      }
      for (let m = 1; m <= 12; m++) {
        const mCols = monthIdxs[m];
        if (mCols) {
          const mTgtRaw = mCols.tgt >= 0 ? normalizeSpace(row[mCols.tgt]) : null;
          const mActRaw = mCols.actual >= 0 ? normalizeSpace(row[mCols.actual]) : null;
          if (mTgtRaw || mActRaw) {
            const mKey = `${indKey}|${m}`;
            if (!monthly.has(mKey)) {
              monthly.set(mKey, { indKey, month: m, tgt: mTgtRaw, act: mActRaw });
            }
          }
        }
      }
    }
  }
}

// ============ REPORT ============
console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║       تقرير التحقق من الإصلاح (منطق جديد)           ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

console.log(`📦 مبادرات: ${initiatives.size}`);
console.log(`📁 مشاريع: ${projects.size}`);
console.log(`📈 مؤشرات: ${indicators.size}`);
console.log(`📅 مستهدفات شهرية: ${monthly.size}`);

// Check quarters per initiative
console.log('\n══ فحص الأرباع لكل مبادرة ══');
let allFour = 0, someQuarters = 0, noQuarters = 0;
for (const [key, init] of initiatives.entries()) {
  const qCount = [init.q1, init.q2, init.q3, init.q4].filter(Boolean).length;
  if (qCount === 4) allFour++;
  else if (qCount > 0) someQuarters++;
  else noQuarters++;
}
console.log(`  لها 4 أرباع: ${allFour}`);
console.log(`  لها بعض الأرباع: ${someQuarters}`);
console.log(`  بدون أرباع: ${noQuarters}`);

// Show sample initiatives with their quarters
console.log('\n══ عينة من المبادرات وأرباعها ══');
let count = 0;
for (const [key, init] of initiatives.entries()) {
  if (count++ > 8) break;
  console.log(`  "${init.name.substring(0, 40)}" [${init.sheet}]`);
  console.log(`    Q1=${init.q1} Q2=${init.q2} Q3=${init.q3} Q4=${init.q4}`);
  console.log(`    مؤشر الكفاءة: "${(init.effKpi || '').substring(0, 40)}" → ${init.effTgt}`);
  console.log(`    مؤشر الفعالية: "${(init.effectKpi || '').substring(0, 40)}" → ${init.effectTgt}`);
}

// Monthly targets summary per month
console.log('\n══ إحصاء المستهدفات الشهرية ══');
const monthCount = {};
for (const m of monthly.values()) {
  monthCount[m.month] = (monthCount[m.month] || 0) + 1;
}
for (let m = 1; m <= 12; m++) {
  const mNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const count = monthCount[m] || 0;
  console.log(`  شهر ${m} (${mNames[m-1]}): ${count} مستهدف`);
}

// Check for initiatives with missing KPI
console.log('\n══ مبادرات بدون مؤشر كفاءة/فعالية ══');
let missingKpi = 0;
for (const [key, init] of initiatives.entries()) {
  if (!init.effKpi || !init.effectKpi) {
    missingKpi++;
    if (missingKpi <= 5) {
      console.log(`  ⚠️  "${init.name}" [${init.sheet}] — كفاءة="${init.effKpi}" فعالية="${init.effectKpi}"`);
    }
  }
}
if (missingKpi === 0) console.log('  ✅ جميع المبادرات لها مؤشرات');
else console.log(`  إجمالي: ${missingKpi} مبادرة`);

// Indicators with missing annual target
console.log('\n══ مؤشرات بدون مستهدف سنوي ══');
let missingAnnualTgt = 0;
for (const [key, ind] of indicators.entries()) {
  if (!ind.target) {
    missingAnnualTgt++;
    if (missingAnnualTgt <= 5) {
      console.log(`  ⚠️  "${ind.name}" [${ind.sheet}]`);
    }
  }
}
if (missingAnnualTgt === 0) console.log('  ✅ جميع المؤشرات لها مستهدف سنوي');
else console.log(`  إجمالي: ${missingAnnualTgt} مؤشر`);

console.log('\n✅ انتهى التحقق');

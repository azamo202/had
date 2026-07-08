import * as xlsx from 'xlsx';
import { readFileSync } from 'fs';

const filePath = 'الخطة التشغيلية المحدثة الأخيرة (1).xlsx';
const data = readFileSync(filePath);
const workbook = xlsx.read(data, { cellDates: true });

console.log('=== الأوراق في الملف ===');
workbook.SheetNames.forEach((name, i) => console.log(`  [${i}] "${name}"`));

const ARABIC_NUM = { 'الأول': 1, 'الثاني': 2, 'الثالث': 3, 'الرابع': 4, 'الخامس': 5, 'السادس': 6 };

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

for (const sheetName of workbook.SheetNames) {
  if (!sheetName.includes('الهدف')) continue;

  const sheet = workbook.Sheets[sheetName];
  if (!sheet || !sheet['!ref']) continue;

  const range = xlsx.utils.decode_range(sheet['!ref']);

  // Build full grid with merges filled
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

  console.log(`\n${'='.repeat(80)}`);
  console.log(`ورقة: "${sheetName}" — أعمدة: ${range.e.c+1}, صفوف: ${range.e.r+1}`);

  // Print header rows (first 4 rows)
  console.log('\n--- صفوف الرأس (أول 4 صفوف) ---');
  for (let R = 0; R < Math.min(4, grid.length); R++) {
    const rowData = grid[R].map((v, i) => v != null ? `[${i}]${v}` : null).filter(Boolean);
    console.log(`  الصف ${R}: ${rowData.join(' | ')}`);
  }

  // Find columns
  let gIdx=-1, oIdx=-1, iIdx=-1, projIdx=-1, indNameIdx=-1, indTgtIdx=-1, indBaseIdx=-1;
  let effKpiIdx=-1, effTgtIdx=-1, effectKpiIdx=-1, effectTgtIdx=-1;
  let q1Idx=-1, q2Idx=-1, q3Idx=-1, q4Idx=-1;
  let deptIdx=-1, projCostIdx=-1, weekIdx=-1;
  const monthIdxs = {};

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
    else if (h0.includes('الإدارة') || h0.includes('القطاع')) deptIdx = c;
    else if (projCostIdx === -1 && (fullHead.includes('تكلفة التنفيذ'))) projCostIdx = c;
    else if (h0.includes('النطاق الزمني')) weekIdx = c;
    else if (h0.includes('المشاريع التشغيلية')) projIdx = c;
    else if (h0.includes('مؤشر القياس')) indNameIdx = c;
    else if (h0.includes('خط الأساس')) indBaseIdx = c;
    else if (h0.includes('المستهدف') && indNameIdx >= 0 && c > indNameIdx && !h0.includes('الشهري')) {
      indTgtIdx = c;
    }

    if (h1.includes('الربع 1') || h1.includes('الربع الأول')) q1Idx = c;
    else if (h1.includes('الربع 2') || h1.includes('الربع الثاني')) q2Idx = c;
    else if (h1.includes('الربع 3') || h1.includes('الربع الثالث')) q3Idx = c;
    else if (h1.includes('الربع 4') || h1.includes('الربع الرابع')) q4Idx = c;

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
      } else if (fullHead.includes('المستهدف') || monthIdxs[mNum].tgt === -1) {
        if (fullHead.includes('المستهدف')) monthIdxs[mNum].tgt = c;
        else if (monthIdxs[mNum].tgt === -1) monthIdxs[mNum].tgt = c;
      }
    }
  }

  console.log('\n--- فهرس الأعمدة المكتشفة ---');
  console.log(`  الهدف الاستراتيجي: ${gIdx}`);
  console.log(`  الهدف الفرعي: ${oIdx}`);
  console.log(`  المبادرة: ${iIdx}`);
  console.log(`  الإدارة: ${deptIdx}`);
  console.log(`  مؤشر الكفاءة: ${effKpiIdx} | مستهدفه: ${effTgtIdx}`);
  console.log(`  مؤشر الفعالية: ${effectKpiIdx} | مستهدفه: ${effectTgtIdx}`);
  console.log(`  النطاق الزمني: ${weekIdx}`);
  console.log(`  المشاريع: ${projIdx}`);
  console.log(`  مؤشر القياس: ${indNameIdx}`);
  console.log(`  خط الأساس: ${indBaseIdx}`);
  console.log(`  المستهدف السنوي: ${indTgtIdx}`);
  console.log(`  تكلفة التنفيذ: ${projCostIdx}`);
  console.log(`  الأرباع: Q1=${q1Idx} Q2=${q2Idx} Q3=${q3Idx} Q4=${q4Idx}`);
  console.log(`  أشهر مكتشفة: ${Object.keys(monthIdxs).join(', ')}`);
  for (const [m, cols] of Object.entries(monthIdxs)) {
    console.log(`    شهر ${m}: tgt=${cols.tgt} actual=${cols.actual} chal=${cols.chal} ev=${cols.ev}`);
  }

  // Sample data rows
  console.log('\n--- عينة من بيانات المشاريع (أول 5 صفوف بيانات) ---');
  let sampleCount = 0;
  for (let r = 3; r < grid.length && sampleCount < 5; r++) {
    const row = grid[r];
    const gName = normalizeSpace(row[gIdx]);
    const iName = normalizeSpace(row[iIdx]);
    const pName = normalizeSpace(row[projIdx]);
    const indName = normalizeSpace(row[indNameIdx]);
    if (!gName && !iName && !pName) continue;
    if (!gName || !iName || !pName) continue;

    const q1Val = q1Idx >= 0 ? row[q1Idx] : 'غير موجود';
    const q2Val = q2Idx >= 0 ? row[q2Idx] : 'غير موجود';
    const q3Val = q3Idx >= 0 ? row[q3Idx] : 'غير موجود';
    const q4Val = q4Idx >= 0 ? row[q4Idx] : 'غير موجود';

    console.log(`\n  [صف ${r}]`);
    console.log(`    الهدف: "${gName}"`);
    console.log(`    المبادرة: "${iName}"`);
    console.log(`    المشروع: "${pName}"`);
    console.log(`    مؤشر القياس: "${indName}"`);
    console.log(`    المستهدف السنوي [${indTgtIdx}]: "${normalizeSpace(row[indTgtIdx])}"`);
    console.log(`    Q1[${q1Idx}]="${q1Val}" Q2[${q2Idx}]="${q2Val}" Q3[${q3Idx}]="${q3Val}" Q4[${q4Idx}]="${q4Val}"`);
    
    // Print monthly data
    for (const [m, cols] of Object.entries(monthIdxs)) {
      const tgt = cols.tgt >= 0 ? row[cols.tgt] : null;
      const act = cols.actual >= 0 ? row[cols.actual] : null;
      if (tgt || act) {
        console.log(`    شهر ${m}: مستهدف="${tgt}" منجز="${act}"`);
      }
    }
    sampleCount++;
  }

  // Count projects and indicators
  let projSet = new Set(), indSet = new Set(), rowCount = 0;
  let lastProjName = null;
  let quarterIssues = [];
  for (let r = 3; r < grid.length; r++) {
    const row = grid[r];
    const gName = normalizeSpace(row[gIdx]);
    const iName = normalizeSpace(row[iIdx]);
    const rawPName = normalizeSpace(row[projIdx]);
    if (rawPName) lastProjName = rawPName;
    const pName = lastProjName;
    if (!gName && !iName && !pName) continue;
    if (!gName || !iName || !pName) continue;
    rowCount++;
    
    const projKey = `${iName}|${pName}`;
    projSet.add(projKey);

    const indName = normalizeSpace(row[indNameIdx]);
    if (indName) indSet.add(`${projKey}|${indName}`);

    // Check quarter values
    const q1Val = q1Idx >= 0 ? row[q1Idx] : null;
    const q2Val = q2Idx >= 0 ? row[q2Idx] : null;
    const q3Val = q3Idx >= 0 ? row[q3Idx] : null;
    const q4Val = q4Idx >= 0 ? row[q4Idx] : null;
    if ((q1Val || q2Val || q3Val || q4Val) && quarterIssues.length < 3) {
      const isCheck = (val) => {
        if (!val) return false;
        const s = String(val).trim();
        return s.includes('✔') || s.includes('✓') || s === 'true' || s === '1' || s.toLowerCase() === 'yes';
      };
      if (!isCheck(q1Val) && !isCheck(q2Val) && !isCheck(q3Val) && !isCheck(q4Val)) {
        quarterIssues.push({ row: r, proj: pName, q1: q1Val, q2: q2Val, q3: q3Val, q4: q4Val });
      }
    }
  }

  console.log(`\n--- إحصائيات "${sheetName}" ---`);
  console.log(`  صفوف بيانات: ${rowCount}`);
  console.log(`  مشاريع فريدة: ${projSet.size}`);
  console.log(`  مؤشرات فريدة: ${indSet.size}`);
  if (quarterIssues.length > 0) {
    console.log(`\n⚠️  مشاكل في قيم الأرباع:`);
    quarterIssues.forEach(issue => {
      console.log(`    صف ${issue.row} — "${issue.proj}": Q1="${issue.q1}" Q2="${issue.q2}" Q3="${issue.q3}" Q4="${issue.q4}"`);
    });
  }
}

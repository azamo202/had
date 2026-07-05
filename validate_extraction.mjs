import fs from 'fs';
import * as XLSX from 'xlsx';

function getCellRaw(sheet, r, c) {
  const cellAddress = XLSX.utils.encode_cell({ r, c });
  return sheet[cellAddress];
}
function getCellValueRaw(sheet, r, c) {
  const cell = getCellRaw(sheet, r, c);
  return cell !== undefined ? cell.v : null;
}
function getMergedRange(sheet, r, c) {
  if (sheet['!merges']) {
    for (const m of sheet['!merges']) {
      if (r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c) {
        return m;
      }
    }
  }
  return { s: {r, c}, e: {r, c} };
}
function getMergedTopLeftValue(sheet, r, c) {
  const m = getMergedRange(sheet, r, c);
  return getCellValueRaw(sheet, m.s.r, m.s.c);
}
function isWhitespaceOrNbsp(val) {
  if (typeof val === 'string') {
    return val.trim().replace(/\u00A0/g, '') === '';
  }
  return false;
}
function normalizeNull(val) {
  if (val === undefined || val === null || val === '') return null;
  if (isWhitespaceOrNbsp(val)) return null;
  return val;
}
function tryNumeric(val) {
  const n = normalizeNull(val);
  if (n === null) return { raw: null, numeric: null };
  const rawStr = String(n);
  const num = Number(n);
  if (!isNaN(num) && rawStr.trim() !== '') {
    return { raw: null, numeric: num };
  }
  return { raw: rawStr, numeric: null };
}

function runValidation() {
  const arrayBuffer = fs.readFileSync('test.xlsx');
  const workbook = XLSX.read(arrayBuffer, { cellFormula: true, type: 'array' });
  
  const expectedSheetNames = [
    "الهدف الأول", "الهدف الثاني", "الهدف الثالث", "الهدف الرابع", 
    "الهدف الخامس", "الهدف السادس", "الهدف السابع", "الهدف الثامن"
  ];

  let csvContent = "Sheet,Cell,Field,ExtractedValue\n";
  let cellsChecked = 0;

  function assertCell(sheetName, cellRef, actualVal, expectedVal, fieldName) {
    cellsChecked++;
    let outVal = String(actualVal).replace(/"/g, '""').replace(/\n/g, '\\n');
    csvContent += `"${sheetName}","${cellRef}","${fieldName}","${outVal}"\n`;

    // specific checks for the report
    if (cellRef === "H16" && fieldName === "department_name") {
       console.log(`[Target Request] H16 Department: Extracted -> ${actualVal}`);
    }
    if (fieldName === "budget_I" && (actualVal === "مكة" || actualVal === "المدينة")) {
       console.log(`[Target Request] Budget Split: Found ${actualVal} in sheet ${sheetName} cell ${cellRef}`);
    }
    if (fieldName === "month_8_target" || fieldName === "month_8_achieved") {
       if (actualVal !== null && actualVal !== undefined && actualVal !== "null" && actualVal !== "") {
           console.log(`[Target Request] August Value (Month 8): Sheet ${sheetName} Cell ${cellRef} Field ${fieldName} Value ${actualVal}`);
       }
    }
  }

  for (const sheetName of expectedSheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : {s:{r:0,c:0}, e:{r:0,c:0}};
    const max_row = range.e.r + 1;
    const max_col = range.e.c + 1;

    let variant = "unknown";
    let has_execution_cost = false;
    let has_baseline = false;
    
    let budgetCols = [];
    for (let c = 0; c < max_col; c++) {
      for (let r = 0; r <= 2; r++) {
        const val = String(getCellValueRaw(sheet, r, c) || '').trim();
        if (val === "ميزانية المبادرة") {
          budgetCols.push(c);
          break;
        }
        if (val === "تكلفة التنفيذ") has_execution_cost = true;
        if (val === "خط الأساس\nالمنجز في 2025" || val.includes("خط الأساس")) has_baseline = true;
      }
    }

    if (budgetCols.length >= 2 && budgetCols[1] === budgetCols[0] + 1) {
      variant = "variant_A";
    } else if (has_execution_cost && has_baseline) {
      variant = "variant_B";
    } else if (has_execution_cost && !has_baseline) {
      variant = "variant_C";
    }

    const colMap = new Map();
    const monthsMap = new Map();
    const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليه", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

    for (let c = 0; c < max_col; c++) {
      const headers = [];
      for (let r = 0; r <= 2; r++) {
        const v = getCellValueRaw(sheet, r, c);
        if (v) headers.push(String(v).trim().replace(/\u00A0/g, ' '));
      }
      const combined = headers.join(" | ");
      
      if (combined.includes("الهدف الاستراتيجي")) colMap.set("goal", c);
      if (combined.includes("الهدف الفرعي")) colMap.set("subgoal", c);
      if (combined.includes("المبادرة الاستراتيجية")) colMap.set("initiative", c);
      if (combined.includes("مؤشر الكفاءة")) colMap.set("eff_kpi", c);
      if (combined.includes("مؤشر الفعالية")) colMap.set("efft_kpi", c);
      if (combined.includes("الإدارة / القسم") || combined.includes("القطاع / الإدارة")) colMap.set("dept", c);
      if (combined.includes("النطاق الزمني")) colMap.set("timeframe", c);
      if (combined.includes("الربع 1")) colMap.set("q1", c);
      if (combined.includes("الربع 2")) colMap.set("q2", c);
      if (combined.includes("الربع 3")) colMap.set("q3", c);
      if (combined.includes("الربع 4")) colMap.set("q4", c);
      if (combined.includes("المشاريع التشغيلية")) colMap.set("project", c);
      if (combined.includes("تكلفة التنفيذ")) colMap.set("exec_cost", c);
      if (combined.includes("مؤشر القياس")) colMap.set("proj_kpi", c);
      if (combined.includes("خط الأساس")) colMap.set("baseline", c);

      for (let mIdx = 0; mIdx < 12; mIdx++) {
         const mName = monthNames[mIdx];
         for (let r = 0; r <= 2; r++) {
            const cellVal = String(getCellValueRaw(sheet, r, c) || '').trim();
            if (cellVal === mName) {
               const mMerge = getMergedRange(sheet, r, c);
               let tCol=-1, aCol=-1, cCol=-1, eCol=-1;
               const endScan = Math.min(mMerge.s.c + 6, max_col);
               for (let sc = mMerge.s.c; sc < endScan; sc++) {
                  const subHdr = String(getCellValueRaw(sheet, mMerge.e.r + 1, sc) || getCellValueRaw(sheet, mMerge.e.r, sc) || '').trim();
                  if (subHdr === "المستهدف") tCol = sc;
                  else if (subHdr === "المنجز") aCol = sc;
                  else if (subHdr === "التحديات") cCol = sc;
                  else if (subHdr === "الشواهد") eCol = sc;
               }
               if (tCol === -1) tCol = c;
               if (aCol === -1) aCol = c + 1;
               if (cCol === -1) cCol = c + 2;
               if (eCol === -1) eCol = c + 3;
               monthsMap.set(mIdx + 1, { targetCol: tCol, achievedCol: aCol, challengeCol: cCol, evidenceCol: eCol });
            }
         }
      }
    }
    
    const initCol = colMap.get("initiative") || 2;
    const effKpiCol = colMap.get("eff_kpi") || 3;
    const effTargetCol = effKpiCol + 1;
    const efftKpiCol = colMap.get("efft_kpi") || 5;
    const efftTargetCol = efftKpiCol + 1;
    const deptCol = colMap.get("dept") || 7;
    
    let budgetCol1 = budgetCols[0] || 8;
    let budgetCol2 = budgetCols.length > 1 ? budgetCols[1] : 9;

    const timeframeCol = colMap.get("timeframe") || (variant === 'variant_A' ? 10 : 9);
    const q1Col = colMap.get("q1") || (variant === 'variant_A' ? 11 : 10);
    const projCol = colMap.get("project") || (variant === 'variant_A' ? 15 : 14);
    const execCostCol = colMap.get("exec_cost") || 15;
    const projKpiCol = colMap.get("proj_kpi") || (variant === 'variant_A' ? 16 : (variant === 'variant_C' ? 16 : 17));
    const projKpiTargetCol = projKpiCol + 1;
    const baselineCol = colMap.get("baseline") || 16;

    for (let r = 3; r < max_row; r++) {
      const kpiName = normalizeNull(getCellValueRaw(sheet, r, projKpiCol));
      if (!kpiName) continue;
      
      const initRaw = getMergedTopLeftValue(sheet, r, initCol);
      const initRange = getMergedRange(sheet, r, initCol);
      const deptRaw = getMergedTopLeftValue(sheet, r, deptCol);

      assertCell(sheetName, XLSX.utils.encode_cell({r: initRange.s.r, c: deptCol}), deptRaw, deptRaw, "department_name");

      if (variant === 'variant_A') {
         const vI = normalizeNull(getMergedTopLeftValue(sheet, r, budgetCol1));
         assertCell(sheetName, XLSX.utils.encode_cell({r: initRange.s.r, c: budgetCol1}), vI, vI, "budget_I");
         
         if (budgetCol2 !== undefined) {
             const vJ = normalizeNull(getMergedTopLeftValue(sheet, r, budgetCol2));
             assertCell(sheetName, XLSX.utils.encode_cell({r: initRange.s.r, c: budgetCol2}), vJ, vJ, "budget_J");
         }
      } else {
         const bTop = getMergedTopLeftValue(sheet, r, budgetCol1);
         const { raw, numeric } = tryNumeric(bTop);
         assertCell(sheetName, XLSX.utils.encode_cell({r: initRange.s.r, c: budgetCol1}), numeric !== null ? numeric : raw, numeric !== null ? numeric : raw, "budget_num");
      }

      const kpiRawTop = normalizeNull(getCellValueRaw(sheet, r, projKpiTargetCol));
      const kpiTarget = tryNumeric(kpiRawTop);
      assertCell(sheetName, XLSX.utils.encode_cell({r, c: projKpiTargetCol}), kpiTarget.numeric !== null ? kpiTarget.numeric : kpiTarget.raw, kpiTarget.numeric !== null ? kpiTarget.numeric : kpiTarget.raw, "kpi_target");

      for (let m = 1; m <= 12; m++) {
         const mCols = monthsMap.get(m);
         if (!mCols) continue;

         const mTargetVal = normalizeNull(getCellValueRaw(sheet, r, mCols.targetCol));
         const mt = tryNumeric(mTargetVal);
         assertCell(sheetName, XLSX.utils.encode_cell({r, c: mCols.targetCol}), mt.numeric !== null ? mt.numeric : mt.raw, mt.numeric !== null ? mt.numeric : mt.raw, `month_${m}_target`);
         
         const mAchievedVal = normalizeNull(getCellValueRaw(sheet, r, mCols.achievedCol));
         const ma = tryNumeric(mAchievedVal);
         assertCell(sheetName, XLSX.utils.encode_cell({r, c: mCols.achievedCol}), ma.numeric !== null ? ma.numeric : ma.raw, ma.numeric !== null ? ma.numeric : ma.raw, `month_${m}_achieved`);
      }
    }
  }

  const artifactsDir = "C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\aa7fc737-915e-491a-adf9-6a57234c8315";
  fs.writeFileSync(`${artifactsDir}\\validation_full_report.csv`, csvContent);
  console.log(`Saved ${cellsChecked} rows to ${artifactsDir}\\validation_full_report.csv`);
}

runValidation();

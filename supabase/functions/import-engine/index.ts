import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import * as XLSX from "https://esm.sh/xlsx@0.18.5"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function computeHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getCellRaw(sheet: XLSX.WorkSheet, r: number, c: number): XLSX.CellObject | undefined {
  const cellAddress = XLSX.utils.encode_cell({ r, c });
  return sheet[cellAddress];
}

function getCellValueRaw(sheet: XLSX.WorkSheet, r: number, c: number): any {
  const cell = getCellRaw(sheet, r, c);
  return cell !== undefined ? cell.v : null;
}

function isPercentageFormat(sheet: XLSX.WorkSheet, r: number, c: number): boolean {
  const cell = getCellRaw(sheet, r, c);
  if (!cell || !cell.z) return false;
  return String(cell.z).includes('%');
}

function getMergedRange(sheet: XLSX.WorkSheet, r: number, c: number) {
  if (sheet['!merges']) {
    for (const m of sheet['!merges']) {
      if (r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c) {
        return m;
      }
    }
  }
  return { s: {r, c}, e: {r, c} };
}

function getMergedTopLeftValue(sheet: XLSX.WorkSheet, r: number, c: number): any {
  const m = getMergedRange(sheet, r, c);
  return getCellValueRaw(sheet, m.s.r, m.s.c);
}

function isPercentageMerged(sheet: XLSX.WorkSheet, r: number, c: number): boolean {
  const m = getMergedRange(sheet, r, c);
  return isPercentageFormat(sheet, m.s.r, m.s.c);
}

function isWhitespaceOrNbsp(val: any): boolean {
  if (typeof val === 'string') {
    return val.trim().replace(/\u00A0/g, '') === '';
  }
  return false;
}

function normalizeNull(val: any): any {
  if (val === undefined || val === null || val === '') return null;
  if (isWhitespaceOrNbsp(val)) return null;
  return val;
}

function tryNumeric(val: any): { raw: string | null, numeric: number | null } {
  const n = normalizeNull(val);
  if (n === null) return { raw: null, numeric: null };
  const rawStr = String(n);
  const num = Number(n);
  if (!isNaN(num) && rawStr.trim() !== '') {
    return { raw: null, numeric: num };
  }
  return { raw: rawStr, numeric: null };
}

function normalizeQuarter(val: any): boolean {
  const n = normalizeNull(val);
  if (n === null) return false;
  const str = String(n).trim();
  if (['✔︎', '✔', '✓'].includes(str)) return true;
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { filePath, dryRun, fileHash } = await req.json()
    if (!filePath) throw new Error("filePath is required")

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: fileData, error: downloadError } = await supabase.storage.from('evidence_files').download(filePath)
    if (downloadError) throw downloadError

    const arrayBuffer = await fileData.arrayBuffer()
    const currentHash = await computeHash(arrayBuffer)

    if (dryRun === false) {
      if (!fileHash) throw new Error("fileHash is required for commit phase.")
      if (fileHash !== currentHash) {
        throw new Error("الملف تغيّر، يلزم مراجعة Dry-run جديدة")
      }
    }

    const workbook = XLSX.read(arrayBuffer, { cellFormula: true, type: 'array' })
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet['!ref']) continue;
      const range = XLSX.utils.decode_range(sheet['!ref']);
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = sheet[XLSX.utils.encode_cell({r, c})];
          if (cell && cell.f) {
            throw new Error(`Formula detected in sheet ${sheetName} cell ${XLSX.utils.encode_cell({r,c})}. 0 formulas allowed.`);
          }
        }
      }
    }

    const report = {
      fileHash: currentHash,
      isDryRun: dryRun,
      formulasCheck: "Passed (0 formulas)",
      sheets: [] as any[],
      expectedRowCounts: [39, 6, 7, 9, 11, 19, 19, 17],
      actualRowCounts: [] as number[],
      rowCountsMatch: false,
      mergesCrossCheck: "Pending...",
      anomaliesTotal: 0
    }

    let globalAnomaliesCount = 0;
    const allSheetsData = [];
    const expectedSheetNames = [
      "الهدف الأول", "الهدف الثاني", "الهدف الثالث", "الهدف الرابع", 
      "الهدف الخامس", "الهدف السادس", "الهدف السابع", "الهدف الثامن"
    ];

    let sheetIdx = 0;
    for (const sheetName of expectedSheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const sheetAnomalies: any[] = [];
      const addAnomaly = (cell_ref: string, type: string, raw_value: any, note: string) => {
        sheetAnomalies.push({ sheet_name: sheetName, cell_ref, anomaly_type: type, raw_value: String(raw_value), note });
        globalAnomaliesCount++;
      };

      const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : {s:{r:0,c:0}, e:{r:0,c:0}};
      const max_row = range.e.r + 1;
      const max_col = range.e.c + 1;
      const sheet_id = sheetIdx + 1;

      let variant = "unknown";
      let has_execution_cost = false;
      let has_baseline = false;
      let is_budget_split = false;
      
      let budgetCols = [];
      for (let c = 0; c < max_col; c++) {
        let textFound = false;
        for (let r = 0; r <= 2; r++) {
          const val = String(getCellValueRaw(sheet, r, c) || '').trim();
          if (val === "ميزانية المبادرة") {
            budgetCols.push(c);
            textFound = true;
            break;
          }
          if (val === "تكلفة التنفيذ") has_execution_cost = true;
          if (val === "خط الأساس\nالمنجز في 2025" || val.includes("خط الأساس")) has_baseline = true;
        }
      }

      if (budgetCols.length >= 2 && budgetCols[1] === budgetCols[0] + 1) {
        variant = "variant_A";
        is_budget_split = true;
      } else if (has_execution_cost && has_baseline) {
        variant = "variant_B";
      } else if (has_execution_cost && !has_baseline) {
        variant = "variant_C";
      }

      let dept_header = "الإدارة / القسم";
      for (let c = 0; c < max_col; c++) {
        for (let r = 0; r <= 2; r++) {
          const val = String(getCellValueRaw(sheet, r, c) || '').trim();
          if (val === "القطاع / الإدارة") dept_header = "القطاع / الإدارة";
        }
      }

      const sheetData = {
        sheet_id,
        sheet_name: sheetName,
        column_variant: variant,
        max_row,
        max_col,
        has_execution_cost_column: has_execution_cost,
        has_baseline_column: has_baseline,
        budget_is_split_two_cols: is_budget_split,
        department_header_literal: dept_header,
        goal: { "الهدف الاستراتيجي": getMergedTopLeftValue(sheet, 3, 0) },
        sub_goals: [] as any[],
        anomalies: sheetAnomalies
      };

      const colMap = new Map<string, number>();
      const monthsMap = new Map<number, { targetCol: number, achievedCol: number, challengeCol: number, evidenceCol: number }>();
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

        // Dynamic Month Detection
        for (let mIdx = 0; mIdx < 12; mIdx++) {
           const mName = monthNames[mIdx];
           for (let r = 0; r <= 2; r++) {
              const cellVal = String(getCellValueRaw(sheet, r, c) || '').trim();
              if (cellVal === mName) {
                 // Found month header at (r, c). Let's find the 4 sub-columns directly underneath it (or within its merge span).
                 const mMerge = getMergedRange(sheet, r, c);
                 let tCol=-1, aCol=-1, cCol=-1, eCol=-1;
                 // Scan from mMerge.s.c to mMerge.e.c for the sub-headers (could be up to 10 cols just in case)
                 const endScan = Math.min(mMerge.s.c + 6, max_col);
                 for (let sc = mMerge.s.c; sc < endScan; sc++) {
                    const subHdr = String(getCellValueRaw(sheet, mMerge.e.r + 1, sc) || getCellValueRaw(sheet, mMerge.e.r, sc) || '').trim();
                    if (subHdr === "المستهدف") tCol = sc;
                    else if (subHdr === "المنجز") aCol = sc;
                    else if (subHdr === "التحديات") cCol = sc;
                    else if (subHdr === "الشواهد") eCol = sc;
                 }
                 // Fallbacks in case headers are completely broken in some files
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

      let currentRowCount = 0;
      let currentSubGoal = null;
      let currentInit = null;
      let currentProj = null;

      for (let r = 3; r < max_row; r++) {
        const kpiName = normalizeNull(getCellValueRaw(sheet, r, projKpiCol));
        if (!kpiName) continue;
        
        currentRowCount++;

        const sgRaw = getMergedTopLeftValue(sheet, r, 1);
        const sgRange = getMergedRange(sheet, r, 1);
        
        if (!currentSubGoal || currentSubGoal["الهدف الفرعي"] !== sgRaw) {
          currentSubGoal = {
            "الهدف الفرعي": String(sgRaw),
            "source_row_start": sgRange.s.r + 1,
            "source_row_end": sgRange.e.r + 1,
            "initiatives": []
          };
          sheetData.sub_goals.push(currentSubGoal);
        }

        const initRaw = getMergedTopLeftValue(sheet, r, initCol);
        const initRange = getMergedRange(sheet, r, initCol);

        let deptVal = normalizeNull(getMergedTopLeftValue(sheet, r, deptCol));
        if (deptVal && String(deptVal).includes('\n')) {
          addAnomaly(XLSX.utils.encode_cell({r: initRange.s.r, c: deptCol}), "multi_value_cell", deptVal, "Department cell has newline");
        }

        let bSingleNum = null, bI_raw = null, bJ_raw = null;
        if (variant === 'variant_A') {
           const vI = normalizeNull(getMergedTopLeftValue(sheet, r, budgetCol1));
           const vJ = normalizeNull(getMergedTopLeftValue(sheet, r, budgetCol2));
           
           if (vI === "مكة" || vJ === "المدينة") {
             addAnomaly(XLSX.utils.encode_cell({r: initRange.s.r, c: budgetCol1}), "budget_split_text", vI + "|" + vJ, "Budget contains text instead of numbers");
           }
           bI_raw = vI !== null ? String(vI) : null;
           bJ_raw = vJ !== null ? String(vJ) : null;
        } else {
           const bTop = getMergedTopLeftValue(sheet, r, budgetCol1);
           const { raw, numeric } = tryNumeric(bTop);
           if (raw !== null) {
              addAnomaly(XLSX.utils.encode_cell({r: initRange.s.r, c: budgetCol1}), "mixed_type_target", raw, "Budget is text");
           }
           bSingleNum = numeric;
        }

        if (!currentInit || currentInit["المبادرة الاستراتيجية "] !== initRaw || currentInit.source_row_start !== initRange.s.r + 1) {
          const effTop = getMergedTopLeftValue(sheet, r, effTargetCol);
          const effTarget = tryNumeric(effTop);
          const effPct = isPercentageMerged(sheet, r, effTargetCol);
          if (effTarget.raw) addAnomaly(XLSX.utils.encode_cell({r: initRange.s.r, c: effTargetCol}), "mixed_type_target", effTarget.raw, "Efficiency target text");
          
          const efftTop = getMergedTopLeftValue(sheet, r, efftTargetCol);
          const efftTarget = tryNumeric(efftTop);
          const efftPct = isPercentageMerged(sheet, r, efftTargetCol);
          if (efftTarget.raw) addAnomaly(XLSX.utils.encode_cell({r: initRange.s.r, c: efftTargetCol}), "mixed_type_target", efftTarget.raw, "Effectiveness target text");

          currentInit = {
            "المبادرة الاستراتيجية ": String(initRaw),
            "efficiency_kpi_name": normalizeNull(getMergedTopLeftValue(sheet, r, effKpiCol)),
            "efficiency_target_raw": effTarget.raw,
            "efficiency_target_numeric": effTarget.numeric,
            "efficiency_target_is_percentage": effPct,
            "effectiveness_kpi_name": normalizeNull(getMergedTopLeftValue(sheet, r, efftKpiCol)),
            "effectiveness_target_raw": efftTarget.raw,
            "effectiveness_target_numeric": efftTarget.numeric,
            "effectiveness_target_is_percentage": efftPct,
            "department_raw": deptVal,
            "budget_single_numeric": bSingleNum,
            "budget_col_I_raw": bI_raw,
            "budget_col_J_raw": bJ_raw,
            "timeframe_text": normalizeNull(getMergedTopLeftValue(sheet, r, timeframeCol)),
            "source_row_start": initRange.s.r + 1,
            "source_row_end": initRange.e.r + 1,
            "quarters": {
              "الربع 1": normalizeNull(getMergedTopLeftValue(sheet, r, q1Col)),
              "is_active_1": normalizeQuarter(getMergedTopLeftValue(sheet, r, q1Col)),
              "الربع 2": normalizeNull(getMergedTopLeftValue(sheet, r, q1Col + 1)),
              "is_active_2": normalizeQuarter(getMergedTopLeftValue(sheet, r, q1Col + 1)),
              "الربع 3": normalizeNull(getMergedTopLeftValue(sheet, r, q1Col + 2)),
              "is_active_3": normalizeQuarter(getMergedTopLeftValue(sheet, r, q1Col + 2)),
              "الربع 4": normalizeNull(getMergedTopLeftValue(sheet, r, q1Col + 3)),
              "is_active_4": normalizeQuarter(getMergedTopLeftValue(sheet, r, q1Col + 3)),
            },
            "projects": []
          };
          currentSubGoal.initiatives.push(currentInit);
        }

        const projRaw = getMergedTopLeftValue(sheet, r, projCol);
        const projRange = getMergedRange(sheet, r, projCol);
        
        let costNum = null;
        if (has_execution_cost) {
           const costVal = tryNumeric(getMergedTopLeftValue(sheet, r, execCostCol));
           if (costVal.raw) addAnomaly(XLSX.utils.encode_cell({r: projRange.s.r, c: execCostCol}), "mixed_type_target", costVal.raw, "Exec cost text");
           costNum = costVal.numeric;
        }

        if (!currentProj || currentProj["المشاريع التشغيلية للمبادرة"] !== projRaw || currentProj.source_row_start !== projRange.s.r + 1) {
          currentProj = {
            "المشاريع التشغيلية للمبادرة": String(projRaw),
            "تكلفة التنفيذ": costNum,
            "source_row_start": projRange.s.r + 1,
            "source_row_end": projRange.e.r + 1,
            "kpis": []
          };
          currentInit.projects.push(currentProj);
        }

        const kpiRawTop = normalizeNull(getCellValueRaw(sheet, r, projKpiTargetCol));
        const kpiTarget = tryNumeric(kpiRawTop);
        const kpiPct = isPercentageFormat(sheet, r, projKpiTargetCol);
        if (kpiTarget.raw) addAnomaly(XLSX.utils.encode_cell({r, c: projKpiTargetCol}), "mixed_type_target", kpiTarget.raw, "KPI Target text");
        
        let baselineNum = null, baselineRaw = null, baselinePct = false;
        if (has_baseline) {
           const bl = tryNumeric(normalizeNull(getCellValueRaw(sheet, r, baselineCol)));
           baselineNum = bl.numeric;
           baselineRaw = bl.raw !== null ? bl.raw : (bl.numeric !== null ? String(bl.numeric) : null);
           baselinePct = isPercentageFormat(sheet, r, baselineCol);
        }

        const kpiItem = {
          "مؤشر القياس": String(kpiName),
          "kpi_target_raw": kpiTarget.raw !== null ? kpiTarget.raw : (kpiTarget.numeric !== null ? String(kpiTarget.numeric) : null),
          "kpi_target_numeric": kpiTarget.numeric,
          "kpi_target_is_percentage": kpiPct,
          "baseline_2025_raw": baselineRaw,
          "baseline_2025_numeric": baselineNum,
          "baseline_2025_is_percentage": baselinePct,
          "source_row": r + 1,
          "monthly_tracking": [] as any[]
        };

        for (let m = 1; m <= 12; m++) {
           const mCols = monthsMap.get(m);
           if (!mCols) continue; // If month header not found somehow

           const mTargetVal = normalizeNull(getCellValueRaw(sheet, r, mCols.targetCol));
           const mtPct = isPercentageFormat(sheet, r, mCols.targetCol);
           const mt = tryNumeric(mTargetVal);
           if (mt.raw) addAnomaly(XLSX.utils.encode_cell({r, c: mCols.targetCol}), "mixed_type_target", mt.raw, "Monthly target text");
           
           const mAchievedVal = normalizeNull(getCellValueRaw(sheet, r, mCols.achievedCol));
           const maPct = isPercentageFormat(sheet, r, mCols.achievedCol);
           const ma = tryNumeric(mAchievedVal);
           
           const mChallengeVal = normalizeNull(getCellValueRaw(sheet, r, mCols.challengeCol));
           const mEvidenceVal = normalizeNull(getCellValueRaw(sheet, r, mCols.evidenceCol));

           kpiItem.monthly_tracking.push({
             "month_number": m,
             "target_raw": mt.raw !== null ? mt.raw : (mt.numeric !== null ? String(mt.numeric) : null),
             "target_numeric": mt.numeric,
             "target_is_percentage": mtPct,
             "achieved_raw": ma.raw !== null ? ma.raw : (ma.numeric !== null ? String(ma.numeric) : null),
             "achieved_numeric": ma.numeric,
             "achieved_is_percentage": maPct,
             "challenges": mChallengeVal ? String(mChallengeVal) : null,
             "evidence": mEvidenceVal ? String(mEvidenceVal) : null
           });
        }
        
        currentProj.kpis.push(kpiItem);
      }
      
      report.actualRowCounts.push(currentRowCount);
      allSheetsData.push(sheetData);
      sheetIdx++;
    }

    report.rowCountsMatch = JSON.stringify(report.actualRowCounts) === JSON.stringify(report.expectedRowCounts);
    report.sheets = allSheetsData.map(s => ({
      sheet_name: s.sheet_name,
      variant: s.column_variant,
      sub_goals_count: s.sub_goals.length,
      initiatives_count: s.sub_goals.reduce((acc, sg) => acc + sg.initiatives.length, 0),
      projects_count: s.sub_goals.reduce((acc, sg) => acc + sg.initiatives.reduce((iacc: number, init: any) => iacc + init.projects.length, 0), 0)
    }));
    report.anomaliesTotal = globalAnomaliesCount;

    if (dryRun) {
      return new Response(JSON.stringify({ success: true, report, payload: allSheetsData, anomalies: allSheetsData.flatMap(s => s.anomalies) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    } else {
      const payload = { sheets: allSheetsData };
      const { data: rpcData, error: rpcError } = await supabase.rpc('import_operational_plan', { payload });
      
      if (rpcError) throw rpcError;

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Successfully committed via RPC transaction.",
        report
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

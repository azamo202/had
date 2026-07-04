import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import * as XLSX from "https://esm.sh/xlsx@0.18.5"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { filePath, userId, targetYear } = await req.json()
    if (!filePath) throw new Error("filePath is required")

    const year = targetYear ? parseInt(targetYear, 10) : new Date().getFullYear();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Need admin rights to bypass RLS during import
    )

    // 1. Create Import Record
    const { data: importRecord, error: importError } = await supabase
      .from('imports')
      .insert({ user_id: userId, file_name: filePath, status: 'processing' })
      .select().single()
    if (importError) throw importError

    const log = async (msg: string, level = 'info') => {
      console.log(`[${level}] ${msg}`)
      await supabase.from('import_logs').insert({ import_id: importRecord.id, message: msg, level })
    }

    try {
      await log(`Downloading file from storage: ${filePath}`)
      
      // 2. Download File
      const { data: fileData, error: downloadError } = await supabase.storage.from('evidence_files').download(filePath)
      if (downloadError) throw downloadError

      // 3. Parse Excel
      await log('Parsing Excel workbook...')
      const arrayBuffer = await fileData.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      
      let totalProjectsProcessed = 0;
      let insertedCount = 0;
      let skippedCount = 0;

      for (const sheetName of workbook.SheetNames) {
        await log(`Processing sheet: ${sheetName}`)
        const sheet = workbook.Sheets[sheetName]
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
        if (rawData.length === 0) continue

        // Basic Fill-down algorithm
        const filledData: any[][] = []
        let previousRow: any[] = []
        // Start from row index 2 (skipping 2 header rows)
        for (let r = 2; r < rawData.length; r++) { 
          const row = rawData[r]
          if (!row || row.length === 0) continue;

          const filledRow: any[] = []
          let isEmptyRow = true;
          for (let c = 0; c < 100; c++) { // arbitrary max cols
            let val = row[c]
            // If cell is empty and it's one of the hierarchy columns (Goal, Obj, Init, Dept), fill down
            // 0: Goal, 1: Objective, 2: Initiative, 7: Dept
            if ((val === undefined || val === null || val === '') && [0, 1, 2, 7].includes(c) && previousRow.length > 0) {
              val = previousRow[c]
            }
            if (val !== undefined && val !== null && val !== '') isEmptyRow = false;
            filledRow[c] = val
          }
          if (!isEmptyRow) {
            filledData.push(filledRow)
            previousRow = filledRow
          }
        }

        await log(`Found ${filledData.length} valid data rows in sheet ${sheetName}.`)

        // 4. Batch Processing
        for (const row of filledData) {
          try {
            const goalName = String(row[0] || '').trim();
            const objectiveName = String(row[1] || '').trim();
            const initiativeName = String(row[2] || '').trim();
            const deptName = String(row[7] || '').trim();
            const projectName = String(row[15] || '').trim(); // Project Name is at index 15
            const projectCost = 0; // Cost is not available at project level

            if (!projectName || !deptName || !initiativeName) {
              skippedCount++;
              continue; // Skip if no project name
            }

            // 4.1 Upsert Department
            const { data: dept } = await supabase
              .from('organization_units')
              .upsert({ name: deptName, type: 'Department' }, { onConflict: 'name', ignoreDuplicates: false })
              .select().single();

            if (!dept) throw new Error(`Failed to upsert department: ${deptName}`);

            // 4.2 Upsert Goal (using name as pseudo-code for now if no specific code provided)
            const goalCode = 'G-' + goalName.substring(0, 10);
            const { data: goal } = await supabase
              .from('strategic_goals')
              .upsert({ code: goalCode, name: goalName }, { onConflict: 'code', ignoreDuplicates: false })
              .select().single();

            // 4.3 Upsert Objective
            const objCode = 'O-' + objectiveName.substring(0, 10);
            const { data: objective } = await supabase
              .from('strategic_objectives')
              .upsert({ strategic_goal_id: goal!.id, code: objCode, name: objectiveName }, { onConflict: 'code', ignoreDuplicates: false })
              .select().single();

            // 4.4 Upsert Initiative
            const initCode = 'I-' + initiativeName.substring(0, 10);
            const { data: initiative } = await supabase
              .from('strategic_initiatives')
              .upsert({ strategic_objective_id: objective!.id, code: initCode, name: initiativeName }, { onConflict: 'code', ignoreDuplicates: false })
              .select().single();

            // 4.5 Upsert Project
            const { data: project, error: projErr } = await supabase
              .from('operational_projects')
              .upsert(
                { initiative_id: initiative!.id, organization_unit_id: dept!.id, project_name: projectName, project_cost: projectCost }, 
                { onConflict: 'initiative_id, organization_unit_id, project_name' }
              )
              .select().single();

            if (projErr || !project) throw new Error(`Failed to upsert project: ${projectName} - ${projErr?.message}`);

            insertedCount++;
            
            // 4.6 Insert/Upsert Targets
            // January starts at Column 19 (Index 19 for Target, 20 for Achieved)
            let monthColStart = 19;
            for (let m = 1; m <= 12; m++) {
              const targetVal = row[monthColStart];
              const achievedVal = row[monthColStart + 1];
              // Insert Target
              if (targetVal !== undefined && targetVal !== null && targetVal !== '') {
                await supabase.from('project_targets').upsert(
                  { project_id: project.id, year: year, month: m, target_value: parseFloat(targetVal) || 0 },
                  { onConflict: 'project_id, year, month' }
                );
              }
              // Insert Achieved if any (for history/initial import)
              if (achievedVal !== undefined && achievedVal !== null && achievedVal !== '') {
                // Ensure there is a monthly update record
                const { data: updateRecord } = await supabase.from('monthly_updates').upsert(
                  { project_id: project.id, reporting_year: year, reporting_month: m, actual_achievement: parseFloat(achievedVal) || 0 },
                  { onConflict: 'project_id, reporting_year, reporting_month' }
                ).select().single();
              }
              monthColStart += 4; // Move to next month (Target, Achieved, Challenges, Evidence)
            }
            
            totalProjectsProcessed++;
          } catch (rowErr) {
            await supabase.from('import_errors').insert({
              import_id: importRecord.id,
              error_message: rowErr.message,
              raw_data: row
            });
            await log(`Error on row: ${rowErr.message}`, 'error');
          }
        }
      }

      await log(`Import completed. Processed: ${totalProjectsProcessed}, Inserted/Updated: ${insertedCount}, Skipped: ${skippedCount}`, 'info')
      
      // Mark as completed
      await supabase.from('imports').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', importRecord.id)

      return new Response(JSON.stringify({ 
        success: true, 
        import_id: importRecord.id,
        processed: totalProjectsProcessed,
        inserted: insertedCount,
        skipped: skippedCount
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })

    } catch (innerError) {
      await supabase.from('imports').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', importRecord.id)
      await log(`Error during import: ${innerError.message}`, 'error')
      throw innerError
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

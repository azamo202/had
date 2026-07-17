// import_h1_data.mjs
// Reads بيانات_المشاريع.csv and updates indicator_monthly_values in Supabase
// Run with: node import_h1_data.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://xbvalutyozrrvxfrdejn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_yLmnusHcgptfNKfeUQ3J_A_mlvhOGeO';
const NOT_SCHEDULED = 'غير مجدول في النصف الأول';

const baseHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: baseHeaders });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supabasePost(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...baseHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
}

async function supabasePatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { ...baseHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status} ${await res.text()}`);
}

// ─── Parse CSV ────────────────────────────────────────────────────────────────
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, ''); // strip BOM
  const lines = content.split('\n').filter(l => l.trim());
  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  });
}

function splitCSVLine(line) {
  const result = [];
  let inQuotes = false, cur = '';
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

function parseNum(raw) {
  const clean = raw.replace(/%/g, '').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log('📂 Reading CSV...');
  const csvPath = path.join(__dirname, 'بيانات_المشاريع.csv');
  const rows = parseCSV(csvPath);
  console.log(`✅ Loaded ${rows.length} rows\n`);

  console.log('🔄 Fetching data from Supabase...');
  const [projects, indicators, existingMonthly] = await Promise.all([
    supabaseGet('operational_projects?select=id,project_name'),
    supabaseGet('project_indicators?select=id,project_id,indicator_name'),
    supabaseGet('indicator_monthly_values?select=id,indicator_id,month&month=eq.6'),
  ]);

  console.log(`✅ ${projects.length} projects, ${indicators.length} indicators, ${existingMonthly.length} existing month-6 records\n`);

  // Build lookups
  const projLookup = {};
  for (const p of projects) projLookup[p.project_name.trim()] = p.id;

  const indLookup = {};
  for (const ind of indicators) {
    const key = `${ind.project_id}__${ind.indicator_name.trim()}`;
    indLookup[key] = ind.id;
  }

  const existingLookup = {};
  for (const mv of existingMonthly) {
    existingLookup[`${mv.indicator_id}__${mv.month}`] = mv.id;
  }

  // Process rows
  let upserted = 0, skipped = 0;
  const notFoundProjects = new Set();
  const notFoundIndicators = new Set();

  for (const row of rows) {
    const projectName = (row['المشروع التشغيلي'] || '').trim();
    const indicatorName = (row['مؤشر القياس'] || '').trim();
    const targetRaw = (row['المستهدف'] || '').trim();
    const actualRaw = (row['المنجز'] || '').trim();

    // Skip not scheduled
    if (targetRaw === NOT_SCHEDULED) { skipped++; continue; }

    // Find project
    const projectId = projLookup[projectName];
    if (!projectId) {
      notFoundProjects.add(projectName);
      skipped++;
      continue;
    }

    // Find indicator
    const indKey = `${projectId}__${indicatorName}`;
    const indicatorId = indLookup[indKey];
    if (!indicatorId) {
      notFoundIndicators.add(`${projectName} > ${indicatorName}`);
      skipped++;
      continue;
    }

    const targetIsPct = targetRaw.endsWith('%');
    const targetNum = parseNum(targetRaw);
    const actualIsPct = actualRaw.endsWith('%');
    const actualNum = parseNum(actualRaw);

    // Store as month=6 (cumulative H1 value = June entry)
    const MONTH = 6;
    const mvKey = `${indicatorId}__${MONTH}`;
    const existingId = existingLookup[mvKey];

    const payload = {
      indicator_id: indicatorId,
      month: MONTH,
      target_value: targetNum,
      target_value_raw: targetRaw.replace(/%/g, '').trim(),
      target_is_percentage: targetIsPct,
      achieved_value: actualNum,
      achieved_is_percentage: actualIsPct,
    };

    try {
      if (existingId) {
        await supabasePatch(`indicator_monthly_values?id=eq.${existingId}`, payload);
      } else {
        await supabasePost('indicator_monthly_values', payload);
      }
      upserted++;
      console.log(`  ✅ [${projectName}] ${indicatorName} → target:${targetRaw} actual:${actualRaw}`);
    } catch (err) {
      console.error(`  ❌ [${projectName}] ${indicatorName}: ${err.message}`);
    }
  }

  console.log('\n═══════════════════════════════════');
  console.log(`✅ Upserted : ${upserted} rows`);
  console.log(`⏭  Skipped  : ${skipped} rows (not scheduled or not found)`);

  if (notFoundProjects.size > 0) {
    console.log(`\n⚠️  Projects NOT FOUND in DB (${notFoundProjects.size}):`);
    for (const p of notFoundProjects) console.log(`   - ${p}`);
  }

  if (notFoundIndicators.size > 0) {
    console.log(`\n⚠️  Indicators NOT FOUND in DB (${notFoundIndicators.size}):`);
    for (const ind of notFoundIndicators) console.log(`   - ${ind}`);
  }
  console.log('═══════════════════════════════════');
})();

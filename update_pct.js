import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) env[match[1]] = match[match[2] ? 2 : ''].replace(/\r$/, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL || envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim(), env.VITE_SUPABASE_ANON_KEY || envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim());

async function run() {
  const { error } = await supabase.from('project_indicators').update({ kpi_target_is_percentage: true }).ilike('indicator_name', '%نسبة%');
  console.log('Update project_indicators:', error ? error.message : 'Success');
  
  const { error: e2 } = await supabase.from('strategic_initiatives').update({ efficiency_target_is_percentage: true }).ilike('efficiency_indicator_name', '%نسبة%');
  console.log('Update efficiency:', e2 ? e2.message : 'Success');

  const { error: e3 } = await supabase.from('strategic_initiatives').update({ effectiveness_target_is_percentage: true }).ilike('effectiveness_indicator_name', '%نسبة%');
  console.log('Update effectiveness:', e3 ? e3.message : 'Success');
}
run();

-- Drop old views that depend on the tables we're changing
DROP VIEW IF EXISTS vw_late_kpis;
DROP VIEW IF EXISTS vw_strategy_progress;
DROP VIEW IF EXISTS vw_department_progress;
DROP VIEW IF EXISTS vw_dashboard;

-- Drop old monthly updates and targets tables
DROP TABLE IF EXISTS update_supports CASCADE;
DROP TABLE IF EXISTS update_challenges CASCADE;
DROP TABLE IF EXISTS update_approvals CASCADE;
DROP TABLE IF EXISTS update_comments CASCADE;
DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS update_evidence CASCADE;
DROP TABLE IF EXISTS monthly_update_kpis CASCADE;
DROP TABLE IF EXISTS monthly_updates CASCADE;
DROP TABLE IF EXISTS project_targets CASCADE;
DROP TABLE IF EXISTS project_kpis CASCADE;

-- Drop foreign keys from operational_projects and strategic_initiatives if necessary
-- We can just alter the tables. The user's SQL uses UUID primary keys.

-- ---------------------------------------------------------------------
-- Modify strategic_initiatives
-- ---------------------------------------------------------------------
-- Add missing columns
ALTER TABLE strategic_initiatives 
ADD COLUMN IF NOT EXISTS organization_unit_id uuid references organization_units(id),
ADD COLUMN IF NOT EXISTS efficiency_indicator_name text,
ADD COLUMN IF NOT EXISTS efficiency_target numeric,
ADD COLUMN IF NOT EXISTS effectiveness_indicator_name text,
ADD COLUMN IF NOT EXISTS effectiveness_target numeric,
ADD COLUMN IF NOT EXISTS budget_makkah numeric default 0,
ADD COLUMN IF NOT EXISTS budget_madinah numeric default 0,
ADD COLUMN IF NOT EXISTS execution_week_label text,
ADD COLUMN IF NOT EXISTS execution_weeks int,
ADD COLUMN IF NOT EXISTS q1 boolean default false,
ADD COLUMN IF NOT EXISTS q2 boolean default false,
ADD COLUMN IF NOT EXISTS q3 boolean default false,
ADD COLUMN IF NOT EXISTS q4 boolean default false;

-- The budget_total column is GENERATED ALWAYS AS ... STORED
-- If it doesn't exist, we add it. If we can't add it easily, we can just compute it on the fly, 
-- but let's try to add it.
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='strategic_initiatives' AND column_name='budget_total') THEN
    ALTER TABLE strategic_initiatives ADD COLUMN budget_total numeric GENERATED ALWAYS AS (COALESCE(budget_makkah,0) + COALESCE(budget_madinah,0)) STORED;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Modify operational_projects
-- ---------------------------------------------------------------------
ALTER TABLE operational_projects DROP COLUMN IF EXISTS project_cost;

-- ---------------------------------------------------------------------
-- مؤشر القياس (per project, from the monthly tracking sheets)
-- ---------------------------------------------------------------------
create table if not exists project_indicators (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references operational_projects(id) on delete cascade,
  indicator_name  text not null,
  baseline_year   int,
  baseline_value  numeric,   -- خط الأساس (المنجز في XXXX)
  annual_target   numeric,   -- المستهدف
  sort_order      int default 0,
  created_at      timestamptz default now(),
  unique (project_id, indicator_name)
);

-- ---------------------------------------------------------------------
-- المستهدف الشهري (Target / Achieved / Updates / Evidence per month)
-- ---------------------------------------------------------------------
create table if not exists indicator_monthly_values (
  id               uuid primary key default gen_random_uuid(),
  indicator_id     uuid not null references project_indicators(id) on delete cascade,
  year             int not null,
  month            int not null check (month between 1 and 12),
  target_value     numeric,   -- المستهدف
  achieved_value   numeric,   -- المنجز
  updates_notes    text,      -- التحديثات
  evidence         text,      -- الشواهد
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (indicator_id, year, month)
);

-- ---------------------------------------------------------------------
-- Import audit trail
-- ---------------------------------------------------------------------
create table if not exists imports (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,
  file_name     text,
  status        text default 'processing', -- processing | completed | failed
  sheets_found  int default 0,
  rows_processed int default 0,
  rows_inserted  int default 0,
  rows_skipped   int default 0,
  started_at    timestamptz default now(),
  completed_at  timestamptz
);

create table if not exists import_logs (
  id          uuid primary key default gen_random_uuid(),
  import_id   uuid references imports(id) on delete cascade,
  level       text default 'info',
  message     text,
  created_at  timestamptz default now()
);

create table if not exists import_errors (
  id           uuid primary key default gen_random_uuid(),
  import_id    uuid references imports(id) on delete cascade,
  sheet_name   text,
  row_number   int,
  error_message text,
  raw_data     jsonb,
  created_at   timestamptz default now()
);

-- ---------------------------------------------------------------------
-- Helpful indexes
-- ---------------------------------------------------------------------
create index if not exists idx_initiatives_unit        on strategic_initiatives(organization_unit_id);
create index if not exists idx_indicators_project      on project_indicators(project_id);
create index if not exists idx_monthly_indicator_year  on indicator_monthly_values(indicator_id, year);
create index if not exists idx_logs_import             on import_logs(import_id);
create index if not exists idx_errors_import           on import_errors(import_id);

-- Re-create Views (Simplified to match new schema)
CREATE OR REPLACE VIEW vw_dashboard AS
SELECT 
    (SELECT COUNT(*) FROM strategic_goals) as total_goals,
    (SELECT COUNT(*) FROM strategic_objectives) as total_objectives,
    (SELECT COUNT(*) FROM strategic_initiatives) as total_initiatives,
    (SELECT COUNT(*) FROM operational_projects) as total_projects,
    (SELECT COUNT(*) FROM operational_projects op JOIN statuses s ON op.status_id = s.id WHERE s.name = 'مكتمل') as projects_completed,
    (SELECT COUNT(*) FROM operational_projects op JOIN statuses s ON op.status_id = s.id WHERE s.name = 'على المسار') as projects_on_track,
    (SELECT COUNT(*) FROM operational_projects op JOIN statuses s ON op.status_id = s.id WHERE s.name = 'يحتاج انتباه') as projects_attention,
    (SELECT COUNT(*) FROM operational_projects op JOIN statuses s ON op.status_id = s.id WHERE s.name = 'متعثر') as projects_delayed,
    (SELECT COUNT(*) FROM operational_projects op JOIN statuses s ON op.status_id = s.id WHERE s.name = 'لم يبدأ') as projects_not_started;

-- Add raw target tracking for edge cases in Excel (e.g., "5% - 10%", "10 مخاطر")
ALTER TABLE public.project_indicators
ADD COLUMN target_raw TEXT;

-- We will keep annual_target as the numeric field, but ensure it's a numeric type that can handle decimals
-- It is already NUMERIC.

ALTER TABLE public.indicator_monthly_values
ADD COLUMN target_value_raw TEXT,
ADD COLUMN achieved_value_raw TEXT;

-- Add UNIQUE constraints to support robust Upsert (Re-import without dropping)
-- This allows updating existing records if they match the natural composite key

ALTER TABLE public.strategic_goals
ADD CONSTRAINT uq_strategic_goals_name UNIQUE (name);

ALTER TABLE public.strategic_objectives
ADD CONSTRAINT uq_strategic_objectives_name_goal UNIQUE (name, strategic_goal_id);

ALTER TABLE public.strategic_initiatives
ADD CONSTRAINT uq_strategic_initiatives_name_obj UNIQUE (name, strategic_objective_id);

ALTER TABLE public.operational_projects
ADD CONSTRAINT uq_operational_projects_name_init UNIQUE (project_name, initiative_id);

ALTER TABLE public.project_indicators
ADD CONSTRAINT uq_project_indicators_name_proj UNIQUE (indicator_name, project_id);

ALTER TABLE public.indicator_monthly_values
ADD CONSTRAINT uq_indicator_monthly_values_ind_month UNIQUE (indicator_id, month);

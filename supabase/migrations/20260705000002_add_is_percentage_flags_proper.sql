ALTER TABLE public.strategic_initiatives ADD COLUMN efficiency_target_is_percentage BOOLEAN DEFAULT false;
ALTER TABLE public.strategic_initiatives ADD COLUMN effectiveness_target_is_percentage BOOLEAN DEFAULT false;
ALTER TABLE public.project_indicators ADD COLUMN kpi_target_is_percentage BOOLEAN DEFAULT false;
ALTER TABLE public.indicator_monthly_values ADD COLUMN target_is_percentage BOOLEAN DEFAULT false;
ALTER TABLE public.indicator_monthly_values ADD COLUMN achieved_is_percentage BOOLEAN DEFAULT false;

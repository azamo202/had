-- Alter efficiency_target and effectiveness_target to text to accept raw string values from Excel
ALTER TABLE public.strategic_initiatives
  ALTER COLUMN efficiency_target TYPE text USING efficiency_target::text,
  ALTER COLUMN effectiveness_target TYPE text USING effectiveness_target::text;

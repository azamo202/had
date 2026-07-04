-- Fix organization_units unique constraint
ALTER TABLE organization_units ADD CONSTRAINT org_units_name_key UNIQUE (name);

-- 1. Insert Roles
INSERT INTO public.roles (name, permissions) VALUES
  ('مدير الاستراتيجية', '{"all": true}'::jsonb),
  ('المدير التنفيذي', '{"read": true}'::jsonb),
  ('مدير ادارة', '{"read": true}'::jsonb),
  ('رئيس قسم', '{"read": true}'::jsonb),
  ('مدير مكتب', '{"read": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- 2. Create Helper Function to get the current user's role
CREATE OR REPLACE FUNCTION public.get_user_role_name()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.name 
  FROM public.users u 
  JOIN public.roles r ON u.role_id = r.id 
  WHERE u.id = auth.uid();
$$;

-- 3. Enable RLS on all tables
ALTER TABLE public.strategic_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategic_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategic_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies

-- Allow all authenticated users to read (SELECT)
CREATE POLICY "Allow authenticated read access" ON public.strategic_goals FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON public.strategic_objectives FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON public.strategic_initiatives FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON public.operational_projects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON public.project_targets FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON public.project_kpis FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON public.organization_units FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON public.kpis FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON public.roles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON public.statuses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated read access" ON public.users FOR SELECT USING (auth.role() = 'authenticated');

-- Allow 'مدير الاستراتيجية' to have ALL access (INSERT, UPDATE, DELETE)
-- strategic_goals
CREATE POLICY "Allow Strategy Manager full access" ON public.strategic_goals FOR ALL USING (public.get_user_role_name() = 'مدير الاستراتيجية');
-- strategic_objectives
CREATE POLICY "Allow Strategy Manager full access" ON public.strategic_objectives FOR ALL USING (public.get_user_role_name() = 'مدير الاستراتيجية');
-- strategic_initiatives
CREATE POLICY "Allow Strategy Manager full access" ON public.strategic_initiatives FOR ALL USING (public.get_user_role_name() = 'مدير الاستراتيجية');
-- operational_projects
CREATE POLICY "Allow Strategy Manager full access" ON public.operational_projects FOR ALL USING (public.get_user_role_name() = 'مدير الاستراتيجية');
-- project_targets
CREATE POLICY "Allow Strategy Manager full access" ON public.project_targets FOR ALL USING (public.get_user_role_name() = 'مدير الاستراتيجية');
-- project_kpis
CREATE POLICY "Allow Strategy Manager full access" ON public.project_kpis FOR ALL USING (public.get_user_role_name() = 'مدير الاستراتيجية');
-- organization_units
CREATE POLICY "Allow Strategy Manager full access" ON public.organization_units FOR ALL USING (public.get_user_role_name() = 'مدير الاستراتيجية');
-- kpis
CREATE POLICY "Allow Strategy Manager full access" ON public.kpis FOR ALL USING (public.get_user_role_name() = 'مدير الاستراتيجية');
-- roles
CREATE POLICY "Allow Strategy Manager full access" ON public.roles FOR ALL USING (public.get_user_role_name() = 'مدير الاستراتيجية');
-- statuses
CREATE POLICY "Allow Strategy Manager full access" ON public.statuses FOR ALL USING (public.get_user_role_name() = 'مدير الاستراتيجية');
-- users
CREATE POLICY "Allow Strategy Manager full access" ON public.users FOR ALL USING (public.get_user_role_name() = 'مدير الاستراتيجية');


-- Ensure the monthly_updates table exists in case it was dropped or not fully migrated
CREATE TABLE IF NOT EXISTS public.monthly_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.operational_projects(id) ON DELETE CASCADE,
    reporting_month INTEGER NOT NULL,
    reporting_year INTEGER NOT NULL,
    notes TEXT,
    status TEXT DEFAULT 'pending',
    approver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    approval_date TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    UNIQUE (project_id, reporting_year, reporting_month)
);

-- Drop status_id if it exists from an older version of the schema
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='monthly_updates' AND column_name='status_id') THEN
        ALTER TABLE public.monthly_updates DROP COLUMN status_id CASCADE;
    END IF;
END $$;

-- Drop update_approvals as we merged the workflow into monthly_updates for MVP simplicity
DROP TABLE IF EXISTS public.update_approvals CASCADE;

-- Ensure RLS is enabled
ALTER TABLE public.monthly_updates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Allow read for all authenticated users" ON public.monthly_updates;
DROP POLICY IF EXISTS "Allow strategy manager all access on monthly_updates" ON public.monthly_updates;
DROP POLICY IF EXISTS "Allow managers to insert monthly_updates" ON public.monthly_updates;
DROP POLICY IF EXISTS "Allow managers to update their own monthly_updates" ON public.monthly_updates;
DROP POLICY IF EXISTS "Allow read for all users" ON public.monthly_updates;
DROP POLICY IF EXISTS "Allow strategy manager all" ON public.monthly_updates;
DROP POLICY IF EXISTS "Allow managers to insert" ON public.monthly_updates;
DROP POLICY IF EXISTS "Allow managers to update their own" ON public.monthly_updates;

-- Create policies for monthly_updates
CREATE POLICY "Allow read for all authenticated users" 
ON public.monthly_updates FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow strategy manager all access on monthly_updates" 
ON public.monthly_updates FOR ALL 
TO authenticated 
USING (public.get_user_role_name() = 'مدير الاستراتيجية');

CREATE POLICY "Allow managers to insert monthly_updates" 
ON public.monthly_updates FOR INSERT 
TO authenticated 
WITH CHECK (public.get_user_role_name() IN ('مدير ادارة', 'رئيس قسم', 'مدير مكتب', 'مدير الاستراتيجية', 'ممثل إدارة'));

CREATE POLICY "Allow managers to update their own monthly_updates" 
ON public.monthly_updates FOR UPDATE 
TO authenticated 
USING (created_by = auth.uid() OR public.get_user_role_name() = 'مدير الاستراتيجية');

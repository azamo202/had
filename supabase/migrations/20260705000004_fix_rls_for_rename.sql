CREATE OR REPLACE FUNCTION public.get_user_role_name()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN r.name = 'مدير المنصة' THEN 'مدير الاستراتيجية'
    ELSE r.name 
  END
  FROM public.users u 
  JOIN public.roles r ON u.role_id = r.id 
  WHERE u.id = auth.uid();
$$;

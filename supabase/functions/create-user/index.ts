import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Unauthorized: Missing Authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    
    // 1. Verify the current user is authenticated
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: authUser }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !authUser) {
      console.error('getUser error:', userError)
      throw new Error('Unauthorized')
    }

    // 2. Fetch the requestor's role to ensure they are admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const { data: requestorPublic } = await supabaseAdmin
      .from('users')
      .select('roles(name)')
      .eq('id', authUser.id)
      .single();
      
    if (requestorPublic?.roles?.name !== 'مدير الاستراتيجية') {
      throw new Error('Forbidden: Only Strategy Manager can create users.')
    }

    // 3. Extract request body
    const { email, password, name, roleName, dept } = await req.json()
    if (!email || !password || !name || !roleName) {
      throw new Error('Missing required fields')
    }

    // Map frontend roles to backend role names if necessary
    let realRoleName = roleName;
    if (roleName === 'strategy_manager') realRoleName = 'مدير الاستراتيجية';
    else if (roleName === 'ceo') realRoleName = 'المدير التنفيذي';
    else if (roleName === 'dept_manager') realRoleName = 'مدير ادارة';
    else if (roleName === 'section_head') realRoleName = 'رئيس قسم';
    else if (roleName === 'office_manager') realRoleName = 'مدير مكتب';

    // Get role id
    const { data: roles } = await supabaseAdmin.from('roles').select('id, name').eq('name', realRoleName);
    if (!roles || roles.length === 0) {
      throw new Error('Invalid role specified')
    }
    const roleId = roles[0].id;

    // 4. Create User in auth.users
    const { data: newUserAuth, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (createError) {
      throw createError
    }

    // Resolve dept name to organization_unit_id
    let orgUnitId = null;
    if (dept) {
      const { data: orgData } = await supabaseAdmin.from('organization_units').select('id').eq('name', dept).single();
      if (orgData) orgUnitId = orgData.id;
    }

    // 5. Insert into public.users
    const { error: insertError } = await supabaseAdmin.from('users').insert({
      id: newUserAuth.user.id,
      email: email,
      full_name: name,
      role_id: roleId,
      organization_unit_id: orgUnitId,
      active: true
    })

    if (insertError) {
      // Rollback auth user creation if public.users fails
      await supabaseAdmin.auth.admin.deleteUser(newUserAuth.user.id)
      throw insertError
    }

    return new Response(
      JSON.stringify({ message: 'User created successfully', id: newUserAuth.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

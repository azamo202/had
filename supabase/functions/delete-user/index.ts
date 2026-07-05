import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
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
    
    // Verify user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: authUser }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !authUser) {
      throw new Error('Unauthorized')
    }

    // Check if Strategy Manager
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const { data: requestorPublic } = await supabaseAdmin
      .from('users')
      .select('roles(name)')
      .eq('id', authUser.id)
      .single();
      
    if (requestorPublic?.roles?.name !== 'مدير المنصة' && requestorPublic?.roles?.name !== 'مدير الاستراتيجية') {
      throw new Error('Forbidden: Only Strategy/Platform Manager can delete users.')
    }

    const { userId } = await req.json()
    if (!userId) {
      throw new Error('Missing userId')
    }

    // Delete from auth.users (public.users will cascade if ON DELETE CASCADE is set, but we can delete public first just in case)
    await supabaseAdmin.from('users').delete().eq('id', userId);
    
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteError) {
      throw deleteError
    }

    return new Response(
      JSON.stringify({ message: 'User deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

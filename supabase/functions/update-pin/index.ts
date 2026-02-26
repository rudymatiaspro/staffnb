import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── AUTH: Validate JWT ──
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Verify the caller's identity
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const callerId = claimsData.claims.sub as string;

  const body = await req.json().catch(() => null);
  if (!body?.profileId || !body?.pinHash) {
    return new Response(JSON.stringify({ error: 'profileId and pinHash required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { profileId, pinHash, pinSet = true } = body;

  // ── AUTHORIZATION: caller must be the profile owner OR a manager/owner/god/admin ──
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

  let authorized = false;

  // Case 1: User updating their own PIN
  if (callerId === profileId) {
    authorized = true;
  }

  // Case 2: Manager/owner/god/admin updating someone else's PIN
  if (!authorized) {
    const { data: callerRole } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .single();

    if (callerRole && ['god', 'admin', 'owner', 'manager'].includes(callerRole.role)) {
      authorized = true;
    }
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify the target profile exists
  const { data: profile, error: fetchError } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .single();

  if (fetchError || !profile) {
    return new Response(JSON.stringify({ error: 'Profile not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Update pin_hash and pin_set
  const { error: updateError } = await serviceClient
    .from('profiles')
    .update({ pin_hash: pinHash, pin_set: pinSet })
    .eq('id', profileId);

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Update failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const STATION_EMAIL = 'cas_station@staffandb.app';
    const STATION_PASSWORD = '154154';
    const STATION_NAME = 'CAS_station';

    // Check if station user already exists
    const { data: existingUsers, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) throw listErr;

    let stationUser = existingUsers.users.find((u) => u.email === STATION_EMAIL);

    if (!stationUser) {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: STATION_EMAIL,
        password: STATION_PASSWORD,
        email_confirm: true,
        user_metadata: { name: STATION_NAME },
      });
      if (createErr) throw createErr;
      stationUser = created.user;
    } else {
      await supabaseAdmin.auth.admin.updateUserById(stationUser.id, {
        password: STATION_PASSWORD,
        email_confirm: true,
      });
    }

    if (!stationUser) throw new Error('Failed to create or find station user');

    // Ensure profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', stationUser.id)
      .maybeSingle();

    if (!existingProfile) {
      await supabaseAdmin.from('profiles').insert({
        id: stationUser.id,
        name: STATION_NAME,
        team: 'BAR',
        pin_set: false,
        station_pin_set: false,
      });
    }

    // Ensure station role (staff)
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', stationUser.id)
      .maybeSingle();

    if (!existingRole) {
      await supabaseAdmin.from('user_roles').insert({
        user_id: stationUser.id,
        role: 'staff',
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Station user ensured', email: STATION_EMAIL }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('ensure-station-user error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

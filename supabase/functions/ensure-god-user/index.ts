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

    const GOD_EMAIL = 'god@staffandb.app';
    const GOD_PASSWORD = 'Fatima!';
    const GOD_NAME = 'GOD';

    // Check if god user already exists
    const { data: existingUsers, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) throw listErr;

    let godUser = existingUsers.users.find((u) => u.email === GOD_EMAIL);

    if (!godUser) {
      // Create the god user
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: GOD_EMAIL,
        password: GOD_PASSWORD,
        email_confirm: true,
        user_metadata: { name: GOD_NAME },
      });
      if (createErr) throw createErr;
      godUser = created.user;
    } else {
      // Ensure password is correct (update it)
      await supabaseAdmin.auth.admin.updateUserById(godUser.id, {
        password: GOD_PASSWORD,
        email_confirm: true,
      });
    }

    if (!godUser) throw new Error('Failed to create or find god user');

    // Ensure profile exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', godUser.id)
      .maybeSingle();

    if (!existingProfile) {
      await supabaseAdmin.from('profiles').insert({
        id: godUser.id,
        name: GOD_NAME,
        team: 'MANAGEMENT',
        pin_set: false,
        station_pin_set: false,
      });
    }

    // Ensure god role exists
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', godUser.id)
      .maybeSingle();

    if (!existingRole) {
      await supabaseAdmin.from('user_roles').insert({
        user_id: godUser.id,
        role: 'god',
      });
    } else {
      // Make sure role is 'god'
      await supabaseAdmin
        .from('user_roles')
        .update({ role: 'god' })
        .eq('user_id', godUser.id);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'God user ensured', email: GOD_EMAIL }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('ensure-god-user error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

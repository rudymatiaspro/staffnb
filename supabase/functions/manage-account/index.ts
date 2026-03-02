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

    // Verify caller is god/admin/owner
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Unauthorized');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !caller) throw new Error('Unauthorized');

    const { data: callerRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .maybeSingle();

    const allowedRoles = ['god', 'owner', 'admin'];
    if (!callerRole || !allowedRoles.includes(callerRole.role)) {
      throw new Error('Insufficient permissions — god/owner/admin required');
    }

    const body = await req.json();
    const { action } = body;

    // ── CREATE account ──────────────────────────────────────────────────────────
    if (action === 'create') {
      const { name, email, password, role, team, restaurant_id } = body;
      if (!name || !email || !password) throw new Error('name, email, password required');

      // Create auth user
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (createErr) throw createErr;
      const newUser = created.user;
      if (!newUser) throw new Error('Failed to create user');

      // Create profile
      const profileInsert: Record<string, unknown> = {
        id: newUser.id,
        name,
        email,
        team: team ?? 'BAR',
        pin_set: false,
        station_pin_set: false,
      };
      if (restaurant_id) profileInsert.restaurant_id = restaurant_id;

      const { error: profileErr } = await supabaseAdmin.from('profiles').insert(profileInsert);
      if (profileErr && !profileErr.message.includes('duplicate')) throw profileErr;

      // Create role
      const { error: roleErr } = await supabaseAdmin.from('user_roles').insert({
        user_id: newUser.id,
        role: role ?? 'staff',
      });
      if (roleErr && !roleErr.message.includes('duplicate')) throw roleErr;

      return new Response(
        JSON.stringify({ success: true, userId: newUser.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── UPDATE role & team ──────────────────────────────────────────────────────
    if (action === 'update_role') {
      const { userId, role, team, name, status, internal_note, phone, email } = body;
      if (!userId) throw new Error('userId required');

      // Prevent changing god role
      const { data: targetRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      if (targetRole?.role === 'god') throw new Error('Cannot modify god account');

      // Update profile
      const profileUpdate: Record<string, unknown> = { team };
      if (name) profileUpdate.name = name;
      if (status) profileUpdate.status = status;
      if (internal_note !== undefined) profileUpdate.internal_note = internal_note;
      if (phone !== undefined) profileUpdate.phone = phone;
      if (email !== undefined) profileUpdate.email = email;
      await supabaseAdmin.from('profiles').update(profileUpdate).eq('id', userId);

      // If email changed, update auth user email too
      if (email) {
        await supabaseAdmin.auth.admin.updateUserById(userId, { email });
      }

      // Update role
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingRole) {
        await supabaseAdmin.from('user_roles').update({ role }).eq('user_id', userId);
      } else {
        await supabaseAdmin.from('user_roles').insert({ user_id: userId, role });
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── DELETE account ──────────────────────────────────────────────────────────
    if (action === 'delete') {
      const { userId } = body;
      if (!userId) throw new Error('userId required');

      // Prevent deleting god account
      const { data: targetRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();
      if (targetRole?.role === 'god') throw new Error('Cannot delete god account');

      // Prevent self-deletion
      if (userId === caller.id) throw new Error('Cannot delete your own account');

      // Delete auth user (cascades to profile via trigger)
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (delErr) throw delErr;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error('manage-account error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

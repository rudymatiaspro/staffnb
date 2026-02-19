import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PIN "1111" hashed the same way the app does: btoa(pin)
const DEFAULT_PIN_HASH = btoa('1111');

// Staff to seed — maps exactly to the spec
const STAFF: Array<{
  name: string;
  role: 'owner' | 'admin' | 'manager' | 'chef' | 'staff';
  team: 'BAR' | 'KITCHEN' | 'FLOOR' | 'ATELIER' | 'MANAGEMENT';
  // label only used in logs
  label: string;
}> = [
  { name: 'Rudy',  role: 'admin',   team: 'MANAGEMENT', label: 'Admin' },
  { name: 'Hanh',  role: 'owner',   team: 'MANAGEMENT', label: 'Owner' },
  { name: 'Cuong', role: 'manager', team: 'MANAGEMENT', label: 'Manager' },
  { name: 'Quan',  role: 'manager', team: 'MANAGEMENT', label: 'Manager' },
  { name: 'Lena',  role: 'staff',   team: 'FLOOR',      label: 'Staff Salle' },
  { name: 'Phat',  role: 'staff',   team: 'FLOOR',      label: 'Staff Salle' },
  { name: 'Tran',  role: 'staff',   team: 'FLOOR',      label: 'Staff Salle' },
  { name: 'Hoa',   role: 'chef',    team: 'KITCHEN',    label: 'Chef' },
  { name: 'Quynh', role: 'chef',    team: 'KITCHEN',    label: 'Chef Pâtissier' },
  { name: 'Thinh', role: 'staff',   team: 'KITCHEN',    label: 'Sous-Chef' },
  { name: 'Ken',   role: 'staff',   team: 'KITCHEN',    label: 'Sous-Chef' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Use service role to bypass RLS for seeding
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Check if profiles table is empty — allow seed without auth in that case
  const { count: profileCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  const isEmpty = (profileCount ?? 0) === 0;

  if (!isEmpty) {
    // Table not empty: require admin/owner auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims } = await callerClient.auth.getClaims(token);
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerId = claims.claims.sub as string;
    const { data: callerRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .single();
    if (!callerRole || !['admin', 'owner'].includes(callerRole.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden — admin or owner required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const results: Array<{ name: string; status: string; id?: string; error?: string }> = [];

  for (const member of STAFF) {
    try {
      // 1. Check if a profile with this name already exists (avoid duplicates)
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('name', member.name)
        .maybeSingle();

      if (existing) {
        results.push({ name: member.name, status: 'skipped — already exists', id: existing.id });
        continue;
      }

      // 2. Create a synthetic UUID (no Supabase Auth account needed — app uses PIN auth)
      const syntheticId = crypto.randomUUID();

      // 3. Insert profile with default PIN hash (1111) and pin_set = false to force PIN change
      const { error: profileError } = await supabase.from('profiles').insert({
        id: syntheticId,
        name: member.name,
        team: member.team,
        pin_hash: DEFAULT_PIN_HASH,
        pin_set: false,        // false = first login → force PIN change
        station_pin_set: false,
        score: 0,
      });

      if (profileError) {
        results.push({ name: member.name, status: 'error', error: profileError.message });
        continue;
      }

      // 4. Insert role
      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: syntheticId,
        role: member.role,
      });

      if (roleError) {
        results.push({ name: member.name, status: 'profile created but role error', id: syntheticId, error: roleError.message });
        continue;
      }

      results.push({ name: member.name, status: 'created', id: syntheticId });
    } catch (err) {
      results.push({ name: member.name, status: 'exception', error: String(err) });
    }
  }

  const created = results.filter(r => r.status === 'created').length;
  const skipped = results.filter(r => r.status.startsWith('skipped')).length;
  const errors  = results.filter(r => r.status === 'error' || r.status === 'exception').length;

  return new Response(
    JSON.stringify({ summary: { created, skipped, errors }, results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});

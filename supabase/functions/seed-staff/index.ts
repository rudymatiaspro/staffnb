import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PBKDF2 PIN hashing — matches src/lib/pinCrypto.ts exactly
const ITERATIONS = 100_000;
const KEY_LEN = 32;
const HASH = 'SHA-256';

function bufToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

async function hashPin(pin: string): Promise<string> {
  const saltArr = crypto.getRandomValues(new Uint8Array(16));
  const saltBuf = saltArr.buffer as ArrayBuffer;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuf, iterations: ITERATIONS, hash: HASH },
    keyMaterial,
    KEY_LEN * 8,
  );
  return `${bufToB64(saltBuf)}:${bufToB64(bits)}`;
}

// The 11 canonical staff members
const STAFF: Array<{
  name: string;
  role: 'owner' | 'admin' | 'manager' | 'chef' | 'staff' | 'god';
  team: 'BAR' | 'KITCHEN' | 'FLOOR' | 'ATELIER' | 'MANAGEMENT';
}> = [
  { name: 'Rudy',  role: 'god',     team: 'MANAGEMENT' },
  { name: 'Hanh',  role: 'owner',   team: 'MANAGEMENT' },
  { name: 'Cuong', role: 'manager', team: 'MANAGEMENT' },
  { name: 'Quan',  role: 'manager', team: 'MANAGEMENT' },
  { name: 'Lena',  role: 'staff',   team: 'FLOOR'      },
  { name: 'Phat',  role: 'staff',   team: 'FLOOR'      },
  { name: 'Tran',  role: 'staff',   team: 'FLOOR'      },
  { name: 'Hoa',   role: 'chef',    team: 'KITCHEN'    },
  { name: 'Quynh', role: 'chef',    team: 'KITCHEN'    },
  { name: 'Thinh', role: 'staff',   team: 'KITCHEN'    },
  { name: 'Ken',   role: 'staff',   team: 'KITCHEN'    },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Service role client — bypasses RLS for admin seeding
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Auth check — require god/admin/owner token unless table is empty
  const { count: profileCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  const isEmpty = (profileCount ?? 0) === 0;

  if (!isEmpty) {
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
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: callerRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    if (!callerRole || !['god', 'admin', 'owner'].includes(callerRole.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden — admin or owner required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // Check if ?reset=true param is present to wipe and re-seed
  const url = new URL(req.url);
  const reset = url.searchParams.get('reset') === 'true';

  if (reset) {
    // Delete all synthetic profiles (those not linked to auth.users)
    // We identify them by checking: keep Rudy's auth account, remove the rest
    const { data: authUser } = await supabase.auth.admin.listUsers();
    const authIds = new Set((authUser?.users ?? []).map((u: { id: string }) => u.id));

    // Delete non-auth profiles (synthetic PIN-only accounts)
    const { data: allProfiles } = await supabase.from('profiles').select('id, name');
    for (const p of (allProfiles ?? [])) {
      // Keep profiles that correspond to real auth users
      if (!authIds.has(p.id)) {
        await supabase.from('user_roles').delete().eq('user_id', p.id);
        await supabase.from('profiles').delete().eq('id', p.id);
      }
    }
  }

  const results: Array<{ name: string; status: string; id?: string; error?: string }> = [];

  for (const member of STAFF) {
    try {
      // Skip Rudy — he's a real Supabase auth user, managed separately
      if (member.name === 'Rudy') {
        results.push({ name: member.name, status: 'skipped — managed via auth' });
        continue;
      }

      // Check for existing profile by name
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('name', member.name)
        .maybeSingle();

      if (existing && !reset) {
        results.push({ name: member.name, status: 'skipped — already exists', id: existing.id });
        continue;
      }

      const syntheticId = existing?.id ?? crypto.randomUUID();

      // Hash default PIN "1111" with PBKDF2 (matches pinCrypto.ts)
      const pinHash = await hashPin('1111');

      if (existing) {
        // Update existing profile
        await supabase.from('profiles').update({
          team: member.team,
          pin_hash: pinHash,
          pin_set: false,
          station_pin_set: false,
        }).eq('id', syntheticId);

        // Upsert role
        await supabase.from('user_roles').upsert({
          user_id: syntheticId,
          role: member.role,
        }, { onConflict: 'user_id' });

        results.push({ name: member.name, status: 'updated', id: syntheticId });
      } else {
        // Insert new profile
        const { error: profileError } = await supabase.from('profiles').insert({
          id: syntheticId,
          name: member.name,
          team: member.team,
          pin_hash: pinHash,
          pin_set: false,
          station_pin_set: false,
          score: 0,
        });

        if (profileError) {
          results.push({ name: member.name, status: 'error', error: profileError.message });
          continue;
        }

        const { error: roleError } = await supabase.from('user_roles').insert({
          user_id: syntheticId,
          role: member.role,
        });

        if (roleError) {
          results.push({ name: member.name, status: 'profile created but role error', id: syntheticId, error: roleError.message });
          continue;
        }

        results.push({ name: member.name, status: 'created', id: syntheticId });
      }
    } catch (err) {
      results.push({ name: member.name, status: 'exception', error: String(err) });
    }
  }

  const created = results.filter(r => r.status === 'created').length;
  const updated = results.filter(r => r.status === 'updated').length;
  const skipped = results.filter(r => r.status.startsWith('skipped')).length;
  const errors  = results.filter(r => ['error', 'exception', 'profile created but role error'].includes(r.status)).length;

  return new Response(
    JSON.stringify({ summary: { created, updated, skipped, errors }, results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});

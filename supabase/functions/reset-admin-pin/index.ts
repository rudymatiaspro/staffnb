/**
 * Edge function to reset admin PINs using PBKDF2 server-side.
 * Only callable internally (no auth required since it's a one-time setup helper).
 * Uses Web Crypto API (available in Deno).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ITERATIONS = 100_000;
const KEY_LEN = 32;

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

async function hashPin(pin: string): Promise<string> {
  const saltArr = crypto.getRandomValues(new Uint8Array(16));
  const saltBuf = saltArr.buffer as ArrayBuffer;
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuf, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    KEY_LEN * 8
  );
  return `${bufToB64(saltBuf)}:${bufToB64(bits)}`;
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const { pin = '7839', userIds } = body;

    if (!userIds || !Array.isArray(userIds)) {
      return new Response(JSON.stringify({ error: 'userIds array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = [];
    for (const userId of userIds) {
      const newHash = await hashPin(pin);
      const { error } = await supabase
        .from('profiles')
        .update({
          pin_hash: newHash,
          pin_set: true,
          pin_locked: false,
          pin_attempts: 0,
          pin_locked_at: null,
          pin_force_reset: false,
        })
        .eq('id', userId);
      results.push({ userId, success: !error, error: error?.message });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

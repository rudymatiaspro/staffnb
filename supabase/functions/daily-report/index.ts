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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date().toISOString().split('T')[0];

    // ─── 1. Tasks ───────────────────────────────────────────────────────────────
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .gte('deadline', `${today}T00:00:00`)
      .lte('deadline', `${today}T23:59:59`);

    const totalTasks = tasks?.length ?? 0;
    const completedTasks = tasks?.filter(t => t.status === 'done').length ?? 0;

    // Completion rates by team
    const teamCompletionRates: Record<string, { total: number; done: number }> = {};
    for (const task of (tasks ?? [])) {
      if (!teamCompletionRates[task.team]) teamCompletionRates[task.team] = { total: 0, done: 0 };
      teamCompletionRates[task.team].total++;
      if (task.status === 'done') teamCompletionRates[task.team].done++;
    }
    const teamRates: Record<string, number> = {};
    for (const [team, { total, done }] of Object.entries(teamCompletionRates)) {
      teamRates[team] = total > 0 ? Math.round((done / total) * 100) : 0;
    }

    // ─── 2. Score events today ───────────────────────────────────────────────────
    const { data: scoreEvents } = await supabase
      .from('score_events')
      .select('*')
      .gte('timestamp', `${today}T00:00:00`)
      .lte('timestamp', `${today}T23:59:59`);

    // Staff performance: top scorers
    const staffScores: Record<string, { name: string; points: number }> = {};
    for (const ev of (scoreEvents ?? [])) {
      if (!staffScores[ev.user_id]) staffScores[ev.user_id] = { name: ev.user_name, points: 0 };
      staffScores[ev.user_id].points += ev.points;
    }
    const staffPerformance = Object.values(staffScores)
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    // ─── 3. Malus today ──────────────────────────────────────────────────────────
    const { data: malusEvents } = await supabase
      .from('malus_events')
      .select('*')
      .gte('timestamp', `${today}T00:00:00`)
      .lte('timestamp', `${today}T23:59:59`);

    const totalMalusToday = malusEvents?.reduce((sum, m) => sum + m.points, 0) ?? 0;

    // ─── 4. Incidents ────────────────────────────────────────────────────────────
    const { data: incidents } = await supabase
      .from('incidents')
      .select('*')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    const openIncidents = incidents?.filter(i => i.status === 'open').length ?? 0;
    const resolvedIncidents = incidents?.filter(i => i.status === 'resolved').length ?? 0;

    // ─── 5. Stock alerts ─────────────────────────────────────────────────────────
    const { data: products } = await supabase
      .from('products')
      .select('*');
    const stockAlerts = (products ?? [])
      .filter(p => p.current_stock <= p.min_threshold)
      .map(p => ({ name: p.name, current: p.current_stock, threshold: p.min_threshold }));

    // ─── 6. Orders today ─────────────────────────────────────────────────────────
    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    const ordersCreated = orders?.length ?? 0;
    const ordersValidated = orders?.filter(o => o.status === 'validated' || o.status === 'received').length ?? 0;

    // ─── 7. Save report ──────────────────────────────────────────────────────────
    const { data: report, error: reportError } = await supabase
      .from('day_reports')
      .insert({
        date: today,
        triggered_by: 'auto',
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        team_completion_rates: teamRates,
        staff_performance: staffPerformance,
        stock_alerts: stockAlerts,
      })
      .select()
      .single();

    if (reportError) {
      console.error('Report insert error:', reportError);
      throw reportError;
    }

    // ─── 8. Notify Owner & Admin ─────────────────────────────────────────────────
    const { data: ownerRoles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['owner', 'admin']);

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const top3 = staffPerformance.slice(0, 3).map((s, i) => `${['🥇','🥈','🥉'][i]} ${s.name} (${s.points}pts)`).join('\n');

    const notifBody = [
      `📋 Tâches : ${completedTasks}/${totalTasks} (${completionRate}%)`,
      `⚠️ Incidents : ${openIncidents} ouverts, ${resolvedIncidents} résolus`,
      `📦 Commandes : ${ordersCreated} créées, ${ordersValidated} validées`,
      `🔴 Stock : ${stockAlerts.length} produit(s) sous seuil`,
      `💥 Malus total : -${totalMalusToday}pts`,
      top3 ? `\n🏆 Top performers :\n${top3}` : '',
    ].filter(Boolean).join('\n');

    const notifications = (ownerRoles ?? []).map(r => ({
      user_id: r.user_id,
      type: 'daily_report',
      title: `📊 Rapport journalier — ${new Date(today + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`,
      body: notifBody,
      ref_id: report?.id ?? null,
      ref_type: 'day_report',
    }));

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }

    // ─── 9. Update day_close_states ──────────────────────────────────────────────
    const { data: existing } = await supabase
      .from('day_close_states')
      .select('id')
      .eq('date', today)
      .single();

    if (existing) {
      await supabase.from('day_close_states').update({
        triggered: true,
        triggered_at: new Date().toISOString(),
        report_id: report?.id,
        report_ready_at: new Date().toISOString(),
      }).eq('date', today);
    } else {
      await supabase.from('day_close_states').insert({
        date: today,
        triggered: true,
        triggered_at: new Date().toISOString(),
        report_id: report?.id,
        report_ready_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({
      success: true,
      date: today,
      report_id: report?.id,
      totalTasks,
      completedTasks,
      completionRate,
      notifiedUsers: notifications.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('daily-report error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

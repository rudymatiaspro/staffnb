import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from './client';
import type { User, Task, TaskTemplate, GamificationSettings, Product, StockLog, DayReport, DayCloseState, Shift, TeamScore, ScoreEvent, Team } from '../../types';
import { INITIAL_GAMIFICATION } from '../../data/initialData';

// ─── TYPE MAPPERS (DB row → App type) ─────────────────────────────────────────

function dbRowToUser(row: Record<string, unknown>, roleRow?: Record<string, unknown>): User {
  return {
    id: row.id as string,
    name: row.name as string,
    team: row.team as Team,
    role: (roleRow?.role as 'owner' | 'manager' | 'staff') ?? 'staff',
    pinSet: Boolean(row.pin_set),
    pin: '', // never expose from DB
    stationPinSet: Boolean(row.station_pin_set),
    photo: (row.photo_url as string) ?? undefined,
    score: (row.score as number) ?? 0,
  };
}

function dbRowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    templateId: (row.template_id as string) ?? undefined,
    name: row.name as string,
    team: row.team as Team,
    assignedUserId: (row.assigned_user_id as string) ?? undefined,
    assignedUserName: (row.assigned_user_name as string) ?? undefined,
    deadline: new Date(row.deadline as string),
    status: row.status as Task['status'],
    validatedBy: (row.validated_by as string) ?? undefined,
    validatedAt: row.validated_at ? new Date(row.validated_at as string) : undefined,
    isRecurring: Boolean(row.is_recurring),
    isPunctual: Boolean(row.is_punctual),
    description: (row.description as string) ?? undefined,
    createdAt: new Date(row.created_at as string),
    createdBy: (row.created_by as string) ?? 'system',
    points: (row.points as number) ?? 10,
  };
}

function dbRowToTemplate(row: Record<string, unknown>): TaskTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    team: row.team as Team,
    frequency: row.frequency as TaskTemplate['frequency'],
    days: (row.days as number[]) ?? undefined,
    time: row.time as string,
    assignedUserId: (row.assigned_user_id as string) ?? undefined,
    description: (row.description as string) ?? undefined,
    points: (row.points as number) ?? 10,
  };
}

function dbRowToProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as Product['category'],
    brand: (row.brand as string) ?? undefined,
    supplier: (row.supplier as string) ?? undefined,
    supplierContact: (row.supplier_contact as string) ?? undefined,
    unit: row.unit as Product['unit'],
    currentStock: row.current_stock as number,
    minThreshold: row.min_threshold as number,
    notes: (row.notes as string) ?? undefined,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function dbRowToShift(row: Record<string, unknown>): Shift {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    userName: row.user_name as string,
    team: row.team as Team,
    clockIn: new Date(row.clock_in as string),
    clockOut: row.clock_out ? new Date(row.clock_out as string) : undefined,
    totalMinutes: (row.total_minutes as number) ?? undefined,
    date: row.date as string,
  };
}

function dbRowToTeamScore(row: Record<string, unknown>): TeamScore {
  return {
    team: row.team as Team,
    baseBonus: row.base_bonus as number,
    totalMalus: row.total_malus as number,
    currentBonus: row.current_bonus as number,
    malusEvents: [],
    date: row.date as string,
    completionRate: (row.completion_rate as number) ?? undefined,
  };
}

function dbRowToDayReport(row: Record<string, unknown>): DayReport {
  return {
    id: row.id as string,
    date: row.date as string,
    generatedAt: new Date(row.generated_at as string),
    triggeredBy: row.triggered_by as 'manual' | 'auto',
    triggeredByUser: (row.triggered_by_user as string) ?? undefined,
    managerNotes: (row.manager_notes as string) ?? '',
    totalTasks: row.total_tasks as number,
    completedTasks: row.completed_tasks as number,
    teamCompletionRates: (row.team_completion_rates as Record<string, number>) ?? {},
    stockAlerts: (row.stock_alerts as DayReport['stockAlerts']) ?? [],
    staffPerformance: (row.staff_performance as DayReport['staffPerformance']) ?? [],
  };
}

function dbRowToDayCloseState(row: Record<string, unknown>): DayCloseState {
  return {
    date: row.date as string,
    triggered: row.triggered as boolean,
    triggeredAt: row.triggered_at ? new Date(row.triggered_at as string) : undefined,
    reportReadyAt: row.report_ready_at ? new Date(row.report_ready_at as string) : undefined,
    reportId: (row.report_id as string) ?? undefined,
  };
}

function dbRowToGamification(row: Record<string, unknown>): GamificationSettings {
  return {
    dailyBonusBase: row.daily_bonus_base as number,
    malusPerLateTask: row.malus_per_late_task as number,
    bonusResetTime: row.bonus_reset_time as string,
    pointsOnTime: row.points_on_time as number,
    pointsEarly: row.points_early as number,
    pointsWithPhoto: row.points_with_photo as number,
    pointsClockIn: row.points_clock_in as number,
    pointsPerfectDay: row.points_perfect_day as number,
    penaltyOverdue: row.penalty_overdue as number,
    penaltyLateClock: row.penalty_late_clock as number,
    penaltyNoClock: row.penalty_no_clock as number,
    collectivePenaltyThreshold: row.collective_penalty_threshold as number,
    collectivePenaltyPoints: row.collective_penalty_points as number,
  };
}

// ─── MAIN SUPABASE DATA HOOK ──────────────────────────────────────────────────

export interface SupabaseData {
  users: User[];
  tasks: Task[];
  templates: TaskTemplate[];
  products: Product[];
  stockLogs: StockLog[];
  shifts: Shift[];
  teamScores: TeamScore[];
  dayReports: DayReport[];
  dayCloseState: DayCloseState | null;
  gamificationSettings: GamificationSettings;
  loading: boolean;
  // Write ops
  saveTask: (task: Task) => Promise<void>;
  saveTemplate: (template: TaskTemplate) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  saveProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  saveStockLog: (log: StockLog, newStock: number) => Promise<void>;
  saveShift: (shift: Shift) => Promise<void>;
  updateShift: (shift: Shift) => Promise<void>;
  saveTeamScore: (score: TeamScore) => Promise<void>;
  saveDayReport: (report: DayReport) => Promise<void>;
  updateDayReport: (id: string, notes: string) => Promise<void>;
  saveDayCloseState: (state: DayCloseState) => Promise<void>;
  saveGamification: (settings: GamificationSettings) => Promise<void>;
  saveProfile: (user: User) => Promise<void>;
  setProfilePin: (userId: string, pin: string) => Promise<void>;
  setProfileStationPin: (userId: string, pin: string) => Promise<void>;
  deleteProfile: (userId: string) => Promise<void>;
}

export function useSupabaseData(enabled: boolean): SupabaseData {
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [teamScores, setTeamScores] = useState<TeamScore[]>([]);
  const [dayReports, setDayReports] = useState<DayReport[]>([]);
  const [dayCloseState, setDayCloseState] = useState<DayCloseState | null>(null);
  const [gamificationSettings, setGamificationSettings] = useState<GamificationSettings>(INITIAL_GAMIFICATION);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  // ─── Initial fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || initialized.current) return;
    initialized.current = true;
    fetchAll();
  }, [enabled]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [
        { data: profilesData },
        { data: rolesData },
        { data: tasksData },
        { data: templatesData },
        { data: productsData },
        { data: stockLogsData },
        { data: shiftsData },
        { data: teamScoresData },
        { data: dayReportsData },
        { data: gamData },
      ] = await Promise.all([
        supabase.from('profiles').select('*').order('name'),
        supabase.from('user_roles').select('*'),
        supabase.from('tasks').select('*').order('deadline'),
        supabase.from('task_templates').select('*').order('name'),
        supabase.from('products').select('*').order('name'),
        supabase.from('stock_logs').select('*').order('timestamp', { ascending: false }).limit(500),
        supabase.from('shifts').select('*').order('clock_in', { ascending: false }),
        supabase.from('team_scores').select('*'),
        supabase.from('day_reports').select('*').order('date', { ascending: false }),
        supabase.from('gamification_settings').select('*').limit(1),
      ]);

      const rolesMap = Object.fromEntries((rolesData ?? []).map((r) => [r.user_id, r]));

      setUsers((profilesData ?? []).map((p) => dbRowToUser(p as Record<string, unknown>, rolesMap[p.id] as Record<string, unknown>)));
      setTasks((tasksData ?? []).map((t) => dbRowToTask(t as Record<string, unknown>)));
      setTemplates((templatesData ?? []).map((t) => dbRowToTemplate(t as Record<string, unknown>)));
      setProducts((productsData ?? []).map((p) => dbRowToProduct(p as Record<string, unknown>)));
      setStockLogs((stockLogsData ?? []).map((s) => ({
        id: s.id,
        productId: s.product_id,
        delta: s.delta,
        reason: s.reason as StockLog['reason'],
        updatedBy: s.updated_by,
        timestamp: new Date(s.timestamp),
      })));
      setShifts((shiftsData ?? []).map((s) => dbRowToShift(s as Record<string, unknown>)));
      setTeamScores((teamScoresData ?? []).map((ts) => dbRowToTeamScore(ts as Record<string, unknown>)));
      setDayReports((dayReportsData ?? []).map((r) => dbRowToDayReport(r as Record<string, unknown>)));
      if (gamData && gamData.length > 0) {
        setGamificationSettings(dbRowToGamification(gamData[0] as Record<string, unknown>));
      }

      // Fetch today's day close state
      const today = new Date().toISOString().split('T')[0];
      const { data: dcsData } = await supabase.from('day_close_states').select('*').eq('date', today).single();
      if (dcsData) setDayCloseState(dbRowToDayCloseState(dcsData as Record<string, unknown>));

    } catch (err) {
      console.error('Supabase fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  // ─── Realtime subscriptions ──────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const channels = [
      supabase.channel('tasks-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setTasks((p) => p.filter((t) => t.id !== payload.old.id));
        } else if (payload.eventType === 'INSERT') {
          setTasks((p) => [...p, dbRowToTask(payload.new as Record<string, unknown>)]);
        } else {
          setTasks((p) => p.map((t) => t.id === (payload.new as Record<string, unknown>).id ? dbRowToTask(payload.new as Record<string, unknown>) : t));
        }
      }).subscribe(),

      supabase.channel('shifts-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setShifts((p) => [dbRowToShift(payload.new as Record<string, unknown>), ...p]);
        } else if (payload.eventType === 'UPDATE') {
          setShifts((p) => p.map((s) => s.id === (payload.new as Record<string, unknown>).id ? dbRowToShift(payload.new as Record<string, unknown>) : s));
        }
      }).subscribe(),

      supabase.channel('products-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setProducts((p) => p.filter((x) => x.id !== payload.old.id));
        } else if (payload.eventType === 'INSERT') {
          setProducts((p) => [...p, dbRowToProduct(payload.new as Record<string, unknown>)]);
        } else {
          setProducts((p) => p.map((x) => x.id === (payload.new as Record<string, unknown>).id ? dbRowToProduct(payload.new as Record<string, unknown>) : x));
        }
      }).subscribe(),

      supabase.channel('reports-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'day_reports' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setDayReports((p) => [dbRowToDayReport(payload.new as Record<string, unknown>), ...p]);
        } else if (payload.eventType === 'UPDATE') {
          setDayReports((p) => p.map((r) => r.id === (payload.new as Record<string, unknown>).id ? dbRowToDayReport(payload.new as Record<string, unknown>) : r));
        }
      }).subscribe(),

      supabase.channel('profiles-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        // Re-fetch profiles on any change
        fetchAll();
      }).subscribe(),
    ];

    return () => { channels.forEach((c) => supabase.removeChannel(c)); };
  }, [enabled]);

  // ─── Write operations ────────────────────────────────────────────────────────

  const saveTask = useCallback(async (task: Task) => {
    const row = {
      id: task.id,
      template_id: task.templateId ?? null,
      name: task.name,
      team: task.team,
      assigned_user_id: task.assignedUserId ?? null,
      assigned_user_name: task.assignedUserName ?? null,
      deadline: task.deadline.toISOString(),
      status: task.status,
      validated_by: task.validatedBy ?? null,
      validated_at: task.validatedAt?.toISOString() ?? null,
      is_recurring: task.isRecurring,
      is_punctual: task.isPunctual,
      description: task.description ?? null,
      created_at: task.createdAt.toISOString(),
      points: task.points ?? 10,
    };
    await supabase.from('tasks').upsert(row);
  }, []);

  const saveTemplate = useCallback(async (template: TaskTemplate) => {
    const row = {
      id: template.id,
      name: template.name,
      team: template.team,
      frequency: template.frequency,
      days: template.days ?? null,
      time: template.time,
      assigned_user_id: template.assignedUserId ?? null,
      description: template.description ?? null,
      points: template.points ?? 10,
    };
    await supabase.from('task_templates').upsert(row);
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    await supabase.from('task_templates').delete().eq('id', id);
  }, []);

  const saveProduct = useCallback(async (product: Product) => {
    const row = {
      id: product.id,
      name: product.name,
      category: product.category,
      brand: product.brand ?? null,
      supplier: product.supplier ?? null,
      supplier_contact: product.supplierContact ?? null,
      unit: product.unit,
      current_stock: product.currentStock,
      min_threshold: product.minThreshold,
      notes: product.notes ?? null,
    };
    await supabase.from('products').upsert(row);
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    await supabase.from('products').delete().eq('id', id);
  }, []);

  const saveStockLog = useCallback(async (log: StockLog, newStock: number) => {
    await supabase.from('stock_logs').insert({
      id: log.id,
      product_id: log.productId,
      delta: log.delta,
      reason: log.reason,
      updated_by: log.updatedBy,
      timestamp: log.timestamp.toISOString(),
    });
    await supabase.from('products').update({ current_stock: newStock }).eq('id', log.productId);
  }, []);

  const saveShift = useCallback(async (shift: Shift) => {
    await supabase.from('shifts').insert({
      id: shift.id,
      user_id: shift.userId,
      user_name: shift.userName,
      team: shift.team,
      clock_in: shift.clockIn.toISOString(),
      clock_out: shift.clockOut?.toISOString() ?? null,
      total_minutes: shift.totalMinutes ?? null,
      date: shift.date,
    });
  }, []);

  const updateShift = useCallback(async (shift: Shift) => {
    await supabase.from('shifts').update({
      clock_out: shift.clockOut?.toISOString() ?? null,
      total_minutes: shift.totalMinutes ?? null,
    }).eq('id', shift.id);
  }, []);

  const saveTeamScore = useCallback(async (score: TeamScore) => {
    await supabase.from('team_scores').upsert({
      team: score.team,
      base_bonus: score.baseBonus,
      total_malus: score.totalMalus,
      current_bonus: score.currentBonus,
      date: score.date,
      completion_rate: score.completionRate ?? null,
    }, { onConflict: 'team,date' });
  }, []);

  const saveDayReport = useCallback(async (report: DayReport) => {
    await supabase.from('day_reports').upsert({
      id: report.id,
      date: report.date,
      generated_at: report.generatedAt.toISOString(),
      triggered_by: report.triggeredBy,
      triggered_by_user: report.triggeredByUser ?? null,
      manager_notes: report.managerNotes ?? null,
      total_tasks: report.totalTasks,
      completed_tasks: report.completedTasks,
      team_completion_rates: report.teamCompletionRates,
      stock_alerts: report.stockAlerts,
      staff_performance: report.staffPerformance,
    });
  }, []);

  const updateDayReport = useCallback(async (id: string, notes: string) => {
    await supabase.from('day_reports').update({ manager_notes: notes }).eq('id', id);
  }, []);

  const saveDayCloseState = useCallback(async (state: DayCloseState) => {
    await supabase.from('day_close_states').upsert({
      date: state.date,
      triggered: state.triggered,
      triggered_at: state.triggeredAt?.toISOString() ?? null,
      report_ready_at: state.reportReadyAt?.toISOString() ?? null,
      report_id: state.reportId ?? null,
    }, { onConflict: 'date' });
  }, []);

  const saveGamification = useCallback(async (settings: GamificationSettings) => {
    const { data } = await supabase.from('gamification_settings').select('id').limit(1).single();
    if (data) {
      await supabase.from('gamification_settings').update({
        daily_bonus_base: settings.dailyBonusBase,
        malus_per_late_task: settings.malusPerLateTask,
        bonus_reset_time: settings.bonusResetTime,
        points_on_time: settings.pointsOnTime,
        points_early: settings.pointsEarly,
        points_with_photo: settings.pointsWithPhoto,
        points_clock_in: settings.pointsClockIn,
        points_perfect_day: settings.pointsPerfectDay,
        penalty_overdue: settings.penaltyOverdue,
        penalty_late_clock: settings.penaltyLateClock,
        penalty_no_clock: settings.penaltyNoClock,
        collective_penalty_threshold: settings.collectivePenaltyThreshold,
        collective_penalty_points: settings.collectivePenaltyPoints,
      }).eq('id', data.id);
    }
  }, []);

  const saveProfile = useCallback(async (user: User) => {
    await supabase.from('profiles').upsert({
      id: user.id,
      name: user.name,
      team: user.team,
      photo_url: user.photo ?? null,
      score: user.score ?? 0,
      pin_set: user.pinSet,
      station_pin_set: user.stationPinSet ?? false,
    });
    // Upsert role separately
    await supabase.from('user_roles').upsert({ user_id: user.id, role: user.role }, { onConflict: 'user_id' });
  }, []);

  const setProfilePin = useCallback(async (userId: string, pin: string) => {
    // Store a simple hash (btoa for basic obfuscation — real apps use bcrypt via edge function)
    await supabase.from('profiles').update({ pin_hash: btoa(pin), pin_set: true }).eq('id', userId);
  }, []);

  const setProfileStationPin = useCallback(async (userId: string, pin: string) => {
    await supabase.from('profiles').update({ station_pin_hash: btoa(pin), station_pin_set: true }).eq('id', userId);
  }, []);

  const deleteProfile = useCallback(async (userId: string) => {
    await supabase.from('profiles').delete().eq('id', userId);
  }, []);

  return {
    users, tasks, templates, products, stockLogs, shifts, teamScores,
    dayReports, dayCloseState, gamificationSettings, loading,
    saveTask, saveTemplate, deleteTemplate, saveProduct, deleteProduct,
    saveStockLog, saveShift, updateShift, saveTeamScore, saveDayReport,
    updateDayReport, saveDayCloseState, saveGamification, saveProfile,
    setProfilePin, setProfileStationPin, deleteProfile,
  };
}

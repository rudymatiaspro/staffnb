import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, User, Task, TaskTemplate, GamificationSettings, Team, TeamScore, MalusEvent, Product, StockLog, StockUpdateReason, StockStatus, DayReport, DayCloseState, Shift, Incident, TemperatureLocation, TemperatureLog, TeamObjective } from '../types';
import { INITIAL_USERS, INITIAL_TEMPLATES, INITIAL_GAMIFICATION } from '../data/initialData';
import { useSupabaseData, StaffRanking } from '../integrations/supabase/hooks';
import { useAuth } from './AuthContext';
import { supabase } from '../integrations/supabase/client';

export interface ValidationEvent {
  id: string;
  taskId: string;
  taskName: string;
  team: Team;
  validatedBy: string;
  validatedAt: Date;
}

interface AppContextType extends AppState {
  validationLog: ValidationEvent[];
  realtimeStatus: 'connected' | 'connecting' | 'disconnected';
  unreadHighIncidents: number;
  clearIncidentBadge: () => void;
  login: (user: User) => void;
  logout: () => void;
  setPin: (userId: string, pin: string) => void;
  validatePin: (userId: string, pin: string) => boolean;
  resetPin: (userId: string) => void;
  setStationPin: (userId: string, pin: string) => void;
  resetStationPin: (userId: string) => void;
  validateStationPin: (pin: string) => User | null;
  completeTask: (taskId: string) => void;
  createPunctualTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  createTemplate: (template: Omit<TaskTemplate, 'id'>) => void;
  updateTemplate: (template: TaskTemplate) => void;
  deleteTemplate: (templateId: string) => void;
  deleteTask: (taskId: string) => void;
  updateGamificationSettings: (settings: GamificationSettings) => void;
  addUser: (user: Omit<User, 'id'>) => void;
  removeUser: (userId: string) => void;
  updateUser: (user: User) => void;
  getTeamScore: (team: Team) => TeamScore;
  getTodayTasks: (team?: Team | Team[]) => Task[];
  regenerateDailyTasks: () => void;
  toast: Toast | null;
  clearToast: () => void;
  products: Product[];
  stockLogs: StockLog[];
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (productId: string) => void;
  updateStock: (productId: string, delta: number, reason: StockUpdateReason) => void;
  dayReports: DayReport[];
  dayCloseState: DayCloseState | null;
  triggerCloseDay: (triggeredByUser: string) => void;
  saveManagerNotes: (reportId: string, notes: string) => void;
  shifts: Shift[];
  clockAction: (userId: string) => 'in' | 'out';
  getUserShifts: (userId: string, dateStr?: string) => Shift[];
  getAllShiftsForDate: (dateStr: string) => Shift[];
  // New modules
  incidents: Incident[];
  addIncident: (incident: Omit<Incident, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateIncident: (id: string, updates: Partial<Incident>) => void;
  deleteIncident: (id: string) => void;
  tempLocations: TemperatureLocation[];
  tempLogs: TemperatureLog[];
  addTempLog: (log: Omit<TemperatureLog, 'id' | 'createdAt'>, location?: { minThreshold?: number; maxThreshold: number }) => void;
  addTempLocation: (loc: Omit<TemperatureLocation, 'id' | 'createdAt'>) => void;
  objectives: TeamObjective[];
  addObjective: (obj: Omit<TeamObjective, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateObjective: (id: string, updates: Partial<TeamObjective>) => void;
  deleteObjective: (id: string) => void;
  staffRankings: StaffRanking[];
}

export interface Toast {
  type: 'success' | 'error' | 'info' | 'malus';
  message: string;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY = 'staffb-manager-v1';
const todayStr = () => new Date().toISOString().split('T')[0];

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function buildTaskDeadline(timeStr: string, baseDate?: Date): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = baseDate ? new Date(baseDate) : new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function generateDailyTasks(templates: TaskTemplate[], existingTasks: Task[]): Task[] {
  const today = todayStr();
  const dayOfWeek = new Date().getDay();
  const newTasks: Task[] = [];

  for (const tpl of templates) {
    const alreadyExists = existingTasks.some(
      (t) => t.templateId === tpl.id && t.createdAt.toISOString().split('T')[0] === today
    );
    if (alreadyExists) continue;

    const shouldGenerate =
      tpl.frequency === 'daily' ||
      (tpl.frequency === 'weekly' && tpl.days?.includes(dayOfWeek)) ||
      (tpl.frequency === 'custom' && tpl.days?.includes(dayOfWeek));

    if (shouldGenerate) {
      const deadline = buildTaskDeadline(tpl.time);
      const now = new Date();
      const status = deadline < now ? 'overdue' : 'pending';
      newTasks.push({
        id: generateId(),
        templateId: tpl.id,
        name: tpl.name,
        team: tpl.team,
        assignedUserId: tpl.assignedUserId,
        deadline,
        status,
        isRecurring: true,
        isPunctual: false,
        description: tpl.description,
        points: tpl.points || 10,
        createdAt: new Date(),
        createdBy: 'system',
      });
    }
  }
  return newTasks;
}

const TEAMS: Team[] = ['BAR', 'KITCHEN', 'FLOOR', 'ATELIER', 'MANAGEMENT', 'ALL'];

function initTeamScores(base: number): TeamScore[] {
  return TEAMS.map((team) => ({
    team,
    baseBonus: base,
    totalMalus: 0,
    currentBonus: base,
    malusEvents: [],
    date: todayStr(),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reviveDates(raw: string): Record<string, any> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.tasks) {
      parsed.tasks = parsed.tasks.map((t: Task) => ({
        ...t,
        deadline: new Date(t.deadline),
        createdAt: new Date(t.createdAt),
        validatedAt: t.validatedAt ? new Date(t.validatedAt) : undefined,
      }));
    }
    if (parsed.teamScores) {
      parsed.teamScores = parsed.teamScores.map((zs: TeamScore) => ({
        ...zs,
        malusEvents: (zs.malusEvents || []).map((me: MalusEvent) => ({
          ...me,
          timestamp: new Date(me.timestamp),
        })),
      }));
    }
    if (parsed.validationLog) {
      parsed.validationLog = parsed.validationLog.map((v: ValidationEvent) => ({
        ...v,
        validatedAt: new Date(v.validatedAt),
      }));
    }
    if (parsed.products) {
      parsed.products = parsed.products.map((p: Product) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      }));
    }
    if (parsed.stockLogs) {
      parsed.stockLogs = parsed.stockLogs.map((s: StockLog) => ({ ...s, timestamp: new Date(s.timestamp) }));
    }
    if (parsed.dayReports) {
      parsed.dayReports = parsed.dayReports.map((r: DayReport) => ({ ...r, generatedAt: new Date(r.generatedAt) }));
    }
    if (parsed.dayCloseState) {
      const ds = parsed.dayCloseState as DayCloseState;
      parsed.dayCloseState = {
        ...ds,
        triggeredAt: ds.triggeredAt ? new Date(ds.triggeredAt) : undefined,
        reportReadyAt: ds.reportReadyAt ? new Date(ds.reportReadyAt) : undefined,
      };
    }
    if (parsed.shifts) {
      parsed.shifts = parsed.shifts.map((s: Shift) => ({
        ...s,
        clockIn: new Date(s.clockIn),
        clockOut: s.clockOut ? new Date(s.clockOut) : undefined,
      }));
    }
    return parsed;
  } catch {
    return {};
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { supabaseUser } = useAuth();
  const isAuthenticated = Boolean(supabaseUser);

  // Supabase data layer (only active when authenticated)
  const db = useSupabaseData(isAuthenticated);

  // Local state — when authenticated, DB data takes over; otherwise use localStorage
  const raw = localStorage.getItem(STORAGE_KEY);
  const saved = raw ? reviveDates(raw) : {};

  // Start with empty arrays when authenticated (DB will fill them)
  // Fall back to initial data only when not authenticated
  const [users, setUsers] = useState<User[]>(isAuthenticated ? [] : (saved.users || INITIAL_USERS));
  const [templates, setTemplates] = useState<TaskTemplate[]>(isAuthenticated ? [] : (saved.templates || INITIAL_TEMPLATES));
  const [gamificationSettings, setGamificationSettings] = useState<GamificationSettings>(
    saved.gamificationSettings || INITIAL_GAMIFICATION
  );
  const [restaurantName] = useState(saved.restaurantName || 'Casinha');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [validationLog, setValidationLog] = useState<ValidationEvent[]>(saved.validationLog || []);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tasks, setTasks] = useState<Task[]>(() => {
    if (isAuthenticated) return []; // DB will populate
    const savedTasks: Task[] = saved.tasks || [];
    const generated = generateDailyTasks(saved.templates || INITIAL_TEMPLATES, savedTasks);
    return [...savedTasks, ...generated];
  });

  const [teamScores, setTeamScores] = useState<TeamScore[]>(() => {
    const base = saved.gamificationSettings?.dailyBonusBase || INITIAL_GAMIFICATION.dailyBonusBase;
    if (saved.teamScores && saved.teamScores.length > 0) {
      if (saved.teamScores[0]?.date !== todayStr()) return initTeamScores(base);
      return saved.teamScores;
    }
    return initTeamScores(base);
  });

  const [products, setProducts] = useState<Product[]>(isAuthenticated ? [] : (saved.products || []));
  const [stockLogs, setStockLogs] = useState<StockLog[]>(isAuthenticated ? [] : (saved.stockLogs || []));
  const [dayReports, setDayReports] = useState<DayReport[]>(isAuthenticated ? [] : (saved.dayReports || []));
  const [dayCloseState, setDayCloseState] = useState<DayCloseState | null>(isAuthenticated ? null : (saved.dayCloseState || null));
  const [shifts, setShifts] = useState<Shift[]>(isAuthenticated ? [] : (saved.shifts || []));
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [tempLocations, setTempLocations] = useState<TemperatureLocation[]>([]);
  const [tempLogs, setTempLogs] = useState<TemperatureLog[]>([]);
  const [objectives, setObjectives] = useState<TeamObjective[]>([]);

  // ─── High-severity incident badge + real-time toast ──────────────────────────
  // Track the timestamp of the last badge clear.
  const lastSeenIncidentRef = useRef<number>(Date.now());
  const [unreadHighIncidents, setUnreadHighIncidents] = useState(0);
  // Track which incident IDs we already know about to detect genuinely new ones.
  const knownIncidentIdsRef = useRef<Set<string> | null>(null);

  const clearIncidentBadge = useCallback(() => {
    lastSeenIncidentRef.current = Date.now();
    setUnreadHighIncidents(0);
  }, []);

  // ─── Auto-seed: if profiles table is empty after first load, call seed-staff ──
  const seedAttemptedRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated) return;
    if (db.loading) return;
    if (seedAttemptedRef.current) return;
    if (db.users.length > 0) return; // already seeded
    seedAttemptedRef.current = true;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/seed-staff`;
    fetch(url, { method: 'POST' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (body?.summary?.created > 0) {
          // Refetch users after seed
          window.location.reload();
        }
      })
      .catch((err) => console.error('Auto-seed failed:', err));
  }, [isAuthenticated, db.loading, db.users.length]);

  // ─── Sync DB data into local state when it loads ─────────────────────────────
  useEffect(() => {
    if (!db.loading && db.users.length > 0) {
      setUsers(db.users);
    }
  }, [db.loading, db.users.length]);

  useEffect(() => {
    if (!db.loading && db.tasks.length > 0) {
      setTasks(db.tasks);
    }
  }, [db.loading, db.tasks.length]);

  useEffect(() => {
    if (!db.loading && db.templates.length > 0) {
      setTemplates(db.templates);
    }
  }, [db.loading, db.templates.length]);

  useEffect(() => {
    if (!db.loading && db.products.length > 0) {
      setProducts(db.products);
    }
  }, [db.loading, db.products.length]);

  useEffect(() => {
    if (!db.loading && db.stockLogs.length > 0) {
      setStockLogs(db.stockLogs);
    }
  }, [db.loading, db.stockLogs.length]);

  useEffect(() => {
    if (!db.loading && db.shifts.length > 0) {
      setShifts(db.shifts);
    }
  }, [db.loading, db.shifts.length]);

  useEffect(() => {
    if (!db.loading && db.teamScores.length > 0) {
      setTeamScores(db.teamScores.map((ts) => ({ ...ts, malusEvents: [] })));
    }
  }, [db.loading, db.teamScores.length]);

  useEffect(() => {
    if (!db.loading && db.dayReports.length > 0) {
      setDayReports(db.dayReports);
    }
  }, [db.loading, db.dayReports.length]);

  useEffect(() => {
    if (!db.loading && db.dayCloseState) {
      setDayCloseState(db.dayCloseState);
    }
  }, [db.loading, db.dayCloseState]);

  useEffect(() => {
    if (!db.loading) {
      setGamificationSettings(db.gamificationSettings);
    }
  }, [db.loading, db.gamificationSettings]);

  // Also keep realtime DB updates in sync
  useEffect(() => {
    if (isAuthenticated && db.users.length > 0) setUsers(db.users);
  }, [db.users]);

  useEffect(() => {
    if (isAuthenticated && db.tasks.length > 0) setTasks(db.tasks);
  }, [db.tasks]);

  useEffect(() => {
    if (isAuthenticated) setProducts(db.products);
  }, [db.products]);

  useEffect(() => {
    if (isAuthenticated && db.shifts.length > 0) setShifts(db.shifts);
  }, [db.shifts]);

  useEffect(() => {
    if (isAuthenticated && db.dayReports.length > 0) setDayReports(db.dayReports);
  }, [db.dayReports]);

  const showToast = useCallback((t: Toast) => {
    setToast(t);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  // Live update task statuses every 5s
  const gamifRef = useRef(gamificationSettings);
  gamifRef.current = gamificationSettings;

  useEffect(() => {
    const interval = setInterval(() => {
      setTasks((prev) => {
        let changed = false;
        const next = prev.map((task) => {
          if (task.status === 'pending' && task.deadline < new Date()) {
            changed = true;
            setTeamScores((scores) =>
              scores.map((ts) => {
                if (ts.team === task.team || (task.team === 'ALL' && ts.team !== 'ALL')) {
                  const pts = gamifRef.current.malusPerLateTask;
                  const malus: MalusEvent = {
                    id: generateId(),
                    team: task.team,
                    taskId: task.id,
                    taskName: task.name,
                    points: pts,
                    timestamp: new Date(),
                  };
                  const newTotal = ts.totalMalus + pts;
                  return {
                    ...ts,
                    totalMalus: newTotal,
                    currentBonus: Math.max(0, ts.baseBonus - newTotal),
                    malusEvents: [...ts.malusEvents, malus],
                  };
                }
                return ts;
              })
            );
            showToast({ type: 'malus', message: `Task overdue: "${task.name}"` });
            return { ...task, status: 'overdue' as const };
          }
          return task;
        });
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [showToast]);

  // Persist to localStorage as backup
  useEffect(() => {
    const state = {
      users, templates, tasks, teamScores, gamificationSettings, restaurantName, validationLog,
      products, stockLogs, dayReports, dayCloseState, shifts,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [users, templates, tasks, teamScores, gamificationSettings, restaurantName, validationLog,
      products, stockLogs, dayReports, dayCloseState, shifts]);

  const login = useCallback((user: User) => setCurrentUser(user), []);
  const logout = useCallback(() => setCurrentUser(null), []);

  const setPin = useCallback((userId: string, pin: string) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, pin, pinSet: true } : u)));
    if (isAuthenticated) db.setProfilePin(userId, pin);
  }, [isAuthenticated, db]);

  const validatePin = useCallback(
    (userId: string, pin: string) => {
      const user = users.find((u) => u.id === userId);
      if (!user) return false;
      const stored = user.pin ?? '';
      // PBKDF2 hash format: "salt:hash" — async verification done in Login.tsx
      // Here we handle: legacy btoa, empty (default 000111), or direct
      if (stored.includes(':')) {
        // PBKDF2 — can't verify synchronously; Login.tsx uses async verifyPin
        // Return true here to let Login.tsx do async validation
        return true;
      }
      if (!stored) {
        // No PIN set — default 154154
        return pin === '154154';
      }
      // Legacy btoa
      try { return stored === btoa(pin); } catch { return false; }
    },
    [users]
  );

  const resetPin = useCallback((userId: string) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, pin: '', pinSet: false } : u)));
    showToast({ type: 'info', message: 'Login PIN reset' });
  }, [showToast]);

  const setStationPin = useCallback((userId: string, pin: string) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, stationPin: pin, stationPinSet: true } : u)));
    if (isAuthenticated) db.setProfileStationPin(userId, pin);
    showToast({ type: 'success', message: 'Station PIN saved' });
  }, [isAuthenticated, db, showToast]);

  const resetStationPin = useCallback((userId: string) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, stationPin: '', stationPinSet: false } : u)));
    showToast({ type: 'info', message: 'Station PIN cleared' });
  }, [showToast]);

  const validateStationPin = useCallback((pin: string): User | null => {
    if (!pin || pin.length !== 6) return null;
    return users.find((u) => {
      if (!u.stationPinSet) return false;
      return u.stationPin === pin;
    }) ?? null;
  }, [users]);

  const completeTask = useCallback(
    async (taskId: string) => {
      if (!currentUser) return;
      const updatedTask = tasks.find((t) => t.id === taskId);
      if (!updatedTask) return;
      const newTask = { ...updatedTask, status: 'done' as const, validatedBy: currentUser.name, validatedAt: new Date() };
      setTasks((prev) => prev.map((t) => t.id === taskId ? newTask : t));
      const event: ValidationEvent = {
        id: generateId(),
        taskId,
        taskName: updatedTask.name,
        team: updatedTask.team,
        validatedBy: currentUser.name,
        validatedAt: new Date(),
      };
      setValidationLog((prev) => [event, ...prev].slice(0, 100));
      showToast({ type: 'success', message: `"${updatedTask.name}" completed! +${updatedTask.points || 10} pts` });
      if (isAuthenticated) {
        db.saveTask(newTask);
        // Trigger server-side objective progress recalculation
        try {
          const { supabase } = await import('../integrations/supabase/client');
          await supabase.rpc('update_objective_progress');
        } catch (e) {
          console.warn('update_objective_progress failed silently:', e);
        }
      }
    },
    [currentUser, tasks, showToast, isAuthenticated, db]
  );

  const createPunctualTask = useCallback(
    (task: Omit<Task, 'id' | 'createdAt'>) => {
      const newTask: Task = { ...task, id: generateId(), createdAt: new Date() };
      setTasks((prev) => [...prev, newTask]);
      showToast({ type: 'success', message: `Task "${task.name}" created!` });
      if (isAuthenticated) db.saveTask(newTask);
    },
    [showToast, isAuthenticated, db]
  );

  const createTemplate = useCallback((template: Omit<TaskTemplate, 'id'>) => {
    const newTpl: TaskTemplate = { ...template, id: generateId() };
    setTemplates((prev) => [...prev, newTpl]);
    showToast({ type: 'success', message: `Template "${template.name}" created!` });
    if (isAuthenticated) db.saveTemplate(newTpl);
  }, [showToast, isAuthenticated, db]);

  const updateTemplate = useCallback((template: TaskTemplate) => {
    setTemplates((prev) => prev.map((t) => (t.id === template.id ? template : t)));
    if (isAuthenticated) db.saveTemplate(template);
  }, [isAuthenticated, db]);

  const deleteTemplate = useCallback((templateId: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    showToast({ type: 'info', message: 'Template deleted' });
    if (isAuthenticated) db.deleteTemplate(templateId);
  }, [showToast, isAuthenticated, db]);

  const deleteTask = useCallback(async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (isAuthenticated) {
      await supabase.from('tasks').delete().eq('id', taskId);
    }
  }, [isAuthenticated]);

  const updateGamificationSettings = useCallback((settings: GamificationSettings) => {
    setGamificationSettings(settings);
    showToast({ type: 'success', message: 'Settings saved!' });
    if (isAuthenticated) db.saveGamification(settings);
  }, [showToast, isAuthenticated, db]);

  const addUser = useCallback((user: Omit<User, 'id'>) => {
    const newUser: User = { ...user, id: generateId() };
    setUsers((prev) => [...prev, newUser]);
    showToast({ type: 'success', message: `${user.name} added!` });
    if (isAuthenticated) db.saveProfile(newUser);
  }, [showToast, isAuthenticated, db]);

  const removeUser = useCallback((userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    if (isAuthenticated) db.deleteProfile(userId);
  }, [isAuthenticated, db]);

  const updateUser = useCallback((user: User) => {
    setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)));
    if (isAuthenticated) db.saveProfile(user);
  }, [isAuthenticated, db]);

  const getTeamScore = useCallback(
    (team: Team): TeamScore =>
      teamScores.find((ts) => ts.team === team) || {
        team,
        baseBonus: gamificationSettings.dailyBonusBase,
        totalMalus: 0,
        currentBonus: gamificationSettings.dailyBonusBase,
        malusEvents: [],
        date: todayStr(),
      },
    [teamScores, gamificationSettings.dailyBonusBase]
  );

  const getTodayTasks = useCallback(
    (team?: Team | Team[]): Task[] => {
      const today = todayStr();
      const teams: Team[] | undefined = team
        ? Array.isArray(team) ? team : [team]
        : undefined;
      return tasks.filter((t) => {
        const taskDay = t.createdAt.toISOString().split('T')[0];
        const deadlineDay = t.deadline.toISOString().split('T')[0];
        const isToday = taskDay === today || deadlineDay === today;
        if (!isToday) return false;
        if (!teams || teams.includes('ALL')) return true;
        return t.team === 'ALL' || teams.some(tm => t.team === tm);
      });
    },
    [tasks]
  );

  const regenerateDailyTasks = useCallback(() => {
    setTasks((prev) => {
      const generated = generateDailyTasks(templates, prev);
      if (isAuthenticated) {
        generated.forEach((t) => db.saveTask(t));
      }
      return [...prev, ...generated];
    });
  }, [templates, isAuthenticated, db]);

  // ─── MODULE 1: CATALOGUE ─────────────────────────────────────────────────────
  const addProduct = useCallback((product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date();
    const newProduct: Product = { ...product, id: generateId(), createdAt: now, updatedAt: now };
    setProducts((prev) => [...prev, newProduct]);
    showToast({ type: 'success', message: `"${product.name}" added to catalogue` });
    if (isAuthenticated) db.saveProduct(newProduct);
  }, [showToast, isAuthenticated, db]);

  const updateProduct = useCallback((product: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...product, updatedAt: new Date() } : p)));
    showToast({ type: 'success', message: 'Product updated' });
    if (isAuthenticated) db.saveProduct({ ...product, updatedAt: new Date() });
  }, [showToast, isAuthenticated, db]);

  const deleteProduct = useCallback((productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    showToast({ type: 'info', message: 'Product deleted' });
    if (isAuthenticated) db.deleteProduct(productId);
  }, [showToast, isAuthenticated, db]);

  const updateStock = useCallback((productId: string, delta: number, reason: StockUpdateReason) => {
    if (!currentUser) return;
    let newStock = 0;
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          newStock = Math.max(0, p.currentStock + delta);
          return { ...p, currentStock: newStock, updatedAt: new Date() };
        }
        return p;
      })
    );
    const log: StockLog = {
      id: generateId(),
      productId,
      delta,
      reason,
      updatedBy: currentUser.name,
      timestamp: new Date(),
    };
    setStockLogs((prev) => [log, ...prev].slice(0, 500));
    showToast({ type: 'success', message: `Stock updated (${delta > 0 ? '+' : ''}${delta})` });
    if (isAuthenticated) db.saveStockLog(log, newStock);
  }, [currentUser, showToast, isAuthenticated, db]);

  // ─── MODULE 2: END OF DAY REPORT ─────────────────────────────────────────────
  const generateReport = useCallback((triggeredBy: 'manual' | 'auto', triggeredByUser?: string) => {
    const today = todayStr();
    const allTasks = tasks.filter((t) => {
      const day = t.createdAt.toISOString().split('T')[0];
      return day === today;
    });
    const completedTasks = allTasks.filter((t) => t.status === 'done');

    const teamRates: Record<string, number> = {};
    TEAMS.forEach((team) => {
      const tt = allTasks.filter((t) => t.team === team);
      teamRates[team] = tt.length > 0 ? Math.round((tt.filter((t) => t.status === 'done').length / tt.length) * 100) : 100;
    });

    const stockAlerts = products.map((p) => {
      const status: StockStatus = p.currentStock <= p.minThreshold ? 'critical' : p.currentStock <= p.minThreshold * 1.5 ? 'warning' : 'healthy';
      return { productId: p.id, productName: p.name, currentStock: p.currentStock, minThreshold: p.minThreshold, status };
    }).filter((a) => a.status !== 'healthy');

    const staffPerf = users.filter((u) => u.role === 'staff').map((u) => {
      const validated = validationLog.filter((v) => v.validatedBy === u.name && v.validatedAt.toISOString().split('T')[0] === today);
      return { userId: u.id, userName: u.name, tasksCompleted: validated.length, pointsEarned: validated.length * 10, penaltiesApplied: 0 };
    });

    const report: DayReport = {
      id: generateId(),
      date: today,
      generatedAt: new Date(),
      triggeredBy,
      triggeredByUser,
      managerNotes: '',
      totalTasks: allTasks.length,
      completedTasks: completedTasks.length,
      teamCompletionRates: teamRates,
      stockAlerts,
      staffPerformance: staffPerf,
    };
    setDayReports((prev) => [report, ...prev]);
    setDayCloseState((prev) => prev ? { ...prev, reportId: report.id } : null);
    showToast({ type: 'success', message: "Tonight's report is ready!" });
    if (isAuthenticated) db.saveDayReport(report);
    return report;
  }, [tasks, products, users, validationLog, showToast, isAuthenticated, db]);

  const triggerCloseDay = useCallback((triggeredByUser: string) => {
    const now = new Date();
    const readyAt = new Date(now.getTime() + 10 * 60 * 1000);
    const state: DayCloseState = {
      date: todayStr(),
      triggered: true,
      triggeredAt: now,
      reportReadyAt: readyAt,
    };
    setDayCloseState(state);
    showToast({ type: 'info', message: `Report will be ready at ${readyAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` });
    if (isAuthenticated) db.saveDayCloseState(state);
    setTimeout(() => { generateReport('manual', triggeredByUser); }, 10 * 60 * 1000);
  }, [showToast, generateReport, isAuthenticated, db]);

  const saveManagerNotes = useCallback((reportId: string, notes: string) => {
    setDayReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, managerNotes: notes } : r)));
    showToast({ type: 'success', message: 'Notes saved' });
    if (isAuthenticated) db.updateDayReport(reportId, notes);
  }, [showToast, isAuthenticated, db]);

  useEffect(() => {
    const checkAutoReport = () => {
      const now = new Date();
      const today = todayStr();
      if (now.getHours() === 23 && now.getMinutes() >= 30) {
        const alreadyDone = dayReports.some((r) => r.date === today) || (dayCloseState?.date === today && dayCloseState.triggered);
        if (!alreadyDone) generateReport('auto');
      }
    };
    const interval = setInterval(checkAutoReport, 60000);
    return () => clearInterval(interval);
  }, [dayReports, dayCloseState, generateReport]);

  // ─── MODULE 3: CLOCK IN/OUT ───────────────────────────────────────────────────
  const clockAction = useCallback((userId: string): 'in' | 'out' => {
    const user = users.find((u) => u.id === userId);
    if (!user) return 'in';
    const today = todayStr();
    const todayShifts = shifts.filter((s) => s.userId === userId && s.date === today);
    const lastShift = todayShifts[todayShifts.length - 1];
    const isClockIn = !lastShift || lastShift.clockOut !== undefined;

    if (isClockIn) {
      const shift: Shift = {
        id: generateId(),
        userId,
        userName: user.name,
        team: user.team,
        clockIn: new Date(),
        date: today,
      };
      setShifts((prev) => [...prev, shift]);
      if (isAuthenticated) db.saveShift(shift);
    } else if (lastShift) {
      const clockOut = new Date();
      const totalMinutes = Math.round((clockOut.getTime() - lastShift.clockIn.getTime()) / 60000);
      const updated = { ...lastShift, clockOut, totalMinutes };
      setShifts((prev) => prev.map((s) => (s.id === lastShift.id ? updated : s)));
      if (isAuthenticated) db.updateShift(updated);
    }
    return isClockIn ? 'in' : 'out';
  }, [users, shifts, isAuthenticated, db]);

  const getUserShifts = useCallback((userId: string, dateStr?: string): Shift[] => {
    return shifts.filter((s) => s.userId === userId && (!dateStr || s.date === dateStr));
  }, [shifts]);

  const getAllShiftsForDate = useCallback((dateStr: string): Shift[] => {
    return shifts.filter((s) => s.date === dateStr);
  }, [shifts]);

  // ─── New module write ops (wired through db) ─────────────────────────────────
  const addIncident = useCallback(async (incident: Omit<Incident, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!isAuthenticated) return;
    const newInc: Incident = {
      ...incident,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setIncidents((prev) => [newInc, ...prev]);
    await db.saveIncident(newInc);
  }, [isAuthenticated, db]);

  const updateIncident = useCallback(async (id: string, updates: Partial<Incident>) => {
    setIncidents((prev) => prev.map((i) => i.id === id ? { ...i, ...updates, updatedAt: new Date() } : i));
    if (isAuthenticated) await db.updateIncidentDB(id, updates);
  }, [isAuthenticated, db]);

  const deleteIncident = useCallback(async (id: string) => {
    setIncidents((prev) => prev.filter((i) => i.id !== id));
    if (isAuthenticated) await db.deleteIncidentDB(id);
  }, [isAuthenticated, db]);

  const addTempLog = useCallback(async (log: Omit<TemperatureLog, 'id' | 'createdAt'>, location?: { minThreshold?: number; maxThreshold: number }) => {
    const newLog: TemperatureLog = { ...log, id: generateId(), createdAt: new Date() };
    setTempLogs((prev) => [newLog, ...prev]);
    if (isAuthenticated) await db.saveTempLog(newLog);

    // FIX 6: If alert, auto-create an incident
    if (log.isAlert && isAuthenticated) {
      const minStr = location?.minThreshold !== undefined ? `min ${location.minThreshold}°C / ` : '';
      const maxStr = location?.maxThreshold !== undefined ? `max ${location.maxThreshold}°C` : '';
      const incidentData: Omit<Incident, 'id' | 'createdAt' | 'updatedAt'> = {
        type: 'Hygiene issue',
        description: `Température hors norme: ${log.temperature}°C (seuil: ${minStr}${maxStr})`,
        location: 'Kitchen',
        severity: 'high',
        team: 'KITCHEN',
        reporterName: log.loggedBy,
        reporterUserId: log.loggedByUserId,
        anonymous: false,
        status: 'open',
      };
      const newInc: Incident = {
        ...incidentData,
        id: generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setIncidents((prev) => [newInc, ...prev]);
      await db.saveIncident(newInc);
      showToast({ type: 'malus', message: `⚠️ Alerte HACCP créée automatiquement — ${log.locationName}` });
    }
  }, [isAuthenticated, db, showToast]);

  const addTempLocation = useCallback(async (loc: Omit<TemperatureLocation, 'id' | 'createdAt'>) => {
    const newLoc: TemperatureLocation = { ...loc, id: generateId(), createdAt: new Date() };
    setTempLocations((prev) => [...prev, newLoc]);
    if (isAuthenticated) await db.saveTempLocation(newLoc);
  }, [isAuthenticated, db]);

  const addObjective = useCallback(async (obj: Omit<TeamObjective, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newObj: TeamObjective = { ...obj, id: generateId(), createdAt: new Date(), updatedAt: new Date() };
    setObjectives((prev) => [...prev, newObj]);
    if (isAuthenticated) await db.saveObjective(newObj);
  }, [isAuthenticated, db]);

  const updateObjective = useCallback(async (id: string, updates: Partial<TeamObjective>) => {
    setObjectives((prev) => prev.map((o) => o.id === id ? { ...o, ...updates, updatedAt: new Date() } : o));
    if (isAuthenticated) await db.updateObjectiveDB(id, updates);
  }, [isAuthenticated, db]);

  const deleteObjective = useCallback(async (id: string) => {
    setObjectives((prev) => prev.filter((o) => o.id !== id));
    if (isAuthenticated) await db.deleteObjectiveDB(id);
  }, [isAuthenticated, db]);

  // Sync new module data from DB
  useEffect(() => {
    if (!isAuthenticated) return;

    const incoming = db.incidents;

    // First load — seed the known-IDs set, no toasts
    if (knownIncidentIdsRef.current === null) {
      knownIncidentIdsRef.current = new Set(incoming.map((i) => i.id));
      setIncidents(incoming);
      return;
    }

    // Subsequent updates — find truly new incidents
    const knownIds = knownIncidentIdsRef.current;
    const newHighIncidents = incoming.filter(
      (i) => !knownIds.has(i.id) && i.severity === 'high'
    );

    // Toast each new high-severity incident (managers/owners only)
    if (newHighIncidents.length > 0 && currentUser && (currentUser.role === 'manager' || currentUser.role === 'owner')) {
      newHighIncidents.forEach((inc) => {
        showToast({
          type: 'malus',
          message: `🚨 High incident: ${inc.type} — ${inc.location}`,
        });
      });
    }

    // Update the known-IDs set
    incoming.forEach((i) => knownIds.add(i.id));
    setIncidents(incoming);
  }, [db.incidents]);

  useEffect(() => { if (isAuthenticated) setTempLocations(db.tempLocations); }, [db.tempLocations]);
  useEffect(() => { if (isAuthenticated) setTempLogs(db.tempLogs); }, [db.tempLogs]);
  useEffect(() => { if (isAuthenticated) setObjectives(db.objectives); }, [db.objectives]);

  // Recount unread high-severity incidents whenever the incidents list changes
  useEffect(() => {
    const cutoff = lastSeenIncidentRef.current;
    const count = incidents.filter(
      (i) => i.severity === 'high' && i.createdAt.getTime() > cutoff
    ).length;
    setUnreadHighIncidents(count);
  }, [incidents]);

  return (
    <AppContext.Provider
      value={{
        users, tasks, templates, teamScores, gamificationSettings,
        currentUser, restaurantName, validationLog, toast,
        realtimeStatus: db.realtimeStatus,
        unreadHighIncidents, clearIncidentBadge,
        login, logout, setPin, validatePin, resetPin,
        setStationPin, resetStationPin, validateStationPin,
        completeTask, createPunctualTask, createTemplate, updateTemplate,
        deleteTemplate, deleteTask, updateGamificationSettings,
        addUser, removeUser, updateUser,
        getTeamScore, getTodayTasks, regenerateDailyTasks, clearToast,
        products, stockLogs, addProduct, updateProduct, deleteProduct, updateStock,
        dayReports, dayCloseState, triggerCloseDay, saveManagerNotes,
        shifts, clockAction, getUserShifts, getAllShiftsForDate,
        incidents, addIncident, updateIncident, deleteIncident,
        tempLocations, tempLogs, addTempLog, addTempLocation,
        objectives, addObjective, updateObjective, deleteObjective,
        staffRankings: db.staffRankings,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

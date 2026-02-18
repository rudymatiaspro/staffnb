import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, User, Task, TaskTemplate, GamificationSettings, Team, TeamScore, MalusEvent } from '../types';
import { INITIAL_USERS, INITIAL_TEMPLATES, INITIAL_GAMIFICATION } from '../data/initialData';

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
  login: (user: User) => void;
  logout: () => void;
  setPin: (userId: string, pin: string) => void;
  validatePin: (userId: string, pin: string) => boolean;
  resetPin: (userId: string) => void;
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
  getTodayTasks: (team?: Team) => Task[];
  regenerateDailyTasks: () => void;
  toast: Toast | null;
  clearToast: () => void;
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

function reviveDates(raw: string): Partial<AppState & { validationLog: ValidationEvent[]; teamScores: TeamScore[] }> {
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
    return parsed;
  } catch {
    return {};
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const raw = localStorage.getItem(STORAGE_KEY);
  const saved = raw ? reviveDates(raw) : {};

  const [users, setUsers] = useState<User[]>(saved.users || INITIAL_USERS);
  const [templates, setTemplates] = useState<TaskTemplate[]>(saved.templates || INITIAL_TEMPLATES);
  const [gamificationSettings, setGamificationSettings] = useState<GamificationSettings>(
    saved.gamificationSettings || INITIAL_GAMIFICATION
  );
  const [restaurantName] = useState(saved.restaurantName || 'Casinha');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [validationLog, setValidationLog] = useState<ValidationEvent[]>(saved.validationLog || []);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tasks, setTasks] = useState<Task[]>(() => {
    const savedTasks: Task[] = saved.tasks || [];
    const generated = generateDailyTasks(saved.templates || INITIAL_TEMPLATES, savedTasks);
    return [...savedTasks, ...generated];
  });

  const [teamScores, setTeamScores] = useState<TeamScore[]>(() => {
    const base = saved.gamificationSettings?.dailyBonusBase || INITIAL_GAMIFICATION.dailyBonusBase;
    if (saved.teamScores && saved.teamScores.length > 0) {
      if (saved.teamScores[0]?.date !== todayStr()) {
        return initTeamScores(base);
      }
      return saved.teamScores;
    }
    return initTeamScores(base);
  });

  const showToast = useCallback((t: Toast) => {
    setToast(t);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const clearToast = useCallback(() => {
    setToast(null);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  // Persist state
  useEffect(() => {
    const state = { users, templates, tasks, teamScores, gamificationSettings, restaurantName, validationLog };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [users, templates, tasks, teamScores, gamificationSettings, restaurantName, validationLog]);

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

  const login = useCallback((user: User) => setCurrentUser(user), []);
  const logout = useCallback(() => setCurrentUser(null), []);

  const setPin = useCallback((userId: string, pin: string) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, pin, pinSet: true } : u)));
  }, []);

  const validatePin = useCallback(
    (userId: string, pin: string) => {
      const user = users.find((u) => u.id === userId);
      return user?.pin === pin;
    },
    [users]
  );

  const resetPin = useCallback((userId: string) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, pin: '', pinSet: false } : u)));
    showToast({ type: 'info', message: 'PIN reset successfully' });
  }, [showToast]);

  const completeTask = useCallback(
    (taskId: string) => {
      if (!currentUser) return;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: 'done', validatedBy: currentUser.name, validatedAt: new Date() }
            : t
        )
      );
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        const event: ValidationEvent = {
          id: generateId(),
          taskId,
          taskName: task.name,
          team: task.team,
          validatedBy: currentUser.name,
          validatedAt: new Date(),
        };
        setValidationLog((prev) => [event, ...prev].slice(0, 100));
        showToast({ type: 'success', message: `"${task.name}" completed! +${task.points || 10} pts` });
      }
    },
    [currentUser, tasks, showToast]
  );

  const createPunctualTask = useCallback(
    (task: Omit<Task, 'id' | 'createdAt'>) => {
      const newTask: Task = { ...task, id: generateId(), createdAt: new Date() };
      setTasks((prev) => [...prev, newTask]);
      showToast({ type: 'success', message: `Task "${task.name}" created!` });
    },
    [showToast]
  );

  const createTemplate = useCallback((template: Omit<TaskTemplate, 'id'>) => {
    const newTpl: TaskTemplate = { ...template, id: generateId() };
    setTemplates((prev) => [...prev, newTpl]);
    showToast({ type: 'success', message: `Template "${template.name}" created!` });
  }, [showToast]);

  const updateTemplate = useCallback((template: TaskTemplate) => {
    setTemplates((prev) => prev.map((t) => (t.id === template.id ? template : t)));
  }, []);

  const deleteTemplate = useCallback((templateId: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    showToast({ type: 'info', message: 'Template deleted' });
  }, [showToast]);

  const deleteTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const updateGamificationSettings = useCallback((settings: GamificationSettings) => {
    setGamificationSettings(settings);
    showToast({ type: 'success', message: 'Settings saved!' });
  }, [showToast]);

  const addUser = useCallback((user: Omit<User, 'id'>) => {
    const newUser: User = { ...user, id: generateId() };
    setUsers((prev) => [...prev, newUser]);
    showToast({ type: 'success', message: `${user.name} added!` });
  }, [showToast]);

  const removeUser = useCallback((userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  }, []);

  const updateUser = useCallback((user: User) => {
    setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)));
  }, []);

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
    (team?: Team): Task[] => {
      const today = todayStr();
      return tasks.filter((t) => {
        const taskDay = t.createdAt.toISOString().split('T')[0];
        const deadlineDay = t.deadline.toISOString().split('T')[0];
        const isToday = taskDay === today || deadlineDay === today;
        if (!isToday) return false;
        if (!team) return true;
        if (team === 'ALL') return true;
        return t.team === team || t.team === 'ALL';
      });
    },
    [tasks]
  );

  const regenerateDailyTasks = useCallback(() => {
    setTasks((prev) => {
      const generated = generateDailyTasks(templates, prev);
      return [...prev, ...generated];
    });
  }, [templates]);

  return (
    <AppContext.Provider
      value={{
        users, tasks, templates, teamScores, gamificationSettings,
        currentUser, restaurantName, validationLog, toast,
        login, logout, setPin, validatePin, resetPin,
        completeTask, createPunctualTask, createTemplate, updateTemplate,
        deleteTemplate, deleteTask, updateGamificationSettings,
        addUser, removeUser, updateUser,
        getTeamScore, getTodayTasks, regenerateDailyTasks, clearToast,
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

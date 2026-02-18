import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState, User, Task, TaskTemplate, GamificationSettings, Zone, ZoneScore, MalusEvent } from '../types';
import { INITIAL_USERS, INITIAL_TEMPLATES, INITIAL_GAMIFICATION } from '../data/initialData';

interface AppContextType extends AppState {
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
  getZoneScore: (zone: Zone) => ZoneScore;
  getTodayTasks: (zone?: Zone) => Task[];
  regenerateDailyTasks: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY = 'casinha-manager-state';
const todayStr = () => new Date().toISOString().split('T')[0];

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function buildTaskDeadline(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
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
      const status = deadline < new Date() ? 'overdue' : 'pending';
      newTasks.push({
        id: generateId(),
        templateId: tpl.id,
        name: tpl.name,
        zone: tpl.zone,
        assignedUserId: tpl.assignedUserId,
        deadline,
        status,
        isRecurring: true,
        isPunctual: false,
        description: tpl.description,
        createdAt: new Date(),
        createdBy: 'system',
      });
    }
  }
  return newTasks;
}

function initializeZoneScores(zones: Zone[]): ZoneScore[] {
  return zones.map((zone) => ({
    zone,
    baseBonus: 100,
    totalMalus: 0,
    currentBonus: 100,
    malusEvents: [],
    date: todayStr(),
  }));
}

function loadState(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Revive dates
    if (parsed.tasks) {
      parsed.tasks = parsed.tasks.map((t: Task) => ({
        ...t,
        deadline: new Date(t.deadline),
        createdAt: new Date(t.createdAt),
        validatedAt: t.validatedAt ? new Date(t.validatedAt) : undefined,
      }));
    }
    if (parsed.zoneScores) {
      parsed.zoneScores = parsed.zoneScores.map((zs: ZoneScore) => ({
        ...zs,
        malusEvents: (zs.malusEvents || []).map((me: MalusEvent) => ({
          ...me,
          timestamp: new Date(me.timestamp),
        })),
      }));
    }
    return parsed;
  } catch {
    return {};
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const saved = loadState();

  const [users, setUsers] = useState<User[]>(saved.users || INITIAL_USERS);
  const [templates, setTemplates] = useState<TaskTemplate[]>(saved.templates || INITIAL_TEMPLATES);
  const [gamificationSettings, setGamificationSettings] = useState<GamificationSettings>(
    saved.gamificationSettings || INITIAL_GAMIFICATION
  );
  const [restaurantName] = useState(saved.restaurantName || 'Casinha');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>(() => {
    const savedTasks: Task[] = saved.tasks || [];
    const generated = generateDailyTasks(saved.templates || INITIAL_TEMPLATES, savedTasks);
    return [...savedTasks, ...generated];
  });
  const [zoneScores, setZoneScores] = useState<ZoneScore[]>(() => {
    const saved2 = loadState();
    if (saved2.zoneScores && saved2.zoneScores.length > 0) {
      const today = todayStr();
      // Reset if new day
      if (saved2.zoneScores[0]?.date !== today) {
        return initializeZoneScores(['BAR', 'CUISINE', 'ATELIER', 'MANAGEMENT', 'ALL']);
      }
      return saved2.zoneScores;
    }
    return initializeZoneScores(['BAR', 'CUISINE', 'ATELIER', 'MANAGEMENT', 'ALL']);
  });

  // Persist state
  useEffect(() => {
    const state = { users, templates, tasks, zoneScores, gamificationSettings, restaurantName };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [users, templates, tasks, zoneScores, gamificationSettings, restaurantName]);

  // Live update task statuses
  useEffect(() => {
    const interval = setInterval(() => {
      setTasks((prev) =>
        prev.map((task) => {
          if (task.status === 'pending' && task.deadline < new Date()) {
            // Apply malus
            setZoneScores((scores) =>
              scores.map((zs) => {
                if (zs.zone === task.zone || zs.zone === 'ALL') {
                  const malus: MalusEvent = {
                    id: generateId(),
                    zone: task.zone,
                    taskId: task.id,
                    taskName: task.name,
                    points: gamificationSettings.malusPerLateTask,
                    timestamp: new Date(),
                  };
                  const newTotal = zs.totalMalus + gamificationSettings.malusPerLateTask;
                  return {
                    ...zs,
                    totalMalus: newTotal,
                    currentBonus: Math.max(0, zs.baseBonus - newTotal),
                    malusEvents: [...zs.malusEvents, malus],
                  };
                }
                return zs;
              })
            );
            return { ...task, status: 'overdue' };
          }
          return task;
        })
      );
    }, 10000);
    return () => clearInterval(interval);
  }, [gamificationSettings.malusPerLateTask]);

  const login = useCallback((user: User) => {
    setCurrentUser(user);
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
  }, []);

  const setPin = useCallback((userId: string, pin: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, pin, pinSet: true } : u))
    );
  }, []);

  const validatePin = useCallback(
    (userId: string, pin: string): boolean => {
      const user = users.find((u) => u.id === userId);
      return user?.pin === pin;
    },
    [users]
  );

  const resetPin = useCallback((userId: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, pin: '', pinSet: false } : u))
    );
  }, []);

  const completeTask = useCallback(
    (taskId: string) => {
      if (!currentUser) return;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'done',
                validatedBy: currentUser.name,
                validatedAt: new Date(),
              }
            : t
        )
      );
    },
    [currentUser]
  );

  const createPunctualTask = useCallback(
    (task: Omit<Task, 'id' | 'createdAt'>) => {
      const newTask: Task = {
        ...task,
        id: generateId(),
        createdAt: new Date(),
      };
      setTasks((prev) => [...prev, newTask]);
    },
    []
  );

  const createTemplate = useCallback((template: Omit<TaskTemplate, 'id'>) => {
    const newTpl: TaskTemplate = { ...template, id: generateId() };
    setTemplates((prev) => [...prev, newTpl]);
  }, []);

  const updateTemplate = useCallback((template: TaskTemplate) => {
    setTemplates((prev) => prev.map((t) => (t.id === template.id ? template : t)));
  }, []);

  const deleteTemplate = useCallback((templateId: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, []);

  const updateGamificationSettings = useCallback((settings: GamificationSettings) => {
    setGamificationSettings(settings);
  }, []);

  const addUser = useCallback((user: Omit<User, 'id'>) => {
    const newUser: User = { ...user, id: generateId() };
    setUsers((prev) => [...prev, newUser]);
  }, []);

  const removeUser = useCallback((userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  }, []);

  const getZoneScore = useCallback(
    (zone: Zone): ZoneScore => {
      return (
        zoneScores.find((zs) => zs.zone === zone) || {
          zone,
          baseBonus: gamificationSettings.dailyBonusBase,
          totalMalus: 0,
          currentBonus: gamificationSettings.dailyBonusBase,
          malusEvents: [],
          date: todayStr(),
        }
      );
    },
    [zoneScores, gamificationSettings.dailyBonusBase]
  );

  const getTodayTasks = useCallback(
    (zone?: Zone): Task[] => {
      const today = todayStr();
      return tasks.filter((t) => {
        const taskDay = t.createdAt.toISOString().split('T')[0];
        const deadlineDay = t.deadline.toISOString().split('T')[0];
        const isToday = taskDay === today || deadlineDay === today;
        if (!isToday) return false;
        if (!zone) return true;
        return t.zone === zone || t.zone === 'ALL';
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
        users,
        tasks,
        templates,
        zoneScores,
        gamificationSettings,
        currentUser,
        restaurantName,
        login,
        logout,
        setPin,
        validatePin,
        resetPin,
        completeTask,
        createPunctualTask,
        createTemplate,
        updateTemplate,
        deleteTemplate,
        deleteTask,
        updateGamificationSettings,
        addUser,
        removeUser,
        getZoneScore,
        getTodayTasks,
        regenerateDailyTasks,
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

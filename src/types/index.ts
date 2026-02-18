export type Team = 'BAR' | 'KITCHEN' | 'FLOOR' | 'ATELIER' | 'MANAGEMENT' | 'ALL';

export type UserRole = 'owner' | 'manager' | 'staff';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  team: Team;
  pin?: string;
  pinSet: boolean;
  photo?: string; // base64 or URL
  score?: number; // current shift score
}

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'overdue';
export type TaskFrequency = 'daily' | 'weekly' | 'custom';

export interface TaskTemplate {
  id: string;
  name: string;
  team: Team;
  frequency: TaskFrequency;
  days?: number[]; // 0=Sunday, 1=Monday, ...
  time: string; // HH:mm
  assignedUserId?: string;
  description?: string;
  points?: number; // pts for completing on time
}

export interface Task {
  id: string;
  templateId?: string;
  name: string;
  team: Team;
  assignedUserId?: string;
  assignedUserName?: string;
  deadline: Date;
  status: TaskStatus;
  validatedBy?: string;
  validatedAt?: Date;
  isRecurring: boolean;
  isPunctual: boolean;
  description?: string;
  createdAt: Date;
  createdBy: string;
  points?: number; // pts for this task
}

export interface ScoreEvent {
  id: string;
  userId: string;
  userName: string;
  team: Team;
  type: 'bonus' | 'penalty' | 'collective_penalty';
  reason: string;
  points: number; // positive = gain, negative = loss
  timestamp: Date;
}

export interface MalusEvent {
  id: string;
  team: Team;
  taskId: string;
  taskName: string;
  points: number;
  timestamp: Date;
}

export interface TeamScore {
  team: Team;
  baseBonus: number;
  totalMalus: number;
  currentBonus: number;
  malusEvents: MalusEvent[];
  date: string; // YYYY-MM-DD
  completionRate?: number; // 0-100
}

export interface GamificationSettings {
  dailyBonusBase: number;
  malusPerLateTask: number;
  bonusResetTime: string; // HH:mm
  // Individual bonuses
  pointsOnTime: number;       // +10 task completed on time
  pointsEarly: number;        // +12 task completed early
  pointsWithPhoto: number;    // +2 bonus with photo
  pointsClockIn: number;      // +5 clock in on time
  pointsPerfectDay: number;   // +20 all tasks done
  // Individual penalties
  penaltyOverdue: number;     // -5 task overdue
  penaltyLateClock: number;   // -8 late clock-in
  penaltyNoClock: number;     // -15 no clock-in
  // Collective penalty
  collectivePenaltyThreshold: number; // 70 (%)
  collectivePenaltyPoints: number;    // -10
}

export interface AppState {
  users: User[];
  tasks: Task[];
  templates: TaskTemplate[];
  teamScores: TeamScore[];
  gamificationSettings: GamificationSettings;
  currentUser: User | null;
  restaurantName: string;
}

export interface ValidationLog {
  taskId: string;
  taskName: string;
  team: Team;
  validatedBy: string;
  validatedAt: Date;
}

// Legacy alias for backward compat
export type Zone = Team;
export type ZoneScore = TeamScore;

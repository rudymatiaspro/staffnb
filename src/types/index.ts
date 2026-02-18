export type Zone = 'BAR' | 'CUISINE' | 'ATELIER' | 'MANAGEMENT' | 'ALL';

export type UserRole = 'owner' | 'manager' | 'staff';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  zone: Zone;
  pin?: string; // hashed or plain for demo
  pinSet: boolean;
}

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'overdue';
export type TaskFrequency = 'daily' | 'weekly' | 'custom';

export interface TaskTemplate {
  id: string;
  name: string;
  zone: Zone;
  frequency: TaskFrequency;
  days?: number[]; // 0=Sunday, 1=Monday, ...
  time: string; // HH:mm
  assignedUserId?: string;
  description?: string;
}

export interface Task {
  id: string;
  templateId?: string;
  name: string;
  zone: Zone;
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
}

export interface MalusEvent {
  id: string;
  zone: Zone;
  taskId: string;
  taskName: string;
  points: number;
  timestamp: Date;
}

export interface ZoneScore {
  zone: Zone;
  baseBonus: number;
  totalMalus: number;
  currentBonus: number;
  malusEvents: MalusEvent[];
  date: string; // YYYY-MM-DD
}

export interface GamificationSettings {
  dailyBonusBase: number;
  malusPerLateTask: number;
  bonusResetTime: string; // HH:mm
}

export interface AppState {
  users: User[];
  tasks: Task[];
  templates: TaskTemplate[];
  zoneScores: ZoneScore[];
  gamificationSettings: GamificationSettings;
  currentUser: User | null;
  restaurantName: string;
}

export interface ValidationLog {
  taskId: string;
  taskName: string;
  zone: Zone;
  validatedBy: string;
  validatedAt: Date;
}

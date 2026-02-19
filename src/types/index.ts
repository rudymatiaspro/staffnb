export type Team = 'BAR' | 'KITCHEN' | 'FLOOR' | 'ATELIER' | 'MANAGEMENT' | 'ALL';

export type UserRole = 'owner' | 'admin' | 'manager' | 'chef' | 'staff';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  team: Team;           // primary team (kept for backward compat)
  teams?: Team[];       // all assigned teams (multi-team support)
  pin?: string;          // app login PIN
  pinSet: boolean;       // app login PIN set
  stationPin?: string;   // clock-in/out station PIN (separate)
  stationPinSet?: boolean;
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

// ─── MODULE 1: PRODUCT CATALOGUE ─────────────────────────────────────────────

export type ProductCategory =
  | 'Red Wine' | 'White Wine' | 'Rosé Wine' | 'Champagne & Sparkling'
  | 'Beer' | 'Spirits' | 'Cocktail Ingredients' | 'Soft Drinks & Juices'
  | 'Fresh Produce' | 'Dry & Canned Goods' | 'Snacks & Tapas'
  | 'Packaging' | 'Cleaning Products' | 'Kitchen Supplies';

export type ProductCategoryGroup = 'BEVERAGES' | 'FOOD' | 'SUPPLIES';

export const PRODUCT_CATEGORIES: Record<ProductCategoryGroup, ProductCategory[]> = {
  BEVERAGES: ['Red Wine', 'White Wine', 'Rosé Wine', 'Champagne & Sparkling', 'Beer', 'Spirits', 'Cocktail Ingredients', 'Soft Drinks & Juices'],
  FOOD: ['Fresh Produce', 'Dry & Canned Goods', 'Snacks & Tapas'],
  SUPPLIES: ['Packaging', 'Cleaning Products', 'Kitchen Supplies'],
};

export type UnitType = 'btl' | 'pcs';

export type StockStatus = 'healthy' | 'warning' | 'critical';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  brand?: string;
  supplier?: string;
  supplierContact?: string;
  unit: UnitType;
  currentStock: number;
  minThreshold: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type StockUpdateReason = 'Delivery received' | 'Consumed' | 'Damaged' | 'Inventory correction';

export interface StockLog {
  id: string;
  productId: string;
  delta: number; // positive = added, negative = removed
  reason: StockUpdateReason;
  updatedBy: string;
  timestamp: Date;
}

// ─── MODULE 2: END OF DAY REPORT ─────────────────────────────────────────────

export interface DayReport {
  id: string;
  date: string; // YYYY-MM-DD
  generatedAt: Date;
  triggeredBy: 'manual' | 'auto';
  triggeredByUser?: string;
  managerNotes: string;
  // snapshot data
  totalTasks: number;
  completedTasks: number;
  teamCompletionRates: Record<string, number>;
  stockAlerts: { productId: string; productName: string; currentStock: number; minThreshold: number; status: StockStatus }[];
  staffPerformance: { userId: string; userName: string; tasksCompleted: number; pointsEarned: number; penaltiesApplied: number }[];
}

export interface DayCloseState {
  date: string; // YYYY-MM-DD
  triggered: boolean;
  triggeredAt?: Date;
  reportReadyAt?: Date; // triggeredAt + 10 min
  reportId?: string;
}

// ─── MODULE 3 (NEW): INCIDENT REPORTING ──────────────────────────────────────

export type IncidentType = 'Equipment failure' | 'Customer complaint' | 'Hygiene issue' | 'Accident / Injury' | 'Security concern' | 'Other';
export type IncidentSeverity = 'low' | 'medium' | 'high';
export type IncidentStatus = 'open' | 'in_progress' | 'resolved';
export type IncidentLocation = 'Bar' | 'Kitchen' | 'Atelier' | 'Floor' | 'Other';

export interface Incident {
  id: string;
  type: IncidentType;
  description: string;
  location: IncidentLocation;
  severity: IncidentSeverity;
  team: Team;
  reporterName?: string;
  reporterUserId?: string;
  anonymous: boolean;
  status: IncidentStatus;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── MODULE 4 (NEW): HACCP TEMPERATURE LOG ───────────────────────────────────

export interface TemperatureLocation {
  id: string;
  name: string;
  minThreshold?: number;
  maxThreshold: number;
  isCustom: boolean;
  createdAt: Date;
}

export interface TemperatureLog {
  id: string;
  locationId: string;
  locationName: string;
  temperature: number;
  unit: string;
  isAlert: boolean;
  note?: string;
  loggedBy: string;
  loggedByUserId?: string;
  createdAt: Date;
}

// ─── MODULE 5 (NEW): TEAM OBJECTIVES ─────────────────────────────────────────

export interface TeamObjective {
  id: string;
  title: string;
  description?: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  team: Team | 'ALL';
  deadline: string; // YYYY-MM-DD
  autoTrack: boolean;
  autoTrackMetric?: string;
  createdBy?: string;
  createdByUserId?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── MODULE 3 (ORIGINAL): CLOCK IN/OUT ───────────────────────────────────────

export interface ClockEvent {
  id: string;
  userId: string;
  userName: string;
  team: Team;
  type: 'in' | 'out';
  timestamp: Date;
}

export interface Shift {
  id: string;
  userId: string;
  userName: string;
  team: Team;
  clockIn: Date;
  clockOut?: Date;
  totalMinutes?: number;
  date: string; // YYYY-MM-DD
}

import { User, TaskTemplate, GamificationSettings, Team } from '../types';

export const INITIAL_USERS: User[] = [
  { id: 'owner-1', name: 'Owner', role: 'owner', team: 'MANAGEMENT', pinSet: true, pin: '0000' },
  { id: 'manager-cuong', name: 'Cuong', role: 'manager', team: 'MANAGEMENT', pinSet: false, pin: '' },
  { id: 'manager-quan', name: 'Quan', role: 'manager', team: 'MANAGEMENT', pinSet: false, pin: '' },
  // BAR staff
  { id: 'staff-lena', name: 'Lena', role: 'staff', team: 'BAR', pinSet: false, pin: '' },
  { id: 'staff-tran', name: 'Tran', role: 'staff', team: 'BAR', pinSet: false, pin: '' },
  { id: 'staff-phat', name: 'Phat', role: 'staff', team: 'BAR', pinSet: false, pin: '' },
  // KITCHEN staff
  { id: 'staff-ken', name: 'Ken', role: 'staff', team: 'KITCHEN', pinSet: false, pin: '' },
  { id: 'staff-thinh', name: 'Thinh', role: 'staff', team: 'KITCHEN', pinSet: false, pin: '' },
  { id: 'staff-hoa', name: 'Hoa', role: 'staff', team: 'KITCHEN', pinSet: false, pin: '' },
  // ATELIER staff
  { id: 'staff-quynh', name: 'Quynh', role: 'staff', team: 'ATELIER', pinSet: false, pin: '' },
];

export const INITIAL_TEMPLATES: TaskTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Bar Setup',
    team: 'BAR',
    frequency: 'daily',
    time: '09:00',
    description: 'Prepare the bar for opening',
    points: 10,
  },
  {
    id: 'tpl-2',
    name: 'Coffee Machine Cleaning',
    team: 'BAR',
    frequency: 'daily',
    time: '18:00',
    description: 'Clean and maintain the coffee machine',
    points: 10,
  },
  {
    id: 'tpl-3',
    name: 'Kitchen Setup',
    team: 'KITCHEN',
    frequency: 'daily',
    time: '09:00',
    description: 'Prepare workstations for service',
    points: 10,
  },
  {
    id: 'tpl-4',
    name: 'Kitchen Cleaning',
    team: 'KITCHEN',
    frequency: 'daily',
    time: '22:00',
    description: 'Full kitchen clean after service',
    points: 10,
  },
  {
    id: 'tpl-5',
    name: 'Atelier Prep',
    team: 'ATELIER',
    frequency: 'daily',
    time: '10:00',
    description: 'Organize and prepare the atelier',
    points: 10,
  },
  {
    id: 'tpl-6',
    name: 'Team Meeting',
    team: 'ALL',
    frequency: 'weekly',
    days: [1], // Monday
    time: '08:30',
    description: 'Weekly all-hands team meeting',
    points: 5,
  },
];

export const INITIAL_GAMIFICATION: GamificationSettings = {
  dailyBonusBase: 100,
  malusPerLateTask: 10,
  bonusResetTime: '03:00',
  pointsOnTime: 10,
  pointsEarly: 12,
  pointsWithPhoto: 2,
  pointsClockIn: 5,
  pointsPerfectDay: 20,
  penaltyOverdue: 5,
  penaltyLateClock: 8,
  penaltyNoClock: 15,
  collectivePenaltyThreshold: 70,
  collectivePenaltyPoints: 10,
};

export const TEAM_LABELS: Record<string, string> = {
  BAR: 'Bar',
  KITCHEN: 'Kitchen',
  FLOOR: 'Floor',
  ATELIER: 'Atelier',
  MANAGEMENT: 'Management',
  ALL: 'All Teams',
};

export const TEAM_CSS: Record<string, string> = {
  BAR: 'team-bar',
  KITCHEN: 'team-kitchen',
  FLOOR: 'team-floor',
  ATELIER: 'team-atelier',
  MANAGEMENT: 'team-management',
  ALL: 'team-all',
};

// Legacy aliases
export const ZONE_LABELS = TEAM_LABELS;
export const ZONE_CSS = TEAM_CSS;
export const ZONE_EMOJI: Record<string, string> = {
  BAR: '',
  KITCHEN: '',
  FLOOR: '',
  ATELIER: '',
  MANAGEMENT: '',
  ALL: '',
};

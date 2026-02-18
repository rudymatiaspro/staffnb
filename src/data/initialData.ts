import { User, TaskTemplate, GamificationSettings, Zone } from '../types';

export const INITIAL_USERS: User[] = [
  // Owner
  { id: 'owner-1', name: 'Owner', role: 'owner', zone: 'MANAGEMENT', pinSet: true, pin: '0000' },
  // Managers
  { id: 'manager-cuong', name: 'Cuong', role: 'manager', zone: 'MANAGEMENT', pinSet: false, pin: '' },
  { id: 'manager-quan', name: 'Quan', role: 'manager', zone: 'MANAGEMENT', pinSet: false, pin: '' },
  // BAR staff
  { id: 'staff-lena', name: 'Lena', role: 'staff', zone: 'BAR', pinSet: false, pin: '' },
  { id: 'staff-tran', name: 'Trân', role: 'staff', zone: 'BAR', pinSet: false, pin: '' },
  { id: 'staff-phat', name: 'Phat', role: 'staff', zone: 'BAR', pinSet: false, pin: '' },
  // CUISINE staff
  { id: 'staff-ken', name: 'Ken', role: 'staff', zone: 'CUISINE', pinSet: false, pin: '' },
  { id: 'staff-thinh', name: 'Thinh', role: 'staff', zone: 'CUISINE', pinSet: false, pin: '' },
  { id: 'staff-hoa', name: 'Hoa (Chef)', role: 'staff', zone: 'CUISINE', pinSet: false, pin: '' },
  // ATELIER staff
  { id: 'staff-quynh', name: 'Quynh', role: 'staff', zone: 'ATELIER', pinSet: false, pin: '' },
];

export const INITIAL_TEMPLATES: TaskTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Mise en place bar',
    zone: 'BAR',
    frequency: 'daily',
    time: '09:00',
    description: 'Préparer le bar pour l\'ouverture',
  },
  {
    id: 'tpl-2',
    name: 'Nettoyage machine à café',
    zone: 'BAR',
    frequency: 'daily',
    time: '18:00',
    description: 'Nettoyer et entretenir la machine à café',
  },
  {
    id: 'tpl-3',
    name: 'Mise en place cuisine',
    zone: 'CUISINE',
    frequency: 'daily',
    time: '09:00',
    description: 'Préparer les postes de travail',
  },
  {
    id: 'tpl-4',
    name: 'Nettoyage cuisine',
    zone: 'CUISINE',
    frequency: 'daily',
    time: '22:00',
    description: 'Nettoyage complet de la cuisine en fin de service',
  },
  {
    id: 'tpl-5',
    name: 'Préparation atelier',
    zone: 'ATELIER',
    frequency: 'daily',
    time: '10:00',
    description: 'Organiser et préparer l\'atelier',
  },
  {
    id: 'tpl-6',
    name: 'Réunion équipe',
    zone: 'ALL',
    frequency: 'weekly',
    days: [1], // Monday
    time: '08:30',
    description: 'Réunion hebdomadaire de toute l\'équipe',
  },
];

export const INITIAL_GAMIFICATION: GamificationSettings = {
  dailyBonusBase: 100,
  malusPerLateTask: 10,
  bonusResetTime: '03:00',
};

export const ZONE_LABELS: Record<string, string> = {
  BAR: '🟤 BAR',
  CUISINE: '🟡 CUISINE',
  ATELIER: '🟣 ATELIER',
  MANAGEMENT: '🔵 MANAGEMENT',
  ALL: '🌐 TOUTES ZONES',
};

export const ZONE_CSS: Record<string, string> = {
  BAR: 'zone-bar',
  CUISINE: 'zone-cuisine',
  ATELIER: 'zone-atelier',
  MANAGEMENT: 'zone-management',
  ALL: 'zone-all',
};

export const ZONE_EMOJI: Record<string, string> = {
  BAR: '🟤',
  CUISINE: '🟡',
  ATELIER: '🟣',
  MANAGEMENT: '🔵',
  ALL: '🌐',
};

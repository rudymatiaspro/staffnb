# Staff&B — Full Codebase Summary
> Generated: 2026-02-19 | Stack: React 18 + Vite + TypeScript + Tailwind CSS + Supabase (Lovable Cloud)
> Restaurant: **Casinha**

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Directory Structure](#3-directory-structure)
4. [Routes & Pages](#4-routes--pages)
5. [Authentication System (2 layers)](#5-authentication-system-2-layers)
6. [User Roles & Permissions](#6-user-roles--permissions)
7. [Data Architecture](#7-data-architecture)
8. [React Component Inventory](#8-react-component-inventory)
9. [Context & State Management](#9-context--state-management)
10. [Supabase Data Hook (useSupabaseData)](#10-supabase-data-hook-usesupabasedata)
11. [Database Tables (23 total)](#11-database-tables-23-total)
12. [PostgreSQL Functions & Triggers](#12-postgresql-functions--triggers)
13. [Edge Functions](#13-edge-functions)
14. [Realtime Subscriptions](#14-realtime-subscriptions)
15. [Scheduled Jobs (pg_cron)](#15-scheduled-jobs-pgcron)
16. [Gamification System](#16-gamification-system)
17. [Feature Status Matrix](#17-feature-status-matrix)
18. [TypeScript Types](#18-typescript-types)
19. [Design System & Theming](#19-design-system--theming)
20. [Known Gaps & Next Steps](#20-known-gaps--next-steps)

---

## 1. Project Overview

**Staff&B** is a restaurant staff management web application for **Casinha**. It provides:

- **Task management** — recurring templates + punctual tasks, per-team, with deadline timers
- **Gamification** — individual scores (bonus/penalty), team daily bonus pools, leaderboard, malus contests
- **Planning** — manager shift grid, staff shift view, shift swap requests, availability management
- **Inventory** — product catalogue, stock updates, supplier orders with full receipt flow
- **Incidents** — report, track, and resolve workplace incidents; HACCP temperature logging with auto-alerts
- **Messaging** — multi-channel real-time chat with @mention notifications
- **Reports** — daily close reports (auto at 22h + manual), PDF/CSV export
- **Clock-in Kiosk** — dedicated `/station` route with its own auth context for clock-in/out via station PIN
- **Objectives** — team progress goals with optional auto-tracking from DB metrics

---

## 2. Tech Stack & Dependencies

### Core
| Package | Version | Purpose |
|---------|---------|---------|
| react | ^18.3.1 | UI framework |
| react-dom | ^18.3.1 | DOM rendering |
| vite | — | Build tool |
| typescript | — | Type safety |
| tailwindcss | — | Utility CSS |
| tailwindcss-animate | ^1.0.7 | Animation utilities |

### Backend / Data
| Package | Version | Purpose |
|---------|---------|---------|
| @supabase/supabase-js | ^2.97.0 | Database, Auth, Realtime, Storage |
| @tanstack/react-query | ^5.83.0 | Query client (light usage) |

### UI Components
| Package | Version | Purpose |
|---------|---------|---------|
| @radix-ui/* (30 packages) | various | shadcn/ui primitives |
| class-variance-authority | ^0.7.1 | Component variants |
| clsx | ^2.1.1 | Class merging |
| tailwind-merge | ^2.6.0 | Tailwind dedup |
| lucide-react | ^0.462.0 | Icons |
| cmdk | ^1.1.1 | Command palette |
| vaul | ^0.9.9 | Drawer |
| sonner | ^1.7.4 | Toast notifications |
| next-themes | ^0.3.0 | Dark/light mode |
| embla-carousel-react | ^8.6.0 | Carousel |

### Forms & Validation
| Package | Version | Purpose |
|---------|---------|---------|
| react-hook-form | ^7.61.1 | Form state |
| @hookform/resolvers | ^3.10.0 | Validation adapters |
| zod | ^3.25.76 | Schema validation |
| input-otp | ^1.4.2 | OTP/PIN input |

### Charts & Export
| Package | Version | Purpose |
|---------|---------|---------|
| recharts | ^2.15.4 | Data visualisation |
| jspdf | ^4.2.0 | PDF generation |
| jspdf-autotable | ^5.0.7 | Table plugin for jsPDF |
| date-fns | ^3.6.0 | Date utilities |
| react-day-picker | ^8.10.1 | Calendar UI |

### Routing
| Package | Version | Purpose |
|---------|---------|---------|
| react-router-dom | ^6.30.1 | Client-side routing |

---

## 3. Directory Structure

```
/
├── index.html                          # Entry HTML (inline theme script for FOUC prevention)
├── APP_STATE.md                        # Technical documentation (live truth source)
├── CODEBASE_SUMMARY.md                 # This document
├── tailwind.config.ts                  # Tailwind + design tokens
├── vite.config.ts                      # Vite config
├── tsconfig.app.json
│
├── public/
│   ├── favicon.ico / favicon.svg
│   ├── logo.svg
│   └── robots.txt
│
├── src/
│   ├── main.tsx                        # React entry point
│   ├── App.tsx                         # Root: providers + router
│   ├── App.css
│   ├── index.css                       # Design tokens (CSS custom properties)
│   ├── vite-env.d.ts
│   │
│   ├── assets/
│   │   └── logo.svg
│   │
│   ├── types/
│   │   └── index.ts                    # All TypeScript interfaces & types (284 lines)
│   │
│   ├── data/
│   │   └── initialData.ts              # Seed data, TEAM_LABELS, TEAM_CSS constants
│   │
│   ├── context/
│   │   ├── AuthContext.tsx             # Supabase auth session wrapper
│   │   └── AppContext.tsx              # Master app state (897 lines)
│   │
│   ├── integrations/supabase/
│   │   ├── client.ts                   # Auto-generated Supabase client (DO NOT EDIT)
│   │   ├── hooks.ts                    # useSupabaseData — all fetches + write ops (681 lines)
│   │   └── types.ts                    # Auto-generated DB types (DO NOT EDIT)
│   │
│   ├── hooks/
│   │   ├── use-mobile.tsx              # Responsive breakpoint hook
│   │   ├── use-toast.ts                # Toast hook
│   │   └── useBrowserNotifications.ts  # Web Notifications API hook
│   │
│   ├── lib/
│   │   └── utils.ts                    # cn() utility
│   │
│   ├── pages/
│   │   ├── Index.tsx                   # Auth gate / app entry
│   │   ├── Dashboard.tsx               # Main shell (header + role routing)
│   │   ├── Station.tsx                 # Clock-in kiosk
│   │   ├── Login.tsx                   # Email/password login
│   │   ├── AuthLogin.tsx               # Auth wrapper
│   │   └── NotFound.tsx                # 404
│   │
│   └── components/
│       ├── auth/
│       │   ├── NameSelector.tsx        # User picker
│       │   └── PinEntry.tsx            # 4-digit PIN pad
│       │
│       ├── dashboard/
│       │   ├── OwnerDashboard.tsx      # 15-tab owner view
│       │   ├── ManagerView.tsx         # 14-tab manager view
│       │   ├── StaffView.tsx           # 10-tab staff view
│       │   └── OwnerSettings.tsx       # Gamification + restaurant settings
│       │
│       ├── tasks/
│       │   ├── TaskCard.tsx            # Task card with timer, complete, delete
│       │   └── CreateTaskModal.tsx     # Create punctual or template task
│       │
│       ├── planning/
│       │   ├── PlanningModule.tsx      # Manager weekly shift planner (+ Disponibilités tab)
│       │   ├── StaffShiftsView.tsx     # Staff upcoming shifts
│       │   ├── ShiftSwapModule.tsx     # Shift swap request + approval
│       │   └── AvailabilityModule.tsx  # Staff set availability / Manager read-only view
│       │
│       ├── catalogue/
│       │   └── ProductCatalogue.tsx    # Product CRUD + stock updates
│       │
│       ├── orders/
│       │   └── OrdersModule.tsx        # Order lifecycle (draft→receipt) + recurring badge
│       │
│       ├── timesheets/
│       │   └── TimesheetView.tsx       # Clock-in/out history
│       │
│       ├── reports/
│       │   └── EndOfDayReport.tsx      # Day report list + PDF/CSV export panel
│       │
│       ├── incidents/
│       │   └── IncidentModule.tsx      # Incident report + management
│       │
│       ├── haccp/
│       │   └── HACCPModule.tsx         # HACCP temperature logging + alert rows
│       │
│       ├── objectives/
│       │   └── ObjectivesModule.tsx    # Team objectives + progress bars
│       │
│       ├── messaging/
│       │   └── MessagingModule.tsx     # Multi-channel chat + @mentions
│       │
│       ├── leaderboard/
│       │   └── Leaderboard.tsx         # Staff score leaderboard
│       │
│       ├── scoring/
│       │   ├── ScoreEventsView.tsx     # Bonus/penalty event history
│       │   └── MalusContestModule.tsx  # Contest malus / resolve contestation
│       │
│       ├── zones/
│       │   └── BonusScoreCard.tsx      # Team daily bonus card
│       │
│       ├── notifications/
│       │   └── NotificationBell.tsx    # Header bell + unread dropdown
│       │
│       ├── pins/
│       │   └── PinManagement.tsx       # View / set / reset staff PINs
│       │
│       ├── NavLink.tsx                 # Navigation link component
│       │
│       └── ui/                         # shadcn/ui primitives (30+ components)
│           ├── button.tsx, card.tsx, dialog.tsx, form.tsx, input.tsx
│           ├── select.tsx, tabs.tsx, table.tsx, badge.tsx, checkbox.tsx
│           ├── calendar.tsx, popover.tsx, sheet.tsx, drawer.tsx
│           ├── ToastNotification.tsx   # Custom in-app toast
│           └── ... (30 total)
│
└── supabase/
    ├── config.toml                     # Supabase project config (DO NOT EDIT)
    ├── functions/
    │   ├── daily-report/index.ts       # Cron 22:00 — aggregate day metrics
    │   ├── ensure-god-user/index.ts    # Create god/super-admin user
    │   └── generate-tasks-now/index.ts # Manual trigger — call generate_tasks_from_templates()
    └── migrations/                     # All SQL migrations (applied, DO NOT EDIT)
```

---

## 4. Routes & Pages

| Route | File | Who Sees It | Description |
|-------|------|-------------|-------------|
| `/` | `src/pages/Index.tsx` | Everyone | Auth gate — renders Login if not authed, else Dashboard |
| `/` (authed) | `src/pages/Dashboard.tsx` | Authed users | Main shell with header + role-based view |
| `/station` | `src/pages/Station.tsx` | Station kiosk | Standalone clock-in/out, own AuthProvider + AppProvider |
| `*` | `src/pages/NotFound.tsx` | Everyone | 404 fallback |

### Dashboard Sub-Views (tabs, not routes)
All rendered inside `Dashboard.tsx` based on `currentUser.role`:

| View Component | Roles | Number of Tabs |
|---------------|-------|---------------|
| `OwnerDashboard` | owner, admin | 15 |
| `ManagerView` | manager, chef | 14 |
| `StaffView` | staff | 10 |

### OwnerDashboard Tabs
Overview · Board · Messages · Commandes · Scores · Contestations · Catalogue · Timesheets · Reports · Incidents · HACCP · Objectifs · PINs · Settings

### ManagerView Tabs
Tâches · Planning · Commandes · Messages · Scores · Contestations · Activité · Catalogue · Timesheets · Reports · Incidents · HACCP · Objectifs · PINs

### StaffView Tabs
Tâches · Messages · Planning · Échanges · Commandes · Catalogue · Pointage · Incident · HACCP · Objectifs · Dispos

---

## 5. Authentication System (2 layers)

### Layer 1 — Supabase Auth (email/password)
**File:** `src/context/AuthContext.tsx`

```
signUp(email, password, name)
  → supabase.auth.signUp()
  → triggers ensure-god-user edge function (if god user needed)

signIn(email, password)
  → supabase.auth.signInWithPassword()
  → session stored as JWT in Supabase

signOut()
  → supabase.auth.signOut()
  → clears session + currentUser
```

**Exposes via context:** `session`, `supabaseUser`, `loading`, `signIn`, `signUp`, `signOut`

### Layer 2 — App-level PIN login (staff identity selection)
**File:** `src/context/AppContext.tsx`

After Supabase auth, users:
1. Pick their name from `NameSelector.tsx` (shows all profiles from DB)
2. Enter 4-digit PIN in `PinEntry.tsx`
3. PIN verified against `profiles.pin_hash` (stored as `btoa(pin)` — base64 obfuscation)
4. `currentUser` is set in AppContext

**Station PINs** are separate (`station_pin_hash` column) — used only on the `/station` kiosk.

**Auth state flow:**
```
Supabase session exists?
  No  → Show Login page (email/password)
  Yes → Show NameSelector → PinEntry → Dashboard
```

### Auth Components
| Component | Purpose |
|-----------|---------|
| `NameSelector.tsx` | Scrollable list of all staff profiles |
| `PinEntry.tsx` | 4-digit numpad with backspace |
| `PinManagement.tsx` | Manager/Owner interface: set/reset app & station PINs |

---

## 6. User Roles & Permissions

### Roles (stored in `user_roles` table)

| Role | DB Value | Key Privileges |
|------|----------|---------------|
| God | `god` | Rudy's super-admin; full DB access, bypasses RLS |
| Owner | `owner` | All permissions including delete + billing |
| Admin | `admin` | Same as owner except cannot delete restaurant |
| Manager | `manager` | Manages own team: tasks, planning, incidents, reports |
| Chef | `chef` | Like manager but scoped to kitchen/atelier; **exempt from double-malus** |
| Staff | `staff` | Basic: own tasks, messaging, incidents, clock-in |

### DB Role Helper Functions (SECURITY DEFINER)
| Function | Returns | Logic |
|----------|---------|-------|
| `get_my_role()` | `user_role` | Reads from `user_roles` for `auth.uid()` |
| `get_my_team()` | `team_name` | Reads from `profiles` for `auth.uid()` |
| `is_owner()` | boolean | role IN ('owner', 'admin') |
| `is_admin()` | boolean | same as is_owner() |
| `is_manager_or_owner()` | boolean | role IN ('owner', 'admin', 'manager', 'chef') |
| `can_manage_team(team)` | boolean | owner always true; manager only if same team |

### Permission Matrix (UI level)

| Feature | Staff | Manager | Owner/Admin |
|---------|:-----:|:-------:|:-----------:|
| View/complete own tasks | ✅ | ✅ | ✅ |
| Create/delete tasks | ❌ | ✅ | ✅ |
| View catalogue (read) | ✅ | ✅ | ✅ |
| Manage products/stock | ❌ | ✅ | ✅ |
| View/create orders | ✅ | ✅ | ✅ |
| Validate/manage orders | ❌ | ✅ | ✅ |
| View own planning | ✅ | ✅ | ✅ |
| Manage planning | ❌ | ✅ | ✅ |
| Request shift swap | ✅ | ✅ | ✅ |
| Approve shift swap | ❌ | ✅ | ✅ |
| Report incident | ✅ | ✅ | ✅ |
| Resolve incident | ❌ | ✅ | ✅ |
| Log HACCP temperature | ✅ | ✅ | ✅ |
| Manage HACCP locations | ❌ | ✅ | ✅ |
| View objectives | ✅ | ✅ | ✅ |
| Create/manage objectives | ❌ | ✅ | ✅ |
| View leaderboard | ✅ | ✅ | ✅ |
| Add score events | ❌ | ✅ | ✅ |
| Contest a malus | ✅ | — | — |
| Resolve contestation | ❌ | ✅ | ✅ |
| View own timesheet | ✅ | ✅ (all team) | ✅ (all) |
| Manage PINs | ❌ | ✅ | ✅ |
| View day reports | ❌ | ✅ | ✅ |
| Trigger close day | ❌ | ✅ | ✅ |
| Gamification settings | ❌ | ❌ | ✅ |
| Delete users/profiles | ❌ | ❌ | ✅ |
| Send/delete messages | own only | ✅ | ✅ |

---

## 7. Data Architecture

### Data Flow

```
Supabase DB (cloud)
       │
       ▼
useSupabaseData() hook  ←──── 15 parallel initial fetches
       │                ←──── 9 Realtime subscriptions (postgres_changes)
       │
       ▼
AppContext (React context)
       │ ── exposes entities: users, tasks, templates, products,
       │                      shifts, incidents, objectives, etc.
       │ ── exposes write ops: saveTask(), addIncident(), updateStock()...
       │
       ▼
Dashboard / ManagerView / StaffView / OwnerDashboard
       │
       ▼
Feature modules (TaskCard, PlanningModule, IncidentModule, etc.)
```

### Local Fallback (unauthenticated mode)
When no Supabase session exists, the app uses:
- `localStorage` key `staffb-manager-v1` — persisted JSON state
- Seed data from `src/data/initialData.ts` (INITIAL_USERS, INITIAL_TEMPLATES, INITIAL_GAMIFICATION)

### Theme Persistence
- Key: `localStorage.theme` = `'dark'` | `'light'`
- Applied via `document.documentElement.classList.toggle('dark', ...)`
- FOUC prevention: inline `<script>` in `index.html` runs before React hydrates

---

## 8. React Component Inventory

### Pages (6)
| Component | Route | Description |
|-----------|-------|-------------|
| `Index` | `/` | Auth gate |
| `Dashboard` | `/` (authed) | Shell: header, theme toggle, notification bell, user menu |
| `Station` | `/station` | Clock-in/out kiosk |
| `Login` | — | Email/password form |
| `AuthLogin` | — | Auth wrapper |
| `NotFound` | `*` | 404 |

### Dashboard Header (Dashboard.tsx)
- **Logo** + restaurant name
- **Dark/Light mode** — Sun/Moon toggle, persists to localStorage
- **Realtime status** — green pulse "live" or orange WifiOff "Reconnecting"
- **Enable browser alerts** — pill button (managers only, if permission === 'default')
- **High-severity incident badge** — red pulsing alert (managers only, if unread high incidents)
- **NotificationBell** — dropdown with unread in-app notifications
- **Overdue tasks bell** — red count badge
- **User menu** — name + team badge, push alerts toggle, Change user, Sign out

### Task Components
| Component | Description |
|-----------|-------------|
| `TaskCard` | Countdown timer, status badge, team badge, complete button (staff), delete (manager), photo upload trigger |
| `CreateTaskModal` | Form: name, team, deadline, assignee, points, recurring/punctual toggle |

### Planning Components
| Component | Description |
|-----------|-------------|
| `PlanningModule` | Manager weekly grid (Mon–Sun × staff), drag-drop-like assignment, shift type selector (matin/soir/coupure/repos/congés), note field. Tabs: Planning · Échanges · Disponibilités |
| `StaffShiftsView` | Staff's upcoming shifts for the week |
| `ShiftSwapModule` | Request: pick shift + target user. Manager: approve/reject with reason |
| `AvailabilityModule` | `StaffAvailabilityView`: weekly toggle (Available/Partial/Unavailable) + time range for Partial. `ManagerAvailabilityView`: read-only color-coded grid of all team members |

### Catalogue & Orders
| Component | Description |
|-----------|-------------|
| `ProductCatalogue` | Grouped by category (Beverages/Food/Supplies), stock badge (healthy/warning/critical), delta update modal, supplier info |
| `OrdersModule` | Create order → add items → submit for validation → manager validates → receive with quantity check. Shows 🔄 badge on recurring orders + next_occurrence date |

### Scoring & Gamification
| Component | Description |
|-----------|-------------|
| `BonusScoreCard` | Team daily bonus pool: base − malus events, completion rate |
| `Leaderboard` | Individual ranking by `profiles.score`, shows team_rank + overall_rank from `get_staff_rankings()` RPC |
| `ScoreEventsView` | Chronological log of bonus/penalty events with type badge |
| `MalusContestModule` | Staff: submit contest for a penalty. Manager: view pending, uphold or overturn with note |

### Reports & Timesheets
| Component | Description |
|-----------|-------------|
| `EndOfDayReport` | Lists day reports, detail view with completion rates + staff performance. **ExportPanel**: date range picker → CSV (tasks) or PDF (tasks + rankings + incidents) via jsPDF |
| `TimesheetView` | Per-user clock-in/out history with total hours |

### Incidents & HACCP
| Component | Description |
|-----------|-------------|
| `IncidentModule` | Report form (type, location, severity, description, anonymous toggle). Manager: list + resolve with note. 🌡️ badge on HACCP auto-incidents |
| `HACCPModule` | Temperature log form with location selector. Alert rows highlighted in red. Auto-creates incident when `is_alert = true` |

### Objectives & Messaging
| Component | Description |
|-----------|-------------|
| `ObjectivesModule` | Progress bar cards per objective. Manager: create/edit. Auto-track metric display |
| `MessagingModule` | Channel tabs (general/bar/kitchen/floor/atelier/management). @mention with user picker. Realtime via Supabase channel |

### Notifications
| Component | Description |
|-----------|-------------|
| `NotificationBell` | Bell icon with unread count badge. Dropdown lists recent notifications. Mark all read. Realtime INSERT subscription |
| `ToastNotification` | Bottom-right slide-up toast for success/error/info/malus events |

### Management
| Component | Description |
|-----------|-------------|
| `PinManagement` | Table of all users. Set/reset app PIN and station PIN. Shows pinSet status |
| `OwnerSettings` | Gamification number inputs (bonus, malus, thresholds, individual point values). Restaurant name. Save button → `saveGamification()` |

---

## 9. Context & State Management

### `AuthContext` (`src/context/AuthContext.tsx`)
- **Purpose:** Wraps Supabase session state
- **State:** `session`, `supabaseUser`, `loading`
- **Methods:** `signIn()`, `signUp()`, `signOut()`
- **Realtime:** `supabase.auth.onAuthStateChange()` listener

### `AppContext` (`src/context/AppContext.tsx`, 897 lines)
- **Purpose:** Master application state for all features
- **Depends on:** `useAuth()` (for `supabaseUser`), `useSupabaseData()` (for DB layer)
- **State managed:**
  - `users: User[]` — all profiles
  - `tasks: Task[]` — today's + historical tasks
  - `templates: TaskTemplate[]` — recurring task templates
  - `teamScores: TeamScore[]` — daily team bonus scores
  - `gamificationSettings: GamificationSettings` — singleton settings
  - `products: Product[]` — inventory
  - `stockLogs: StockLog[]` — stock change history
  - `dayReports: DayReport[]` — EOD reports
  - `dayCloseState: DayCloseState | null` — today's close trigger
  - `shifts: Shift[]` — clock-in/out records
  - `incidents: Incident[]` — workplace incidents
  - `tempLocations: TemperatureLocation[]` — HACCP locations
  - `tempLogs: TemperatureLog[]` — temperature records
  - `objectives: TeamObjective[]` — team goals
  - `currentUser: User | null` — app-level logged-in user (PIN-selected)
  - `validationLog: ValidationEvent[]` — task validation history
  - `toast: Toast | null` — in-app toast state
  - `staffRankings: StaffRanking[]` — from `get_staff_rankings()` RPC

- **Key methods exposed:**
  - `login(user)` / `logout()` — PIN-level session
  - `setPin / validatePin / resetPin / setStationPin / validateStationPin`
  - `completeTask(taskId)` — marks done, triggers score events
  - `createPunctualTask(task)` — one-off task creation
  - `createTemplate / updateTemplate / deleteTemplate`
  - `addProduct / updateProduct / deleteProduct / updateStock`
  - `triggerCloseDay(user)` — fires daily-report edge function
  - `addIncident / updateIncident / deleteIncident`
  - `addTempLog(log, location)` — saves temp log; if `is_alert=true` → auto-creates incident
  - `addObjective / updateObjective / deleteObjective`
  - `getTodayTasks(team?)` — filtered by team if provided
  - `getTeamScore(team)` — returns TeamScore for given team
  - `getUserShifts / getAllShiftsForDate`

- **Overdue task detection:** `setInterval` every 5 seconds — checks `task.deadline < now()` and flips `pending → overdue`

---

## 10. Supabase Data Hook (useSupabaseData)

**File:** `src/integrations/supabase/hooks.ts` (681 lines)

### Initial Fetch (parallel, 15 tables + 1 RPC)
```
fetchAll() runs once on mount when enabled=true:

Promise.all([
  profiles, user_roles, profile_teams,
  tasks, task_templates,
  products, stock_logs,
  shifts, team_scores, day_reports,
  gamification_settings,
  incidents, temperature_locations, temperature_logs,
  team_objectives
])
+ supabase.rpc('get_staff_rankings')
+ supabase.from('day_close_states').eq('date', today)
```

### Type Mappers (DB snake_case → TypeScript camelCase)
| Mapper | DB Table |
|--------|----------|
| `dbRowToUser()` | profiles + user_roles + profile_teams |
| `dbRowToTask()` | tasks |
| `dbRowToTemplate()` | task_templates |
| `dbRowToProduct()` | products |
| `dbRowToShift()` | shifts |
| `dbRowToTeamScore()` | team_scores |
| `dbRowToDayReport()` | day_reports |
| `dbRowToDayCloseState()` | day_close_states |
| `dbRowToGamification()` | gamification_settings |

### Write Operations
| Method | DB Operation |
|--------|-------------|
| `saveTask(task)` | `tasks.upsert()` |
| `saveTemplate(template)` | `task_templates.upsert()` |
| `deleteTemplate(id)` | `task_templates.delete()` |
| `saveProduct(product)` | `products.upsert()` |
| `deleteProduct(id)` | `products.delete()` |
| `saveStockLog(log, newStock)` | `stock_logs.insert()` + `products.update()` |
| `saveShift(shift)` | `shifts.insert()` |
| `updateShift(shift)` | `shifts.update()` (clock_out, total_minutes) |
| `saveTeamScore(score)` | `team_scores.upsert()` (conflict: team,date) |
| `saveDayReport(report)` | `day_reports.upsert()` |
| `updateDayReport(id, notes)` | `day_reports.update()` |
| `saveDayCloseState(state)` | `day_close_states.upsert()` (conflict: date) |
| `saveGamification(settings)` | `gamification_settings.update()` |
| `saveProfile(user)` | `profiles.upsert()` + `user_roles.upsert()` + `profile_teams` sync |
| `setProfilePin(userId, pin)` | `profiles.update({ pin_hash: btoa(pin), pin_set: true })` |
| `setProfileStationPin(userId, pin)` | `profiles.update({ station_pin_hash: btoa(pin) })` |
| `deleteProfile(userId)` | `profiles.delete()` |
| `saveIncident(incident)` | `incidents.upsert()` |
| `updateIncidentDB(id, updates)` | `incidents.update()` |
| `deleteIncidentDB(id)` | `incidents.delete()` |
| `saveTempLog(log)` | `temperature_logs.insert()` |
| `saveTempLocation(loc)` | `temperature_locations.insert()` |
| `saveObjective(obj)` | `team_objectives.upsert()` |
| `updateObjectiveDB(id, updates)` | `team_objectives.update()` |
| `deleteObjectiveDB(id)` | `team_objectives.delete()` |

---

## 11. Database Tables (23 total)

### User & Auth
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `profiles` | id (=auth.uid), name, team, pin_hash, station_pin_hash, pin_set, station_pin_set, score, photo_url | One row per Supabase auth user |
| `user_roles` | user_id, role (enum) | Separate from profiles — one role per user |
| `profile_teams` | profile_id, team | Multi-team assignments |

### Tasks
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `tasks` | id, name, team, status, deadline, assigned_user_id, template_id, is_recurring, is_punctual, points, validated_by/at | Main task entity |
| `task_templates` | id, name, team, frequency, days[], time (HH:mm), points, assigned_user_id | Recurring task definitions |

### Products & Orders
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `products` | id, name, category, brand, supplier, unit, current_stock, min_threshold | Inventory item |
| `stock_logs` | id, product_id, delta, reason (enum), updated_by, timestamp | Stock change audit |
| `orders` | id, order_number, supplier, status (enum), is_recurring, recurrence_freq, next_occurrence, parent_order_id | Purchase order |
| `order_items` | id, order_id, product_id, product_name, quantity, unit (enum), unit_price | Line items |
| `order_receipts` | id, order_id, received_by, received_at, has_gap, gap_note | Receipt record |
| `order_receipt_items` | id, receipt_id, order_item_id, ordered_qty, received_qty | Quantity reconciliation |

### Shifts & Planning
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `shifts` | id, user_id, team, clock_in, clock_out, total_minutes, date | Actual clock-in records |
| `planning_shifts` | id, user_id, date, shift_start, shift_end, shift_type, team, note | Planned shifts (manager-created) |
| `shift_swap_requests` | id, requester_id, shift_id, target_user_id, target_shift_id, status, note, rejection_reason | Swap workflow |
| `availability_requests` | id, user_id, type (day_off/availability), date, status, note, reviewed_by/at | Leave/availability requests |

### Scoring & Gamification
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `score_events` | id, user_id, team, type (enum), reason, points, timestamp | Individual score changes |
| `malus_events` | id, team, task_id, task_name, points, timestamp | Team-level malus records |
| `malus_contests` | id, contestant_id, score_event_id, reason, status, arbiter_id, arbiter_note | Malus dispute flow |
| `team_scores` | id, team, date, base_bonus, total_malus, current_bonus, completion_rate | Daily team bonus |
| `gamification_settings` | (singleton) all numeric settings | Owner-configurable |

### Incidents & HACCP
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `incidents` | id, type, description, location, severity, team, anonymous, status, reporter_user_id, resolved_by/at | Workplace incidents |
| `temperature_locations` | id, name, min_threshold, max_threshold, is_custom | HACCP monitoring points |
| `temperature_logs` | id, location_id, temperature, unit, is_alert, note, logged_by, logged_by_user_id | Temperature readings |

### Objectives & Comms
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `team_objectives` | id, title, description, target_value, current_value, unit, team, deadline, auto_track, auto_track_metric | Team goals |
| `messages` | id, channel, content, sender_id, sender_name, sender_team, mentions[] | Chat messages |
| `notifications` | id, user_id, type, title, body, read, ref_id, ref_type | In-app notifications |

### Reports
| Table | Key Columns | Notes |
|-------|-------------|-------|
| `day_reports` | id, date, triggered_by, total_tasks, completed_tasks, team_completion_rates (jsonb), staff_performance (jsonb), stock_alerts (jsonb), manager_notes | EOD summary |
| `day_close_states` | id, date, triggered, triggered_at, report_id, report_ready_at | Daily close tracking |

---

## 12. PostgreSQL Functions & Triggers

### Read / Query Functions
| Function | Returns | Description |
|----------|---------|-------------|
| `get_my_role()` | user_role | Current user's role from user_roles |
| `get_my_team()` | team_name | Current user's team from profiles |
| `is_owner()` | boolean | role IN ('owner', 'admin') |
| `is_admin()` | boolean | same as is_owner() |
| `is_manager_or_owner()` | boolean | role IN ('owner', 'admin', 'manager', 'chef') |
| `can_manage_team(team)` | boolean | Owner always true; manager matches own team |
| `get_staff_rankings()` | TABLE | user_id, name, team, score, team_rank (RANK() OVER PARTITION BY team), overall_rank (RANK() OVER ORDER BY score) |

### Action Functions
| Function | Description |
|----------|-------------|
| `generate_tasks_from_templates()` | Reads all templates, checks frequency vs today's weekday, inserts tasks if no duplicate exists for today. Called by pg_cron at 00:01 and by `generate-tasks-now` edge function |
| `recalculate_all_scores()` | Resets all profiles.score to 0, replays all score_events in order. Run once after trigger creation |
| `update_objective_progress()` | For objectives with auto_track=true: updates current_value from DB metrics (tasks_completed, incidents_resolved, score_average, orders_validated). Auto-marks completed/at_risk |
| `spawn_recurring_orders()` | Finds orders with is_recurring=true and next_occurrence <= now(). Clones them as draft with parent_order_id. Updates next_occurrence on original |

### Triggers
| Trigger | Table | When | Action |
|---------|-------|------|--------|
| `sync_profile_score` / `trg_sync_profile_score` | `score_events` | AFTER INSERT | Updates profiles.score: +points for bonus, −points for penalty, collective_penalty deducts from all team members. Uses GREATEST(score − points, 0) |
| `trg_manager_double_malus` | `score_events` | AFTER INSERT | If penalized user has role='manager' (not chef): creates a second score_event with same points + " (malus doublé manager)" |
| `trg_collective_penalty` | `tasks` | AFTER UPDATE (status→overdue) | Counts team's overdue tasks today; if ≥ collective_penalty_threshold: inserts collective_penalty score_event (once per team per day) |

---

## 13. Edge Functions

### `daily-report`
**Path:** `supabase/functions/daily-report/index.ts`
**Trigger:** pg_cron `0 22 * * *` (22:00 daily) + manual HTTP POST
**What it does:**
1. Queries tasks, score_events, malus_events, incidents, products, orders
2. Computes: completion rates per team, top performers, stock alerts
3. Writes row to `day_reports`
4. Writes/updates `day_close_states`
5. Inserts `notifications` for all owner/admin users

### `ensure-god-user`
**Path:** `supabase/functions/ensure-god-user/index.ts`
**Trigger:** Manual HTTP POST
**What it does:**
1. Checks if god user exists in auth.users
2. Creates Supabase auth user if not
3. Inserts into `profiles` and `user_roles` with role='god'
4. Idempotent — safe to run multiple times

### `generate-tasks-now`
**Path:** `supabase/functions/generate-tasks-now/index.ts`
**Trigger:** Manual (button in ManagerView) + pg_cron backup
**What it does:**
1. Calls `supabase.rpc('generate_tasks_from_templates')`
2. Returns `{ success: true }` on success
3. Manager sees toast notification on result

**Trigger in UI:** "Générer les tâches du jour" button in ManagerView

---

## 14. Realtime Subscriptions

All subscriptions set up in `useSupabaseData()` via `supabase.channel()`.

| Channel | Table | Events | Handler |
|---------|-------|--------|---------|
| `tasks-changes` | tasks | INSERT, UPDATE, DELETE | In-place state update |
| `shifts-changes` | shifts | INSERT, UPDATE | Append or update shift |
| `products-changes` | products | INSERT, UPDATE, DELETE | In-place state update |
| `reports-changes` | day_reports | INSERT, UPDATE | Prepend or update report |
| `profiles-changes` | profiles | ALL | Full `fetchAll()` refetch |
| `temp-logs-changes` | temperature_logs | ALL | Full `fetchAll()` refetch |
| `objectives-changes` | team_objectives | ALL | Full `fetchAll()` refetch |
| `incidents-changes` | incidents | INSERT, UPDATE, DELETE | In-place state update |

**Additional subscriptions in components:**

| Component | Table | Events | Handler |
|-----------|-------|--------|---------|
| `NotificationBell` | notifications | INSERT | Increment unread, show toast |
| `MessagingModule` | messages | INSERT | Append new message in real-time |

**Realtime status indicator** in Dashboard header:
- `connected` → green pulse dot + "live"
- `connecting` → orange WifiOff icon + "Reconnecting…"
- `disconnected` → orange WifiOff icon + "Offline"

---

## 15. Scheduled Jobs (pg_cron)

| Job Name | Schedule (cron) | Function Called | Description |
|----------|-----------------|-----------------|-------------|
| `daily-report-22h` | `0 22 * * *` | `daily-report` edge function | End-of-day aggregate report |
| `generate-tasks-daily` | `1 0 * * *` | `generate_tasks_from_templates()` | Spawn today's recurring tasks at 00:01 |
| `update-objectives-progress` | `*/30 * * * *` | `update_objective_progress()` | Auto-update objective current values every 30 min |
| `spawn-recurring-orders` | `0 7 * * *` | `spawn_recurring_orders()` | Clone due recurring orders at 07:00 |

**Required PostgreSQL extensions:** `pg_cron`, `pg_net`

---

## 16. Gamification System

### Individual Score Events (score_events table)
| Event Type | Points | Trigger |
|------------|--------|---------|
| Task completed on time | +10 (`pointsOnTime`) | `completeTask()` before deadline |
| Task completed early | +12 (`pointsEarly`) | Before deadline with margin |
| With photo | +2 (`pointsWithPhoto`) | Photo attached on completion |
| Clock-in on time | +5 (`pointsClockIn`) | Clock-in at Station |
| Perfect day | +20 (`pointsPerfectDay`) | All tasks done by EOD |
| Task overdue | −5 (`penaltyOverdue`) | `trg_collective_penalty` trigger |
| Late clock-in | −8 (`penaltyLateClock`) | Station clock-in |
| No clock-in | −15 (`penaltyNoClock`) | EOD check |

### Manager Double-Malus
- When a manager receives a `penalty` score_event, `trg_manager_double_malus` fires
- Creates a second score_event for the same manager with same points + " (malus doublé manager)"
- **Exception:** role = 'chef' → NO double malus

### Collective Penalty
- When a task flips to 'overdue', `trg_collective_penalty` counts overdue tasks for that team today
- If count ≥ `collective_penalty_threshold` (default: 3): inserts a `collective_penalty` score_event for the whole team
- Only fires **once per team per day**

### Team Daily Bonus Pool (team_scores table)
- `base_bonus` = 100 (default, owner-configurable)
- `total_malus` = sum of malus_events for today
- `current_bonus` = base_bonus − total_malus (min 0)
- `completion_rate` = % tasks done

### Staff Rankings (get_staff_rankings RPC)
```sql
SELECT p.id, p.name, p.team, p.score,
  RANK() OVER (PARTITION BY p.team ORDER BY p.score DESC) AS team_rank,
  RANK() OVER (ORDER BY p.score DESC) AS overall_rank
FROM profiles p
WHERE EXISTS (SELECT 1 FROM user_roles WHERE user_id = p.id AND role = 'staff');
```
Shown in: Leaderboard, StaffView shift score card, OwnerDashboard top performers

---

## 17. Feature Status Matrix

### ✅ Fully Live (real DB + real business logic)

| Feature | Implementation |
|---------|---------------|
| Supabase Auth (email/password) | AuthContext + supabase.auth |
| App-level PIN login | AppContext + profiles.pin_hash |
| Station kiosk PIN | Station.tsx + profiles.station_pin_hash |
| User profiles CRUD | profiles table + saveProfile() |
| User roles | user_roles table, RLS helpers |
| Multi-team assignment | profile_teams table |
| Tasks (create, complete, delete, validate) | tasks table + saveTask() |
| Task templates (daily/weekly/custom) | task_templates table |
| Auto-generate tasks from templates | generate_tasks_from_templates() SQL + pg_cron 00:01 + Edge Function + UI button |
| Product catalogue CRUD | products table |
| Stock updates + logs | stock_logs table + saveStockLog() |
| Orders (full lifecycle) | orders + order_items + order_receipts |
| Recurring order auto-spawn | spawn_recurring_orders() SQL + pg_cron 07:00 |
| Clock-in/out (Station kiosk) | shifts table + clockAction() |
| Planning (manager shift grid) | planning_shifts table |
| Shift swap requests | shift_swap_requests table |
| Availability requests | availability_requests table + AvailabilityModule UI |
| Score events (bonus/penalty) | score_events table |
| profiles.score sync via trigger | sync_profile_score trigger AFTER INSERT on score_events |
| Manager double-malus | trg_manager_double_malus trigger, chef exempt |
| Collective penalty automation | trg_collective_penalty trigger on tasks status→overdue |
| Real staff rankings | get_staff_rankings() RPC with RANK() OVER |
| Top performer by real score | staffRankings sorted by score DESC |
| Malus contestation | malus_contests table + MalusContestModule |
| Gamification settings | gamification_settings table + OwnerSettings UI |
| Incidents (report, manage, resolve) | incidents table + IncidentModule |
| HACCP temp logs + locations | temperature_logs + temperature_locations tables |
| HACCP alert → auto incident | addTempLog() creates incident if is_alert=true |
| Objective auto-tracking | update_objective_progress() SQL + pg_cron */30 |
| Messaging (channels + @mentions) | messages table + Realtime |
| In-app notifications | notifications table + NotificationBell |
| Browser push notifications | useBrowserNotifications hook + Web Notifications API |
| Day reports (manual + auto 22h) | day_reports + daily-report edge function |
| Dark/Light mode toggle | Header button, localStorage, FOUC-free |
| Staff availability UI | AvailabilityModule: staff weekly grid + manager read-only |
| Report export PDF/CSV | EndOfDayReport ExportPanel: jsPDF + real DB data |
| Leaderboard | Leaderboard.tsx with real scores |
| Timesheets | TimesheetView.tsx |

### ⚠️ Partial / Limited
| Feature | Gap |
|---------|-----|
| Station planning integration | Clock-in/out works but no auto-check against planning_shifts |
| Objective auto-track metric values | DB function exists but `auto_track_metric` string values not standardized in UI (free-text) |
| HACCP alert incident verification | Fires toast but may need manual testing in production |

---

## 18. TypeScript Types

**File:** `src/types/index.ts` (284 lines)

### Core Entities
```typescript
type Team = 'BAR' | 'KITCHEN' | 'FLOOR' | 'ATELIER' | 'MANAGEMENT' | 'ALL';
type UserRole = 'owner' | 'admin' | 'manager' | 'chef' | 'staff';

interface User {
  id: string; name: string; role: UserRole; team: Team;
  teams?: Team[];        // multi-team support
  pin?: string;          // app PIN (never from DB)
  pinSet: boolean;
  stationPin?: string;   // clock-in PIN
  stationPinSet?: boolean;
  photo?: string;        // base64 or URL
  score?: number;
}

interface Task {
  id: string; templateId?: string; name: string; team: Team;
  assignedUserId?: string; assignedUserName?: string;
  deadline: Date; status: TaskStatus; validatedBy?: string; validatedAt?: Date;
  isRecurring: boolean; isPunctual: boolean;
  description?: string; createdAt: Date; createdBy: string; points?: number;
}

interface TaskTemplate {
  id: string; name: string; team: Team;
  frequency: 'daily' | 'weekly' | 'custom';
  days?: number[];  // 0=Sun, 1=Mon, ...
  time: string;     // HH:mm
  assignedUserId?: string; description?: string; points?: number;
}
```

### Gamification
```typescript
interface GamificationSettings {
  dailyBonusBase: number;     // 100
  malusPerLateTask: number;   // 10
  bonusResetTime: string;     // HH:mm
  pointsOnTime: number;       // 10
  pointsEarly: number;        // 12
  pointsWithPhoto: number;    // 2
  pointsClockIn: number;      // 5
  pointsPerfectDay: number;   // 20
  penaltyOverdue: number;     // 5
  penaltyLateClock: number;   // 8
  penaltyNoClock: number;     // 15
  collectivePenaltyThreshold: number;  // 3 (count of overdue tasks)
  collectivePenaltyPoints: number;     // 5
}

interface ScoreEvent {
  id: string; userId: string; userName: string; team: Team;
  type: 'bonus' | 'penalty' | 'collective_penalty';
  reason: string; points: number; timestamp: Date;
}

interface TeamScore {
  team: Team; baseBonus: number; totalMalus: number;
  currentBonus: number; malusEvents: MalusEvent[];
  date: string; completionRate?: number;
}
```

### Incidents & HACCP
```typescript
type IncidentType = 'Equipment failure' | 'Customer complaint' | 'Hygiene issue'
  | 'Accident / Injury' | 'Security concern' | 'Other';
type IncidentSeverity = 'low' | 'medium' | 'high';
type IncidentStatus = 'open' | 'in_progress' | 'resolved';
type IncidentLocation = 'Bar' | 'Kitchen' | 'Atelier' | 'Floor' | 'Other';

interface TemperatureLocation { id, name, minThreshold?, maxThreshold, isCustom, createdAt }
interface TemperatureLog { id, locationId, locationName, temperature, unit, isAlert, note?, loggedBy, createdAt }
```

### Products & Orders
```typescript
type ProductCategory = 'Red Wine' | 'White Wine' | ... (14 values)
type UnitType = 'btl' | 'pcs';
type StockStatus = 'healthy' | 'warning' | 'critical';
type StockUpdateReason = 'Delivery received' | 'Consumed' | 'Damaged' | 'Inventory correction';

interface Product { id, name, category, brand?, supplier?, supplierContact?,
  unit, currentStock, minThreshold, notes?, createdAt, updatedAt }
```

### DB Enums (Supabase)
| Enum | Values |
|------|--------|
| `team_name` | BAR, KITCHEN, FLOOR, ATELIER, MANAGEMENT, ALL |
| `user_role` | owner, admin, manager, chef, staff, god |
| `task_status` | pending, in_progress, done, overdue |
| `task_frequency` | daily, weekly, custom |
| `score_event_type` | bonus, penalty, collective_penalty |
| `stock_update_reason` | Delivery received, Consumed, Damaged, Inventory correction |
| `unit_type` | btl, pcs |
| `order_unit` | kg, g, L, cL, pcs, carton, caisse |
| `order_status` | draft, pending, validated, received, rejected |
| `report_trigger` | manual, auto |

---

## 19. Design System & Theming

### CSS Custom Properties (`src/index.css`)
The app uses a semantic token system with HSL values:
- `--background`, `--foreground` — page background + primary text
- `--card`, `--card-foreground` — surface backgrounds
- `--primary`, `--primary-foreground` — brand colour
- `--secondary`, `--muted`, `--accent` — supporting backgrounds
- `--destructive` — error/danger states
- `--border`, `--input`, `--ring` — interactive element strokes
- `--timer-safe`, `--timer-warning`, `--timer-danger` — task deadline countdown colours
- `--sidebar-*` — sidebar-specific tokens

### Team Badge Classes (`src/data/initialData.ts` + `src/index.css`)
```
TEAM_CSS mapping:
  BAR        → 'team-bar'
  KITCHEN    → 'team-kitchen'
  FLOOR      → 'team-floor'
  ATELIER    → 'team-atelier'
  MANAGEMENT → 'team-management'
  ALL        → 'team-all'
```

### Dark Mode
- Toggle: Sun/Moon button in Dashboard header
- Mechanism: `document.documentElement.classList.toggle('dark', ...)`
- Persistence: `localStorage.theme` ('dark' | 'light')
- FOUC prevention: Inline `<script>` in `index.html` reads localStorage before React renders
- Fallback: `prefers-color-scheme` media query

### Typography & Layout
- Max content width: `max-w-5xl mx-auto`
- Header: `sticky top-0 z-40 bg-card/95 backdrop-blur border-b`
- Cards: `glass-card` utility class (backdrop blur + subtle border)
- Animations: `animate-slide-up`, `animate-pulse`, `animate-pulse-danger`

---

## 20. Known Gaps & Next Steps

### Minor Gaps
| Gap | Notes |
|-----|-------|
| Station planning check | Clock-in doesn't validate against `planning_shifts` |
| `auto_track_metric` standardisation | UI allows free-text; should be a select of known metric types |
| Station PIN hashing | Currently uses `btoa()` (base64), not true bcrypt |
| Realtime for planning_shifts | No subscription on planning_shifts table — manager changes not instantly visible to staff |

### Recommended Next Features
1. **Station ↔ Planning integration** — validate clock-in against planned shift, flag unplanned clock-ins
2. **Push notification backend** — server-side notifications via edge function for incidents/mentions
3. **Photo upload on task completion** — wire `pointsWithPhoto` bonus; store in Supabase Storage
4. **Recurring order UI improvements** — show 🔄 badge on recurring orders + next_occurrence in list
5. **Standardise auto_track_metric** — replace free-text with dropdown (tasks_completed, score_average, etc.)
6. **PIN hashing** — use bcrypt via edge function for real security
7. **Export filter** — currently exports all data; add team filter to CSV/PDF

---

*End of CODEBASE_SUMMARY.md*
*Generated: 2026-02-19 — covers all implemented features as of the latest migrations*

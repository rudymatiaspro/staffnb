# APP_STATE.md — Staff&B Application State
> Generated: 2026-02-19 | Stack: React 18 + Vite + TypeScript + Tailwind CSS + Supabase (Lovable Cloud)

---

## Table of Contents
1. [Routes & Pages](#1-routes--pages)
2. [Authentication & Auth Flow](#2-authentication--auth-flow)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Database Tables (Supabase)](#4-database-tables-supabase)
5. [React Components](#5-react-components)
6. [Edge Functions](#6-edge-functions)
7. [Realtime Subscriptions](#7-realtime-subscriptions)
8. [Connected vs Mock/Placeholder](#8-connected-vs-mockplaceholder)
9. [Data Flow & Context](#9-data-flow--context)
10. [Scheduled Jobs](#10-scheduled-jobs)

---

## 1. Routes & Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/pages/Index.tsx` | Root — redirects to auth or dashboard |
| `/` (authenticated) | `src/pages/Dashboard.tsx` | Main app shell (role-aware: Owner / Manager / Staff) |
| `/station` | `src/pages/Station.tsx` | Clock-in/out kiosk (standalone, own AuthProvider + AppProvider) |
| `*` | `src/pages/NotFound.tsx` | 404 fallback |

### Sub-pages (rendered inside Dashboard via tabs, not separate routes)
- Login screen → `src/pages/Login.tsx` / `src/pages/AuthLogin.tsx`

---

## 2. Authentication & Auth Flow

### Layer 1 — Supabase Auth (email/password)
- Managed by `src/context/AuthContext.tsx`
- Methods: `signIn`, `signUp`, `signOut`
- Session persisted via Supabase JWT

### Layer 2 — App-level PIN login (staff identity)
- After Supabase auth, users pick their name and enter a 4-digit PIN
- Managed in `src/context/AppContext.tsx` (`currentUser` state)
- PINs are **hashed server-side** (`pin_hash` column in `profiles` table)
- Station PINs are **separate** (`station_pin_hash`) for the clock-in kiosk

### Auth Components
| Component | Purpose |
|-----------|---------|
| `src/components/auth/NameSelector.tsx` | List of users to pick from |
| `src/components/auth/PinEntry.tsx` | 4-digit PIN pad |
| `src/components/pins/PinManagement.tsx` | Manager/Owner interface to set/reset PINs |

---

## 3. User Roles & Permissions

### Roles (stored in `user_roles` table — never on `profiles`)

| Role | DB Value | Description |
|------|----------|-------------|
| God | `god` | Super-admin (Rudy), full access, bypasses all RLS |
| Owner | `owner` | Restaurant owner — all permissions including delete |
| Admin | `admin` | Same as owner except cannot delete the restaurant |
| Manager | `manager` | Manages own team tasks, planning, incidents, reports |
| Chef | `chef` | Like manager but scoped to kitchen/atelier, exempt from double-malus |
| Staff | `staff` | Basic access: own tasks, timesheet, messaging, incidents |

### DB Helper Functions (SECURITY DEFINER)

| Function | Returns | Used for |
|----------|---------|---------|
| `get_my_role()` | `user_role` | Current user's role |
| `get_my_team()` | `team_name` | Current user's primary team |
| `is_owner()` | `boolean` | owner OR admin |
| `is_admin()` | `boolean` | owner OR admin |
| `is_manager_or_owner()` | `boolean` | owner, admin, manager, chef |
| `can_manage_team(team)` | `boolean` | owner always; manager only for own team |

### Permission Matrix (UI level)

| Feature | Staff | Manager | Owner/Admin |
|---------|-------|---------|-------------|
| View own tasks | ✅ | ✅ | ✅ |
| Complete tasks | ✅ | ✅ | ✅ |
| Create tasks | ❌ | ✅ | ✅ |
| Delete tasks | ❌ | ✅ | ✅ |
| View catalogue | ✅ (read) | ✅ (read) | ✅ (full) |
| Manage products/stock | ❌ | ✅ | ✅ |
| View orders | ✅ | ✅ | ✅ |
| Manage orders | ❌ | ✅ | ✅ |
| View planning | ✅ (own) | ✅ (all) | ✅ (all) |
| Manage planning | ❌ | ✅ | ✅ |
| Request shift swap | ✅ | ✅ | ✅ |
| Approve shift swap | ❌ | ✅ | ✅ |
| Report incident | ✅ | ✅ | ✅ |
| Resolve incident | ❌ | ✅ | ✅ |
| Log HACCP temp | ✅ | ✅ | ✅ |
| Manage HACCP locations | ❌ | ✅ | ✅ |
| View objectives | ✅ | ✅ | ✅ |
| Manage objectives | ❌ | ✅ | ✅ |
| View leaderboard | ✅ | ✅ | ✅ |
| Add score events | ❌ | ✅ | ✅ |
| Contest a malus | ✅ | — | — |
| Resolve contestation | ❌ | ✅ | ✅ |
| View timesheets | ✅ (own) | ✅ (team) | ✅ (all) |
| Manage PINs | ❌ | ✅ | ✅ |
| View day reports | ❌ | ✅ | ✅ |
| Trigger close day | ❌ | ✅ | ✅ |
| Gamification settings | ❌ | ❌ | ✅ |
| Delete users/profiles | ❌ | ❌ | ✅ |
| Messaging (all channels) | ✅ | ✅ | ✅ |
| Delete messages | own only | ✅ | ✅ |

---

## 4. Database Tables (Supabase)

### `profiles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | = auth.uid() |
| `name` | text | Display name |
| `team` | team_name (enum) | Primary team |
| `pin_hash` | text | Bcrypt hash of app PIN |
| `pin_set` | boolean | Whether PIN has been configured |
| `station_pin_hash` | text | Bcrypt hash of station PIN |
| `station_pin_set` | boolean | Whether station PIN configured |
| `score` | integer | Cumulative gamification score |
| `photo_url` | text | Avatar URL |
| `created_at`, `updated_at` | timestamptz | Auto-managed |

### `user_roles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → profiles.id |
| `role` | user_role (enum) | owner / admin / manager / chef / staff / god |

### `profile_teams`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `profile_id` | uuid | FK → profiles.id |
| `team` | text | Additional team assignment (multi-team support) |
| `created_at` | timestamptz | — |

### `tasks`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `name` | text | Task name |
| `team` | team_name | Team scope |
| `status` | task_status | pending / in_progress / done / overdue |
| `deadline` | timestamptz | Due date/time |
| `assigned_user_id` | uuid | FK → profiles |
| `assigned_user_name` | text | Denormalized name |
| `template_id` | uuid | FK → task_templates |
| `is_recurring` | boolean | |
| `is_punctual` | boolean | |
| `points` | integer | Default 10 |
| `validated_by` | text | Name of validator |
| `validated_at` | timestamptz | |
| `description` | text | Optional |
| `created_by`, `created_at` | uuid / timestamptz | |

### `task_templates`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `name` | text | |
| `team` | team_name | |
| `frequency` | task_frequency | daily / weekly / custom |
| `days` | integer[] | 0=Sun…6=Sat |
| `time` | text | HH:mm |
| `points` | integer | Default 10 |
| `assigned_user_id` | uuid | Optional fixed assignee |
| `description` | text | |
| `created_by`, `created_at` | | |

### `products`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `name` | text | |
| `category` | text | ProductCategory string |
| `brand`, `supplier`, `supplier_contact` | text | |
| `unit` | unit_type | btl / pcs |
| `current_stock` | integer | |
| `min_threshold` | integer | Alert threshold |
| `notes` | text | |
| `created_at`, `updated_at` | timestamptz | |

### `stock_logs`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `product_id` | uuid | FK → products |
| `delta` | integer | +/- quantity change |
| `reason` | stock_update_reason | Delivery received / Consumed / Damaged / Inventory correction |
| `updated_by` | text | User name |
| `timestamp` | timestamptz | |

### `orders`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `order_number` | text | Unique reference |
| `supplier` | text | |
| `status` | order_status | draft / pending / validated / received / rejected |
| `created_by` | uuid | FK → profiles |
| `created_by_name` | text | Denormalized |
| `validated_by` | uuid | FK → profiles |
| `validated_by_name`, `validated_at` | | |
| `is_recurring` | boolean | |
| `recurrence_freq` | text | |
| `next_occurrence` | date | |
| `notes`, `rejection_reason` | text | |
| `created_at`, `updated_at` | | |

### `order_items`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `order_id` | uuid | FK → orders |
| `product_id` | uuid | FK → products (nullable) |
| `product_name` | text | Denormalized |
| `quantity` | numeric | |
| `unit` | order_unit | kg / g / L / cL / pcs / carton / caisse |
| `unit_price` | numeric | Optional |

### `order_receipts`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `order_id` | uuid | FK → orders |
| `received_by` | uuid | FK → profiles |
| `received_by_name` | text | |
| `received_at` | timestamptz | |
| `has_gap` | boolean | Discrepancy flag |
| `gap_note` | text | |

### `order_receipt_items`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `receipt_id` | uuid | FK → order_receipts |
| `order_item_id` | uuid | FK → order_items |
| `product_id` | uuid | FK → products |
| `product_name` | text | |
| `ordered_qty`, `received_qty` | numeric | |
| `unit` | order_unit | |

### `shifts` (clock-in/out)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `user_id` | uuid | FK → profiles |
| `user_name` | text | |
| `team` | team_name | |
| `clock_in` | timestamptz | |
| `clock_out` | timestamptz | Nullable |
| `total_minutes` | integer | Computed on clock-out |
| `date` | date | YYYY-MM-DD |

### `planning_shifts`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `user_id` | uuid | FK → profiles |
| `user_name` | text | |
| `team` | text | |
| `date` | date | |
| `shift_start`, `shift_end` | time | HH:mm |
| `shift_type` | text | matin / soir / coupure / repos / congés |
| `note` | text | |
| `created_by` | uuid | FK → profiles |

### `shift_swap_requests`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `requester_id` | uuid | FK → profiles |
| `requester_name` | text | |
| `shift_id` | uuid | FK → planning_shifts |
| `target_user_id` | uuid | FK → profiles (nullable for open requests) |
| `target_user_name` | text | |
| `target_shift_id` | uuid | FK → planning_shifts (nullable) |
| `status` | text | pending / approved / rejected |
| `note` | text | |
| `reviewed_by` | uuid | FK → profiles |
| `reviewed_by_name` | text | |
| `rejection_reason` | text | |

### `availability_requests`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `user_id` | uuid | FK → profiles |
| `user_name` | text | |
| `type` | text | day_off / availability |
| `date` | date | |
| `status` | text | pending / approved / rejected |
| `note` | text | |
| `reviewed_by`, `reviewed_at` | | |

### `score_events`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `user_id` | uuid | FK → profiles |
| `user_name` | text | |
| `team` | team_name | |
| `type` | score_event_type | bonus / penalty / collective_penalty |
| `reason` | text | |
| `points` | integer | + or - |
| `timestamp` | timestamptz | |

### `malus_events`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `team` | team_name | |
| `task_id` | uuid | FK → tasks |
| `task_name` | text | Denormalized |
| `points` | integer | Always negative |
| `timestamp` | timestamptz | |

### `malus_contests`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `contestant_id` | uuid | FK → profiles |
| `contestant_name` | text | |
| `score_event_id` | uuid | FK → score_events |
| `reason` | text | Staff's justification |
| `status` | text | pending / upheld / overturned |
| `arbiter_id` | uuid | FK → profiles |
| `arbiter_name` | text | |
| `arbiter_note` | text | |
| `resolved_at` | timestamptz | |

### `team_scores`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `team` | team_name | |
| `date` | date | YYYY-MM-DD |
| `base_bonus` | integer | Default 100 |
| `total_malus` | integer | Accumulated malus |
| `current_bonus` | integer | base_bonus - total_malus |
| `completion_rate` | numeric | 0-100 |

### `gamification_settings` (singleton)
| Column | Type | Default |
|--------|------|---------|
| `daily_bonus_base` | integer | 100 |
| `malus_per_late_task` | integer | 10 |
| `bonus_reset_time` | text | 23:30 |
| `points_on_time` | integer | 10 |
| `points_early` | integer | 12 |
| `points_with_photo` | integer | 2 |
| `points_clock_in` | integer | 5 |
| `points_perfect_day` | integer | 20 |
| `penalty_overdue` | integer | 5 |
| `penalty_late_clock` | integer | 8 |
| `penalty_no_clock` | integer | 15 |
| `collective_penalty_threshold` | integer | 70 (%) |
| `collective_penalty_points` | integer | 10 |

### `incidents`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `type` | text | Equipment failure / Customer complaint / Hygiene issue / Accident / Security concern / Other |
| `description` | text | |
| `location` | text | Bar / Kitchen / Atelier / Floor / Other |
| `severity` | text | low / medium / high |
| `team` | text | |
| `reporter_name` | text | Nullable if anonymous |
| `reporter_user_id` | uuid | Nullable |
| `anonymous` | boolean | |
| `status` | text | open / in_progress / resolved |
| `resolution_note` | text | |
| `resolved_by`, `resolved_at` | | |

### `temperature_locations`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `name` | text | e.g. "Frigo cuisine", "Congélateur bar" |
| `min_threshold` | numeric | Nullable |
| `max_threshold` | numeric | |
| `is_custom` | boolean | System vs user-created |

### `temperature_logs`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `location_id` | uuid | FK → temperature_locations |
| `location_name` | text | Denormalized |
| `temperature` | numeric | |
| `unit` | text | °C (default) |
| `is_alert` | boolean | Outside threshold |
| `note` | text | |
| `logged_by` | text | User name |
| `logged_by_user_id` | uuid | FK → profiles |

### `team_objectives`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `title` | text | |
| `description` | text | |
| `target_value`, `current_value` | numeric | |
| `unit` | text | e.g. %, covers, bottles |
| `team` | text | BAR / KITCHEN / ALL / etc. |
| `deadline` | date | |
| `auto_track` | boolean | Auto-update from metrics |
| `auto_track_metric` | text | |
| `completed_at` | timestamptz | |
| `created_by`, `created_by_user_id` | | |

### `messages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `channel` | text | general / bar / kitchen / floor / atelier / management |
| `content` | text | Message text |
| `sender_id` | uuid | FK → profiles |
| `sender_name` | text | Denormalized |
| `sender_team` | text | |
| `mentions` | text[] | Array of mentioned user IDs |
| `created_at` | timestamptz | |

### `notifications`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `user_id` | uuid | FK → profiles |
| `type` | text | mention / incident / daily_report / shift_swap / malus / etc. |
| `title` | text | |
| `body` | text | |
| `read` | boolean | Default false |
| `ref_id` | uuid | Referenced entity ID |
| `ref_type` | text | e.g. message / incident / day_report |
| `created_at` | timestamptz | |

### `day_reports`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `date` | date | |
| `generated_at` | timestamptz | |
| `triggered_by` | report_trigger | manual / auto |
| `triggered_by_user` | text | |
| `total_tasks`, `completed_tasks` | integer | |
| `team_completion_rates` | jsonb | { BAR: 80, KITCHEN: 60, … } |
| `staff_performance` | jsonb | Array of { name, points } |
| `stock_alerts` | jsonb | Array of low-stock products |
| `manager_notes` | text | Editable by manager |

### `day_close_states`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | |
| `date` | date | YYYY-MM-DD |
| `triggered` | boolean | |
| `triggered_at` | timestamptz | |
| `report_id` | uuid | FK → day_reports |
| `report_ready_at` | timestamptz | |

---

## 5. React Components

### Pages
| File | Description |
|------|-------------|
| `src/pages/Index.tsx` | App entry — auth gate |
| `src/pages/Dashboard.tsx` | Main shell: header + role-based view routing |
| `src/pages/Station.tsx` | Clock-in/out kiosk |
| `src/pages/Login.tsx` | Supabase email/password login |
| `src/pages/AuthLogin.tsx` | Auth login wrapper |
| `src/pages/NotFound.tsx` | 404 |

### Dashboard Views
| File | Roles | Tabs |
|------|-------|------|
| `src/components/dashboard/OwnerDashboard.tsx` | owner, admin | Overview, Board, Messages, Commandes, Scores, Contestations, Catalogue, Timesheets, Reports, Incidents, HACCP, Objectives, PINs, Settings |
| `src/components/dashboard/ManagerView.tsx` | manager, chef | Tasks, Planning, Commandes, Messages, Scores, Contestations, Activity, Catalogue, Timesheets, Reports, Incidents, HACCP, Objectives, PINs |
| `src/components/dashboard/StaffView.tsx` | staff | Tâches, Messages, Planning, Échanges, Commandes, Catalogue, Pointage, Incident, HACCP, Objectifs |
| `src/components/dashboard/OwnerSettings.tsx` | owner, admin | Gamification settings, restaurant config |

### Auth
| File | Description |
|------|-------------|
| `src/components/auth/NameSelector.tsx` | User selection screen |
| `src/components/auth/PinEntry.tsx` | 4-digit PIN pad |

### Tasks
| File | Description |
|------|-------------|
| `src/components/tasks/TaskCard.tsx` | Task card with complete/delete actions |
| `src/components/tasks/CreateTaskModal.tsx` | Modal to create punctual or recurring tasks |

### Planning
| File | Description |
|------|-------------|
| `src/components/planning/PlanningModule.tsx` | Manager weekly shift planner |
| `src/components/planning/StaffShiftsView.tsx` | Staff view of their upcoming shifts |
| `src/components/planning/ShiftSwapModule.tsx` | Request + approve shift swaps |

### Scoring & Gamification
| File | Description |
|------|-------------|
| `src/components/zones/BonusScoreCard.tsx` | Team daily bonus card with malus deductions |
| `src/components/leaderboard/Leaderboard.tsx` | Individual staff score leaderboard |
| `src/components/scoring/ScoreEventsView.tsx` | History of score events (bonus/penalty) |
| `src/components/scoring/MalusContestModule.tsx` | Staff contest / Manager resolve malus |

### Catalogue & Orders
| File | Description |
|------|-------------|
| `src/components/catalogue/ProductCatalogue.tsx` | Product inventory with stock management |
| `src/components/orders/OrdersModule.tsx` | Order creation, validation, receipt flow |

### Timesheets & Reports
| File | Description |
|------|-------------|
| `src/components/timesheets/TimesheetView.tsx` | Clock-in/out history per user |
| `src/components/reports/EndOfDayReport.tsx` | Day reports list + detail view |

### Incidents & HACCP
| File | Description |
|------|-------------|
| `src/components/incidents/IncidentModule.tsx` | Report + manage incidents |
| `src/components/haccp/HACCPModule.tsx` | HACCP temperature logging |

### Objectives & Messaging
| File | Description |
|------|-------------|
| `src/components/objectives/ObjectivesModule.tsx` | Team objectives with progress tracking |
| `src/components/messaging/MessagingModule.tsx` | Multi-channel messaging with @mentions |

### Notifications
| File | Description |
|------|-------------|
| `src/components/notifications/NotificationBell.tsx` | Header bell with unread badge + dropdown |
| `src/components/ui/ToastNotification.tsx` | In-app toast alerts |

### Management
| File | Description |
|------|-------------|
| `src/components/pins/PinManagement.tsx` | View/set/reset staff PINs |

### Shared UI (shadcn/ui)
> All standard shadcn components in `src/components/ui/`: accordion, alert, alert-dialog, avatar, badge, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toaster, toggle, toggle-group, tooltip

---

## 6. Edge Functions

| Function | Path | Trigger | Description |
|----------|------|---------|-------------|
| `daily-report` | `supabase/functions/daily-report/index.ts` | Cron (22:00 daily) + manual HTTP POST | Aggregates daily metrics, writes to `day_reports`, sends notifications |
| `ensure-god-user` | `supabase/functions/ensure-god-user/index.ts` | Manual HTTP POST | Creates/updates the `god` super-admin user |
| `generate-tasks-now` | `supabase/functions/generate-tasks-now/index.ts` | Manual (button) + Cron (00:01 daily) | Calls `generate_tasks_from_templates()` RPC to spawn today's tasks from active templates |

### Edge Function Details

#### `daily-report`
- Queries: `tasks`, `score_events`, `malus_events`, `incidents`, `products`, `orders`
- Writes to: `day_reports`, `day_close_states`, `notifications`
- Notifies: all users with role `owner` or `admin`
- Notification includes: task completion rate, top 3 performers, open incidents, orders summary, stock alerts, total malus

#### `ensure-god-user`
- Creates auth user if not exists
- Inserts into `profiles` and `user_roles` with role `god`
- Idempotent — safe to run multiple times

---

## 7. Realtime Subscriptions

The `useSupabaseData` hook (`src/integrations/supabase/hooks.ts`) subscribes to the following tables via Supabase Realtime:

| Table | Events | Action |
|-------|--------|--------|
| `tasks` | INSERT, UPDATE, DELETE | Update tasks state in-place |
| `shifts` | INSERT, UPDATE | Update shifts state |
| `products` | INSERT, UPDATE, DELETE | Update products state |
| `day_reports` | INSERT, UPDATE | Update reports list |
| `profiles` | ALL | Full refetch (fetchAll) |
| `incidents` | INSERT, UPDATE, DELETE | Update incidents state |
| `temperature_logs` | INSERT | Append new log |
| `team_objectives` | ALL | Update objectives state |

The `NotificationBell` also subscribes to:
| Table | Events | Action |
|-------|--------|--------|
| `notifications` | INSERT | Increment unread count, show toast |

The `MessagingModule` subscribes to:
| Table | Events | Action |
|-------|--------|--------|
| `messages` | INSERT | Append new message in real-time |

---

## 8. Connected vs Mock/Placeholder

### ✅ Fully Connected (real DB + business logic)

| Feature | Status |
|---------|--------|
| Authentication (Supabase Auth) | ✅ Live |
| PIN login (app-level, hashed) | ✅ Live |
| Station PIN (clock-in kiosk) | ✅ Live |
| User profiles (CRUD) | ✅ Live |
| User roles (separate table) | ✅ Live |
| Multi-team assignment | ✅ Live |
| Tasks (create, complete, delete, validate) | ✅ Live |
| Task templates (recurring, daily, weekly, custom) | ✅ Live |
| **Auto-generate tasks from templates** | ✅ Live — `generate_tasks_from_templates()` SQL function + pg_cron (00:01 daily) + Edge Function + manual button |
| Product catalogue (CRUD, stock update) | ✅ Live |
| Stock logs | ✅ Live |
| Orders (draft → pending → validated → received) | ✅ Live |
| Order receipt (quantity reconciliation) | ✅ Live |
| Clock-in / Clock-out (Station) | ✅ Live |
| Planning (manager shift grid) | ✅ Live |
| Shift swap requests | ✅ Live |
| Availability requests | ✅ Live (table + RLS) |
| Team scores & malus events | ✅ Live |
| Score events (bonus/penalty) | ✅ Live |
| **profiles.score sync via trigger** | ✅ Live — `sync_profile_score` trigger on `score_events` AFTER INSERT; `recalculate_all_scores()` run once |
| **Real staff rankings** | ✅ Live — `get_staff_rankings()` RPC with RANK() OVER (PARTITION BY team / globally); replaces hardcoded `teamRank=2` and `overallRank=4` |
| **Top performer by real score** | ✅ Live — `sort by realScore DESC` using `staffRankings` data from RPC |
| Malus contestation | ✅ Live |
| Gamification settings | ✅ Live |
| Incidents (report, manage, resolve) | ✅ Live |
| HACCP temperature logs + locations | ✅ Live |
| Team objectives | ✅ Live |
| Messaging (channels + @mentions) | ✅ Live |
| In-app notifications | ✅ Live |
| Browser push notifications | ✅ Live |
| Day reports (manual + auto 22h) | ✅ Live |
| Leaderboard (individual scores) | ✅ Live |
| Timesheets | ✅ Live |

### ⚠️ Partially Connected / Limited

| Feature | Status | Notes |
|---------|--------|-------|
| **Dark / Light mode toggle** | ✅ Live — Sun/Moon button in header, persists to `localStorage`, applies `dark` class on `<html>` |
| **Disponibilités staff (UI)** | ✅ Live — `StaffAvailabilityView` in StaffView "Dispos" tab; `ManagerAvailabilityView` in PlanningModule "Disponibilités" tab |
| **Report export PDF/CSV** | ✅ Live — `ExportPanel` in ReportsView fetches real tasks/rankings/incidents from DB; downloads `.csv` and `.pdf` via jsPDF + autotable |

### ⚠️ Partially Connected / Limited

| Feature | Status | Notes |
|---------|--------|-------|
| Station kiosk planning integration | ⚠️ Partial | Clock-in/out works, but auto-check against `planning_shifts` not wired |

### ❌ Not Yet Implemented (Placeholder / Missing)

| Feature | Status | Notes |
|---------|--------|-------|
| Double-malus for managers | ❌ Missing | DB trigger created but UI confirmation not wired |
| Chef exemption from double-malus | ❌ Missing | Role exists, trigger handles it, UI label not shown |
| Collective penalty automation | ❌ Missing | DB trigger created, threshold UI fields pending |
| Recurring orders auto-generation | ❌ Missing | DB function + pg_cron created, UI badge pending |
| HACCP alert → incident auto-creation | ❌ Missing | `addTempLog` fires toast but incident insert needs verification |
| Objective auto-tracking | ❌ Missing | DB function + pg_cron created, `auto_track_metric` values not standardized |

---

## 9. Data Flow & Context

### Context Architecture

```
App.tsx
├── QueryClientProvider (react-query — not heavily used, mostly direct hooks)
├── BrowserRouter
│   ├── Route "/"
│   │   └── Index → AuthContext + AppContext (combined in Index)
│   │       └── Dashboard
│   │           ├── OwnerDashboard
│   │           ├── ManagerView
│   │           └── StaffView
│   └── Route "/station"
│       ├── AuthProvider (standalone)
│       └── AppProvider (standalone)
│           └── Station
```

### `AuthContext` (`src/context/AuthContext.tsx`)
- Wraps Supabase auth session
- Exposes: `session`, `supabaseUser`, `loading`, `signIn`, `signUp`, `signOut`

### `AppContext` (`src/context/AppContext.tsx`)
- Master state for all app data
- Uses `useSupabaseData(enabled)` hook (enabled = when Supabase session exists)
- Exposes all entities: `users`, `tasks`, `templates`, `products`, `shifts`, `incidents`, `objectives`, etc.
- Also exposes all write operations: `saveTask`, `saveIncident`, `updateShift`, etc.
- Manages `currentUser` (the app-level logged-in user via PIN)

### `useSupabaseData` (`src/integrations/supabase/hooks.ts`)
- Single hook that fetches all 15 tables in parallel on init
- Sets up Supabase Realtime subscriptions for 9 tables
- Handles type mapping from DB rows (snake_case) to TypeScript types (camelCase)

---

## 10. Scheduled Jobs

| Job Name | Schedule | Function | Status |
|----------|----------|----------|--------|
| `daily-report-22h` | `0 22 * * *` (22:00 every day) | `daily-report` edge function | ✅ Scheduled via pg_cron |

### Extensions Required
- `pg_cron` — for cron scheduling (enabled via migration)
- `pg_net` — for HTTP calls from DB functions (enabled via migration)

---

## Enums (Supabase)

| Enum Name | Values |
|-----------|--------|
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
| `clock_event_type` | in, out |

---

*End of APP_STATE.md*

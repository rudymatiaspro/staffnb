
-- ════════════════════════════════════════════════════════════════
-- STAFF&B — Full Database Schema
-- ════════════════════════════════════════════════════════════════

-- ─── ENUMS ───────────────────────────────────────────────────────
CREATE TYPE public.user_role AS ENUM ('owner', 'manager', 'staff');
CREATE TYPE public.team_name AS ENUM ('BAR', 'KITCHEN', 'FLOOR', 'ATELIER', 'MANAGEMENT', 'ALL');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'done', 'overdue');
CREATE TYPE public.task_frequency AS ENUM ('daily', 'weekly', 'custom');
CREATE TYPE public.score_event_type AS ENUM ('bonus', 'penalty', 'collective_penalty');
CREATE TYPE public.stock_update_reason AS ENUM ('Delivery received', 'Consumed', 'Damaged', 'Inventory correction');
CREATE TYPE public.unit_type AS ENUM ('btl', 'pcs');
CREATE TYPE public.clock_event_type AS ENUM ('in', 'out');
CREATE TYPE public.report_trigger AS ENUM ('manual', 'auto');

-- ─── PROFILES ────────────────────────────────────────────────────
-- Mirrors auth.users; one row per authenticated user
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT '',
  team        public.team_name NOT NULL DEFAULT 'BAR',
  photo_url   TEXT,
  score       INTEGER NOT NULL DEFAULT 0,
  pin_hash    TEXT,     -- app login PIN (hashed)
  pin_set     BOOLEAN NOT NULL DEFAULT false,
  station_pin_hash TEXT, -- station clock-in PIN (hashed separately)
  station_pin_set  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ─── USER ROLES (separate table — no roles on profiles) ──────────
CREATE TABLE public.user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.user_role NOT NULL DEFAULT 'staff',
  UNIQUE (user_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ─── GAMIFICATION SETTINGS ───────────────────────────────────────
CREATE TABLE public.gamification_settings (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_bonus_base            INTEGER NOT NULL DEFAULT 100,
  malus_per_late_task         INTEGER NOT NULL DEFAULT 10,
  bonus_reset_time            TEXT NOT NULL DEFAULT '23:30',
  points_on_time              INTEGER NOT NULL DEFAULT 10,
  points_early                INTEGER NOT NULL DEFAULT 12,
  points_with_photo           INTEGER NOT NULL DEFAULT 2,
  points_clock_in             INTEGER NOT NULL DEFAULT 5,
  points_perfect_day          INTEGER NOT NULL DEFAULT 20,
  penalty_overdue             INTEGER NOT NULL DEFAULT 5,
  penalty_late_clock          INTEGER NOT NULL DEFAULT 8,
  penalty_no_clock            INTEGER NOT NULL DEFAULT 15,
  collective_penalty_threshold INTEGER NOT NULL DEFAULT 70,
  collective_penalty_points   INTEGER NOT NULL DEFAULT 10,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gamification_settings ENABLE ROW LEVEL SECURITY;
-- Seed one row of default settings
INSERT INTO public.gamification_settings DEFAULT VALUES;

-- ─── TASK TEMPLATES ──────────────────────────────────────────────
CREATE TABLE public.task_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  team             public.team_name NOT NULL DEFAULT 'ALL',
  frequency        public.task_frequency NOT NULL DEFAULT 'daily',
  days             INTEGER[],          -- 0=Sun … 6=Sat
  time             TEXT NOT NULL DEFAULT '09:00',
  assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  description      TEXT,
  points           INTEGER NOT NULL DEFAULT 10,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

-- ─── TASKS ───────────────────────────────────────────────────────
CREATE TABLE public.tasks (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id         UUID REFERENCES public.task_templates(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  team                public.team_name NOT NULL DEFAULT 'ALL',
  assigned_user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_user_name  TEXT,
  deadline            TIMESTAMPTZ NOT NULL,
  status              public.task_status NOT NULL DEFAULT 'pending',
  validated_by        TEXT,
  validated_at        TIMESTAMPTZ,
  is_recurring        BOOLEAN NOT NULL DEFAULT false,
  is_punctual         BOOLEAN NOT NULL DEFAULT false,
  description         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  points              INTEGER NOT NULL DEFAULT 10
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- ─── SCORE EVENTS ────────────────────────────────────────────────
CREATE TABLE public.score_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name   TEXT NOT NULL DEFAULT '',
  team        public.team_name NOT NULL DEFAULT 'BAR',
  type        public.score_event_type NOT NULL DEFAULT 'bonus',
  reason      TEXT NOT NULL DEFAULT '',
  points      INTEGER NOT NULL DEFAULT 0,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;

-- ─── TEAM SCORES (daily snapshot) ────────────────────────────────
CREATE TABLE public.team_scores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team             public.team_name NOT NULL,
  base_bonus       INTEGER NOT NULL DEFAULT 100,
  total_malus      INTEGER NOT NULL DEFAULT 0,
  current_bonus    INTEGER NOT NULL DEFAULT 100,
  date             DATE NOT NULL,
  completion_rate  NUMERIC(5,2),
  UNIQUE (team, date)
);
ALTER TABLE public.team_scores ENABLE ROW LEVEL SECURITY;

-- ─── MALUS EVENTS ────────────────────────────────────────────────
CREATE TABLE public.malus_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team        public.team_name NOT NULL,
  task_id     UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  task_name   TEXT NOT NULL DEFAULT '',
  points      INTEGER NOT NULL DEFAULT 0,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.malus_events ENABLE ROW LEVEL SECURITY;

-- ─── PRODUCTS ────────────────────────────────────────────────────
CREATE TABLE public.products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  category         TEXT NOT NULL,
  brand            TEXT,
  supplier         TEXT,
  supplier_contact TEXT,
  unit             public.unit_type NOT NULL DEFAULT 'pcs',
  current_stock    INTEGER NOT NULL DEFAULT 0,
  min_threshold    INTEGER NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ─── STOCK LOGS ──────────────────────────────────────────────────
CREATE TABLE public.stock_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  delta       INTEGER NOT NULL,
  reason      public.stock_update_reason NOT NULL DEFAULT 'Inventory correction',
  updated_by  TEXT NOT NULL DEFAULT '',
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_logs ENABLE ROW LEVEL SECURITY;

-- ─── SHIFTS ──────────────────────────────────────────────────────
CREATE TABLE public.shifts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name     TEXT NOT NULL DEFAULT '',
  team          public.team_name NOT NULL DEFAULT 'BAR',
  clock_in      TIMESTAMPTZ NOT NULL,
  clock_out     TIMESTAMPTZ,
  total_minutes INTEGER,
  date          DATE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- ─── DAY CLOSE STATE ─────────────────────────────────────────────
CREATE TABLE public.day_close_states (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE NOT NULL UNIQUE,
  triggered       BOOLEAN NOT NULL DEFAULT false,
  triggered_at    TIMESTAMPTZ,
  report_ready_at TIMESTAMPTZ,
  report_id       UUID
);
ALTER TABLE public.day_close_states ENABLE ROW LEVEL SECURITY;

-- ─── DAY REPORTS ─────────────────────────────────────────────────
CREATE TABLE public.day_reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                  DATE NOT NULL,
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_by          public.report_trigger NOT NULL DEFAULT 'auto',
  triggered_by_user     TEXT,
  manager_notes         TEXT,
  total_tasks           INTEGER NOT NULL DEFAULT 0,
  completed_tasks       INTEGER NOT NULL DEFAULT 0,
  team_completion_rates JSONB NOT NULL DEFAULT '{}',
  stock_alerts          JSONB NOT NULL DEFAULT '[]',
  staff_performance     JSONB NOT NULL DEFAULT '[]'
);
ALTER TABLE public.day_reports ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS (SECURITY DEFINER — bypass RLS safely)
-- ════════════════════════════════════════════════════════════════

-- Get the role of the current user
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Get the team of the current user
CREATE OR REPLACE FUNCTION public.get_my_team()
RETURNS public.team_name
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Check if current user is owner
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'owner'
  );
$$;

-- Check if current user is manager or owner
CREATE OR REPLACE FUNCTION public.is_manager_or_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
  );
$$;

-- Check if current user is manager or owner, OR the row belongs to the current user's team (for managers)
CREATE OR REPLACE FUNCTION public.can_manage_team(target_team public.team_name)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'owner')
    OR (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'manager')
      AND (SELECT team FROM public.profiles WHERE id = auth.uid()) = target_team
    );
$$;

-- ════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ════════════════════════════════════════════════════════════════

-- ── profiles ──────────────────────────────────────────────────
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "Owner/manager can update any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_manager_or_owner());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "Owner can delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_owner());

-- ── user_roles ────────────────────────────────────────────────
CREATE POLICY "Authenticated users can view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owner can manage all roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

-- ── gamification_settings ─────────────────────────────────────
CREATE POLICY "Anyone authenticated can view settings" ON public.gamification_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owner can update settings" ON public.gamification_settings
  FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

-- ── task_templates ────────────────────────────────────────────
CREATE POLICY "Authenticated users can view templates" ON public.task_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manager/owner can manage templates" ON public.task_templates
  FOR ALL TO authenticated USING (public.is_manager_or_owner()) WITH CHECK (public.is_manager_or_owner());

-- ── tasks ─────────────────────────────────────────────────────
CREATE POLICY "Owner sees all tasks" ON public.tasks
  FOR SELECT TO authenticated USING (public.is_owner());

CREATE POLICY "Manager sees team tasks" ON public.tasks
  FOR SELECT TO authenticated USING (
    public.is_manager_or_owner() OR assigned_user_id = auth.uid() OR
    (SELECT team FROM public.profiles WHERE id = auth.uid()) = team
  );

CREATE POLICY "Manager/owner can create tasks" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_owner());

CREATE POLICY "Manager/owner can update tasks, staff can update own" ON public.tasks
  FOR UPDATE TO authenticated USING (
    public.is_manager_or_owner() OR assigned_user_id = auth.uid()
  );

CREATE POLICY "Owner can delete tasks" ON public.tasks
  FOR DELETE TO authenticated USING (public.is_owner());

-- ── score_events ──────────────────────────────────────────────
CREATE POLICY "All authenticated can view score events" ON public.score_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manager/owner can insert score events" ON public.score_events
  FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_owner());

CREATE POLICY "Owner can manage score events" ON public.score_events
  FOR ALL TO authenticated USING (public.is_owner());

-- ── team_scores ───────────────────────────────────────────────
CREATE POLICY "All authenticated can view team scores" ON public.team_scores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manager/owner can manage team scores" ON public.team_scores
  FOR ALL TO authenticated USING (public.is_manager_or_owner()) WITH CHECK (public.is_manager_or_owner());

-- ── malus_events ──────────────────────────────────────────────
CREATE POLICY "All authenticated can view malus events" ON public.malus_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manager/owner can manage malus events" ON public.malus_events
  FOR ALL TO authenticated USING (public.is_manager_or_owner()) WITH CHECK (public.is_manager_or_owner());

-- ── products ──────────────────────────────────────────────────
CREATE POLICY "All authenticated can view products" ON public.products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manager/owner can manage products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_owner());

CREATE POLICY "Manager/owner can update products" ON public.products
  FOR UPDATE TO authenticated USING (public.is_manager_or_owner());

CREATE POLICY "Owner can delete products" ON public.products
  FOR DELETE TO authenticated USING (public.is_owner());

-- ── stock_logs ────────────────────────────────────────────────
CREATE POLICY "All authenticated can view stock logs" ON public.stock_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manager/owner can create stock logs" ON public.stock_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_owner());

CREATE POLICY "Owner can delete stock logs" ON public.stock_logs
  FOR DELETE TO authenticated USING (public.is_owner());

-- ── shifts ────────────────────────────────────────────────────
CREATE POLICY "Owner sees all shifts" ON public.shifts
  FOR SELECT TO authenticated USING (public.is_owner());

CREATE POLICY "Manager sees team shifts" ON public.shifts
  FOR SELECT TO authenticated USING (
    public.is_manager_or_owner()
    OR user_id = auth.uid()
    OR public.can_manage_team(team)
  );

CREATE POLICY "Anyone authenticated can insert shifts" ON public.shifts
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Owner/manager can update shifts" ON public.shifts
  FOR UPDATE TO authenticated USING (public.is_manager_or_owner() OR user_id = auth.uid());

CREATE POLICY "Owner can delete shifts" ON public.shifts
  FOR DELETE TO authenticated USING (public.is_owner());

-- ── day_close_states ──────────────────────────────────────────
CREATE POLICY "Manager/owner can view day close" ON public.day_close_states
  FOR SELECT TO authenticated USING (public.is_manager_or_owner());

CREATE POLICY "Manager/owner can manage day close" ON public.day_close_states
  FOR ALL TO authenticated USING (public.is_manager_or_owner()) WITH CHECK (public.is_manager_or_owner());

-- ── day_reports ───────────────────────────────────────────────
CREATE POLICY "Owner sees all reports" ON public.day_reports
  FOR SELECT TO authenticated USING (public.is_owner());

CREATE POLICY "Manager sees reports" ON public.day_reports
  FOR SELECT TO authenticated USING (public.is_manager_or_owner());

CREATE POLICY "Manager/owner can create reports" ON public.day_reports
  FOR INSERT TO authenticated WITH CHECK (public.is_manager_or_owner());

CREATE POLICY "Manager/owner can update reports" ON public.day_reports
  FOR UPDATE TO authenticated USING (public.is_manager_or_owner());

CREATE POLICY "Owner can delete reports" ON public.day_reports
  FOR DELETE TO authenticated USING (public.is_owner());

-- ════════════════════════════════════════════════════════════════
-- REALTIME
-- ════════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shifts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.score_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.day_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.day_close_states;

-- ════════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGER
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ════════════════════════════════════════════════════════════════
-- AUTO-CREATE PROFILE ON SIGN UP
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email, 'New User'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

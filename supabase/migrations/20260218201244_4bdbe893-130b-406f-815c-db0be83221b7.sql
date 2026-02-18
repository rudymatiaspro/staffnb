
-- ═══════════════════════════════════════
-- MODULE 3: INCIDENT REPORTS
-- ═══════════════════════════════════════
CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  description text NOT NULL,
  location text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  team text NOT NULL,
  reporter_name text,
  reporter_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  anonymous boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  resolution_note text,
  resolved_by text,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- All authenticated can view incidents relevant to them
CREATE POLICY "Staff can view own incidents" ON public.incidents
  FOR SELECT TO authenticated USING (reporter_user_id = auth.uid() OR is_manager_or_owner());

CREATE POLICY "Authenticated can insert incidents" ON public.incidents
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Manager/owner can update incidents" ON public.incidents
  FOR UPDATE TO authenticated USING (is_manager_or_owner());

CREATE POLICY "Owner can delete incidents" ON public.incidents
  FOR DELETE TO authenticated USING (is_owner());

-- ═══════════════════════════════════════
-- MODULE 4: HACCP TEMPERATURE LOCATIONS + LOGS
-- ═══════════════════════════════════════
CREATE TABLE public.temperature_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  min_threshold numeric,
  max_threshold numeric NOT NULL,
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.temperature_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view locations" ON public.temperature_locations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manager/owner can manage locations" ON public.temperature_locations
  FOR ALL TO authenticated USING (is_manager_or_owner()) WITH CHECK (is_manager_or_owner());

CREATE TABLE public.temperature_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.temperature_locations(id) ON DELETE CASCADE,
  location_name text NOT NULL,
  temperature numeric NOT NULL,
  unit text NOT NULL DEFAULT '°C',
  is_alert boolean NOT NULL DEFAULT false,
  note text,
  logged_by text NOT NULL,
  logged_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.temperature_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view temp logs" ON public.temperature_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated can insert temp logs" ON public.temperature_logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Manager/owner can update temp logs" ON public.temperature_logs
  FOR UPDATE TO authenticated USING (is_manager_or_owner());

CREATE POLICY "Owner can delete temp logs" ON public.temperature_logs
  FOR DELETE TO authenticated USING (is_owner());

-- Seed default temperature locations
INSERT INTO public.temperature_locations (name, min_threshold, max_threshold, is_custom) VALUES
  ('Fridge 1 (Bar)', NULL, 4, false),
  ('Fridge 2 (Kitchen)', NULL, 4, false),
  ('Freezer (Kitchen)', NULL, -18, false),
  ('Wine Cellar', 10, 16, false);

-- ═══════════════════════════════════════
-- MODULE 5: TEAM OBJECTIVES
-- ═══════════════════════════════════════
CREATE TABLE public.team_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  target_value numeric NOT NULL,
  current_value numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT '%',
  team text NOT NULL DEFAULT 'ALL',
  deadline date NOT NULL,
  auto_track boolean NOT NULL DEFAULT false,
  auto_track_metric text,
  created_by text,
  created_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.team_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view objectives" ON public.team_objectives
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manager/owner can manage objectives" ON public.team_objectives
  FOR ALL TO authenticated USING (is_manager_or_owner()) WITH CHECK (is_manager_or_owner());

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER incidents_updated_at BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER objectives_updated_at BEFORE UPDATE ON public.team_objectives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─── Table: rooms (salles dynamiques) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,                   -- display name, e.g. "Bar"
  team_key    text NOT NULL UNIQUE,            -- internal key, e.g. "BAR"
  color       text NOT NULL DEFAULT 'blue',    -- colour hint for UI
  display_order integer NOT NULL DEFAULT 0,
  is_system   boolean NOT NULL DEFAULT false,  -- system rooms cannot be deleted
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view rooms
CREATE POLICY "All authenticated can view rooms"
  ON public.rooms FOR SELECT
  USING (true);

-- Only owner/admin can manage rooms
CREATE POLICY "Owner/admin can manage rooms"
  ON public.rooms FOR ALL
  USING (is_owner())
  WITH CHECK (is_owner());

-- Updated_at trigger
CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Seed default rooms (system rooms) ───────────────────────────────────────
INSERT INTO public.rooms (name, team_key, color, display_order, is_system) VALUES
  ('Bar',        'BAR',        'orange',  1, true),
  ('Cuisine',    'KITCHEN',    'red',     2, true),
  ('Salle',      'FLOOR',      'blue',    3, true),
  ('Atelier',    'ATELIER',    'purple',  4, true),
  ('Direction',  'MANAGEMENT', 'slate',   5, true)
ON CONFLICT (team_key) DO NOTHING;

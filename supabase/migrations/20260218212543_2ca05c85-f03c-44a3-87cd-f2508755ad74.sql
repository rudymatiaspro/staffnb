
-- Planning shifts table
CREATE TABLE IF NOT EXISTS public.planning_shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL,
  shift_type text NOT NULL CHECK (shift_type IN ('morning', 'evening', 'custom')),
  shift_start time NOT NULL DEFAULT '07:00',
  shift_end time NOT NULL DEFAULT '15:30',
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL DEFAULT '',
  team text NOT NULL DEFAULT 'BAR',
  note text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.planning_shifts ENABLE ROW LEVEL SECURITY;

-- All authenticated can view planning
CREATE POLICY "All authenticated can view planning"
  ON public.planning_shifts FOR SELECT
  USING (true);

-- Manager/owner can manage planning
CREATE POLICY "Manager/owner can manage planning"
  ON public.planning_shifts FOR ALL
  USING (is_manager_or_owner())
  WITH CHECK (is_manager_or_owner());

-- Staff can view their own planning
CREATE POLICY "Staff can view own planning"
  ON public.planning_shifts FOR SELECT
  USING ((user_id = auth.uid()) OR is_manager_or_owner());

-- Updated_at trigger
CREATE TRIGGER update_planning_shifts_updated_at
  BEFORE UPDATE ON public.planning_shifts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.planning_shifts;

-- Create profile_teams junction table for multi-team support
CREATE TABLE public.profile_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (profile_id, team)
);

ALTER TABLE public.profile_teams ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view team assignments
CREATE POLICY "All authenticated can view profile_teams"
ON public.profile_teams
FOR SELECT
USING (true);

-- Managers/owners can manage team assignments
CREATE POLICY "Manager/owner can manage profile_teams"
ON public.profile_teams
FOR ALL
USING (is_manager_or_owner())
WITH CHECK (is_manager_or_owner());

-- Populate profile_teams from existing profiles.team column
INSERT INTO public.profile_teams (profile_id, team)
SELECT id, team::text FROM public.profiles
ON CONFLICT (profile_id, team) DO NOTHING;

-- Enable realtime for profile_teams
ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_teams;
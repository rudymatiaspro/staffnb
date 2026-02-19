
-- ================================================================
-- FIX 2: Sync profiles.score via trigger on score_events
-- ================================================================

-- Trigger function
CREATE OR REPLACE FUNCTION public.sync_profile_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'bonus' THEN
    UPDATE public.profiles
    SET score = score + NEW.points
    WHERE id = NEW.user_id;

  ELSIF NEW.type = 'penalty' THEN
    UPDATE public.profiles
    SET score = GREATEST(score - NEW.points, 0)
    WHERE id = NEW.user_id;

  ELSIF NEW.type = 'collective_penalty' THEN
    UPDATE public.profiles
    SET score = GREATEST(score - NEW.points, 0)
    WHERE team = NEW.team;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop if exists then recreate
DROP TRIGGER IF EXISTS sync_profile_score_trigger ON public.score_events;

CREATE TRIGGER sync_profile_score_trigger
AFTER INSERT ON public.score_events
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_score();

-- ================================================================
-- One-time recalculation: replay all score_events into profiles.score
-- ================================================================

CREATE OR REPLACE FUNCTION public.recalculate_all_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  evt RECORD;
BEGIN
  -- Reset all scores to 0
  UPDATE public.profiles SET score = 0;

  -- Replay in chronological order
  FOR evt IN
    SELECT * FROM public.score_events ORDER BY timestamp ASC
  LOOP
    IF evt.type = 'bonus' THEN
      UPDATE public.profiles
      SET score = score + evt.points
      WHERE id = evt.user_id;

    ELSIF evt.type = 'penalty' THEN
      UPDATE public.profiles
      SET score = GREATEST(score - evt.points, 0)
      WHERE id = evt.user_id;

    ELSIF evt.type = 'collective_penalty' THEN
      UPDATE public.profiles
      SET score = GREATEST(score - evt.points, 0)
      WHERE team = evt.team;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_all_scores() TO authenticated;

-- Run immediately to sync existing data
SELECT public.recalculate_all_scores();

-- ================================================================
-- FIX 3: get_staff_rankings() RPC
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_staff_rankings()
RETURNS TABLE (
  user_id     UUID,
  name        TEXT,
  team        TEXT,
  score       INTEGER,
  team_rank   BIGINT,
  overall_rank BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id            AS user_id,
    p.name,
    p.team::TEXT,
    p.score,
    RANK() OVER (PARTITION BY p.team ORDER BY p.score DESC) AS team_rank,
    RANK() OVER (ORDER BY p.score DESC)                     AS overall_rank
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id AND ur.role = 'staff'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_rankings() TO authenticated;

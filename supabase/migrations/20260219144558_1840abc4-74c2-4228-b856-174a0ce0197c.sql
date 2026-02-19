
-- =========================================================
-- FIX 4: Manager double-malus trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.apply_manager_double_malus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF NEW.type <> 'penalty' THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_role
  FROM public.user_roles
  WHERE user_id = NEW.user_id
  LIMIT 1;

  IF v_role = 'manager' THEN
    INSERT INTO public.score_events (
      user_id, user_name, team, type, reason, points, timestamp
    ) VALUES (
      NEW.user_id,
      NEW.user_name,
      NEW.team,
      'penalty',
      NEW.reason || ' (malus doublé manager)',
      NEW.points,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_manager_double_malus ON public.score_events;

CREATE TRIGGER trg_manager_double_malus
AFTER INSERT ON public.score_events
FOR EACH ROW
EXECUTE FUNCTION public.apply_manager_double_malus();


-- =========================================================
-- FIX 5: Collective penalty automation trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.check_collective_penalty()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_threshold INT;
  v_points INT;
  v_overdue_count INT;
  v_existing INT;
  v_any_user_id UUID;
BEGIN
  IF NEW.status <> 'overdue' OR OLD.status = 'overdue' THEN
    RETURN NEW;
  END IF;

  IF NEW.team::TEXT = 'ALL' THEN
    RETURN NEW;
  END IF;

  SELECT collective_penalty_threshold, collective_penalty_points
  INTO v_threshold, v_points
  FROM public.gamification_settings
  LIMIT 1;

  v_threshold := COALESCE(v_threshold, 3);
  v_points := COALESCE(v_points, 5);

  SELECT COUNT(*) INTO v_overdue_count
  FROM public.tasks
  WHERE status = 'overdue'
    AND team = NEW.team
    AND DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE;

  IF v_overdue_count < v_threshold THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_existing
  FROM public.score_events
  WHERE type = 'collective_penalty'
    AND team = NEW.team
    AND DATE(timestamp AT TIME ZONE 'UTC') = CURRENT_DATE;

  IF v_existing > 0 THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_any_user_id
  FROM public.profiles
  WHERE team = NEW.team
  LIMIT 1;

  IF v_any_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.score_events (
    user_id, user_name, team, type, reason, points, timestamp
  ) VALUES (
    v_any_user_id,
    'SYSTEM',
    NEW.team,
    'collective_penalty',
    'Pénalité collective — seuil de tâches en retard atteint',
    v_points,
    NOW()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_collective_penalty ON public.tasks;

CREATE TRIGGER trg_collective_penalty
AFTER UPDATE OF status ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.check_collective_penalty();


-- =========================================================
-- FIX 7: Objective auto-tracking function
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_objective_progress()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  obj RECORD;
  v_value NUMERIC := 0;
BEGIN
  FOR obj IN SELECT * FROM public.team_objectives WHERE auto_track = true LOOP

    v_value := 0;

    IF obj.auto_track_metric = 'tasks_completed' THEN
      SELECT COUNT(*) INTO v_value
      FROM public.tasks
      WHERE status = 'done'
        AND (team::TEXT = obj.team OR obj.team = 'ALL')
        AND DATE(created_at AT TIME ZONE 'UTC') = CURRENT_DATE;

    ELSIF obj.auto_track_metric = 'incidents_resolved' THEN
      SELECT COUNT(*) INTO v_value
      FROM public.incidents
      WHERE status = 'resolved'
        AND (team = obj.team OR obj.team = 'ALL')
        AND created_at >= date_trunc('week', NOW());

    ELSIF obj.auto_track_metric = 'score_average' THEN
      IF obj.team = 'ALL' THEN
        SELECT COALESCE(AVG(p.score), 0) INTO v_value FROM public.profiles p;
      ELSE
        SELECT COALESCE(AVG(p.score), 0) INTO v_value FROM public.profiles p WHERE p.team::TEXT = obj.team;
      END IF;

    ELSIF obj.auto_track_metric = 'orders_validated' THEN
      SELECT COUNT(*) INTO v_value
      FROM public.orders
      WHERE status IN ('validated', 'received')
        AND created_at >= date_trunc('week', NOW());
    END IF;

    UPDATE public.team_objectives
    SET
      current_value = v_value,
      completed_at = CASE
        WHEN v_value >= obj.target_value AND obj.completed_at IS NULL THEN NOW()
        ELSE obj.completed_at
      END,
      updated_at = NOW()
    WHERE id = obj.id;

  END LOOP;
END;
$$;


-- =========================================================
-- FIX 8: Recurring orders — add parent_order_id column
-- =========================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS parent_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.spawn_recurring_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  orig RECORD;
  new_order_id UUID;
  next_occ DATE;
BEGIN
  FOR orig IN
    SELECT * FROM public.orders
    WHERE is_recurring = true
      AND next_occurrence IS NOT NULL
      AND next_occurrence <= CURRENT_DATE
      AND status NOT IN ('rejected')
  LOOP
    INSERT INTO public.orders (
      order_number, supplier, status, created_by, created_by_name,
      notes, is_recurring, recurrence_freq, next_occurrence,
      parent_order_id, created_at, updated_at
    )
    VALUES (
      orig.order_number || '-R-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD'),
      orig.supplier,
      'draft',
      orig.created_by,
      orig.created_by_name,
      orig.notes,
      false,
      null,
      null,
      orig.id,
      NOW(),
      NOW()
    )
    RETURNING id INTO new_order_id;

    INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit, unit_price, created_at)
    SELECT new_order_id, product_id, product_name, quantity, unit, unit_price, NOW()
    FROM public.order_items
    WHERE order_id = orig.id;

    IF orig.recurrence_freq = 'daily' THEN
      next_occ := orig.next_occurrence + INTERVAL '1 day';
    ELSIF orig.recurrence_freq = 'weekly' THEN
      next_occ := orig.next_occurrence + INTERVAL '7 days';
    ELSIF orig.recurrence_freq = 'monthly' THEN
      next_occ := orig.next_occurrence + INTERVAL '1 month';
    ELSE
      next_occ := orig.next_occurrence + INTERVAL '7 days';
    END IF;

    UPDATE public.orders
    SET next_occurrence = next_occ, updated_at = NOW()
    WHERE id = orig.id;
  END LOOP;
END;
$$;

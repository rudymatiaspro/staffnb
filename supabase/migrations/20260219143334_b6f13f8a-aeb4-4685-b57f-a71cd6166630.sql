
-- ================================================================
-- FIX 1: Auto-generate tasks from templates
-- ================================================================

CREATE OR REPLACE FUNCTION public.generate_tasks_from_templates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tmpl RECORD;
  today_date DATE := CURRENT_DATE;
  today_dow  INTEGER := EXTRACT(DOW FROM CURRENT_DATE); -- 0=Sun..6=Sat
  deadline_ts TIMESTAMPTZ;
  existing_count INTEGER;
  assignee_name TEXT;
BEGIN
  FOR tmpl IN SELECT * FROM public.task_templates LOOP

    -- Frequency check
    IF tmpl.frequency = 'daily' THEN
      -- always spawn
      NULL;
    ELSIF tmpl.frequency = 'weekly' THEN
      -- days[] contains weekday numbers (0=Sun..6=Sat)
      IF tmpl.days IS NULL OR NOT (today_dow = ANY(tmpl.days)) THEN
        CONTINUE;
      END IF;
    ELSIF tmpl.frequency = 'custom' THEN
      -- days[] contains day-of-month numbers for custom schedules
      IF tmpl.days IS NULL OR NOT (EXTRACT(DAY FROM today_date)::INTEGER = ANY(tmpl.days)) THEN
        CONTINUE;
      END IF;
    ELSE
      CONTINUE;
    END IF;

    -- Duplicate check: a task with same template_id already created today
    SELECT COUNT(*) INTO existing_count
    FROM public.tasks
    WHERE template_id = tmpl.id
      AND DATE(created_at AT TIME ZONE 'UTC') = today_date;

    IF existing_count > 0 THEN
      CONTINUE;
    END IF;

    -- Build deadline: today + time from template (HH:mm)
    BEGIN
      deadline_ts := (today_date::TEXT || ' ' || tmpl.time || ':00')::TIMESTAMPTZ;
    EXCEPTION WHEN OTHERS THEN
      deadline_ts := today_date::TIMESTAMPTZ + INTERVAL '09:00';
    END;

    -- Resolve assignee name
    assignee_name := NULL;
    IF tmpl.assigned_user_id IS NOT NULL THEN
      SELECT name INTO assignee_name
      FROM public.profiles
      WHERE id = tmpl.assigned_user_id
      LIMIT 1;
    END IF;

    -- Insert new task
    INSERT INTO public.tasks (
      name, team, status, deadline,
      assigned_user_id, assigned_user_name,
      template_id, is_recurring, points, description,
      created_by, created_at, is_punctual
    ) VALUES (
      tmpl.name,
      tmpl.team,
      'pending',
      deadline_ts,
      tmpl.assigned_user_id,
      assignee_name,
      tmpl.id,
      TRUE,
      tmpl.points,
      tmpl.description,
      NULL,
      now(),
      FALSE
    );

  END LOOP;
END;
$$;

-- Grant execute to authenticated users (managers call via RPC)
GRANT EXECUTE ON FUNCTION public.generate_tasks_from_templates() TO authenticated;

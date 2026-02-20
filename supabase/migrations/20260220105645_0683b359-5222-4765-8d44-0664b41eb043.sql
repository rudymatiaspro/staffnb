
-- ══════════════════════════════════════════════════════════════════
-- FIX 1: God/Admin must bypass restaurant_id filter on ALL tables
-- ══════════════════════════════════════════════════════════════════

-- Helper function: is current user god or admin?
CREATE OR REPLACE FUNCTION public.is_god_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('god', 'admin')
  );
$$;

-- Update is_manager_or_owner to include god/admin
CREATE OR REPLACE FUNCTION public.is_manager_or_owner()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('manager', 'owner', 'god', 'admin')
  )
$$;

-- Update is_owner to include god/admin
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'god', 'admin')
  )
$$;

-- ══════════════════════════════════════════════════════════════════
-- FIX 2: profiles - god/admin can see ALL profiles regardless of restaurant
-- ══════════════════════════════════════════════════════════════════

-- Drop the restrictive restaurant-scoped SELECT policy
DROP POLICY IF EXISTS "profiles_select_same_restaurant" ON public.profiles;

-- Replace: authenticated users see profiles of same restaurant OR god/admin see all
CREATE POLICY "profiles_select_same_restaurant"
ON public.profiles FOR SELECT
USING (
  is_god_or_admin()
  OR restaurant_id = get_user_restaurant_id()
  OR id = auth.uid()
);

-- ══════════════════════════════════════════════════════════════════
-- FIX 3: tasks - god/admin can see ALL tasks regardless of restaurant
-- ══════════════════════════════════════════════════════════════════

-- Drop existing overly restrictive policies and recreate
DROP POLICY IF EXISTS "All authenticated can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Manager/owner can manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "Staff can view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

CREATE POLICY "tasks_select"
ON public.tasks FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (
    is_god_or_admin()
    OR restaurant_id = get_user_restaurant_id()
    OR assigned_user_id = auth.uid()
  )
);

CREATE POLICY "tasks_insert"
ON public.tasks FOR INSERT
WITH CHECK (
  is_manager_or_owner()
);

CREATE POLICY "tasks_update"
ON public.tasks FOR UPDATE
USING (
  is_manager_or_owner() OR assigned_user_id = auth.uid()
);

CREATE POLICY "tasks_delete"
ON public.tasks FOR DELETE
USING (is_owner());

-- ══════════════════════════════════════════════════════════════════
-- FIX 4: planning_shifts - god/admin see all
-- ══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "All authenticated can view planning" ON public.planning_shifts;
DROP POLICY IF EXISTS "Staff can view own planning" ON public.planning_shifts;

CREATE POLICY "planning_select"
ON public.planning_shifts FOR SELECT
USING (
  is_god_or_admin()
  OR user_id = auth.uid()
  OR is_manager_or_owner()
);

-- ══════════════════════════════════════════════════════════════════
-- FIX 5: daily_menu_items - god/admin see all
-- ══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "All authenticated can view menu" ON public.daily_menu_items;
DROP POLICY IF EXISTS "Manager/owner can manage menu" ON public.daily_menu_items;

CREATE POLICY "menu_select"
ON public.daily_menu_items FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "menu_manage"
ON public.daily_menu_items FOR ALL
USING (is_manager_or_owner())
WITH CHECK (is_manager_or_owner());

-- ══════════════════════════════════════════════════════════════════
-- FIX 6: shifts - god/admin see all, fix restaurant filter
-- ══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "shifts_select_same_restaurant" ON public.shifts;

CREATE POLICY "shifts_select_same_restaurant"
ON public.shifts FOR SELECT
USING (
  is_god_or_admin()
  OR restaurant_id = get_user_restaurant_id()
  OR user_id = auth.uid()
);

-- ══════════════════════════════════════════════════════════════════
-- FIX 7: messages - ensure god/admin can send/view
-- ══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "All authenticated can insert messages" ON public.messages;
DROP POLICY IF EXISTS "All authenticated can view messages" ON public.messages;

CREATE POLICY "messages_select"
ON public.messages FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "messages_insert"
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND sender_id = auth.uid()
);

-- ══════════════════════════════════════════════════════════════════
-- FIX 8: Insert menu items for TODAY (2026-02-20) so they appear
-- ══════════════════════════════════════════════════════════════════

INSERT INTO public.daily_menu_items (name, category, status, portions_left, display_order, date, restaurant_id)
SELECT name, category, status, portions_left, display_order, CURRENT_DATE, restaurant_id
FROM public.daily_menu_items
WHERE date = '2026-02-19'
ON CONFLICT DO NOTHING;

-- ══════════════════════════════════════════════════════════════════
-- FIX 9: task_templates - god/admin see all
-- ══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can view templates" ON public.task_templates;
DROP POLICY IF EXISTS "Manager/owner can manage templates" ON public.task_templates;

CREATE POLICY "templates_select"
ON public.task_templates FOR SELECT
USING (
  is_god_or_admin()
  OR restaurant_id = get_user_restaurant_id()
  OR restaurant_id IS NULL
);

CREATE POLICY "templates_manage"
ON public.task_templates FOR ALL
USING (is_manager_or_owner())
WITH CHECK (is_manager_or_owner());

-- ══════════════════════════════════════════════════════════════════
-- FIX 10: products - already public, ensure god/admin can manage
-- ══════════════════════════════════════════════════════════════════

-- score_events, malus_events - already open, keep

-- ══════════════════════════════════════════════════════════════════
-- FIX 11: notifications - god/admin can insert for any user
-- ══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "notifications_insert"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

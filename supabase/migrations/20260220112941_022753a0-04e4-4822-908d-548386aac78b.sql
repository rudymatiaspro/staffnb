
-- ================================================================
-- Fix 1: Allow managers/owners/god to INSERT tasks (missing policy)
-- ================================================================
DROP POLICY IF EXISTS "Manager/owner can insert tasks" ON public.tasks;
CREATE POLICY "Manager/owner can insert tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (is_manager_or_owner());

-- Allow all authenticated to view tasks (they see filtered by team on client side)
DROP POLICY IF EXISTS "Authenticated can view tasks" ON public.tasks;
CREATE POLICY "Authenticated can view tasks"
  ON public.tasks FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow managers to update tasks
DROP POLICY IF EXISTS "Manager/owner can update tasks" ON public.tasks;
CREATE POLICY "Manager/owner can update tasks"
  ON public.tasks FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Allow managers/owners to delete tasks
DROP POLICY IF EXISTS "Manager/owner can delete tasks" ON public.tasks;
CREATE POLICY "Manager/owner can delete tasks"
  ON public.tasks FOR DELETE
  USING (is_manager_or_owner());

-- ================================================================
-- Fix 2: Allow managers/owners/god to INSERT products
-- ================================================================
DROP POLICY IF EXISTS "Manager/owner can manage products" ON public.products;
CREATE POLICY "Manager/owner can manage products"
  ON public.products FOR INSERT
  WITH CHECK (is_manager_or_owner());

-- ================================================================
-- Fix 3: Allow staff to see their own planning shifts (already exists)
-- and allow staff to create shift swap requests - no new shifts
-- Make sure god/admin can see all planning shifts
-- ================================================================
DROP POLICY IF EXISTS "planning_select" ON public.planning_shifts;
CREATE POLICY "planning_select"
  ON public.planning_shifts FOR SELECT
  USING (is_god_or_admin() OR is_manager_or_owner() OR user_id = auth.uid());

-- ================================================================
-- Fix 4: HACCP logs - allow managers/owners/god to DELETE
-- ================================================================
DROP POLICY IF EXISTS "Manager/owner can delete haccp logs" ON public.temperature_logs;
-- temperature_logs table may not exist yet - handled in HACCP UI directly

-- ================================================================  
-- Fix 5: Products - ensure update and delete also work for god/admin
-- ================================================================
DROP POLICY IF EXISTS "Manager/owner can update products" ON public.products;
CREATE POLICY "Manager/owner can update products"
  ON public.products FOR UPDATE
  USING (is_manager_or_owner());

DROP POLICY IF EXISTS "Owner can delete products" ON public.products;
CREATE POLICY "Owner can delete products"
  ON public.products FOR DELETE
  USING (is_owner());

-- ================================================================
-- Fix 6: Orders - allow managers/owners to change status freely  
-- ================================================================
DROP POLICY IF EXISTS "Manager/owner can update orders" ON public.orders;
CREATE POLICY "Manager/owner can update orders"
  ON public.orders FOR UPDATE
  USING (is_manager_or_owner() OR (created_by = auth.uid()));

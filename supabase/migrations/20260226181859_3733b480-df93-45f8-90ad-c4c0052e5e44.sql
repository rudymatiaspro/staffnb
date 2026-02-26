
-- Drop existing DELETE policies on tasks
DROP POLICY IF EXISTS "Manager/owner can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "Owner can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

-- Drop existing UPDATE policies on tasks
DROP POLICY IF EXISTS "Manager/owner can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Manager/owner can update tasks, staff can update own" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;

-- Recreate DELETE: only god/admin/owner
CREATE POLICY "tasks_delete_owner_only"
ON public.tasks
FOR DELETE
USING (is_owner());

-- Recreate UPDATE: god/admin/owner can update any task, staff can update own assigned task (for completing)
CREATE POLICY "tasks_update_owner_or_assigned"
ON public.tasks
FOR UPDATE
USING (is_owner() OR (assigned_user_id = auth.uid()));

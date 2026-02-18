
-- Fix 1: Allow any authenticated user to insert their OWN role during signup
-- (The first user who signs up needs to be able to create their own role)
DROP POLICY IF EXISTS "Owner can manage all roles" ON public.user_roles;

-- Allow users to insert their own role (for signup seeding)
CREATE POLICY "Users can insert own role" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Only owners can update or delete roles
CREATE POLICY "Owner can update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE POLICY "Owner can delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.is_owner());

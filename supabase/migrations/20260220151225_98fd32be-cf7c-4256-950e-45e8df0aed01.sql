
-- Fix infinite recursion in restaurant_members RLS policies

-- Drop the problematic policies
DROP POLICY IF EXISTS "Members can view their restaurant members" ON public.restaurant_members;
DROP POLICY IF EXISTS "Owner can manage their restaurant members" ON public.restaurant_members;

-- Create a security definer function to check restaurant membership without recursion
CREATE OR REPLACE FUNCTION public.is_restaurant_member(_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurant_members
    WHERE user_id = auth.uid()
      AND restaurant_id = _restaurant_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_restaurant_owner(_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurant_members
    WHERE user_id = auth.uid()
      AND restaurant_id = _restaurant_id
      AND role = 'owner'
  );
$$;

-- Recreate policies using the security definer functions (no more self-referencing)
CREATE POLICY "Members can view their restaurant members"
  ON public.restaurant_members
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      is_god_or_admin()
      OR is_restaurant_member(restaurant_id)
    )
  );

CREATE POLICY "Owner can manage their restaurant members"
  ON public.restaurant_members
  FOR ALL
  USING (
    is_god_or_admin()
    OR is_restaurant_owner(restaurant_id)
  )
  WITH CHECK (
    is_god_or_admin()
    OR is_restaurant_owner(restaurant_id)
  );

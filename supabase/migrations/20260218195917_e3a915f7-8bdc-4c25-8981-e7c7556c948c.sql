
-- Fix 1: Tighten the permissive shifts INSERT policy (WITH CHECK (true) → only own user_id)
DROP POLICY IF EXISTS "Anyone authenticated can insert shifts" ON public.shifts;
CREATE POLICY "Authenticated users can insert own shifts" ON public.shifts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_manager_or_owner());

-- Fix 2: Add SET search_path to handle_updated_at to avoid mutable search path warning
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

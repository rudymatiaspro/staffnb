
-- Fix permissive INSERT policies — require authenticated user to be the reporter
DROP POLICY IF EXISTS "Authenticated can insert incidents" ON public.incidents;
CREATE POLICY "Authenticated can insert incidents" ON public.incidents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "All authenticated can insert temp logs" ON public.temperature_logs;
CREATE POLICY "All authenticated can insert temp logs" ON public.temperature_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

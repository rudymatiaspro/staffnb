
-- ① Create audit_logs table (task ⑧)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager/owner can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (is_manager_or_owner());

CREATE POLICY "Authenticated can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Add approved_by columns to orders if not present (task ③)
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS approved_by_chef UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_by_chef_name TEXT,
  ADD COLUMN IF NOT EXISTS approved_by_manager UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_by_manager_name TEXT,
  ADD COLUMN IF NOT EXISTS chef_approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS manager_confirmed_at TIMESTAMP WITH TIME ZONE;

-- Enable realtime on audit_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;

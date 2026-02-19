-- Create availability_requests table
CREATE TABLE public.availability_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL DEFAULT '',
  date date NOT NULL,
  type text NOT NULL DEFAULT 'day_off', -- 'day_off' | 'availability_note'
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  reviewed_by text,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.availability_requests ENABLE ROW LEVEL SECURITY;

-- Staff can insert their own requests
CREATE POLICY "Staff can insert own requests"
ON public.availability_requests
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Staff can view their own requests
CREATE POLICY "Staff can view own requests"
ON public.availability_requests
FOR SELECT
USING (user_id = auth.uid() OR is_manager_or_owner());

-- Staff can delete their own pending requests
CREATE POLICY "Staff can delete own pending requests"
ON public.availability_requests
FOR DELETE
USING (user_id = auth.uid() AND status = 'pending');

-- Managers/owners can update (review) any request
CREATE POLICY "Manager can update requests"
ON public.availability_requests
FOR UPDATE
USING (is_manager_or_owner());

-- Auto-update updated_at
CREATE TRIGGER set_availability_requests_updated_at
BEFORE UPDATE ON public.availability_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.availability_requests;

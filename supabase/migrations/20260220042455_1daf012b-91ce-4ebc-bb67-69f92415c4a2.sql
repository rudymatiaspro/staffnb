
-- Add account status, internal notes, PIN attempt tracking to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'disabled')),
  ADD COLUMN IF NOT EXISTS internal_note text,
  ADD COLUMN IF NOT EXISTS pin_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pin_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS pin_force_reset boolean NOT NULL DEFAULT false;

-- Index for fast lockout queries
CREATE INDEX IF NOT EXISTS idx_profiles_pin_locked ON public.profiles (pin_locked) WHERE pin_locked = true;
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles (status);

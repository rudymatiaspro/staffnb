
-- Add new columns to profiles (IF NOT EXISTS for idempotency)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'fr'
    CHECK (language_preference IN ('fr','en','vi','ja','it','es','pt','de','ar'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN DEFAULT FALSE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{
    "tasks": true,
    "orders": true,
    "stock_alerts": true,
    "incidents": true,
    "planning": true,
    "chat": true
  }';

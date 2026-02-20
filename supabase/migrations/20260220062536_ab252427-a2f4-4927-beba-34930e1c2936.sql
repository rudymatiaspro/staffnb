
-- Step 1: Add 'station' to the user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'station';

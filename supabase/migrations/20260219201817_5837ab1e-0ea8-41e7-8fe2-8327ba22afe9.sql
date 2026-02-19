
-- Remove the foreign key constraint that prevents synthetic PIN-only profiles
-- The app uses a hybrid auth: real Supabase auth for god/admin, PIN-only for staff
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

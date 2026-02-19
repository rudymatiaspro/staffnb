
-- Drop FK on user_roles so synthetic (PIN-only) profiles can have roles
-- Also relax the unique constraint to allow one user → multiple roles if needed
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

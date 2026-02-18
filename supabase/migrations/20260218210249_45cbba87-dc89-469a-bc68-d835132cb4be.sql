-- Add 'god' to the user_role enum if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'god'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'god';
  END IF;
END $$;

-- Delete user_roles for all except GOD and Rudy
DELETE FROM public.user_roles 
WHERE user_id NOT IN (
  '87f4e54d-dfc4-4243-887b-306900bdf98e',
  '5e542a60-5444-4f56-877e-6a5ca6580464'
);

-- Delete profiles for all except GOD and Rudy
DELETE FROM public.profiles
WHERE id NOT IN (
  '87f4e54d-dfc4-4243-887b-306900bdf98e',
  '5e542a60-5444-4f56-877e-6a5ca6580464'
);

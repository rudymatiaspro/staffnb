
-- Étape 1 : Ajouter les nouvelles valeurs d'enum seulement (doit être committé séparément)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'chef';

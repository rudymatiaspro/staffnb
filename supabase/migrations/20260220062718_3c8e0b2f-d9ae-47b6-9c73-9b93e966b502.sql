
-- Ensure is_manager_or_owner includes admin and god explicitly
CREATE OR REPLACE FUNCTION public.is_manager_or_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
    AND role IN ('owner'::user_role, 'manager'::user_role, 'admin'::user_role, 'chef'::user_role, 'god'::user_role)
  );
$function$;

-- Ensure is_owner includes god and admin
CREATE OR REPLACE FUNCTION public.is_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
    AND role IN ('owner'::user_role, 'admin'::user_role, 'god'::user_role)
  );
$function$;
